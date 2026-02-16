from pathlib import Path

import pytest

from app.config import settings
from app.providers.hf import HuggingFaceProvider
from app.providers.runtime_classifier import RuntimePrediction


def test_hf_provider_prefers_runtime_predictions_when_enabled(monkeypatch, tmp_path):
    model_dir = tmp_path / "runtime-model"
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "model.onnx").write_bytes(b"fake")

    previous_runtime_enabled = settings.hf_runtime_enabled
    settings.hf_runtime_enabled = True
    try:
        def fake_infer(video_object_key: str, artifact_path: str, framework: str, top_k_override: int | None = None):
            assert video_object_key == "sessions/demo/uploads/demo.mp4"
            assert Path(artifact_path) == model_dir
            assert framework == "onnx"
            assert top_k_override is None
            return [
                RuntimePrediction(label="hello", confidence=0.94, start_sec=0.0, end_sec=0.7),
                RuntimePrediction(label="thanks", confidence=0.87, start_sec=0.7, end_sec=1.6),
            ]

        monkeypatch.setattr("app.providers.hf.infer_gesture_labels", fake_infer)

        provider = HuggingFaceProvider()
        segments = provider.transcribe(
            "sessions/demo/uploads/demo.mp4",
            options={"artifact_path": str(model_dir), "framework": "onnx", "model_name": "mvitv2"},
        )

        assert len(segments) == 2
        assert segments[0].text == "Predicted gesture: hello"
        assert segments[0].confidence == 0.94
        assert segments[0].start_sec == 0.0
        assert segments[0].end_sec == 0.7
    finally:
        settings.hf_runtime_enabled = previous_runtime_enabled


def test_hf_provider_uses_artifact_segments_when_runtime_disabled(tmp_path):
    model_dir = tmp_path / "artifact-model"
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "segments.json").write_text(
        '[{"start_sec": 0.0, "end_sec": 1.0, "text": "artifact-line", "confidence": 0.91}]',
        encoding="utf-8",
    )

    previous_runtime_enabled = settings.hf_runtime_enabled
    settings.hf_runtime_enabled = False
    try:
        provider = HuggingFaceProvider()
        segments = provider.transcribe(
            "sessions/demo/uploads/demo.mp4",
            options={"artifact_path": str(model_dir), "framework": "onnx", "model_name": "mvitv2"},
        )

        assert len(segments) == 1
        assert segments[0].text == "artifact-line"
        assert segments[0].confidence == 0.91
    finally:
        settings.hf_runtime_enabled = previous_runtime_enabled


def test_hf_provider_runtime_failure_raises_when_strict(monkeypatch, tmp_path):
    model_dir = tmp_path / "strict-runtime-model"
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "model.onnx").write_bytes(b"fake")

    previous_runtime_enabled = settings.hf_runtime_enabled
    previous_runtime_strict = settings.hf_runtime_strict
    settings.hf_runtime_enabled = True
    settings.hf_runtime_strict = True
    try:
        def fake_infer(*_args, **_kwargs):
            raise RuntimeError("shape_mismatch")

        monkeypatch.setattr("app.providers.hf.infer_gesture_labels", fake_infer)
        provider = HuggingFaceProvider()

        with pytest.raises(RuntimeError, match="runtime_inference_failed"):
            provider.transcribe(
                "sessions/demo/uploads/demo.mp4",
                options={"artifact_path": str(model_dir), "framework": "onnx", "model_name": "mvitv2"},
            )
    finally:
        settings.hf_runtime_enabled = previous_runtime_enabled
        settings.hf_runtime_strict = previous_runtime_strict


def test_hf_provider_runtime_failure_fallback_when_non_strict(monkeypatch, tmp_path):
    model_dir = tmp_path / "non-strict-runtime-model"
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "model.onnx").write_bytes(b"fake")
    (model_dir / "segments.json").write_text(
        '[{"start_sec": 0.0, "end_sec": 1.0, "text": "artifact-fallback", "confidence": 0.89}]',
        encoding="utf-8",
    )

    previous_runtime_enabled = settings.hf_runtime_enabled
    previous_runtime_strict = settings.hf_runtime_strict
    settings.hf_runtime_enabled = True
    settings.hf_runtime_strict = False
    try:
        def fake_infer(*_args, **_kwargs):
            raise RuntimeError("shape_mismatch")

        monkeypatch.setattr("app.providers.hf.infer_gesture_labels", fake_infer)
        provider = HuggingFaceProvider()
        segments = provider.transcribe(
            "sessions/demo/uploads/demo.mp4",
            options={"artifact_path": str(model_dir), "framework": "onnx", "model_name": "mvitv2"},
        )

        assert len(segments) == 1
        assert segments[0].text == "artifact-fallback"
    finally:
        settings.hf_runtime_enabled = previous_runtime_enabled
        settings.hf_runtime_strict = previous_runtime_strict
