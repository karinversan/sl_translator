from app.providers.base import ModelProvider, ProviderSegment


class StubProvider(ModelProvider):
    name = "stub"

    def health(self) -> dict:
        return {"provider": self.name, "status": "ok"}

    def transcribe(self, video_object_key: str, options: dict | None = None) -> list[ProviderSegment]:
        base_texts = [
            "Hello, today we will start with a short introduction.",
            "Next we will show how subtitle styling updates in real time.",
            "You can jump to exact moments on the timeline using timecode.",
            "Any segment edit immediately updates the voiceover script.",
            "Exports are generated from the current edited transcript state.",
            "This is deterministic stub output while model integration is pending.",
        ]
        segments: list[ProviderSegment] = []
        cursor = 0.0
        for idx, line in enumerate(base_texts):
            duration = 3.5 if idx % 2 == 0 else 4.0
            segments.append(
                ProviderSegment(
                    order_index=idx,
                    start_sec=round(cursor, 3),
                    end_sec=round(cursor + duration, 3),
                    text=line,
                    confidence=0.88 - (idx * 0.02),
                )
            )
            cursor += duration
        return segments

    def regenerate(self, segments: list[ProviderSegment], options: dict | None = None) -> list[ProviderSegment]:
        regenerated: list[ProviderSegment] = []
        for idx, segment in enumerate(segments):
            suffix = " [refined]" if idx % 2 == 0 else ""
            regenerated.append(
                ProviderSegment(
                    order_index=segment.order_index,
                    start_sec=segment.start_sec,
                    end_sec=segment.end_sec,
                    text=f"{segment.text}{suffix}",
                    confidence=max(segment.confidence - 0.01, 0.5),
                )
            )
        return regenerated

