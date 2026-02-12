from datetime import timedelta

from app.config import settings
from app.db import SessionLocal
from app.models import AuditEvent
from app.services.audit import prune_old_audit_events
from app.services.sessions import utc_now


def test_auth_requires_api_key_and_user_id_when_enabled(client):
    previous_enabled = settings.auth_enabled
    previous_keys = settings.auth_api_keys
    previous_admin_keys = settings.auth_admin_api_keys
    try:
        settings.auth_enabled = True
        settings.auth_api_keys = "user-key-1"
        settings.auth_admin_api_keys = "admin-key-1"

        no_auth = client.post("/v1/sessions", json={})
        assert no_auth.status_code == 401

        no_user = client.post("/v1/sessions", json={}, headers={"x-api-key": "user-key-1"})
        assert no_user.status_code == 400

        ok = client.post(
            "/v1/sessions",
            json={},
            headers={"x-api-key": "user-key-1", "x-user-id": "user-a"},
        )
        assert ok.status_code == 200
        assert ok.json()["user_id"] == "user-a"
    finally:
        settings.auth_enabled = previous_enabled
        settings.auth_api_keys = previous_keys
        settings.auth_admin_api_keys = previous_admin_keys


def test_auth_blocks_access_to_foreign_session(client):
    previous_enabled = settings.auth_enabled
    previous_keys = settings.auth_api_keys
    previous_admin_keys = settings.auth_admin_api_keys
    try:
        settings.auth_enabled = True
        settings.auth_api_keys = "user-key-1,user-key-2"
        settings.auth_admin_api_keys = "admin-key-1"

        created = client.post(
            "/v1/sessions",
            json={},
            headers={"x-api-key": "user-key-1", "x-user-id": "owner-a"},
        )
        assert created.status_code == 200
        session_id = created.json()["id"]

        forbidden = client.get(
            f"/v1/sessions/{session_id}",
            headers={"x-api-key": "user-key-2", "x-user-id": "owner-b"},
        )
        assert forbidden.status_code == 403
    finally:
        settings.auth_enabled = previous_enabled
        settings.auth_api_keys = previous_keys
        settings.auth_admin_api_keys = previous_admin_keys


def test_model_mutation_requires_admin_when_auth_enabled(client):
    previous_enabled = settings.auth_enabled
    previous_keys = settings.auth_api_keys
    previous_admin_keys = settings.auth_admin_api_keys
    try:
        settings.auth_enabled = True
        settings.auth_api_keys = "user-key-1"
        settings.auth_admin_api_keys = "admin-key-1"

        forbidden = client.post(
            "/v1/models",
            json={
                "name": "blocked-model",
                "hf_repo": "local/blocked",
                "hf_revision": "main",
                "framework": "onnx",
            },
            headers={"x-api-key": "user-key-1", "x-user-id": "u1"},
        )
        assert forbidden.status_code == 403

        allowed = client.post(
            "/v1/models",
            json={
                "name": "admin-model",
                "hf_repo": "local/admin-model",
                "hf_revision": "main",
                "framework": "onnx",
            },
            headers={"x-api-key": "admin-key-1"},
        )
        assert allowed.status_code == 200
    finally:
        settings.auth_enabled = previous_enabled
        settings.auth_api_keys = previous_keys
        settings.auth_admin_api_keys = previous_admin_keys


def test_audit_events_are_persisted_for_session_create(client):
    previous_audit_enabled = settings.audit_persist_enabled
    try:
        settings.audit_persist_enabled = True
        response = client.post("/v1/sessions", json={"user_id": "audit-user"})
        assert response.status_code == 200

        with SessionLocal() as db:
            events = db.query(AuditEvent).all()
            assert len(events) > 0
            assert any(event.action == "session.create" for event in events)
    finally:
        settings.audit_persist_enabled = previous_audit_enabled


def test_audit_retention_prunes_old_records():
    previous_audit_enabled = settings.audit_persist_enabled
    previous_retention_days = settings.audit_retention_days
    previous_batch_size = settings.audit_cleanup_batch_size
    try:
        settings.audit_persist_enabled = True
        settings.audit_retention_days = 30
        settings.audit_cleanup_batch_size = 100

        now = utc_now()
        with SessionLocal() as db:
            db.add(
                AuditEvent(
                    created_at=now - timedelta(days=40),
                    action="old.event",
                    payload_json="{}",
                )
            )
            db.add(
                AuditEvent(
                    created_at=now - timedelta(days=5),
                    action="new.event",
                    payload_json="{}",
                )
            )
            db.commit()

        deleted = prune_old_audit_events()
        assert deleted >= 1

        with SessionLocal() as db:
            actions = [event.action for event in db.query(AuditEvent).all()]
            assert "old.event" not in actions
            assert "new.event" in actions
    finally:
        settings.audit_persist_enabled = previous_audit_enabled
        settings.audit_retention_days = previous_retention_days
        settings.audit_cleanup_batch_size = previous_batch_size
