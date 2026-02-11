export function toSeconds(value: string): number {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return 0;

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return 0;
}

export function formatTimecode(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatSrtTime(totalSeconds: number): string {
  return `${formatTimecode(totalSeconds)},000`;
}

export function parseTimecodeInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (/^\d{1,2}:\d{1,2}$/.test(value) || /^\d{1,2}:\d{1,2}:\d{1,2}$/.test(value)) {
    return toSeconds(value);
  }

  return null;
}
