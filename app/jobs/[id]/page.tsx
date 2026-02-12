"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Home,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCcw,
  Search,
  Sparkles,
  Upload,
  Volume2
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { defaultTranscript, TranscriptSegment } from "@/lib/mock/jobs";
import {
  createExport,
  getJob,
  getJobSegments,
  getSession,
  patchJobSegments,
  regenerateJob,
} from "@/lib/api/backend";
import { formatSrtTime, formatTimecode, parseTimecodeInput, toSeconds } from "@/lib/utils/timecode";

type PreviewMode = "Original" | "Subtitled" | "Voiceover";
type TimelineZoom = "fit" | 1 | 2 | 4;

function isSessionExpiredMessage(message: string) {
  return message.includes("session_expired") || message.includes("410");
}

function download(name: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
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

function toVtt(segments: TranscriptSegment[]) {
  return [
    "WEBVTT",
    "",
    ...segments.map((segment) => `${segment.start}.000 --> ${segment.end}.000\n${segment.text}\n`)
  ].join("\n");
}

function mapApiSegmentsToUi(
  segments: Array<{ id: string; order_index: number; start_sec: number; end_sec: number; text: string }>
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

export default function JobDetailsPage() {
  const params = useParams<{ id: string }>();
  const jobId = String(params.id ?? "");
  const [progress, setProgress] = useState(18);
  const [status, setStatus] = useState<"Processing" | "Done">("Processing");
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const [mode, setMode] = useState<PreviewMode>("Subtitled");
  const [segments, setSegments] = useState<TranscriptSegment[]>(defaultTranscript.map((item) => ({ ...item })));
  const [activeSegmentId, setActiveSegmentId] = useState(defaultTranscript[0]?.id ?? "");
  const [segmentQuery, setSegmentQuery] = useState("");
  const [jumpTo, setJumpTo] = useState("");
  const [timelineZoom, setTimelineZoom] = useState<TimelineZoom>("fit");
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [subtitleSize, setSubtitleSize] = useState<"S" | "M" | "L">("M");
  const [subtitlePosition, setSubtitlePosition] = useState<"bottom" | "top">("bottom");
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [textCase, setTextCase] = useState<"normal" | "upper" | "lower">("normal");
  const [voiceTone, setVoiceTone] = useState("Natural");

  const totalDuration = useMemo(
    () => Math.max(1, ...segments.map((segment) => toSeconds(segment.end))),
    [segments]
  );
  const [playheadSec, setPlayheadSec] = useState(0);
  const zoomLevels: TimelineZoom[] = ["fit", 1, 2, 4];
  const pxPerSecond = timelineZoom === "fit" ? 0 : 14 * timelineZoom;

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

  useEffect(() => {
    const restore = async () => {
      setIsLoading(true);
      try {
        const job = await getJob(jobId);
        setSessionId(job.session_id);

        const session = await getSession(job.session_id);
        if (session.status !== "ACTIVE" || session.remaining_seconds <= 0) {
          setSessionExpired(true);
          setSessionRemainingSeconds(0);
        } else {
          setSessionExpired(false);
          setSessionRemainingSeconds(session.remaining_seconds);
        }
        if (session.video_ready && session.video_download_url) {
          setVideoPreviewUrl(session.video_download_url);
          setVideoLoadError(null);
        }

        const apiSegments = await getJobSegments(jobId);
        const mapped = mapApiSegmentsToUi(apiSegments);
        if (mapped.length) {
          setSegments(mapped);
          setActiveSegmentId(mapped[0].id);
          setPlayheadSec(toSeconds(mapped[0].start));
        }

        setStatus(job.status === "done" ? "Done" : "Processing");
        setProgress(job.progress);
        setBackendReady(true);
        setBackendError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load job from backend";
        if (isSessionExpiredMessage(message)) {
          setSessionExpired(true);
          setSessionRemainingSeconds(0);
        }
        setBackendReady(false);
        setBackendError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void restore();
  }, [jobId]);

  useEffect(() => {
    if (backendReady) return;
    if (status === "Done") return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(prev + Math.round(Math.random() * 10), 100);
        if (next >= 100) {
          setStatus("Done");
        }
        return next;
      });
    }, 900);

    return () => clearInterval(timer);
  }, [status, backendReady]);

  useEffect(() => {
    if (!backendReady) return;
    if (status === "Done") return;
    const timer = setInterval(async () => {
      try {
        const job = await getJob(jobId);
        setProgress(job.progress);
        setStatus(job.status === "done" ? "Done" : "Processing");
      } catch {
        // ignore transient poll failures
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [backendReady, status, jobId]);

  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(async () => {
      try {
        const session = await getSession(sessionId);
        setSessionRemainingSeconds(session.remaining_seconds);
        if (session.status !== "ACTIVE" || session.remaining_seconds <= 0) {
          setSessionExpired(true);
          setBackendError("Session expired. Editing and exports are locked.");
        }
        if (!videoPreviewUrl && session.video_ready && session.video_download_url) {
          setVideoPreviewUrl(session.video_download_url);
          setVideoLoadError(null);
        }
      } catch {
        // Ignore transient session poll errors.
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [sessionId, videoPreviewUrl]);

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
  }, [videoPreviewUrl]);

  const updateSegment = (id: string, patch: Partial<TranscriptSegment>) => {
    if (controlsLocked) return;
    setSegments((prev) => prev.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)));

    if (!backendReady) return;
    const payload: {
      id: string;
      start_sec?: number;
      end_sec?: number;
      text?: string;
    } = { id };

    if (patch.start !== undefined) {
      const parsed = parseTimecodeInput(patch.start);
      if (parsed !== null) payload.start_sec = parsed;
    }
    if (patch.end !== undefined) {
      const parsed = parseTimecodeInput(patch.end);
      if (parsed !== null) payload.end_sec = parsed;
    }
    if (patch.text !== undefined) payload.text = patch.text;

    void patchJobSegments(jobId, [payload]).catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to save segment";
      if (isSessionExpiredMessage(message)) {
        setSessionExpired(true);
      }
      setBackendError(message);
    });
  };

  const activeSegment = useMemo(
    () => segments.find((segment) => segment.id === activeSegmentId) ?? segments[0],
    [activeSegmentId, segments]
  );

  const activeIndex = Math.max(
    0,
    segments.findIndex((segment) => segment.id === activeSegmentId)
  );

  const selectSegment = (segment: TranscriptSegment) => {
    setActiveSegmentId(segment.id);
    const next = toSeconds(segment.start);
    setPlayheadSec(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
  };

  const moveBySegment = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(activeIndex + direction, 0), segments.length - 1);
    const next = segments[nextIndex];
    if (!next) return;
    selectSegment(next);
  };

  const onJumpToTime = () => {
    const parsed = parseTimecodeInput(jumpTo);
    if (parsed === null) return;
    const next = Math.min(Math.max(parsed, 0), videoDurationSec || totalDuration);
    setPlayheadSec(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
    }
  };

  const playbackDuration = videoDurationSec > 0 ? videoDurationSec : totalDuration;

  const seekVideo = (seconds: number) => {
    const next = Math.max(0, Math.min(seconds, playbackDuration));
    setPlayheadSec(next);
    if (videoRef.current) {
      videoRef.current.currentTime = next;
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

  const handleRegenerate = async () => {
    if (controlsLocked) return;
    if (!backendReady) {
      setSegments((prev) =>
        prev.map((segment, index) => ({
          ...segment,
          text: index % 2 === 0 ? `${segment.text} [refined]` : segment.text
        }))
      );
      return;
    }
    try {
      const regenerated = await regenerateJob(jobId);
      const mapped = mapApiSegmentsToUi(regenerated);
      setSegments(mapped);
      if (mapped.length && !mapped.find((item) => item.id === activeSegmentId)) {
        setActiveSegmentId(mapped[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Regenerate failed";
      if (isSessionExpiredMessage(message)) {
        setSessionExpired(true);
      }
      setBackendError(message);
    }
  };

  const handleExport = async (format: "SRT" | "VTT" | "TXT" | "AUDIO" | "VIDEO") => {
    if (controlsLocked) return;
    try {
      if (!backendReady) {
        if (format === "SRT") {
          download(`${jobId}.srt`, toSrt(segments), "text/plain");
          return;
        }
        if (format === "VTT") {
          download(`${jobId}.vtt`, toVtt(segments), "text/vtt");
          return;
        }
        if (format === "TXT") {
          download(`${jobId}.txt`, transcriptText, "text/plain");
          return;
        }
        throw new Error("export_unavailable");
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
        setSessionExpired(true);
      }
      setBackendError(message);
    }
  };

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

  const formatByCase = useCallback(
    (value: string) => {
      if (textCase === "upper") return value.toUpperCase();
      if (textCase === "lower") return value.toLowerCase();
      return value;
    },
    [textCase]
  );

  const transcriptText = useMemo(() => segments.map((segment) => segment.text).join("\n"), [segments]);
  const previewSegment = activeFromPlayhead ?? activeSegment;
  const previewText = useMemo(
    () => (previewSegment ? formatByCase(previewSegment.text) : ""),
    [previewSegment, formatByCase]
  );

  const voiceoverScript = useMemo(
    () =>
      `Tone: ${voiceTone}. ${segments
        .map((segment) => formatByCase(segment.text.trim()))
        .filter(Boolean)
        .join(" ")}`,
    [segments, voiceTone, formatByCase]
  );

  const subtitleSizeClass = {
    S: "text-base md:text-lg",
    M: "text-lg md:text-xl",
    L: "text-2xl md:text-3xl"
  }[subtitleSize];

  const subtitlePositionClass = subtitlePosition === "bottom" ? "bottom-5" : "top-5";
  const controlsLocked = sessionExpired;

  return (
    <section className="container pb-14 pt-12">
      <div className="page-head flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="page-kicker">Job details</p>
          <h1 className="section-title text-[2.2rem] md:text-5xl">Results and Editor</h1>
          <p className="page-lead max-w-4xl">
            Timeline-driven subtitle editing with fast navigation by exact timecode.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/live">
              <Radio className="h-4 w-4" />
              Realtime
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Video
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/history">History</Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading job data...
        </div>
      )}

      {backendError && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {backendError}
        </div>
      )}

      {(sessionId || sessionRemainingSeconds !== null) && (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
          Session {sessionId ? sessionId.slice(0, 8) : "-"} • expires in{" "}
          {sessionRemainingSeconds !== null ? Math.max(Math.ceil(sessionRemainingSeconds / 60), 0) : "-"} min
        </div>
      )}

      {sessionExpired && (
        <div className="mb-4 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          This editing session expired. Open a new upload to continue editing.
        </div>
      )}

      <Card className="border-white/10 bg-black/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Job {jobId}</CardTitle>
              <CardDescription>
                Status: <span className="text-foreground">{status}</span>
              </CardDescription>
            </div>
            <Badge variant={status === "Done" ? "success" : "default"}>{status}</Badge>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
      </Card>

      <div className={`mt-5 grid gap-5 lg:grid-cols-[1.46fr_0.84fr] ${controlsLocked ? "pointer-events-none opacity-60" : ""}`}>
        <Card className="min-w-0 border-white/10 bg-black/50">
          <CardHeader>
            <Tabs defaultValue="preview" className="w-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-4">
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {(["Original", "Subtitled", "Voiceover"] as PreviewMode[]).map((item) => (
                    <Button
                      key={item}
                      size="sm"
                      variant={mode === item ? "default" : "secondary"}
                      onClick={() => setMode(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/12 bg-black/45 p-4">
                  <div className="relative flex h-[400px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="absolute inset-0 scan-overlay opacity-35" />
                    {videoPreviewUrl ? (
                      <video
                        ref={videoRef}
                        src={videoPreviewUrl}
                        className="h-full w-full object-contain"
                        playsInline
                        preload="metadata"
                        controls
                        onLoadedMetadata={(event) => {
                          const duration = Number.isFinite(event.currentTarget.duration)
                            ? event.currentTarget.duration
                            : 0;
                          setVideoDurationSec(duration);
                          setVideoLoadError(null);
                        }}
                        onTimeUpdate={(event) => setPlayheadSec(event.currentTarget.currentTime)}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnded={() => setIsVideoPlaying(false)}
                        onError={() => setVideoLoadError("Video file is unavailable for preview.")}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Video is not attached to this job yet.
                      </p>
                    )}
                    {videoLoadError && (
                      <div className="absolute left-3 top-3 rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                        {videoLoadError}
                      </div>
                    )}

                    {mode !== "Original" && previewSegment && (
                      <div
                        className={`absolute ${subtitlePositionClass} left-1/2 w-[90%] max-w-3xl -translate-x-1/2 rounded-lg px-3 py-2 text-center leading-snug ${subtitleSizeClass} ${
                          subtitleBackground
                            ? "border border-white/15 bg-black/55"
                            : "border border-transparent bg-transparent"
                        }`}
                      >
                        {mode === "Subtitled" ? previewText : `Voiceover: ${previewText}`}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" />
                        Playhead {formatTimecode(playheadSec)} / {formatTimecode(playbackDuration)}
                      </span>
                      <span>{segments.length} segments</span>
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={toggleVideoPlayback}
                        disabled={!videoPreviewUrl}
                      >
                        {isVideoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {isVideoPlaying ? "Pause" : "Play"}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => seekVideo(playheadSec - 5)} disabled={!videoPreviewUrl}>
                        -5s
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => seekVideo(playheadSec + 5)} disabled={!videoPreviewUrl}>
                        +5s
                      </Button>
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
                      max={playbackDuration}
                      step={1}
                      value={[playheadSec]}
                      onValueChange={(value) => seekVideo(value[0] ?? 0)}
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
                              className={`absolute top-1 h-6 rounded-sm border transition ${
                                active
                                  ? "border-white/40 bg-white/35"
                                  : "border-white/15 bg-white/10 hover:border-white/35"
                              }`}
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

                    <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-white/60">
                        <Volume2 className="h-3.5 w-3.5" />
                        Voiceover script
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{voiceoverScript}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="space-y-3">
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={segmentQuery}
                      onChange={(event) => setSegmentQuery(event.target.value)}
                      placeholder="Search subtitle text or time"
                    />
                  </div>

                  <div className="max-h-[440px] space-y-3 overflow-auto pr-1">
                    {visibleSegments.map((segment) => (
                      <div
                        key={segment.id}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                      >
                        <div className="mb-2 grid grid-cols-2 gap-2">
                          <Input
                            value={segment.start}
                            onChange={(event) => updateSegment(segment.id, { start: event.target.value })}
                          />
                          <Input
                            value={segment.end}
                            onChange={(event) => updateSegment(segment.id, { end: event.target.value })}
                          />
                        </div>
                        <Textarea
                          value={segment.text}
                          onChange={(event) => updateSegment(segment.id, { text: event.target.value })}
                        />
                        <div className="mt-2">
                          <Button size="sm" variant="ghost" onClick={() => selectSegment(segment)}>
                            Open at playhead
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    className="gap-2"
                    onClick={() => void handleRegenerate()}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Regenerate captions
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>

        <Card className="border-white/10 bg-black/50">
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Downloads are generated on the client via Blob.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="mb-3 space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="text-sm font-medium">Output appearance</p>
              <p className="text-xs text-muted-foreground">
                Configure how translated output should look after processing.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Subtitle size</Label>
                  <Select value={subtitleSize} onValueChange={(value) => setSubtitleSize(value as "S" | "M" | "L")}>
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
                  <Select
                    value={subtitlePosition}
                    onValueChange={(value) => setSubtitlePosition(value as "top" | "bottom")}
                  >
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
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Text case</Label>
                  <Select
                    value={textCase}
                    onValueChange={(value) => setTextCase(value as "normal" | "upper" | "lower")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="upper">UPPERCASE</SelectItem>
                      <SelectItem value="lower">lowercase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Voice tone</Label>
                  <Select value={voiceTone} onValueChange={setVoiceTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Natural">Natural</SelectItem>
                      <SelectItem value="Formal">Formal</SelectItem>
                      <SelectItem value="Soft">Soft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <Label htmlFor="sub-bg-switch">Subtitle background</Label>
                <Switch
                  id="sub-bg-switch"
                  checked={subtitleBackground}
                  onCheckedChange={setSubtitleBackground}
                />
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => void handleExport("SRT")}
            >
              <Download className="h-4 w-4" />
              Download SRT
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => void handleExport("VTT")}
            >
              <Download className="h-4 w-4" />
              Download VTT
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => void handleExport("TXT")}
            >
              <Download className="h-4 w-4" />
              Download text
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void handleExport("VIDEO")}>
              Download video
            </Button>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-white/80" />
                Subtitle edits and voiceover script remain synchronized across the full timeline.
              </p>
            </div>

            <Button asChild variant="ghost" className="mt-3 w-full">
              <Link href="/history">Back to history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
