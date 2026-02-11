export type JobStatus = "Processing" | "Done" | "Failed";

export type JobHistoryItem = {
  id: string;
  createdAt: string;
  type: "Live" | "Upload";
  language: string;
  status: JobStatus;
};

export type TranscriptSegment = {
  id: string;
  start: string;
  end: string;
  text: string;
};

export const mockHistory: JobHistoryItem[] = [
  {
    id: "job_9a1x",
    createdAt: "2026-02-10 18:42",
    type: "Live",
    language: "ASL → English",
    status: "Done"
  },
  {
    id: "job_4n2k",
    createdAt: "2026-02-10 16:20",
    type: "Upload",
    language: "RSL → Русский",
    status: "Processing"
  },
  {
    id: "job_8f6m",
    createdAt: "2026-02-09 21:03",
    type: "Upload",
    language: "BSL → English",
    status: "Done"
  },
  {
    id: "job_7h2d",
    createdAt: "2026-02-08 09:11",
    type: "Live",
    language: "ASL → Español",
    status: "Failed"
  }
];

export const defaultTranscript: TranscriptSegment[] = [
  {
    id: "seg_1",
    start: "00:00:01",
    end: "00:00:04",
    text: "Здравствуйте, сегодня мы начнем с краткого вступления."
  },
  {
    id: "seg_2",
    start: "00:00:05",
    end: "00:00:08",
    text: "Далее покажем, как меняется стиль субтитров в реальном времени."
  },
  {
    id: "seg_3",
    start: "00:00:09",
    end: "00:00:13",
    text: "После этого можно экспортировать файл в формате SRT или VTT."
  },
  {
    id: "seg_4",
    start: "00:00:14",
    end: "00:00:18",
    text: "Эта версия интерфейса демонстрирует только фронтенд-поведение."
  }
];
