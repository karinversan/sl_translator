import time
from time import monotonic

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import EditingSession, Job, JobStatus, SessionStatus
from app.services.audit import prune_old_audit_events
from app.services.jobs import process_job_by_id
from app.services.queue import QueueJobMessage, dequeue_inference_job, push_dead_letter, requeue_inference_job
from app.services.sessions import utc_now


def expire_sessions() -> int:
    with SessionLocal() as db:
        now = utc_now()
        stmt = select(EditingSession).where(
            EditingSession.status == SessionStatus.ACTIVE,
            EditingSession.expires_at <= now,
        )
        sessions = db.scalars(stmt).all()
        if not sessions:
            return 0

        for session in sessions:
            session.status = SessionStatus.EXPIRED
            jobs_stmt = select(Job).where(
                Job.session_id == session.id,
                Job.status.in_([JobStatus.QUEUED, JobStatus.PROCESSING]),
            )
            for job in db.scalars(jobs_stmt).all():
                job.status = JobStatus.EXPIRED
                job.updated_at = now

        db.commit()
        return len(sessions)


def handle_dequeued_job(message: QueueJobMessage) -> str:
    result = process_job_by_id(message.job_id)
    if result == "done":
        return "done"

    if result == "failed":
        if message.attempt < settings.worker_job_max_retries:
            requeue_inference_job(QueueJobMessage(job_id=message.job_id, attempt=message.attempt + 1))
            return "retry"
        push_dead_letter(message, reason="max_retries_exceeded")
        return "dead_letter"

    push_dead_letter(message, reason=result)
    return result


def main():
    print("worker started")
    interval = max(settings.worker_expire_interval_seconds, 5)
    audit_interval = max(settings.worker_audit_cleanup_interval_seconds, 30)
    next_expire_check = monotonic()
    next_audit_cleanup = monotonic()
    while True:
        now = monotonic()
        if now >= next_expire_check:
            count = expire_sessions()
            if count:
                print(f"expired {count} sessions")
            next_expire_check = now + interval

        if now >= next_audit_cleanup:
            deleted = prune_old_audit_events()
            if deleted:
                print(f"deleted {deleted} old audit events")
            next_audit_cleanup = now + audit_interval

        message = dequeue_inference_job(settings.worker_queue_pop_timeout_seconds)
        if message:
            outcome = handle_dequeued_job(message)
            print(f"processed job={message.job_id} attempt={message.attempt} outcome={outcome}")
            continue

        time.sleep(max(settings.worker_idle_sleep_seconds, 0.1))


if __name__ == "__main__":
    main()
