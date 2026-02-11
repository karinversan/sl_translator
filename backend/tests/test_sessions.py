from datetime import datetime, timezone

from app.services.sessions import compute_expires_at, remaining_seconds


def test_compute_expires_at_45_minutes():
    now = datetime(2026, 2, 11, 12, 0, 0, tzinfo=timezone.utc)
    expires = compute_expires_at(now, 45)
    assert expires == datetime(2026, 2, 11, 12, 45, 0, tzinfo=timezone.utc)


def test_remaining_seconds_is_never_negative():
    now = datetime(2026, 2, 11, 12, 0, 0, tzinfo=timezone.utc)
    expired = datetime(2026, 2, 11, 11, 59, 0, tzinfo=timezone.utc)
    assert remaining_seconds(expired, now=now) == 0

