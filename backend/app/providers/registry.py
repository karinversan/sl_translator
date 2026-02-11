from app.config import settings
from app.providers.base import ModelProvider
from app.providers.stub import StubProvider


def get_model_provider() -> ModelProvider:
    provider = settings.model_provider.lower()
    if provider == "stub":
        return StubProvider()

    # Fallback to stub until HF provider is implemented.
    return StubProvider()

