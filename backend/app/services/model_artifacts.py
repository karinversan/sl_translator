import json
import shutil
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import urlopen

from app.config import settings


def _safe_folder_name(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_", "."} else "-" for char in value)


def _local_model_dir(model_id: str, hf_repo: str, hf_revision: str) -> Path:
    cache_root = Path(settings.hf_cache_dir)
    return cache_root / "models" / _safe_folder_name(model_id) / _safe_folder_name(hf_repo) / _safe_folder_name(hf_revision)


def _is_direct_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def _canonical_model_name(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".onnx"):
        return "model.onnx"
    if lower.endswith(".pt") or lower.endswith(".jit") or lower.endswith(".ts") or lower.endswith(".torchscript"):
        return "model.pt"
    return filename


def _find_cached_runtime_model(model_dir: Path) -> Path | None:
    for pattern in ("model.onnx", "model.pt", "model.ts", "*.onnx", "*.pt", "*.jit", "*.ts", "*.torchscript"):
        matches = sorted(path for path in model_dir.glob(pattern) if path.is_file())
        if matches:
            return matches[0]
    return None


def _download_model_from_url(url: str, model_dir: Path) -> None:
    model_dir.mkdir(parents=True, exist_ok=True)
    parsed = urlparse(url)
    raw_name = Path(parsed.path).name or "model.bin"
    canonical_name = _canonical_model_name(raw_name)
    target_path = model_dir / canonical_name

    with urlopen(url, timeout=120) as response, target_path.open("wb") as output_file:
        shutil.copyfileobj(response, output_file)


def _download_optional_file(url: str, target_path: Path) -> bool:
    try:
        with urlopen(url, timeout=60) as response:
            status = getattr(response, "status", 200)
            if status != 200:
                return False
            target_path.parent.mkdir(parents=True, exist_ok=True)
            with target_path.open("wb") as output_file:
                shutil.copyfileobj(response, output_file)
            return True
    except Exception:
        return False


def _companion_candidate_urls(model_url: str) -> list[tuple[str, str]]:
    parsed = urlparse(model_url)
    path = parsed.path
    if "/" not in path:
        return []

    file_name = Path(path).name
    stem = Path(file_name).stem
    parent = path.rsplit("/", 1)[0]

    names = [
        "labels.json",
        "labels.txt",
        "runtime_config.json",
        f"{stem}.labels.json",
        f"{stem}.labels.txt",
        f"{stem}.runtime_config.json",
    ]
    candidates: list[tuple[str, str]] = []
    for name in names:
        url = parsed._replace(path=f"{parent}/{name}").geturl()
        candidates.append((url, name))
    return candidates


def _download_model_and_companions(url: str, model_dir: Path) -> None:
    _download_model_from_url(url, model_dir)
    for companion_url, file_name in _companion_candidate_urls(url):
        _download_optional_file(companion_url, model_dir / file_name)


def upsert_runtime_assets(
    model_id: str,
    hf_repo: str,
    hf_revision: str,
    *,
    labels: list[str] | dict[str, str] | None = None,
    labels_text: str | None = None,
    runtime_config: dict[str, Any] | None = None,
) -> str:
    artifact_path = ensure_model_artifacts(model_id, hf_repo, hf_revision)
    root = Path(artifact_path)
    root.mkdir(parents=True, exist_ok=True)

    if labels is not None:
        (root / "labels.json").write_text(json.dumps(labels, ensure_ascii=True, indent=2), encoding="utf-8")
    if labels_text is not None:
        (root / "labels.txt").write_text(labels_text, encoding="utf-8")
    if runtime_config is not None:
        (root / "runtime_config.json").write_text(
            json.dumps(runtime_config, ensure_ascii=True, indent=2),
            encoding="utf-8",
        )

    return str(root)


def ensure_model_artifacts(model_id: str, hf_repo: str, hf_revision: str) -> str:
    model_dir = _local_model_dir(model_id, hf_repo, hf_revision)

    # Direct model URL support for non-HF registries/object storage.
    if _is_direct_url(hf_repo):
        if settings.hf_offline:
            cached = _find_cached_runtime_model(model_dir)
            if cached:
                return str(model_dir)
            raise RuntimeError("hf_offline_without_cached_artifacts")
        _download_model_and_companions(hf_repo, model_dir)
        return str(model_dir)

    # Local pseudo-repos are always resolved by creating a deterministic placeholder directory.
    if hf_repo.startswith("local/"):
        model_dir.mkdir(parents=True, exist_ok=True)
        marker = model_dir / "MODEL_PLACEHOLDER.txt"
        if not marker.exists():
            marker.write_text(
                "Local placeholder model artifacts.\n"
                f"model_id={model_id}\nrepo={hf_repo}\nrevision={hf_revision}\n",
                encoding="utf-8",
            )
        segments_file = model_dir / "segments.json"
        if not segments_file.exists():
            segments_file.write_text(
                json.dumps(
                    [
                        {
                            "start_sec": 0.0,
                            "end_sec": 3.4,
                            "text": f"[{model_id}] Local artifact segment one.",
                            "confidence": 0.93,
                        },
                        {
                            "start_sec": 3.4,
                            "end_sec": 7.1,
                            "text": "Runtime reads subtitle blocks from model artifacts.",
                            "confidence": 0.9,
                        },
                        {
                            "start_sec": 7.1,
                            "end_sec": 11.0,
                            "text": "Swap the model files and re-sync to update output.",
                            "confidence": 0.88,
                        },
                    ],
                    ensure_ascii=True,
                    indent=2,
                ),
                encoding="utf-8",
            )
        return str(model_dir)

    if settings.hf_offline:
        if model_dir.exists():
            return str(model_dir)
        raise RuntimeError("hf_offline_without_cached_artifacts")

    try:
        from huggingface_hub import snapshot_download
    except ImportError as exc:
        raise RuntimeError("huggingface_hub_not_installed") from exc

    downloaded_path = snapshot_download(
        repo_id=hf_repo,
        revision=hf_revision,
        cache_dir=settings.hf_cache_dir,
        token=settings.hf_token,
    )
    return str(downloaded_path)
