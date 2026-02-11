export type SubtitleChunk = {
  id: string;
  text: string;
  confidence: number;
  kind: "partial" | "final";
  timestamp: string;
};

const phrases = [
  "Доброе утро, начинаем трансляцию.",
  "Сегодня обсудим настройки субтитров.",
  "Добавьте язык вывода в панели справа.",
  "Проверьте, что стиль текста остается читаемым.",
  "Можно переключиться на профиль Speed.",
  "Финальные фразы выглядят плотнее и ярче.",
  "Частичные фразы слегка прозрачные.",
  "Экспортируйте результат в SRT или VTT.",
  "Этот поток полностью имитирован на фронте.",
  "Для демонстрации мы обновляем подписи каждые две секунды."
];

function formatTs(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function generateSubtitleChunk(seed: number): SubtitleChunk {
  const phrase = phrases[seed % phrases.length];
  const partialCut = Math.max(phrase.length - 10, Math.floor(phrase.length * 0.65));
  const kind = Math.random() > 0.4 ? "final" : "partial";

  return {
    id: crypto.randomUUID(),
    text: kind === "final" ? phrase : `${phrase.slice(0, partialCut)}...`,
    confidence: 72 + Math.round(Math.random() * 26),
    kind,
    timestamp: formatTs(new Date())
  };
}

export function seedSubtitles(): SubtitleChunk[] {
  return [generateSubtitleChunk(0), generateSubtitleChunk(1)].map((chunk, idx) => ({
    ...chunk,
    kind: idx === 0 ? "partial" : "final"
  }));
}
