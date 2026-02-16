"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileUp,
  Home,
  Loader2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Sparkles,
  Volume2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  runtimeOutputLanguages,
  runtimeSignLanguages,
  runtimeVoiceOptions
} from "@/lib/config/runtime-options";
import { defaultTranscript, TranscriptSegment } from "@/lib/mock/jobs";
import {
  ApiModelVersion,
  createExport,
  createJob,
  createSession,
  createUploadUrl,
  getJobSegments,
  getJob,
  getSession,
  listModels,
  patchJobSegments,
  uploadFileBySignedUrl,
} from "@/lib/api/backend";
import { formatSrtTime, formatTimecode, parseTimecodeInput, toSeconds } from "@/lib/utils/timecode";
import { cn } from "@/lib/utils";

type RenderMode = "subtitles" | "voice" | "both";
type TimelineZoom = "fit" | 1 | 2 | 4;

const initialSegments: TranscriptSegment[] = defaultTranscript.map((item) => ({ ...item }));
const SESSION_STORAGE_KEY = "signflow_session_id";
const JOB_STORAGE_KEY = "signflow_job_id";

function isSessionExpiredMessage(message: string) {
  return message.includes("session_expired") || message.includes("410");
}

function getFileNameFromObjectKey(value: string | null | undefined): string {
  if (!value) return "";
  const parts = value.split("/");
  return parts.at(-1)?.replace(/_/g, " ") ?? value;
}

function humanizeUploadError(message: string, uploaded = false): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("networkerror")
  ) {
    return "Cannot reach backend upload API. Check that backend is running on localhost:8000.";
  }
  if (message.startsWith("upload_failed_")) {
    return "Video upload failed. Check backend/minio availability and try again.";
  }
  if (message === "video_not_uploaded") {
    return "Upload has not completed yet. Please upload the video again.";
  }
  if (uploaded && message === "job_not_ready") {
    return "Video uploaded, but transcript job is not ready yet. Retry in a few seconds.";
  }
  return message;
}

function mapApiSegmentsToUi(
  segments: Array<{
    id: string;
    order_index: number;
    start_sec: number;
    end_sec: number;
    text: string;
  }>
): TranscriptSegment[] {
  return segments
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((segment) => ({
      id: segment.id,
      start: formatTimecode(segment.start_sec),
      end: formatTimecode(segment.end_sec),
      text: segment.text,
    }));
}

function createDownload(fileName: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function toSrt(segments: TranscriptSegment[]) {
  return segments
    .map((segment, index) => {
      return `${index + 1}\n${formatSrtTime(toSeconds(segment.start))} --> ${formatSrtTime(
        toSeconds(segment.end)
      )}\n${segment.text}`;
    })
    .join("\n\n");
}

function findSegmentByTime(segments: TranscriptSegment[], second: number) {
  const normalized = Math.max(0, Math.floor(second));
  const inside = segments.find((segment) => {
    const start = toSeconds(segment.start);
    const end = toSeconds(segment.end);
    return normalized >= start && normalized < end;
  });
  if (inside) return inside;

  return segments
    .slice()
    .reverse()
    .find((segment) => normalized >= toSeconds(segment.start));
}

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [models, setModels] = useState<ApiModelVersion[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("active");
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  const [videoRate, setVideoRate] = useState("1");
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [activeSegmentId, setActiveSegmentId] = useState(initialSegments[0]?.id ?? "");
  const [segmentQuery, setSegmentQuery] = useState("");
  const [jumpTo, setJumpTo] = useState("");
  const [timelineZoom, setTimelineZoom] = useState<TimelineZoom>("fit");
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [signLanguage, setSignLanguage] = useState<string>(runtimeSignLanguages[0]);
  const [outputLanguage, setOutputLanguage] = useState<string>(runtimeOutputLanguages[0]);
  const [mode, setMode] = useState<RenderMode>("both");
  const allowsSubtitles = mode !== "voice";
  const allowsVoiceover = mode !== "subtitles";

  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voice, setVoice] = useState<string>(runtimeVoiceOptions[0].value);
  const [fontSize, setFontSize] = useState("M");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [subtitleColor, setSubtitleColor] = useState("#ffffff");
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [subtitlePosition, setSubtitlePosition] = useState("bottom");

  const [originalVolume, setOriginalVolume] = useState(70);
  const [overlayVolume, setOverlayVolume] = useState(75);
  const isEditorLocked = sessionExpired;

  useEffect(() => {
    if (mode === "subtitles") {
      setSubtitleEnabled(true);
      setVoiceEnabled(false);
      return;
    }
    if (mode === "voice") {
      setSubtitleEnabled(false);
      setVoiceEnabled(true);
      return;
    }
    setSubtitleEnabled(true);
    setVoiceEnabled(true);
  }, [mode]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const fetched = await listModels();
        setModels(fetched);
        const active = fetched.find((model) => model.is_active);
        if (active) {
          setSelectedModelId(active.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load models";
        setBackendError(humanizeUploadError(message));
      }
    };

    void loadModels();
  }, []);

  const totalDuration = useMemo(
    () => Math.max(1, ...segments.map((segment) => toSeconds(segment.end))),
    [segments]
  );
  const [playheadSec, setPlayheadSec] = useState(0);
  const zoomLevels: TimelineZoom[] = ["fit", 1, 2, 4];
  const pxPerSecond = timelineZoom === "fit" ? 0 : 14 * timelineZoom;

  const resetSessionState = useCallback((expired = false) => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(JOB_STORAGE_KEY);
    setSessionId(null);
    setJobId(null);
    setRemainingSeconds(null);
    setFileName("");
    setSessionExpired(expired);
  }, []);

  const resetEditorState = useCallback(() => {
    if (videoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(videoPreviewUrl);
    setVideoPreviewUrl(null);
    setIsVideoPlaying(false);
    setVideoDurationSec(0);
    setVideoVolume(1);
    setVideoRate("1");
    setSegments(defaultTranscript.map((item) => ({ ...item })));
    setActiveSegmentId(defaultTranscript[0]?.id ?? "");
    setPlayheadSec(0);
    setSegmentQuery("");
    setJumpTo("");
    setBackendError(null);
  }, [videoPreviewUrl]);

  const startFreshSession = useCallback((expired = false) => {
    resetSessionState(expired);
    resetEditorState();
  }, [resetEditorState, resetSessionState]);

  const trackWidthStyle = useMemo(() => {
    if (timelineZoom === "fit") return "100%";
    return `${Math.max(totalDuration * pxPerSecond, 680)}px`;
  }, [timelineZoom, totalDuration, pxPerSecond]);

  const getTrackPosition = (second: number) => {
    if (timelineZoom === "fit") {
      return `${(second / totalDuration) * 100}%`;
    }
    return `${second * pxPerSecond}px`;
  };

  const getTrackWidth = (duration: number) => {
    if (timelineZoom === "fit") {
      return `${Math.max((duration / totalDuration) * 100, 1.5)}%`;
    }
    return `${Math.max(duration * pxPerSecond, 6)}px`;
  };

  const activeFromPlayhead = useMemo(
    () => findSegmentByTime(segments, playheadSec),
    [segments, playheadSec]
  );

  useEffect(() => {
    if (!activeFromPlayhead) return;
    if (activeFromPlayhead.id !== activeSegmentId) {
      setActiveSegmentId(activeFromPlayhead.id);
    }
  }, [activeFromPlayhead, activeSegmentId]);

  useEffect(() => {
    if (timelineZoom === "fit") return;
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const nextLeft = Math.max(playheadSec * pxPerSecond - viewport.clientWidth * 0.5, 0);
    viewport.scrollTo({ left: nextLeft, behavior: "auto" });
  }, [playheadSec, timelineZoom, pxPerSecond]);

  useEffect(() => {
    const restore = async () => {
      const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      const storedJob = window.localStorage.getItem(JOB_STORAGE_KEY);
      if (!storedSession) {
        setIsRestoring(false);
        return;
      }

      try {
        const session = await getSession(storedSession);
        if (session.status !== "ACTIVE") {
          startFreshSession(true);
          setIsRestoring(false);
          return;
        }

        setSessionId(session.id);
        setRemainingSeconds(session.remaining_seconds);
        setSessionExpired(session.remaining_seconds <= 0);
        if (session.video_object_key && session.video_ready) {
          setFileName(getFileNameFromObjectKey(session.video_object_key));
          if (session.video_download_url) {
            setVideoPreviewUrl(session.video_download_url);
          }
        } else {
          setFileName("");
          setVideoPreviewUrl(null);
        }

        const nextJobId = storedJob || session.active_job_id;
        if (nextJobId) {
          setJobId(nextJobId);
          window.localStorage.setItem(JOB_STORAGE_KEY, nextJobId);
          const job = await getJob(nextJobId);
          if (job.model_version_id) {
            setSelectedModelId(job.model_version_id);
          }
          const apiSegments = await getJobSegments(nextJobId);
          const mapped = mapApiSegmentsToUi(apiSegments);
          if (mapped.length) {
            setSegments(mapped);
            setActiveSegmentId(mapped[0].id);
            setPlayheadSec(toSeconds(mapped[0].start));
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to restore session";
        if (isSessionExpiredMessage(message)) {
          startFreshSession(true);
        }
        setBackendError(humanizeUploadError(message));
      } finally {
        setIsRestoring(false);
      }
    };

    void restore();
  }, [startFreshSession]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(async () => {
      try {
        const session = await getSession(sessionId);
        if (session.status !== "ACTIVE" || session.remaining_seconds <= 0) {
          setBackendError("Session expired. Start a new upload to continue editing.");
          startFreshSession(true);
          return;
        }
        setRemainingSeconds(session.remaining_seconds);
        if (!fileName && session.video_object_key && session.video_ready) {
          setFileName(getFileNameFromObjectKey(session.video_object_key));
          if (session.video_download_url) {
            setVideoPreviewUrl(session.video_download_url);
          }
        }
      } catch {
        // ignore transient poll errors
      }
    }, 15000);
    return () => window.clearInterval(timer);
  }, [fileName, sessionId, startFreshSession]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = videoVolume;
  }, [videoVolume]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = Number(videoRate);
  }, [videoRate]);

  const activeSegment = useMemo(
    () => segments.find((segment) => segment.id === activeSegmentId) ?? segments[0],
    [activeSegmentId, segments]
  );

  const voiceoverScript = useMemo(
    () =>
      `Tone ${voice}. ${segments
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join(" ")}`,
    [segments, voice]
  );

  const visibleSegments = useMemo(() => {
    const q = segmentQuery.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((segment) => {
      return (
        segment.text.toLowerCase().includes(q) ||
        segment.start.includes(q) ||
        segment.end.includes(q) ||
        segment.id.toLowerCase().includes(q)
      );
    });
  }, [segments, segmentQuery]);

  const previewClass = useMemo(() => {
    const size = fontSize === "S" ? "text-base" : fontSize === "L" ? "text-3xl" : "text-2xl";
    const position = subtitlePosition === "top" ? "top-6" : "bottom-6";
    return { size, position };
  }, [fontSize, subtitlePosition]);

  const runtimeModels = useMemo(() => {
    return models.filter((model) => ["torch", "torchscript"].includes(model.framework.toLowerCase()));
  }, [models]);

  const previewSegment = activeFromPlayhead ?? activeSegment;
  const previewText = previewSegment?.text?.trim() || "Select a segment from the timeline";

  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.id === activeSegmentId)
  );

  const selectSegment = (segment: TranscriptSegment) => {
    setActiveSegmentId(segment.id);
    const seconds = toSeconds(segment.start);
    setPlayheadSec(seconds);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(seconds, videoDurationSec || totalDuration));
    }
  };

  const moveBySegment = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(activeIndex + direction, 0), segments.length - 1);
    const next = segments[nextIndex];
    if (!next) return;
    selectSegment(next);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isEditorLocked) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setBackendError(null);
    setSessionExpired(false);
    setIsUploading(true);
    const previewUrl = URL.createObjectURL(file);
    let uploadCompleted = false;
    try {
      let sid = sessionId;
      if (!sid) {
        const created = await createSession();
        sid = created.id;
        setSessionId(created.id);
        setRemainingSeconds(created.remaining_seconds);
        window.localStorage.setItem(SESSION_STORAGE_KEY, created.id);
      }

      const upload = await createUploadUrl(sid, file.name, file.type || "video/mp4", file.size);
      await uploadFileBySignedUrl(upload.upload_url, file);
      uploadCompleted = true;

      setFileName(file.name);
      if (videoPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(previewUrl);

      const modelForJob = selectedModelId === "active" ? undefined : selectedModelId;
      const job = await createJob(sid, modelForJob);
      setJobId(job.id);
      window.localStorage.setItem(JOB_STORAGE_KEY, job.id);

      const apiSegments = await getJobSegments(job.id);
      const mapped = mapApiSegmentsToUi(apiSegments);
      if (mapped.length) {
        setSegments(mapped);
        setActiveSegmentId(mapped[0].id);
        setPlayheadSec(toSeconds(mapped[0].start));
      }

    } catch (error) {
      if (!uploadCompleted) {
        URL.revokeObjectURL(previewUrl);
      }
      const message = error instanceof Error ? error.message : "Upload flow failed";
      if (isSessionExpiredMessage(message)) {
        startFreshSession(true);
      }
      setBackendError(humanizeUploadError(message, uploadCompleted));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const updateSegment = (id: string, patch: Partial<TranscriptSegment>) => {
    if (isEditorLocked) return;
    setSegments((prev) => prev.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)));

    if (!jobId) return;

    const payload: {
      id: string;
      order_index?: number;
      start_sec?: number;
      end_sec?: number;
      text?: string;
    } = { id };

    if (patch.text !== undefined) payload.text = patch.text;
    if (patch.start !== undefined) {
      const parsed = parseTimecodeInput(patch.start);
      if (parsed !== null) payload.start_sec = parsed;
    }
    if (patch.end !== undefined) {
      const parsed = parseTimecodeInput(patch.end);
      if (parsed !== null) payload.end_sec = parsed;
    }

    void patchJobSegments(jobId, [payload]).catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to sync segment";
      if (isSessionExpiredMessage(message)) {
        startFreshSession(true);
      }
      setBackendError(humanizeUploadError(message));
    });
  };

  const addSegment = () => {
    if (isEditorLocked) return;
    const nextId = `seg_${segments.length + 1}`;
    const start = totalDuration;
    const end = totalDuration + 3;
    const next: TranscriptSegment = {
      id: nextId,
      start: formatTimecode(start),
      end: formatTimecode(end),
      text: "New subtitle line..."
    };
    setSegments((prev) => [...prev, next]);
    selectSegment(next);

    if (!jobId) return;
    void patchJobSegments(jobId, [
      {
        id: next.id,
        order_index: segments.length,
        start_sec: start,
        end_sec: end,
        text: next.text,
      },
    ]).catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to add segment";
      if (isSessionExpiredMessage(message)) {
        startFreshSession(true);
      }
      setBackendError(humanizeUploadError(message));
    });
  };

  const onJumpToTime = () => {
    const parsed = parseTimecodeInput(jumpTo);
    if (parsed === null) return;
    const nextTime = Math.min(Math.max(parsed, 0), totalDuration);
    setPlayheadSec(nextTime);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(nextTime, videoDurationSec || totalDuration));
    }
  };

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const seekVideo = (seconds: number) => {
    const next = Math.max(0, Math.min(seconds, videoDurationSec || totalDuration));
    setPlayheadSec(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      event.preventDefault();
      toggleVideoPlayback();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleExport = async (format: "SRT" | "VTT" | "TXT" | "AUDIO" | "VIDEO") => {
    if (isEditorLocked) return;
    try {
      if (!jobId) {
        if (format === "SRT") {
          createDownload(`${fileName || "transcript"}.srt`, toSrt(segments), "text/plain");
          return;
        }
        throw new Error("job_not_ready");
      }

      const exported = await createExport(jobId, format);
      const link = document.createElement("a");
      link.href = exported.download_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      if (isSessionExpiredMessage(message)) {
        startFreshSession(true);
      }
      setBackendError(humanizeUploadError(message));
    }
  };

  return (
    <section className="pb-14 pt-12">
      <div className="mx-auto w-full max-w-[1520px] px-4 md:px-6">
        <div className="page-head flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="page-kicker">Video editor workspace</p>
            <h1 className="section-title">Video Translation</h1>
            <p className="page-lead">
              Realistic subtitle workflow for long videos: timeline scrubbing, timecode jump, and dense segment editing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant="secondary" className="gap-2">
              <Link href="/live">
                <Radio className="h-4 w-4" />
                Realtime
              </Link>
            </Button>
          </div>
        </div>

        {(isRestoring || isUploading) && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isRestoring ? "Restoring active session..." : "Uploading and preparing transcript..."}
          </div>
        )}

        {(sessionId || remainingSeconds !== null) && (
          <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
            Session {sessionId ? sessionId.slice(0, 8) : "-"} •
            {" "}expires in {remainingSeconds !== null ? Math.max(Math.ceil(remainingSeconds / 60), 0) : "-"} min
          </div>
        )}

        {sessionExpired && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <span>Session expired after 45 minutes. Start a new session to continue.</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                startFreshSession(false);
              }}
            >
              Start new session
            </Button>
          </div>
        )}

        {backendError && (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {backendError}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onFileChange}
          disabled={isEditorLocked || isUploading}
        />

        {!fileName ? (
          <Card className="border-white/10 bg-black/45">
            <CardHeader>
              <CardTitle>1) Upload video</CardTitle>
              <CardDescription>Upload one file and move directly into the workspace editor.</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isEditorLocked || isUploading}
                className={cn(
                  "flex min-h-36 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-6 text-center",
                  isEditorLocked || isUploading
                    ? "cursor-not-allowed opacity-55"
                    : "cursor-pointer hover:border-white/30"
                )}
              >
                <FileUp className="h-6 w-6 text-white/75" />
                <div>
                  <p className="text-sm font-medium">Choose a video file</p>
                  <p className="text-xs text-muted-foreground">mp4 / mov / mkv</p>
                </div>
              </button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-black/45">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Loaded video</p>
                <p className="text-sm">
                  <span className="text-muted-foreground">File: </span>
                  <span className="text-foreground">{fileName}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => {
                    startFreshSession(false);
                    requestAnimationFrame(() => fileInputRef.current?.click());
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Choose another video
                </Button>
                <Button type="button" variant="outline" onClick={() => startFreshSession(false)}>
                  Start over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {fileName && (
          <>
            <div className={cn(isEditorLocked && "pointer-events-none opacity-60")}>
            <Card className="mt-5 border-white/10 bg-black/45">
              <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-1.5 xl:col-span-2">
                  <Label>Sign language</Label>
                  <Select value={signLanguage} onValueChange={setSignLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {runtimeSignLanguages.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 xl:col-span-2">
                  <Label>Output language</Label>
                  <Select value={outputLanguage} onValueChange={setOutputLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {runtimeOutputLanguages.map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 xl:col-span-2">
                  <Label>Render mode</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as RenderMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subtitles">Subtitles only</SelectItem>
                      <SelectItem value="voice">Voice only</SelectItem>
                      <SelectItem value="both">Subtitles + Voice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 xl:col-span-3">
                  <Label>Runtime model</Label>
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Use active model</SelectItem>
                      {runtimeModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} • {model.framework}
                          {model.is_active ? " • active" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.9fr_0.9fr]">
              <Card className="min-w-0 border-white/10 bg-black/45">
                <CardHeader>
                  <CardTitle>2) Large preview and time navigation</CardTitle>
                  <CardDescription>
                    Timeline is bound to subtitle intervals, so you can edit exactly where text appears in the video.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative flex h-[58vh] min-h-[460px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/35">
                    <div className="absolute inset-0 scan-overlay opacity-30" />
                    {videoPreviewUrl ? (
                      <video
                        ref={videoRef}
                        src={videoPreviewUrl}
                        className="h-full w-full object-contain"
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                          const duration = Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : 0;
                          setVideoDurationSec(duration);
                          event.currentTarget.volume = videoVolume;
                          event.currentTarget.playbackRate = Number(videoRate);
                        }}
                        onTimeUpdate={(event) => {
                          setPlayheadSec(event.currentTarget.currentTime);
                        }}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnded={() => setIsVideoPlaying(false)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Video preview becomes available right after upload.
                      </p>
                    )}
                    {subtitleEnabled && (mode === "subtitles" || mode === "both") && (
                      <div
                        className={cn(
                          "absolute left-1/2 w-[92%] max-w-5xl -translate-x-1/2 rounded-lg px-3 py-2 text-center leading-snug",
                          previewClass.position,
                          previewClass.size
                        )}
                        style={{
                          color: subtitleColor,
                          fontFamily,
                          background: subtitleBackground ? "rgba(0,0,0,0.58)" : "transparent"
                        }}
                      >
                        {previewText}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        Playhead {formatTimecode(playheadSec)} /{" "}
                        {formatTimecode(videoDurationSec > 0 ? videoDurationSec : totalDuration)}
                      </span>
                      <span>{segments.length} segments</span>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={toggleVideoPlayback}>
                        {isVideoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {isVideoPlaying ? "Pause" : "Play"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => seekVideo(playheadSec - 5)}>
                        -5s
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => seekVideo(playheadSec + 5)}>
                        +5s
                      </Button>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Speed</span>
                        <Select value={videoRate} onValueChange={setVideoRate}>
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.75">0.75x</SelectItem>
                            <SelectItem value="1">1x</SelectItem>
                            <SelectItem value="1.25">1.25x</SelectItem>
                            <SelectItem value="1.5">1.5x</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mb-3 rounded-lg border border-white/10 bg-black/25 p-2">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Video volume</span>
                        <span>{Math.round(videoVolume * 100)}%</span>
                      </div>
                      <Slider
                        value={[Math.round(videoVolume * 100)]}
                        onValueChange={(v) => setVideoVolume((v[0] ?? 100) / 100)}
                        max={100}
                      />
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Timeline zoom</span>
                      {zoomLevels.map((level) => {
                        const active = timelineZoom === level;
                        const label = level === "fit" ? "Fit" : `${level}x`;
                        return (
                          <Button
                            key={label}
                            type="button"
                            size="sm"
                            variant={active ? "default" : "secondary"}
                            className="h-7 px-3 text-xs"
                            onClick={() => setTimelineZoom(level)}
                          >
                            {label}
                          </Button>
                        );
                      })}
                    </div>

                    <Slider
                      min={0}
                      max={videoDurationSec > 0 ? videoDurationSec : totalDuration}
                      step={1}
                      value={[playheadSec]}
                      onValueChange={(v) => seekVideo(v[0] ?? 0)}
                    />

                    <div
                      ref={timelineViewportRef}
                      className="mt-3 w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1"
                    >
                      <div
                        className="relative h-8 rounded-md border border-white/10 bg-black/30"
                        style={{ width: trackWidthStyle, minWidth: "100%" }}
                      >
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 w-px bg-white/60"
                          style={{ left: getTrackPosition(playheadSec) }}
                        />
                        {segments.map((segment) => {
                          const start = toSeconds(segment.start);
                          const end = toSeconds(segment.end);
                          const active = segment.id === activeSegmentId;
                          const duration = Math.max(end - start, 1);

                          return (
                            <button
                              key={segment.id}
                              type="button"
                              onClick={() => selectSegment(segment)}
                              className={cn(
                                "absolute top-1 h-6 rounded-sm border transition",
                                active
                                  ? "border-white/40 bg-white/35"
                                  : "border-white/15 bg-white/10 hover:border-white/35"
                              )}
                              style={{ left: getTrackPosition(start), width: getTrackWidth(duration) }}
                              title={`${segment.start} - ${segment.end}`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => moveBySegment(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                        Prev segment
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => moveBySegment(1)}>
                        Next segment
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Input
                        value={jumpTo}
                        onChange={(event) => setJumpTo(event.target.value)}
                        placeholder="Jump: 00:01:24 or 84"
                        className="h-9 w-52"
                      />
                      <Button size="sm" variant="outline" onClick={onJumpToTime}>
                        Jump
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
                <Card className="border-white/10 bg-black/45">
                  <CardHeader>
                    <CardTitle>3) Output controls</CardTitle>
                    <CardDescription>All key parameters in one panel.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
                      Render mode:{" "}
                      <span className="text-foreground">
                        {mode === "subtitles" ? "Subtitles only" : mode === "voice" ? "Voiceover only" : "Subtitles + Voiceover"}
                      </span>
                    </div>

                    {allowsSubtitles && (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-sm font-medium">Subtitles</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Size</Label>
                            <Select value={fontSize} onValueChange={setFontSize}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="S">S</SelectItem>
                                <SelectItem value="M">M</SelectItem>
                                <SelectItem value="L">L</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Position</Label>
                            <Select value={subtitlePosition} onValueChange={setSubtitlePosition}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bottom">Bottom</SelectItem>
                                <SelectItem value="top">Top</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Font family</Label>
                            <Select value={fontFamily} onValueChange={setFontFamily}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Inter">Inter</SelectItem>
                                <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                                <SelectItem value="monospace">Monospace</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Text color</Label>
                            <Input
                              type="color"
                              value={subtitleColor}
                              onChange={(event) => setSubtitleColor(event.target.value)}
                              className="h-10 p-1"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                          <Label htmlFor="subtitle-switch">Subtitles enabled</Label>
                          <Switch id="subtitle-switch" checked={subtitleEnabled} onCheckedChange={setSubtitleEnabled} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                          <Label htmlFor="subtitle-bg">Subtitle background</Label>
                          <Switch id="subtitle-bg" checked={subtitleBackground} onCheckedChange={setSubtitleBackground} />
                        </div>
                      </div>
                    )}

                    {allowsVoiceover && (
                      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-sm font-medium">Voiceover</p>
                        <div className="space-y-1.5">
                          <Label>Voice type</Label>
                          <Select value={voice} onValueChange={setVoice}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {runtimeVoiceOptions.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                          <Label htmlFor="voice-switch">Voiceover enabled</Label>
                          <Switch id="voice-switch" checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Original video volume</span>
                            <span>{originalVolume}%</span>
                          </div>
                          <Slider value={[originalVolume]} onValueChange={(v) => setOriginalVolume(v[0] ?? 70)} max={100} />
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Voiceover volume</span>
                            <span>{overlayVolume}%</span>
                          </div>
                          <Slider value={[overlayVolume]} onValueChange={(v) => setOverlayVolume(v[0] ?? 75)} max={100} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-black/45">
                  <CardHeader>
                    <CardTitle>4) Export</CardTitle>
                    <CardDescription>Files are generated from the current editor state.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={() => void handleExport("SRT")}
                    >
                      <Download className="h-4 w-4" />
                      Download subtitles (.srt)
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={() => void handleExport("AUDIO")}
                    >
                      <Volume2 className="h-4 w-4" />
                      Download audio track
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full justify-start gap-2"
                      onClick={() => void handleExport("VIDEO")}
                    >
                      <Download className="h-4 w-4" />
                      Download video
                    </Button>
                    {jobId ? (
                      <Button asChild variant="outline" className="mt-2 w-full gap-2">
                        <Link href={`/jobs/${jobId}`}>
                          <Sparkles className="h-4 w-4" />
                          Open job editor
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" className="mt-2 w-full gap-2" disabled>
                        <Sparkles className="h-4 w-4" />
                        Open job editor
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="mt-5 border-white/10 bg-black/45">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>5) Segment editor for long subtitles</CardTitle>
                    <CardDescription>
                      Search by text or timecode, select any segment, and edit timing + text in one place.
                    </CardDescription>
                  </div>
                  <Button variant="secondary" size="sm" className="gap-1.5" onClick={addSegment}>
                    <Plus className="h-4 w-4" />
                    Add segment
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[0.56fr_0.44fr]">
                <div className="grid gap-4 lg:grid-cols-[0.5fr_0.5fr]">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        value={segmentQuery}
                        onChange={(event) => setSegmentQuery(event.target.value)}
                        placeholder="Search segment text or 00:00:18"
                      />
                    </div>

                    <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                      {visibleSegments.map((segment, index) => (
                        <button
                          key={segment.id}
                          type="button"
                          onClick={() => selectSegment(segment)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                            activeSegmentId === segment.id
                              ? "border-white/30 bg-white/[0.09]"
                              : "border-white/10 bg-white/[0.02] hover:border-white/22"
                          )}
                        >
                          <p className="text-xs uppercase tracking-[0.2em] text-white/56">
                            Segment {index + 1} • {segment.start} - {segment.end}
                          </p>
                          <p className="mt-1 line-clamp-2">{segment.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <Label>Active segment</Label>
                    {activeSegment ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start</Label>
                            <Input
                              value={activeSegment.start}
                              onChange={(event) => updateSegment(activeSegment.id, { start: event.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End</Label>
                            <Input
                              value={activeSegment.end}
                              onChange={(event) => updateSegment(activeSegment.id, { end: event.target.value })}
                            />
                          </div>
                        </div>
                        <Textarea
                          className="min-h-[220px]"
                          value={activeSegment.text}
                          onChange={(event) => updateSegment(activeSegment.id, { text: event.target.value })}
                        />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Choose a segment from the list.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <Label>Voiceover script (auto)</Label>
                  <Textarea className="min-h-[300px]" value={voiceoverScript} readOnly />
                  <p className="text-xs text-muted-foreground">
                    Subtitle text and voiceover script stay synchronized, even for long timelines.
                  </p>
                </div>
              </CardContent>
            </Card>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
