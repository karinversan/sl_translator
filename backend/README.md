# SignFlow Backend (Phase 1 Skeleton)

This folder contains the first executable backend scaffold aligned with `docs/BACKEND_PLAN.md`.

## Included now

- FastAPI service with `/v1` endpoints for sessions/jobs/segments/exports.
- Postgres-backed persistence via SQLAlchemy.
- 45-minute editing sessions with expiration checks.
- Session restore flow with frontend lock when session expires.
- Stub model provider (`ModelProvider` abstraction).
- HF provider skeleton (`MODEL_PROVIDER=hf`) for future Hugging Face runtime wiring.
- Model version registry API (`/v1/models`) with active model switching.
- MinIO presigned upload/download URL integration.
- Upload request validation (MIME + size guard).
- Per-endpoint API rate limits (in-memory baseline).
- Worker process to expire sessions/jobs in background.
- Unit tests for session TTL, upload validation, and rate limiting.
- Integration tests for API flow with Postgres + MinIO.
- Alembic migration scaffold (`alembic/`).

## Run with Docker Compose

From repository root:

```bash
docker compose -f docker-compose.backend.yml up --build
```

API: `http://localhost:8000/v1/health`

## Migrations

Run inside backend container (or local venv):

```bash
alembic upgrade head
```

## Important notes

- This is phase-1 backend scaffolding, not full production inference.
- The model provider is currently stub-only and can be replaced with HF provider later.
- API still creates tables at startup for local bootstrap; use Alembic for explicit migration flow.
