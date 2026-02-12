import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import Base, engine
from app.db import SessionLocal
from app.main import app
from app.models import AuditEvent, EditingSession, ExportArtifact, Job, ModelVersion, TranscriptSegment
from app.security import rate_limiter
from app.services.model_versions import ensure_default_model_version
from app.services.queue import clear_inference_queue


@pytest.fixture(autouse=True)
def reset_test_state():
    rate_limiter.reset()
    clear_inference_queue()
    engine.dispose()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    engine.dispose()
    db = SessionLocal()
    try:
        db.execute(delete(ExportArtifact))
        db.execute(delete(TranscriptSegment))
        db.execute(delete(Job))
        db.execute(delete(ModelVersion))
        db.execute(delete(AuditEvent))
        db.execute(delete(EditingSession))
        db.commit()
        ensure_default_model_version(db)
    finally:
        db.close()
    clear_inference_queue()

    yield

    db = SessionLocal()
    try:
        db.execute(delete(ExportArtifact))
        db.execute(delete(TranscriptSegment))
        db.execute(delete(Job))
        db.execute(delete(ModelVersion))
        db.execute(delete(AuditEvent))
        db.execute(delete(EditingSession))
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
