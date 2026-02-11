from pathlib import Path
from urllib.parse import quote

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import settings


def _s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4"),
        use_ssl=settings.s3_secure,
    )


def ensure_bucket_exists() -> None:
    client = _s3_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket)


def make_video_object_key(session_id: str, file_name: str) -> str:
    safe_name = Path(file_name).name.replace(" ", "_")
    return f"sessions/{session_id}/uploads/{safe_name}"


def make_export_object_key(job_id: str, export_format: str) -> str:
    ext = export_format.lower()
    return f"jobs/{job_id}/exports/result.{ext}"


def create_upload_url(object_key: str, content_type: str) -> str:
    client = _s3_client()
    return client.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=settings.s3_presign_expire_seconds,
    )


def create_download_url(object_key: str) -> str:
    client = _s3_client()
    try:
        return client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.s3_bucket, "Key": object_key},
            ExpiresIn=settings.s3_presign_expire_seconds,
        )
    except ClientError:
        return f"{settings.public_api_base_url}/v1/storage/mock/{quote(object_key)}"

