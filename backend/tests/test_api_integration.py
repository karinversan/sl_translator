from datetime import timedelta

import boto3
import httpx
from botocore.client import Config

from app.config import settings
from app.db import SessionLocal
from app.models import EditingSession
from app.services.sessions import utc_now


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
        use_ssl=settings.s3_secure,
    )


def test_health_includes_provider_metadata(client):
    health_response = client.get("/v1/health")
    assert health_response.status_code == 200
    payload = health_response.json()
    assert payload["status"] == "ok"
    assert "provider" in payload
    assert "provider" in payload["provider"]
    assert "routing" in payload
    assert health_response.headers.get("x-content-type-options") == "nosniff"
    assert health_response.headers.get("x-frame-options") == "DENY"
    assert health_response.headers.get("x-request-id")


def test_request_id_is_echoed(client):
    request_id = "int-test-request-id"
    response = client.get("/v1/health", headers={"x-request-id": request_id})
    assert response.status_code == 200
    assert response.headers.get("x-request-id") == request_id


def test_upload_to_job_to_export_flow(client):
    session_response = client.post("/v1/sessions", json={"user_id": "int-test"})
    assert session_response.status_code == 200
    session_id = session_response.json()["id"]

    upload_url_response = client.post(
        f"/v1/sessions/{session_id}/upload-url",
        json={
            "file_name": "integration-demo.mp4",
            "content_type": "video/mp4",
            "file_size_bytes": 1024,
        },
    )
    assert upload_url_response.status_code == 200
    upload_data = upload_url_response.json()
    object_key = upload_data["object_key"]
    upload_url = upload_data["upload_url"]

    put_response = httpx.put(
        upload_url,
        content=b"fake-video-content",
        headers={"Content-Type": "video/mp4"},
        timeout=10.0,
    )
    assert put_response.status_code == 200

    create_job_response = client.post(f"/v1/sessions/{session_id}/jobs", json={})
    assert create_job_response.status_code == 200
    job_id = create_job_response.json()["id"]

    segments_response = client.get(f"/v1/jobs/{job_id}/segments")
    assert segments_response.status_code == 200
    segments = segments_response.json()
    assert len(segments) > 0

    first_segment = segments[0]
    patched_text = "Edited integration subtitle line."
    patch_response = client.patch(
        f"/v1/jobs/{job_id}/segments",
        json={"segments": [{"id": first_segment["id"], "text": patched_text}]},
    )
    assert patch_response.status_code == 200

    export_response = client.post(f"/v1/jobs/{job_id}/export", json={"format": "SRT"})
    assert export_response.status_code == 200
    export_data = export_response.json()

    s3 = _s3_client()
    uploaded_object = s3.get_object(Bucket=settings.s3_bucket, Key=object_key)
    assert uploaded_object["ContentLength"] > 0

    export_object = s3.get_object(Bucket=settings.s3_bucket, Key=export_data["object_key"])
    srt_content = export_object["Body"].read().decode("utf-8")
    assert patched_text in srt_content


def test_session_requires_actual_uploaded_object_before_job_creation(client):
    session_response = client.post("/v1/sessions", json={"user_id": "int-test"})
    assert session_response.status_code == 200
    session_id = session_response.json()["id"]

    upload_url_response = client.post(
        f"/v1/sessions/{session_id}/upload-url",
        json={
            "file_name": "missing-upload.mp4",
            "content_type": "video/mp4",
            "file_size_bytes": 1024,
        },
    )
    assert upload_url_response.status_code == 200
    object_key = upload_url_response.json()["object_key"]

    session_after_upload_url = client.get(f"/v1/sessions/{session_id}")
    assert session_after_upload_url.status_code == 200
    payload = session_after_upload_url.json()
    assert payload["video_object_key"] == object_key
    assert payload["video_ready"] is False
    assert payload["video_download_url"] is None

    create_job_response = client.post(f"/v1/sessions/{session_id}/jobs", json={})
    assert create_job_response.status_code == 400
    assert create_job_response.json()["detail"] == "video_not_uploaded"


def test_model_registry_create_and_activate_flow(client):
    active_response = client.get("/v1/models/active")
    assert active_response.status_code == 200
    initial_active_id = active_response.json()["id"]

    create_model_response = client.post(
        "/v1/models",
        json={
            "name": "hf-canary",
            "hf_repo": "org/signflow-model",
            "hf_revision": "v2",
            "framework": "onnx",
            "activate": False,
        },
    )
    assert create_model_response.status_code == 200
    created_model_id = create_model_response.json()["id"]
    assert create_model_response.json()["is_active"] is False

    activate_response = client.post(f"/v1/models/{created_model_id}/activate")
    assert activate_response.status_code == 200
    assert activate_response.json()["is_active"] is True
    assert activate_response.json()["status"] == "active"

    active_after_response = client.get("/v1/models/active")
    assert active_after_response.status_code == 200
    assert active_after_response.json()["id"] == created_model_id
    assert active_after_response.json()["id"] != initial_active_id

    list_response = client.get("/v1/models")
    assert list_response.status_code == 200
    assert len(list_response.json()) >= 2


def test_model_sync_local_repo_updates_artifact_metadata(client):
    create_model_response = client.post(
        "/v1/models",
        json={
            "name": "hf-local",
            "hf_repo": "local/demo-repo",
            "hf_revision": "main",
            "framework": "onnx",
            "activate": False,
        },
    )
    assert create_model_response.status_code == 200
    model_id = create_model_response.json()["id"]
    assert create_model_response.json()["artifact_path"] is None

    sync_response = client.post(f"/v1/models/{model_id}/sync")
    assert sync_response.status_code == 200
    payload = sync_response.json()
    assert payload["artifact_path"] is not None
    assert payload["downloaded_at"] is not None
    assert payload["last_sync_error"] is None


def test_hf_provider_job_flow_with_local_synced_model(client):
    previous_provider = settings.model_provider
    settings.model_provider = "hf"
    try:
        create_model_response = client.post(
            "/v1/models",
            json={
                "name": "hf-runtime-local",
                "hf_repo": "local/runtime-model",
                "hf_revision": "main",
                "framework": "onnx",
                "activate": True,
            },
        )
        assert create_model_response.status_code == 200
        model_id = create_model_response.json()["id"]

        sync_response = client.post(f"/v1/models/{model_id}/sync")
        assert sync_response.status_code == 200

        session_response = client.post("/v1/sessions", json={})
        assert session_response.status_code == 200
        session_id = session_response.json()["id"]

        upload_url_response = client.post(
            f"/v1/sessions/{session_id}/upload-url",
            json={
                "file_name": "hf-flow.mp4",
                "content_type": "video/mp4",
                "file_size_bytes": 2048,
            },
        )
        assert upload_url_response.status_code == 200
        upload_data = upload_url_response.json()
        put_response = httpx.put(
            upload_data["upload_url"],
            content=b"hf-runtime-video",
            headers={"Content-Type": "video/mp4"},
            timeout=10.0,
        )
        assert put_response.status_code == 200

        create_job_response = client.post(f"/v1/sessions/{session_id}/jobs", json={"model_version_id": model_id})
        assert create_job_response.status_code == 200
        job_id = create_job_response.json()["id"]

        segments_response = client.get(f"/v1/jobs/{job_id}/segments")
        assert segments_response.status_code == 200
        segments = segments_response.json()
        assert len(segments) > 0
        assert model_id in segments[0]["text"]
    finally:
        settings.model_provider = previous_provider


def test_live_predict_uses_runtime_classifier(client, monkeypatch):
    create_model_response = client.post(
        "/v1/models",
        json={
            "name": "live-runtime-local",
            "hf_repo": "local/live-runtime",
            "hf_revision": "main",
            "framework": "torchscript",
            "activate": True,
        },
    )
    assert create_model_response.status_code == 200
    model_id = create_model_response.json()["id"]

    sync_response = client.post(f"/v1/models/{model_id}/sync")
    assert sync_response.status_code == 200

    class _Prediction:
        def __init__(self, label: str, confidence: float, start_sec: float, end_sec: float):
            self.label = label
            self.confidence = confidence
            self.start_sec = start_sec
            self.end_sec = end_sec

    def fake_runtime_predict(
        *,
        video_path: str,
        artifact_path: str,
        framework: str,
        top_k_override: int | None = None,
        runtime_config_overrides: dict | None = None,
    ):
        assert video_path
        assert artifact_path
        assert framework == "torchscript"
        assert top_k_override == 2
        assert runtime_config_overrides == {"decoder_mode": "realtime"}
        return [_Prediction(label="hello", confidence=0.91, start_sec=0.0, end_sec=0.7)]

    monkeypatch.setattr("app.api.infer_gesture_labels_from_file", fake_runtime_predict)

    response = client.post(
        "/v1/live/predict",
        files={"file": ("chunk.webm", b"live-webm", "video/webm")},
        data={"model_version_id": model_id, "decoder_mode": "realtime", "top_k": "2"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["model_version_id"] == model_id
    assert payload["framework"] == "torchscript"
    assert len(payload["predictions"]) == 1
    assert payload["predictions"][0]["label"] == "hello"
    assert payload["predictions"][0]["text"] == "Predicted gesture: hello"


def test_job_creation_uses_canary_routing_when_enabled(client):
    previous_canary_id = settings.canary_model_id
    previous_canary_percent = settings.canary_traffic_percent
    previous_provider = settings.model_provider
    settings.model_provider = "stub"
    try:
        active_response = client.get("/v1/models/active")
        assert active_response.status_code == 200
        active_id = active_response.json()["id"]

        canary_response = client.post(
            "/v1/models",
            json={
                "name": "routing-canary",
                "hf_repo": "local/routing-canary",
                "hf_revision": "main",
                "framework": "onnx",
                "activate": False,
            },
        )
        assert canary_response.status_code == 200
        canary_id = canary_response.json()["id"]

        settings.canary_model_id = canary_id
        settings.canary_traffic_percent = 100

        session_response = client.post("/v1/sessions", json={})
        assert session_response.status_code == 200
        session_id = session_response.json()["id"]

        upload_url_response = client.post(
            f"/v1/sessions/{session_id}/upload-url",
            json={
                "file_name": "canary-route.mp4",
                "content_type": "video/mp4",
                "file_size_bytes": 1024,
            },
        )
        assert upload_url_response.status_code == 200

        upload_data = upload_url_response.json()
        put_response = httpx.put(
            upload_data["upload_url"],
            content=b"canary-routing-test",
            headers={"Content-Type": "video/mp4"},
            timeout=10.0,
        )
        assert put_response.status_code == 200

        job_response = client.post(f"/v1/sessions/{session_id}/jobs", json={})
        assert job_response.status_code == 200
        assert job_response.json()["model_version_id"] == canary_id
        assert job_response.json()["model_version_id"] != active_id
    finally:
        settings.canary_model_id = previous_canary_id
        settings.canary_traffic_percent = previous_canary_percent
        settings.model_provider = previous_provider


def test_expired_session_blocks_mutating_actions(client):
    session_response = client.post("/v1/sessions", json={})
    assert session_response.status_code == 200
    session_id = session_response.json()["id"]

    db = SessionLocal()
    try:
        session = db.get(EditingSession, session_id)
        assert session is not None
        session.expires_at = utc_now() - timedelta(seconds=5)
        db.commit()
    finally:
        db.close()

    upload_url_response = client.post(
        f"/v1/sessions/{session_id}/upload-url",
        json={"file_name": "expired.mp4", "content_type": "video/mp4", "file_size_bytes": 256},
    )
    assert upload_url_response.status_code == 410
    assert upload_url_response.json()["detail"] == "session_expired"


def test_upload_url_rejects_invalid_media_type(client):
    session_response = client.post("/v1/sessions", json={})
    assert session_response.status_code == 200
    session_id = session_response.json()["id"]

    upload_url_response = client.post(
        f"/v1/sessions/{session_id}/upload-url",
        json={
            "file_name": "bad-file.bin",
            "content_type": "application/octet-stream",
            "file_size_bytes": 1024,
        },
    )
    assert upload_url_response.status_code == 415
    assert upload_url_response.json()["detail"] == "unsupported_content_type"
