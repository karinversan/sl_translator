import json
import logging
from datetime import timedelta
from typing import Any
from uuid import uuid4

from fastapi import Request
from sqlalchemy import delete, select

from app.config import settings
from app.db import SessionLocal
from app.models import AuditEvent
from app.services.sessions import utc_now


logger = logging.getLogger("signflow.audit")


def _safe_json(payload: dict[str, Any]) -> str:
    try:
        return json.dumps(payload, ensure_ascii=True, sort_keys=True, default=str)
    except Exception:
        return "{}"


def audit_log(action: str, request: Request | None = None, **fields: Any) -> None:
    base_payload: dict[str, Any] = {
        "ts": utc_now().isoformat(),
        "action": action,
        **fields,
    }
    request_id: str | None = None
    path: str | None = None
    method: str | None = None
    client_ip: str | None = None
    if request is not None:
        request_id = getattr(request.state, "request_id", None)
        path = request.url.path
        method = request.method
        client_ip = request.client.host if request.client else None
        base_payload["request_id"] = request_id
        base_payload["path"] = path
        base_payload["method"] = method
        base_payload["client_ip"] = client_ip

    logger.info(_safe_json(base_payload))

    if not settings.audit_persist_enabled:
        return

    try:
        with SessionLocal() as db:
            user_id = fields.get("user_id")
            db.add(
                AuditEvent(
                    id=str(uuid4()),
                    created_at=utc_now(),
                    action=action,
                    user_id=str(user_id) if user_id is not None else None,
                    request_id=request_id,
                    path=path,
                    method=method,
                    client_ip=client_ip,
                    payload_json=_safe_json(base_payload),
                )
            )
            db.commit()
    except Exception as exc:
        logger.warning("audit_persist_failed: %s", str(exc))


def prune_old_audit_events() -> int:
    if settings.audit_retention_days <= 0:
        return 0

    cutoff = utc_now() - timedelta(days=settings.audit_retention_days)
    with SessionLocal() as db:
        old_ids = db.scalars(
            select(AuditEvent.id)
            .where(AuditEvent.created_at < cutoff)
            .order_by(AuditEvent.created_at.asc())
            .limit(settings.audit_cleanup_batch_size)
        ).all()
        if not old_ids:
            return 0

        db.execute(delete(AuditEvent).where(AuditEvent.id.in_(old_ids)))
        db.commit()
        return len(old_ids)
