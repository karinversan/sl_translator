from dataclasses import dataclass
from typing import Protocol


@dataclass
class ProviderSegment:
    order_index: int
    start_sec: float
    end_sec: float
    text: str
    confidence: float


class ModelProvider(Protocol):
    name: str

    def health(self) -> dict:
        ...

    def transcribe(self, video_object_key: str, options: dict | None = None) -> list[ProviderSegment]:
        ...

    def regenerate(self, segments: list[ProviderSegment], options: dict | None = None) -> list[ProviderSegment]:
        ...

