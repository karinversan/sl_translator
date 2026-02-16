import json
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, Callable

from app.storage import download_object_file

DEFAULT_MEAN = [0.485, 0.456, 0.406]
DEFAULT_STD = [0.229, 0.224, 0.225]


@dataclass
class RuntimePrediction:
    label: str
    confidence: float
    start_sec: float
    end_sec: float


@dataclass
class WindowPrediction:
    start_sec: float
    end_sec: float
    class_index: int
    confidence: float
    probabilities: Any


@dataclass
class VideoMetadata:
    fps: float
    frame_count: int
    duration_sec: float


def infer_gesture_labels(
    video_object_key: str,
    artifact_path: str,
    framework: str,
    top_k_override: int | None = None,
    runtime_config_overrides: dict[str, Any] | None = None,
) -> list[RuntimePrediction]:
    with TemporaryDirectory(prefix="signflow-runtime-") as tmp_dir:
        local_video_path = Path(tmp_dir) / "input.mp4"
        download_object_file(video_object_key, str(local_video_path))
        return infer_gesture_labels_from_file(
            video_path=str(local_video_path),
            artifact_path=artifact_path,
            framework=framework,
            top_k_override=top_k_override,
            runtime_config_overrides=runtime_config_overrides,
        )


def infer_gesture_labels_from_file(
    video_path: str,
    artifact_path: str,
    framework: str,
    top_k_override: int | None = None,
    runtime_config_overrides: dict[str, Any] | None = None,
) -> list[RuntimePrediction]:
    root = Path(artifact_path)
    if not root.exists():
        raise RuntimeError("artifact_path_not_found")

    config = _load_runtime_config(root)
    if runtime_config_overrides:
        config = {**config, **runtime_config_overrides}
    model_path = _resolve_model_path(root, framework)
    labels = _load_labels(root)

    num_frames = _as_int(config.get("num_frames"), fallback=32, minimum=4, maximum=128)
    window_size_frames = _as_int(config.get("window_size_frames"), fallback=num_frames, minimum=4, maximum=256)
    stride_frames = _as_int(
        config.get("stride_frames"),
        fallback=max(1, window_size_frames // 4),
        minimum=1,
        maximum=window_size_frames,
    )
    input_size = _as_int(config.get("input_size"), fallback=224, minimum=112, maximum=512)
    mean = _as_float_list(config.get("mean"), fallback=DEFAULT_MEAN)
    std = _as_float_list(config.get("std"), fallback=DEFAULT_STD)
    normalize_to_unit = _resolve_normalize_to_unit(config=config, mean=mean, std=std)
    top_k = top_k_override if top_k_override is not None else _as_int(config.get("top_k"), fallback=3, minimum=1, maximum=10)

    runner = _create_model_runner(model_path=model_path, framework=framework)
    windows, metadata = _collect_window_predictions(
        video_path=Path(video_path),
        runner=runner,
        num_frames=num_frames,
        window_size_frames=window_size_frames,
        stride_frames=stride_frames,
        input_size=input_size,
        mean=mean,
        std=std,
        normalize_to_unit=normalize_to_unit,
    )

    if not windows:
        return []

    mode = str(config.get("decoder_mode", "auto")).strip().lower()
    long_video_threshold_sec = _as_float(config.get("long_video_threshold_sec"), fallback=18.0, minimum=1.0, maximum=3600.0)

    use_ctc = mode == "ctc" or (mode == "auto" and metadata.duration_sec >= long_video_threshold_sec)
    if use_ctc:
        predictions = _decode_ctc_windows(windows=windows, labels=labels, config=config)
    else:
        predictions = _decode_realtime_windows(windows=windows, labels=labels, config=config)

    if predictions:
        return predictions
    return _fallback_top_windows(windows=windows, labels=labels, top_k=top_k)


def _load_runtime_config(root: Path) -> dict[str, Any]:
    cfg_path = root / "runtime_config.json"
    if not cfg_path.exists():
        return {}
    try:
        raw = json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _resolve_model_path(root: Path, framework: str) -> Path:
    normalized = framework.lower()
    if normalized == "onnx":
        model_file = _find_first(root, ["model.onnx", "*.onnx"])
    elif normalized in {"torchscript", "torch"}:
        model_file = _find_first(root, ["model.ts", "model.torchscript", "model.pt", "*.torchscript", "*.jit", "*.pt"])
    else:
        raise RuntimeError(f"unsupported_framework:{framework}")

    if not model_file:
        raise RuntimeError(f"runtime_model_file_not_found:{framework}")
    return model_file


def _find_first(root: Path, patterns: list[str]) -> Path | None:
    for pattern in patterns:
        matches = sorted(path for path in root.rglob(pattern) if path.is_file())
        if matches:
            return matches[0]
    return None


def _load_labels(root: Path) -> list[str]:
    labels_json = root / "labels.json"
    if labels_json.exists():
        try:
            raw = json.loads(labels_json.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                values = [str(item).strip() for item in raw if str(item).strip()]
                if values:
                    return values
            if isinstance(raw, dict):
                entries: list[tuple[str, str]] = []
                for key, value in raw.items():
                    label = str(value).strip()
                    if label:
                        entries.append((str(key), label))
                if entries:
                    entries.sort(key=lambda item: _sortable_key(item[0]))
                    return [value for _, value in entries]
        except Exception:
            pass

    labels_txt = root / "labels.txt"
    if labels_txt.exists():
        values = [line.strip() for line in labels_txt.read_text(encoding="utf-8").splitlines() if line.strip()]
        if values:
            return values
    return []


def _sortable_key(raw: str) -> tuple[int, str]:
    try:
        return (0, f"{int(raw):09d}")
    except ValueError:
        return (1, raw)


def _create_model_runner(model_path: Path, framework: str) -> Callable[[Any], Any]:
    normalized = framework.lower()
    if normalized == "onnx":
        return _create_onnx_runner(model_path)
    if normalized in {"torchscript", "torch"}:
        return _create_torchscript_runner(model_path)
    raise RuntimeError(f"unsupported_framework:{framework}")


def _create_onnx_runner(model_path: Path) -> Callable[[Any], Any]:
    try:
        import numpy as np
        import onnxruntime as ort
    except ImportError as exc:
        raise RuntimeError("onnxruntime_not_installed") from exc

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    if not inputs:
        raise RuntimeError("onnx_input_not_found")
    input_meta = inputs[0]

    def run(clip):
        prepared = _prepare_tensor_for_shape(clip, input_meta.shape)
        outputs = session.run(None, {input_meta.name: prepared})
        if not outputs:
            raise RuntimeError("onnx_empty_outputs")
        return _to_logits_1d(outputs[0], np_module=np)

    return run


def _create_torchscript_runner(model_path: Path) -> Callable[[Any], Any]:
    try:
        import numpy as np
        import torch
    except ImportError as exc:
        raise RuntimeError("torch_not_installed") from exc

    model = torch.jit.load(str(model_path), map_location="cpu")
    model.eval()

    def run(clip):
        tensor = torch.from_numpy(clip).float()
        attempts: list[tuple[str, Any]] = [
            ("ncthw", tensor),
            ("ntchw", tensor.permute(0, 2, 1, 3, 4).contiguous()),
            ("nviews_ncthw", tensor.unsqueeze(1)),
            ("nviews_ntchw", tensor.permute(0, 2, 1, 3, 4).contiguous().unsqueeze(1)),
            ("nviews_ntchw_alt", tensor.unsqueeze(1).permute(0, 1, 3, 2, 4, 5).contiguous()),
        ]

        outputs = None
        last_error: Exception | None = None
        tried_shapes: set[tuple[int, ...]] = set()
        with torch.inference_mode():
            for _, candidate in attempts:
                candidate_shape = tuple(int(dim) for dim in candidate.shape)
                if candidate_shape in tried_shapes:
                    continue
                tried_shapes.add(candidate_shape)
                try:
                    outputs = model(candidate)
                    break
                except Exception as exc:
                    last_error = exc

        if outputs is None:
            if last_error is None:
                raise RuntimeError("torchscript_inference_failed")
            raise RuntimeError(f"torchscript_inference_failed:{last_error}") from last_error

        if isinstance(outputs, (list, tuple)) and outputs:
            outputs = outputs[0]
        if isinstance(outputs, dict) and outputs:
            outputs = next(iter(outputs.values()))
        if hasattr(outputs, "detach"):
            outputs = outputs.detach().cpu().numpy()
        return _to_logits_1d(outputs, np_module=np)

    return run


def _collect_window_predictions(
    *,
    video_path: Path,
    runner: Callable[[Any], Any],
    num_frames: int,
    window_size_frames: int,
    stride_frames: int,
    input_size: int,
    mean: list[float],
    std: list[float],
    normalize_to_unit: bool,
) -> tuple[list[WindowPrediction], VideoMetadata]:
    try:
        import cv2  # type: ignore[import-untyped]
        import numpy as np
    except ImportError as exc:
        raise RuntimeError("opencv_or_numpy_not_installed") from exc

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise RuntimeError("video_open_failed")

    try:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        if fps <= 1e-3:
            fps = 25.0

        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count <= 0:
            clip = _read_single_clip_unknown(
                capture=capture,
                num_frames=num_frames,
                input_size=input_size,
                mean=mean,
                std=std,
                normalize_to_unit=normalize_to_unit,
            )
            logits = runner(clip)
            probabilities = _softmax(logits)
            class_index = int(np.argmax(probabilities))
            confidence = float(probabilities[class_index])
            duration_sec = round(num_frames / fps, 3)
            window = WindowPrediction(
                start_sec=0.0,
                end_sec=max(duration_sec, 0.1),
                class_index=class_index,
                confidence=confidence,
                probabilities=probabilities,
            )
            return [window], VideoMetadata(fps=fps, frame_count=0, duration_sec=window.end_sec)

        starts = list(range(0, max(frame_count - window_size_frames + 1, 1), stride_frames))
        tail_start = max(frame_count - window_size_frames, 0)
        if not starts:
            starts = [0]
        elif starts[-1] != tail_start:
            starts.append(tail_start)

        windows: list[WindowPrediction] = []
        for start in starts:
            end = min(start + window_size_frames, frame_count)
            clip = _read_clip_for_window(
                capture=capture,
                start_frame=start,
                end_frame=end,
                num_frames=num_frames,
                input_size=input_size,
                mean=mean,
                std=std,
                normalize_to_unit=normalize_to_unit,
            )
            logits = runner(clip)
            probabilities = _softmax(logits)
            class_index = int(np.argmax(probabilities))
            confidence = float(probabilities[class_index])
            start_sec = round(start / fps, 3)
            end_sec = round(max(end / fps, start_sec + (1.0 / fps)), 3)
            windows.append(
                WindowPrediction(
                    start_sec=start_sec,
                    end_sec=end_sec,
                    class_index=class_index,
                    confidence=confidence,
                    probabilities=probabilities,
                )
            )

        duration_sec = round(frame_count / fps, 3)
        return windows, VideoMetadata(fps=fps, frame_count=frame_count, duration_sec=duration_sec)
    finally:
        capture.release()


def _read_single_clip_unknown(
    *,
    capture,
    num_frames: int,
    input_size: int,
    mean: list[float],
    std: list[float],
    normalize_to_unit: bool,
):
    raw_frames = []
    while len(raw_frames) < num_frames:
        ok, frame = capture.read()
        if not ok or frame is None:
            break
        raw_frames.append(frame)

    if not raw_frames:
        raise RuntimeError("video_decode_failed")
    while len(raw_frames) < num_frames:
        raw_frames.append(raw_frames[-1])
    return _frames_to_clip(
        raw_frames=raw_frames[:num_frames],
        input_size=input_size,
        mean=mean,
        std=std,
        normalize_to_unit=normalize_to_unit,
    )


def _read_clip_for_window(
    *,
    capture,
    start_frame: int,
    end_frame: int,
    num_frames: int,
    input_size: int,
    mean: list[float],
    std: list[float],
    normalize_to_unit: bool,
):
    import cv2  # type: ignore[import-untyped]
    import numpy as np

    if end_frame <= start_frame:
        end_frame = start_frame + 1

    if end_frame - start_frame == 1:
        indices = [start_frame] * num_frames
    else:
        indices = np.linspace(start_frame, end_frame - 1, num_frames).round().astype(int).tolist()

    raw_frames = []
    for index in indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, float(index))
        ok, frame = capture.read()
        if ok and frame is not None:
            raw_frames.append(frame)

    if not raw_frames:
        raise RuntimeError("window_decode_failed")
    while len(raw_frames) < num_frames:
        raw_frames.append(raw_frames[-1])
    return _frames_to_clip(
        raw_frames=raw_frames[:num_frames],
        input_size=input_size,
        mean=mean,
        std=std,
        normalize_to_unit=normalize_to_unit,
    )


def _frames_to_clip(
    *,
    raw_frames: list[Any],
    input_size: int,
    mean: list[float],
    std: list[float],
    normalize_to_unit: bool,
):
    import numpy as np

    frames = [
        _preprocess_frame(
            frame,
            input_size=input_size,
            mean=mean,
            std=std,
            normalize_to_unit=normalize_to_unit,
        )
        for frame in raw_frames
    ]
    clip = np.stack(frames, axis=0)  # [T, H, W, C]
    clip = np.transpose(clip, (3, 0, 1, 2))  # [C, T, H, W]
    return np.expand_dims(clip, axis=0).astype(np.float32)  # [N, C, T, H, W]


def _preprocess_frame(
    frame,
    *,
    input_size: int,
    mean: list[float],
    std: list[float],
    normalize_to_unit: bool,
):
    import cv2  # type: ignore[import-untyped]
    import numpy as np

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (input_size, input_size), interpolation=cv2.INTER_LINEAR)
    normalized = resized.astype(np.float32)
    if normalize_to_unit:
        normalized = normalized / 255.0
    mean_arr = np.asarray(mean, dtype=np.float32).reshape(1, 1, 3)
    std_arr = np.asarray(std, dtype=np.float32).reshape(1, 1, 3)
    return (normalized - mean_arr) / std_arr


def _resolve_normalize_to_unit(*, config: dict[str, Any], mean: list[float], std: list[float]) -> bool:
    explicit = config.get("normalize_to_unit")
    if isinstance(explicit, bool):
        return explicit
    if _max_abs(mean) > 3.0 or _max_abs(std) > 3.0:
        return False
    return True


def _max_abs(values: list[float]) -> float:
    if not values:
        return 0.0
    return max(abs(item) for item in values)


def _decode_realtime_windows(
    *,
    windows: list[WindowPrediction],
    labels: list[str],
    config: dict[str, Any],
) -> list[RuntimePrediction]:
    min_confidence = _as_float(config.get("realtime_min_confidence"), fallback=0.2, minimum=0.01, maximum=1.0)
    min_duration_sec = _as_float(config.get("realtime_min_duration_sec"), fallback=0.15, minimum=0.0, maximum=30.0)
    max_gap_sec = _as_float(config.get("realtime_max_gap_sec"), fallback=0.35, minimum=0.0, maximum=5.0)

    segments: list[RuntimePrediction] = []
    current_idx: int | None = None
    current_start = 0.0
    current_end = 0.0
    current_confidences: list[float] = []

    def close_current():
        nonlocal current_idx, current_start, current_end, current_confidences
        if current_idx is None or not current_confidences:
            current_idx = None
            current_confidences = []
            return
        duration = current_end - current_start
        avg_confidence = sum(current_confidences) / len(current_confidences)
        if duration >= min_duration_sec:
            label = _label_for_index(current_idx, labels)
            segments.append(
                RuntimePrediction(
                    label=label,
                    confidence=round(avg_confidence, 4),
                    start_sec=round(current_start, 3),
                    end_sec=round(current_end, 3),
                )
            )
        current_idx = None
        current_confidences = []

    for window in windows:
        if window.confidence < min_confidence:
            close_current()
            continue

        if current_idx is not None:
            gap = max(0.0, window.start_sec - current_end)
            if window.class_index == current_idx and gap <= max_gap_sec:
                current_end = window.end_sec
                current_confidences.append(window.confidence)
                continue

        close_current()
        current_idx = window.class_index
        current_start = window.start_sec
        current_end = window.end_sec
        current_confidences = [window.confidence]

    close_current()
    return segments


def _decode_ctc_windows(
    *,
    windows: list[WindowPrediction],
    labels: list[str],
    config: dict[str, Any],
) -> list[RuntimePrediction]:
    blank_index = _resolve_ctc_blank_index(labels=labels, config=config)
    blank_threshold = _as_float(config.get("ctc_blank_threshold"), fallback=0.12, minimum=0.0, maximum=1.0)
    min_token_confidence = _as_float(config.get("ctc_min_token_confidence"), fallback=0.16, minimum=0.01, maximum=1.0)
    min_duration_sec = _as_float(config.get("ctc_min_duration_sec"), fallback=0.12, minimum=0.0, maximum=30.0)

    tokens: list[RuntimePrediction] = []
    prev_symbol = -1
    current_idx: int | None = None
    current_start = 0.0
    current_end = 0.0
    current_confidences: list[float] = []

    def close_current():
        nonlocal current_idx, current_start, current_end, current_confidences
        if current_idx is None or not current_confidences:
            current_idx = None
            current_confidences = []
            return
        avg_confidence = sum(current_confidences) / len(current_confidences)
        duration = current_end - current_start
        if avg_confidence >= min_token_confidence and duration >= min_duration_sec:
            tokens.append(
                RuntimePrediction(
                    label=_label_for_index(current_idx, labels),
                    confidence=round(avg_confidence, 4),
                    start_sec=round(current_start, 3),
                    end_sec=round(current_end, 3),
                )
            )
        current_idx = None
        current_confidences = []

    for window in windows:
        is_pseudo_blank = window.confidence < blank_threshold
        is_blank_class = blank_index is not None and window.class_index == blank_index
        symbol = -1 if (is_pseudo_blank or is_blank_class) else window.class_index

        if symbol != prev_symbol:
            close_current()
            if symbol != -1:
                current_idx = symbol
                current_start = window.start_sec
                current_end = window.end_sec
                current_confidences = [window.confidence]
            prev_symbol = symbol
            continue

        if symbol != -1 and current_idx is not None:
            current_end = window.end_sec
            current_confidences.append(window.confidence)

    close_current()
    return tokens


def _resolve_ctc_blank_index(labels: list[str], config: dict[str, Any]) -> int | None:
    explicit = config.get("ctc_blank_index")
    if explicit is not None:
        try:
            value = int(explicit)
            if value >= 0:
                return value
        except (TypeError, ValueError):
            pass

    blank_aliases = {"<blank>", "blank", "[blank]", "ctc_blank", "_"}
    for idx, label in enumerate(labels):
        if label.strip().lower() in blank_aliases:
            return idx
    return None


def _fallback_top_windows(
    *,
    windows: list[WindowPrediction],
    labels: list[str],
    top_k: int,
) -> list[RuntimePrediction]:
    resolved_top_k = max(1, min(top_k, 10))
    result: list[RuntimePrediction] = []
    seen_indices: set[int] = set()
    for window in sorted(windows, key=lambda item: item.confidence, reverse=True):
        if window.class_index in seen_indices:
            continue
        seen_indices.add(window.class_index)
        result.append(
            RuntimePrediction(
                label=_label_for_index(window.class_index, labels),
                confidence=round(window.confidence, 4),
                start_sec=round(window.start_sec, 3),
                end_sec=round(window.end_sec, 3),
            )
        )
        if len(result) >= resolved_top_k:
            break
    return result


def _label_for_index(index: int, labels: list[str]) -> str:
    if 0 <= index < len(labels):
        return labels[index]
    return f"class_{index}"


def _prepare_tensor_for_shape(clip, input_shape):
    import numpy as np

    if not isinstance(input_shape, list):
        return clip
    if len(input_shape) == 5:
        channel_dim = _shape_dim(input_shape[1])
        temporal_dim = _shape_dim(input_shape[2])
        if channel_dim == 3:
            return clip
        if temporal_dim == 3:
            return np.transpose(clip, (0, 2, 1, 3, 4))
        return clip
    if len(input_shape) == 4:
        center_index = clip.shape[2] // 2
        return clip[:, :, center_index, :, :]
    return clip


def _shape_dim(value: Any) -> int | None:
    return value if isinstance(value, int) else None


def _to_logits_1d(value, *, np_module):
    arr = np_module.asarray(value, dtype=np_module.float32)
    if arr.ndim == 0:
        raise RuntimeError("invalid_model_output")
    if arr.ndim == 1:
        return arr
    flattened = arr.reshape(arr.shape[0], -1)
    return flattened[0]


def _softmax(logits):
    import numpy as np

    shifted = logits - np.max(logits)
    exponent = np.exp(shifted)
    denominator = float(np.sum(exponent))
    if denominator <= 0:
        return np.ones_like(logits, dtype=np.float32) / max(len(logits), 1)
    return exponent / denominator


def _as_int(value: Any, *, fallback: int, minimum: int, maximum: int) -> int:
    try:
        resolved = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(resolved, maximum))


def _as_float(value: Any, *, fallback: float, minimum: float, maximum: float) -> float:
    try:
        resolved = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(resolved, maximum))


def _as_float_list(value: Any, *, fallback: list[float]) -> list[float]:
    if not isinstance(value, list) or len(value) != 3:
        return fallback
    parsed: list[float] = []
    for item in value:
        try:
            parsed.append(float(item))
        except (TypeError, ValueError):
            return fallback
    return parsed
