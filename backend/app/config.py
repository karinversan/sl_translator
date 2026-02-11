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
    public_api_base_url: str = "http://localhost:8000"

    worker_expire_interval_seconds: int = 20

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

