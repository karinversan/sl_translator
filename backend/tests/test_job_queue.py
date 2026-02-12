import httpx

from app.config import settings
from app.services.jobs import process_job_by_id
from app.services.queue import dequeue_inference_job


def _upload_video_via_signed_url(client, session_id: str, file_name: str = "queued.mp4"):
    upload_url_response = client.post(
        f"/v1/sessions/{session_id}/upload-url",
        json={"file_name": file_name, "content_type": "video/mp4", "file_size_bytes": 1024},
    )
    assert upload_url_response.status_code == 200
    upload_data = upload_url_response.json()

    put_response = httpx.put(
        upload_data["upload_url"],
        content=b"queued-video-content",
        headers={"Content-Type": "video/mp4"},
        timeout=10.0,
    )
    assert put_response.status_code == 200


def test_create_job_queues_when_async_enabled(client):
    previous = settings.async_job_processing_enabled
    try:
        settings.async_job_processing_enabled = True

        session_response = client.post("/v1/sessions", json={})
        assert session_response.status_code == 200
        session_id = session_response.json()["id"]

        _upload_video_via_signed_url(client, session_id)

        create_job_response = client.post(f"/v1/sessions/{session_id}/jobs", json={})
        assert create_job_response.status_code == 200
        job_data = create_job_response.json()
        job_id = job_data["id"]
        assert job_data["status"] == "queued"

        segments_before = client.get(f"/v1/jobs/{job_id}/segments")
        assert segments_before.status_code == 200
        assert segments_before.json() == []

        dequeued = dequeue_inference_job(timeout_seconds=1)
        assert dequeued is not None
        assert dequeued.job_id == job_id
        assert process_job_by_id(dequeued.job_id) == "done"

        job_after = client.get(f"/v1/jobs/{job_id}")
        assert job_after.status_code == 200
        assert job_after.json()["status"] == "done"

        segments_after = client.get(f"/v1/jobs/{job_id}/segments")
        assert segments_after.status_code == 200
        assert len(segments_after.json()) > 0
    finally:
        settings.async_job_processing_enabled = previous


def test_create_job_sync_when_async_disabled(client):
    previous = settings.async_job_processing_enabled
    try:
        settings.async_job_processing_enabled = False

        session_response = client.post("/v1/sessions", json={})
        assert session_response.status_code == 200
        session_id = session_response.json()["id"]

        _upload_video_via_signed_url(client, session_id, file_name="sync.mp4")

        create_job_response = client.post(f"/v1/sessions/{session_id}/jobs", json={})
        assert create_job_response.status_code == 200
        assert create_job_response.json()["status"] == "done"

        segments_after = client.get(f"/v1/jobs/{create_job_response.json()['id']}/segments")
        assert segments_after.status_code == 200
        assert len(segments_after.json()) > 0
    finally:
        settings.async_job_processing_enabled = previous
