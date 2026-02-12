from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SignFlow Backend"
    env: str = "dev"

    database_url: str = "postgresql+psycopg://signflow:signflow@postgres:5432/signflow"
    redis_url: str = "redis://redis:6379/0"

    session_ttl_minutes: int = 45

    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "signflow-assets"
    s3_region: str = "us-east-1"
    s3_secure: bool = False
    s3_presign_expire_seconds: int = 900

    model_provider: str = "stub"
    hf_token: str | None = None
    hf_cache_dir: str = "/tmp/hf-cache"
    hf_offline: bool = True
    canary_model_id: str | None = None
    canary_traffic_percent: int = 0
    public_api_base_url: str = "http://localhost:8000"

    auth_enabled: bool = False
    auth_api_keys: str = ""
    auth_admin_api_keys: str = ""

    async_job_processing_enabled: bool = False
    jobs_queue_name: str = "signflow:jobs:inference"
    jobs_dlq_name: str = "signflow:jobs:inference:dlq"
    worker_queue_pop_timeout_seconds: int = 1
    worker_idle_sleep_seconds: float = 1.0
    worker_job_max_retries: int = 2

    worker_expire_interval_seconds: int = 20
    max_request_size_bytes: int = 52428800  # 50 MB for JSON/API requests
    max_upload_size_bytes: int = 2147483648  # 2 GB for media object upload policy hints
    allowed_upload_content_types: str = "video/mp4,video/quicktime,video/x-matroska"

    rate_limit_session_create_per_minute: int = 20
    rate_limit_upload_url_per_minute: int = 60
    rate_limit_job_create_per_minute: int = 30
    rate_limit_export_per_minute: int = 60

    audit_persist_enabled: bool = True
    audit_retention_days: int = 30
    audit_cleanup_batch_size: int = 1000
    worker_audit_cleanup_interval_seconds: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
