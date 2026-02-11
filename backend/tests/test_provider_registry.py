from app.config import settings
from app.providers.registry import get_model_provider


def test_registry_returns_stub_provider():
    previous = settings.model_provider
    try:
        settings.model_provider = "stub"
        provider = get_model_provider()
        assert provider.name == "stub"
    finally:
        settings.model_provider = previous


def test_registry_returns_hf_provider():
    previous = settings.model_provider
    try:
        settings.model_provider = "hf"
        provider = get_model_provider()
        assert provider.name == "huggingface"
    finally:
        settings.model_provider = previous
