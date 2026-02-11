import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import Base, engine
from app.db import SessionLocal
from app.main import app
from app.models import EditingSession, ExportArtifact, Job, TranscriptSegment
from app.security import rate_limiter


@pytest.fixture(autouse=True)
def reset_test_state():
    rate_limiter.reset()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(delete(ExportArtifact))
        db.execute(delete(TranscriptSegment))
        db.execute(delete(Job))
        db.execute(delete(EditingSession))
        db.commit()
    finally:
        db.close()

    yield

    db = SessionLocal()
    try:
        db.execute(delete(ExportArtifact))
        db.execute(delete(TranscriptSegment))
        db.execute(delete(Job))
        db.execute(delete(EditingSession))
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
