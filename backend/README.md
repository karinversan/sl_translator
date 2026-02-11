# SignFlow Backend (Phase 1 Skeleton)

This folder contains the first executable backend scaffold aligned with `docs/BACKEND_PLAN.md`.

## Included now

- FastAPI service with `/v1` endpoints for sessions/jobs/segments/exports.
- Postgres-backed persistence via SQLAlchemy.
- 45-minute editing sessions with expiration checks.
- Stub model provider (`ModelProvider` abstraction).
- MinIO presigned upload/download URL integration.
- Worker process to expire sessions/jobs in background.
- Initial unit tests for session TTL logic.

## Run with Docker Compose

From repository root:

```bash
docker compose -f docker-compose.backend.yml up --build
```

API: `http://localhost:8000/v1/health`

## Important notes

- This is phase-1 backend scaffolding, not full production inference.
- The model provider is currently stub-only and can be replaced with HF provider later.
- DB migrations are not added yet; tables are created at startup for bootstrap.

