from pathlib import Path
from time import perf_counter
from typing import Literal

from sqlalchemy import delete

from app.db import SessionLocal
from app.metrics import observe_job_processing
from app.models import Job, JobStatus, ModelVersion, SessionStatus, TranscriptSegment
from app.providers.registry import get_model_provider
from app.services.model_artifacts import ensure_model_artifacts
from app.services.sessions import utc_now

JobProcessResult = Literal["done", "failed", "expired", "not_found"]


def process_job_by_id(job_id: str) -> JobProcessResult:
    started_at = perf_counter()

    def _finish(outcome: JobProcessResult) -> JobProcessResult:
        observe_job_processing(outcome, perf_counter() - started_at)
        return outcome

    with SessionLocal() as db:
        job = db.get(Job, job_id)
        if not job:
            return _finish("not_found")

        session = job.session
        now = utc_now()
        if session.status != SessionStatus.ACTIVE or session.expires_at <= now:
            session.status = SessionStatus.EXPIRED
            job.status = JobStatus.EXPIRED
            job.updated_at = now
            db.commit()
            return _finish("expired")

        if not session.video_object_key:
            job.status = JobStatus.FAILED
            job.updated_at = now
            db.commit()
            return _finish("failed")

        job.status = JobStatus.PROCESSING
        job.progress = max(job.progress, 20)
        job.updated_at = now
        db.commit()

        provider = get_model_provider()
        model: ModelVersion | None = None
        model_name: str | None = None
        model_repo: str | None = None
        model_revision: str | None = None
        model_framework: str | None = None
        model_artifact_path: str | None = None
        if job.model_version_id:
            model = db.get(ModelVersion, job.model_version_id)
            if model:
                model_name = model.name
                model_repo = model.hf_repo
                model_revision = model.hf_revision
                model_framework = model.framework
                if model.artifact_path and Path(model.artifact_path).exists():
                    model_artifact_path = model.artifact_path

        try:
            if provider.name == "huggingface" and model_repo and model_revision and not model_artifact_path:
                model_artifact_path = ensure_model_artifacts(job.model_version_id or "unknown", model_repo, model_revision)
                if model:
                    sync_time = utc_now()
                    model.artifact_path = model_artifact_path
                    model.downloaded_at = sync_time
                    model.last_sync_error = None
                    model.updated_at = sync_time

            generated = provider.transcribe(
                session.video_object_key,
                options={
                    "session_id": session.id,
                    "model_id": job.model_version_id,
                    "model_name": model_name,
                    "hf_repo": model_repo,
                    "hf_revision": model_revision,
                    "framework": model_framework,
                    "artifact_path": model_artifact_path,
                },
            )
        except Exception as exc:
            if model:
                model.last_sync_error = str(exc)
                model.updated_at = utc_now()
            job.status = JobStatus.FAILED
            job.updated_at = utc_now()
            db.commit()
            return _finish("failed")

        db.execute(delete(TranscriptSegment).where(TranscriptSegment.job_id == job.id))
        for item in generated:
            db.add(
                TranscriptSegment(
                    job_id=job.id,
                    order_index=item.order_index,
                    start_sec=item.start_sec,
                    end_sec=item.end_sec,
                    text=item.text,
                    confidence=item.confidence,
                    version=1,
                )
            )

        job.status = JobStatus.DONE
        job.progress = 100
        job.updated_at = utc_now()
        session.last_activity_at = utc_now()
        db.commit()
        return _finish("done")
