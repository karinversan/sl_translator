from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    user_id: str | None = None


class SessionResponse(BaseModel):
    id: str
    user_id: str | None
    status: str
    created_at: datetime
    expires_at: datetime
    last_activity_at: datetime
    video_object_key: str | None
    remaining_seconds: int
    active_job_id: str | None


class UploadUrlRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="video/mp4", min_length=1, max_length=120)


class UploadUrlResponse(BaseModel):
    object_key: str
    upload_url: str
    expires_in_seconds: int


class JobCreateRequest(BaseModel):
    model_version_id: str | None = None


class JobResponse(BaseModel):
    id: str
    session_id: str
    status: str
    progress: int
    model_version_id: str | None
    created_at: datetime
    updated_at: datetime


class SegmentResponse(BaseModel):
    id: str
    order_index: int
    start_sec: float
    end_sec: float
    text: str
    confidence: float
    version: int


class SegmentPatchItem(BaseModel):
    id: str
    order_index: int | None = None
    start_sec: float | None = None
    end_sec: float | None = None
    text: str | None = None


class SegmentsPatchRequest(BaseModel):
    segments: list[SegmentPatchItem]


class RegenerateRequest(BaseModel):
    style_hint: str | None = None


class ExportCreateRequest(BaseModel):
    format: Literal["SRT", "VTT", "TXT", "AUDIO", "VIDEO"]


class ExportResponse(BaseModel):
    id: str
    job_id: str
    format: str
    status: str
    object_key: str
    download_url: str
    created_at: datetime

