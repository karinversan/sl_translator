from app.config import settings
from app.providers.base import ModelProvider
from app.providers.hf import HuggingFaceProvider
from app.providers.stub import StubProvider


def get_model_provider() -> ModelProvider:
    provider = settings.model_provider.lower()
    if provider == "stub":
        return StubProvider()
    if provider in {"hf", "huggingface"}:
        return HuggingFaceProvider()

    # Fallback to stub for unknown provider names.
    return StubProvider()
