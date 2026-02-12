import json
from dataclasses import dataclass
from typing import Any

import redis

from app.config import settings


@dataclass
class QueueJobMessage:
    job_id: str
    attempt: int = 0


def redis_client() -> redis.Redis:
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def _serialize_message(message: QueueJobMessage) -> str:
    return json.dumps({"job_id": message.job_id, "attempt": message.attempt})


def _deserialize_message(raw: str) -> QueueJobMessage:
    try:
        payload: dict[str, Any] = json.loads(raw)
        return QueueJobMessage(job_id=str(payload["job_id"]), attempt=int(payload.get("attempt", 0)))
    except Exception:
        # Backward compatibility for legacy queue payloads (plain job_id string).
        return QueueJobMessage(job_id=raw, attempt=0)


def enqueue_inference_job(job_id: str, attempt: int = 0) -> None:
    client = redis_client()
    client.rpush(settings.jobs_queue_name, _serialize_message(QueueJobMessage(job_id=job_id, attempt=attempt)))


def dequeue_inference_job(timeout_seconds: int | None = None) -> QueueJobMessage | None:
    client = redis_client()
    timeout = timeout_seconds if timeout_seconds is not None else settings.worker_queue_pop_timeout_seconds
    item = client.blpop(settings.jobs_queue_name, timeout=max(timeout, 1))
    if not item:
        return None
    _, value = item
    return _deserialize_message(value)


def requeue_inference_job(message: QueueJobMessage) -> None:
    enqueue_inference_job(message.job_id, message.attempt)


def push_dead_letter(message: QueueJobMessage, reason: str) -> None:
    client = redis_client()
    payload = {
        "job_id": message.job_id,
        "attempt": message.attempt,
        "reason": reason,
    }
    client.rpush(settings.jobs_dlq_name, json.dumps(payload))


def clear_inference_queue() -> None:
    client = redis_client()
    client.delete(settings.jobs_queue_name)
    client.delete(settings.jobs_dlq_name)
