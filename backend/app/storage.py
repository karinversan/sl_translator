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


def _presign_client():
    endpoint = settings.s3_public_endpoint_url or settings.s3_endpoint_url
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
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

    origins = [origin.strip() for origin in settings.s3_allowed_origins.split(",") if origin.strip()]
    if not origins:
        return

    try:
        client.put_bucket_cors(
            Bucket=settings.s3_bucket,
            CORSConfiguration={
                "CORSRules": [
                    {
                        "AllowedHeaders": ["*"],
                        "AllowedMethods": ["GET", "PUT", "HEAD"],
                        "AllowedOrigins": origins,
                        "ExposeHeaders": ["ETag"],
                        "MaxAgeSeconds": 3000,
                    }
                ]
            },
        )
    except ClientError:
        # Do not fail startup if CORS update is not allowed by provider policy.
        return


def make_video_object_key(session_id: str, file_name: str) -> str:
    safe_name = Path(file_name).name.replace(" ", "_")
    return f"sessions/{session_id}/uploads/{safe_name}"


def make_export_object_key(job_id: str, export_format: str) -> str:
    ext = export_format.lower()
    return f"jobs/{job_id}/exports/result.{ext}"


def create_upload_url(object_key: str, content_type: str) -> str:
    client = _presign_client()
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
    client = _presign_client()
    try:
        return client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.s3_bucket, "Key": object_key},
            ExpiresIn=settings.s3_presign_expire_seconds,
        )
    except ClientError:
        return f"{settings.public_api_base_url}/v1/storage/mock/{quote(object_key)}"


def object_exists(object_key: str) -> bool:
    client = _s3_client()
    try:
        client.head_object(Bucket=settings.s3_bucket, Key=object_key)
        return True
    except Exception:
        return False


def put_text_object(object_key: str, content: str, content_type: str) -> None:
    client = _s3_client()
    client.put_object(
        Bucket=settings.s3_bucket,
        Key=object_key,
        Body=content.encode("utf-8"),
        ContentType=content_type,
    )


def download_object_file(object_key: str, destination_path: str) -> None:
    client = _s3_client()
    client.download_file(settings.s3_bucket, object_key, destination_path)
