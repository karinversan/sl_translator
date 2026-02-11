import time

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import EditingSession, Job, JobStatus, SessionStatus
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


def main():
    print("worker started")
    interval = max(settings.worker_expire_interval_seconds, 5)
    while True:
        count = expire_sessions()
        if count:
            print(f"expired {count} sessions")
        time.sleep(interval)


if __name__ == "__main__":
    main()

