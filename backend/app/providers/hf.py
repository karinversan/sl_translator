import json
import logging
from pathlib import Path

from app.config import settings
from app.providers.base import ModelProvider, ProviderSegment
from app.providers.runtime_classifier import infer_gesture_labels
from app.services.model_artifacts import ensure_model_artifacts
from app.services.grammar import correct_russian_tokens

logger = logging.getLogger(__name__)


class HuggingFaceProvider(ModelProvider):
    name = "huggingface"

    def health(self) -> dict:
        return {
            "provider": self.name,
            "status": "ok" if not settings.hf_offline else "degraded",
            "offline_mode": settings.hf_offline,
            "runtime_enabled": settings.hf_runtime_enabled,
            "runtime_strict": settings.hf_runtime_strict,
            "grammar_enabled": settings.hf_grammar_enabled,
            "grammar_service_configured": bool(settings.hf_grammar_service_url.strip()),
            "message": (
                "HF provider ready. Runtime stage uses gesture classifier; optional second stage can run "
                "Russian grammar correction via local CPU service."
            ),
        }

    def _segments_from_artifacts(self, artifact_path: str | None) -> list[ProviderSegment] | None:
        if not artifact_path:
            return None

        root = Path(artifact_path)
        if not root.exists():
            return None

        segments_json = root / "segments.json"
        if segments_json.exists():
            raw = json.loads(segments_json.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                segments: list[ProviderSegment] = []
                for idx, item in enumerate(raw):
                    if not isinstance(item, dict):
                        continue
                    text = str(item.get("text", "")).strip()
                    if not text:
                        continue
                    start_sec = float(item.get("start_sec", idx * 3.5))
                    end_sec = float(item.get("end_sec", start_sec + 3.5))
                    confidence = float(item.get("confidence", 0.85))
                    segments.append(
                        ProviderSegment(
                            order_index=idx,
                            start_sec=round(start_sec, 3),
                            end_sec=round(end_sec, 3),
                            text=text,
                            confidence=max(min(confidence, 1.0), 0.01),
                        )
                    )
                if segments:
                    return segments

        transcript_txt = root / "transcript.txt"
        if transcript_txt.exists():
            lines = [line.strip() for line in transcript_txt.read_text(encoding="utf-8").splitlines() if line.strip()]
            if lines:
                segments = []
                cursor = 0.0
                for idx, line in enumerate(lines):
                    end_sec = cursor + 3.5
                    segments.append(
                        ProviderSegment(
                            order_index=idx,
                            start_sec=round(cursor, 3),
                            end_sec=round(end_sec, 3),
                            text=line,
                            confidence=0.84,
                        )
                    )
                    cursor = end_sec
                return segments

        return None

    def _runtime_segments(
        self,
        *,
        video_object_key: str,
        artifact_path: str | None,
        framework: str | None,
    ) -> list[ProviderSegment] | None:
        if not settings.hf_runtime_enabled:
            return None
        if not artifact_path or not framework:
            if settings.hf_runtime_strict and framework in {"onnx", "torchscript", "torch"}:
                raise RuntimeError("runtime_artifacts_missing")
            return None

        normalized_framework = framework.lower()
        if normalized_framework not in {"onnx", "torchscript", "torch"}:
            return None

        try:
            predictions = infer_gesture_labels(
                video_object_key=video_object_key,
                artifact_path=artifact_path,
                framework=normalized_framework,
            )
        except Exception as exc:
            logger.warning("runtime inference failed: framework=%s error=%s", normalized_framework, exc)
            if settings.hf_runtime_strict:
                raise RuntimeError(f"runtime_inference_failed:{exc}") from exc
            return None

        if not predictions:
            if settings.hf_runtime_strict:
                raise RuntimeError("runtime_empty_predictions")
            return None

        segments: list[ProviderSegment] = []
        for idx, prediction in enumerate(predictions):
            start_sec = round(max(prediction.start_sec, 0.0), 3)
            end_sec = round(max(prediction.end_sec, start_sec + 0.05), 3)
            segments.append(
                ProviderSegment(
                    order_index=idx,
                    start_sec=start_sec,
                    end_sec=end_sec,
                    text=f"Predicted gesture: {prediction.label}",
                    confidence=max(min(prediction.confidence, 1.0), 0.01),
                )
            )
        return segments

    def _apply_optional_russian_grammar(
        self, segments: list[ProviderSegment], options: dict | None = None
    ) -> list[ProviderSegment]:
        if not settings.hf_grammar_enabled or not segments:
            return segments

        output_language = ""
        if options and isinstance(options.get("output_language"), str):
            output_language = options["output_language"].strip().lower()
        if output_language and output_language not in {"ru", "russian", "русский"}:
            return segments

        prefix = "Predicted gesture:"
        tokens = []
        for segment in segments:
            text = segment.text.strip()
            if text.lower().startswith(prefix.lower()):
                text = text[len(prefix) :].strip()
            tokens.append(text)

        corrected = correct_russian_tokens(tokens)
        if len(corrected) != len(tokens):
            return segments

        updated: list[ProviderSegment] = []
        for segment, token in zip(segments, corrected, strict=False):
            if segment.text.lower().startswith(prefix.lower()):
                next_text = f"{prefix} {token}"
            else:
                next_text = token
            updated.append(
                ProviderSegment(
                    order_index=segment.order_index,
                    start_sec=segment.start_sec,
                    end_sec=segment.end_sec,
                    text=next_text,
                    confidence=segment.confidence,
                )
            )
        return updated

    def transcribe(self, video_object_key: str, options: dict | None = None) -> list[ProviderSegment]:
        model_label = "hf-model"
        artifact_path: str | None = None
        hf_repo: str | None = None
        hf_revision: str = "main"
        framework: str | None = None
        if options and isinstance(options.get("model_name"), str):
            model_label = options["model_name"]
        elif options and isinstance(options.get("model_id"), str):
            model_label = options["model_id"]
        if options and isinstance(options.get("artifact_path"), str):
            artifact_path = options["artifact_path"]
        if options and isinstance(options.get("hf_repo"), str):
            hf_repo = options["hf_repo"]
        if options and isinstance(options.get("hf_revision"), str):
            hf_revision = options["hf_revision"]
        if options and isinstance(options.get("framework"), str):
            framework = options["framework"]

        if not artifact_path and hf_repo:
            artifact_path = ensure_model_artifacts(model_label, hf_repo, hf_revision)

        runtime_segments = self._runtime_segments(
            video_object_key=video_object_key,
            artifact_path=artifact_path,
            framework=framework,
        )
        if runtime_segments:
            return self._apply_optional_russian_grammar(runtime_segments, options)

        artifact_segments = self._segments_from_artifacts(artifact_path)
        if artifact_segments:
            return artifact_segments

        fallback_texts = [
            f"[{model_label}] HF fallback transcript path.",
            "No artifact transcript files were found, so baseline output is used.",
            "Provide runtime model artifacts (model.onnx/model.ts + labels) or segments.json/transcript.txt.",
        ]
        segments: list[ProviderSegment] = []
        cursor = 0.0
        for idx, line in enumerate(fallback_texts):
            duration = 4.0
            segments.append(
                ProviderSegment(
                    order_index=idx,
                    start_sec=round(cursor, 3),
                    end_sec=round(cursor + duration, 3),
                    text=line,
                    confidence=0.76 - (idx * 0.03),
                )
            )
            cursor += duration
        return segments

    def regenerate(self, segments: list[ProviderSegment], options: dict | None = None) -> list[ProviderSegment]:
        return [
            ProviderSegment(
                order_index=segment.order_index,
                start_sec=segment.start_sec,
                end_sec=segment.end_sec,
                text=f"{segment.text} [hf-pass]",
                confidence=max(segment.confidence - 0.02, 0.5),
            )
            for segment in segments
        ]
