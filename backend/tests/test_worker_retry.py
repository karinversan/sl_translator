from app.services.queue import QueueJobMessage
from worker import main as worker_main


def test_handle_dequeued_job_requeues_failed_before_limit(monkeypatch):
    monkeypatch.setattr(worker_main, "process_job_by_id", lambda job_id: "failed")
    requeued: list[QueueJobMessage] = []
    dead_letters: list[tuple[QueueJobMessage, str]] = []

    monkeypatch.setattr(worker_main, "requeue_inference_job", lambda message: requeued.append(message))
    monkeypatch.setattr(worker_main, "push_dead_letter", lambda message, reason: dead_letters.append((message, reason)))
    monkeypatch.setattr(worker_main.settings, "worker_job_max_retries", 2)

    outcome = worker_main.handle_dequeued_job(QueueJobMessage(job_id="job-1", attempt=1))
    assert outcome == "retry"
    assert len(requeued) == 1
    assert requeued[0].job_id == "job-1"
    assert requeued[0].attempt == 2
    assert dead_letters == []


def test_handle_dequeued_job_moves_to_dead_letter_after_max_retries(monkeypatch):
    monkeypatch.setattr(worker_main, "process_job_by_id", lambda job_id: "failed")
    requeued: list[QueueJobMessage] = []
    dead_letters: list[tuple[QueueJobMessage, str]] = []

    monkeypatch.setattr(worker_main, "requeue_inference_job", lambda message: requeued.append(message))
    monkeypatch.setattr(worker_main, "push_dead_letter", lambda message, reason: dead_letters.append((message, reason)))
    monkeypatch.setattr(worker_main.settings, "worker_job_max_retries", 2)

    outcome = worker_main.handle_dequeued_job(QueueJobMessage(job_id="job-2", attempt=2))
    assert outcome == "dead_letter"
    assert requeued == []
    assert len(dead_letters) == 1
    assert dead_letters[0][0].job_id == "job-2"
    assert dead_letters[0][1] == "max_retries_exceeded"


def test_handle_dequeued_job_pushes_expired_to_dead_letter(monkeypatch):
    monkeypatch.setattr(worker_main, "process_job_by_id", lambda job_id: "expired")
    dead_letters: list[tuple[QueueJobMessage, str]] = []

    monkeypatch.setattr(worker_main, "requeue_inference_job", lambda message: None)
    monkeypatch.setattr(worker_main, "push_dead_letter", lambda message, reason: dead_letters.append((message, reason)))

    outcome = worker_main.handle_dequeued_job(QueueJobMessage(job_id="job-3", attempt=0))
    assert outcome == "expired"
    assert len(dead_letters) == 1
    assert dead_letters[0][1] == "expired"
