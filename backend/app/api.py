from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import EditingSession, ExportArtifact, ExportStatus, Job, JobStatus, SessionStatus, TranscriptSegment
from app.providers.base import ProviderSegment
from app.providers.registry import get_model_provider
from app.schemas import (
    ExportCreateRequest,
    ExportResponse,
    JobCreateRequest,
    JobResponse,
    RegenerateRequest,
    SegmentResponse,
    SegmentsPatchRequest,
    SessionCreateRequest,
    SessionResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.sessions import compute_expires_at, ensure_session_active, remaining_seconds, utc_now
from app.storage import create_download_url, create_upload_url, make_export_object_key, make_video_object_key

router = APIRouter(prefix="/v1", tags=["v1"])


def _mark_expired_if_needed(session: EditingSession, db: Session) -> None:
    if session.status == SessionStatus.ACTIVE and utc_now() >= session.expires_at:
        session.status = SessionStatus.EXPIRED
        db.commit()
        db.refresh(session)


def _session_to_response(session: EditingSession, active_job_id: str | None) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        user_id=session.user_id,
        status=session.status.value,
        created_at=session.created_at,
        expires_at=session.expires_at,
        last_activity_at=session.last_activity_at,
        video_object_key=session.video_object_key,
        remaining_seconds=remaining_seconds(session.expires_at),
        active_job_id=active_job_id,
    )


def _job_to_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        session_id=job.session_id,
        status=job.status.value,
        progress=job.progress,
        model_version_id=job.model_version_id,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _segment_to_response(segment: TranscriptSegment) -> SegmentResponse:
    return SegmentResponse(
        id=segment.id,
        order_index=segment.order_index,
        start_sec=segment.start_sec,
        end_sec=segment.end_sec,
        text=segment.text,
        confidence=segment.confidence,
        version=segment.version,
    )


def _load_session_or_404(db: Session, session_id: str) -> EditingSession:
    session = db.get(EditingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session_not_found")
    _mark_expired_if_needed(session, db)
    return session


def _load_job_or_404(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    return job


def _assert_job_session_active(db: Session, job: Job) -> EditingSession:
    session = _load_session_or_404(db, job.session_id)
    ensure_session_active(session)
    return session


@router.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}


@router.post("/sessions", response_model=SessionResponse)
def create_session(payload: SessionCreateRequest, db: Session = Depends(get_db)):
    now = utc_now()
    session = EditingSession(
        user_id=payload.user_id,
        status=SessionStatus.ACTIVE,
        created_at=now,
        expires_at=compute_expires_at(now, settings.session_ttl_minutes),
        last_activity_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_to_response(session, active_job_id=None)


@router.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = _load_session_or_404(db, session_id)
    stmt = select(Job).where(Job.session_id == session.id).order_by(Job.created_at.desc())
    active_job = db.scalars(stmt).first()
    return _session_to_response(session, active_job_id=active_job.id if active_job else None)


@router.post("/sessions/{session_id}/upload-url", response_model=UploadUrlResponse)
def create_session_upload_url(session_id: str, payload: UploadUrlRequest, db: Session = Depends(get_db)):
    session = _load_session_or_404(db, session_id)
    ensure_session_active(session)

    object_key = make_video_object_key(session.id, payload.file_name)
    upload_url = create_upload_url(object_key, payload.content_type)

    session.video_object_key = object_key
    session.last_activity_at = utc_now()
    db.commit()
    return UploadUrlResponse(
        object_key=object_key,
        upload_url=upload_url,
        expires_in_seconds=settings.s3_presign_expire_seconds,
    )


@router.post("/sessions/{session_id}/jobs", response_model=JobResponse)
def create_job_for_session(session_id: str, payload: JobCreateRequest, db: Session = Depends(get_db)):
    session = _load_session_or_404(db, session_id)
    ensure_session_active(session)
    if not session.video_object_key:
        raise HTTPException(status_code=400, detail="video_not_uploaded")

    now = utc_now()
    job = Job(
        session_id=session.id,
        status=JobStatus.PROCESSING,
        progress=15,
        model_version_id=payload.model_version_id or "stub-v0",
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    provider = get_model_provider()
    generated = provider.transcribe(session.video_object_key, options={"session_id": session.id})
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
    db.refresh(job)
    return _job_to_response(job)


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = _load_job_or_404(db, job_id)
    return _job_to_response(job)


@router.get("/jobs/{job_id}/segments", response_model=list[SegmentResponse])
def get_job_segments(job_id: str, db: Session = Depends(get_db)):
    job = _load_job_or_404(db, job_id)
    stmt = select(TranscriptSegment).where(TranscriptSegment.job_id == job.id).order_by(TranscriptSegment.order_index.asc())
    segments = db.scalars(stmt).all()
    return [_segment_to_response(segment) for segment in segments]


@router.patch("/jobs/{job_id}/segments", response_model=list[SegmentResponse])
def patch_job_segments(job_id: str, payload: SegmentsPatchRequest, db: Session = Depends(get_db)):
    job = _load_job_or_404(db, job_id)
    _assert_job_session_active(db, job)

    stmt = select(TranscriptSegment).where(TranscriptSegment.job_id == job.id)
    segments = db.scalars(stmt).all()
    by_id = {segment.id: segment for segment in segments}

    for patch in payload.segments:
        segment = by_id.get(patch.id)
        if not segment:
            continue
        if patch.order_index is not None:
            segment.order_index = patch.order_index
        if patch.start_sec is not None:
            segment.start_sec = patch.start_sec
        if patch.end_sec is not None:
            segment.end_sec = patch.end_sec
        if patch.text is not None:
            segment.text = patch.text
        segment.version += 1

    job.updated_at = utc_now()
    db.commit()

    stmt = select(TranscriptSegment).where(TranscriptSegment.job_id == job.id).order_by(TranscriptSegment.order_index.asc())
    refreshed = db.scalars(stmt).all()
    return [_segment_to_response(segment) for segment in refreshed]


@router.post("/jobs/{job_id}/regenerate", response_model=list[SegmentResponse])
def regenerate_job_segments(job_id: str, payload: RegenerateRequest, db: Session = Depends(get_db)):
    job = _load_job_or_404(db, job_id)
    _assert_job_session_active(db, job)

    stmt = select(TranscriptSegment).where(TranscriptSegment.job_id == job.id).order_by(TranscriptSegment.order_index.asc())
    segments = db.scalars(stmt).all()
    provider = get_model_provider()
    provider_input = [
        ProviderSegment(
            order_index=segment.order_index,
            start_sec=segment.start_sec,
            end_sec=segment.end_sec,
            text=segment.text,
            confidence=segment.confidence,
        )
        for segment in segments
    ]
    regenerated = provider.regenerate(provider_input, options={"style_hint": payload.style_hint})

    for segment, generated in zip(segments, regenerated, strict=False):
        segment.text = generated.text
        segment.confidence = generated.confidence
        segment.version += 1

    job.updated_at = utc_now()
    db.commit()
    return [_segment_to_response(segment) for segment in segments]


@router.post("/jobs/{job_id}/export", response_model=ExportResponse)
def create_export(job_id: str, payload: ExportCreateRequest, db: Session = Depends(get_db)):
    job = _load_job_or_404(db, job_id)
    _assert_job_session_active(db, job)

    object_key = make_export_object_key(job.id, payload.format)
    export = ExportArtifact(
        id=str(uuid4()),
        job_id=job.id,
        format=payload.format,
        status=ExportStatus.DONE,
        object_key=object_key,
        created_at=utc_now(),
    )
    db.add(export)
    db.commit()
    db.refresh(export)

    return ExportResponse(
        id=export.id,
        job_id=export.job_id,
        format=export.format,
        status=export.status.value,
        object_key=export.object_key,
        download_url=create_download_url(export.object_key),
        created_at=export.created_at,
    )


@router.get("/exports/{export_id}", response_model=ExportResponse)
def get_export(export_id: str, db: Session = Depends(get_db)):
    export = db.get(ExportArtifact, export_id)
    if not export:
        raise HTTPException(status_code=404, detail="export_not_found")
    return ExportResponse(
        id=export.id,
        job_id=export.job_id,
        format=export.format,
        status=export.status.value,
        object_key=export.object_key,
        download_url=create_download_url(export.object_key),
        created_at=export.created_at,
    )
