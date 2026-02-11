from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.models import EditingSession, SessionStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def compute_expires_at(now: datetime, ttl_minutes: int) -> datetime:
    return now + timedelta(minutes=ttl_minutes)


def remaining_seconds(expires_at: datetime, now: datetime | None = None) -> int:
    current = now or utc_now()
    return max(int((expires_at - current).total_seconds()), 0)


def is_session_expired(session: EditingSession, now: datetime | None = None) -> bool:
    current = now or utc_now()
    return current >= session.expires_at or session.status == SessionStatus.EXPIRED


def ensure_session_active(session: EditingSession, now: datetime | None = None) -> None:
    if is_session_expired(session, now):
        raise HTTPException(status_code=410, detail="session_expired")

