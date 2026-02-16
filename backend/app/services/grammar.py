import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def normalize_tokens(tokens: list[str]) -> list[str]:
    return [token.strip() for token in tokens if token and token.strip()]


def correct_russian_tokens(tokens: list[str]) -> list[str]:
    cleaned = normalize_tokens(tokens)
    if not cleaned:
        return cleaned

    service_url = settings.hf_grammar_service_url.strip()
    if not service_url:
        return cleaned

    payload = {"language": "ru", "tokens": cleaned}
    try:
        with httpx.Client(timeout=settings.hf_grammar_timeout_seconds) as client:
            response = client.post(service_url, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("grammar postprocess failed: %s", exc)
        return cleaned

    if isinstance(data, dict):
        candidate_tokens = data.get("tokens")
        if isinstance(candidate_tokens, list):
            resolved = normalize_tokens([str(item) for item in candidate_tokens])
            if len(resolved) == len(cleaned):
                return resolved

        candidate_text = data.get("text")
        if isinstance(candidate_text, str):
            resolved = normalize_tokens(candidate_text.split(" "))
            if len(resolved) == len(cleaned):
                return resolved

    return cleaned
