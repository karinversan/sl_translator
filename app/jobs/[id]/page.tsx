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
import { formatSrtTime, formatTimecode, parseTimecodeInput, toSeconds } from "@/lib/utils/timecode";

type PreviewMode = "Original" | "Subtitled" | "Voiceover";
type TimelineZoom = "fit" | 1 | 2 | 4;

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
  const [progress, setProgress] = useState(18);
  const [status, setStatus] = useState<"Processing" | "Done">("Processing");

  const [mode, setMode] = useState<PreviewMode>("Subtitled");
  const [segments, setSegments] = useState<TranscriptSegment[]>(defaultTranscript.map((item) => ({ ...item })));
  const [activeSegmentId, setActiveSegmentId] = useState(defaultTranscript[0]?.id ?? "");
  const [segmentQuery, setSegmentQuery] = useState("");
  const [jumpTo, setJumpTo] = useState("");
  const [timelineZoom, setTimelineZoom] = useState<TimelineZoom>("fit");
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);

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
  }, [status]);

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

  const updateSegment = (id: string, patch: Partial<TranscriptSegment>) => {
    setSegments((prev) => prev.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)));
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
    setPlayheadSec(toSeconds(segment.start));
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
    setPlayheadSec(Math.min(Math.max(parsed, 0), totalDuration));
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

      <Card className="border-white/10 bg-black/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Job {params.id}</CardTitle>
              <CardDescription>
                Status: <span className="text-foreground">{status}</span>
              </CardDescription>
            </div>
            <Badge variant={status === "Done" ? "success" : "default"}>{status}</Badge>
          </div>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.46fr_0.84fr]">
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
                    <p className="text-sm text-muted-foreground">Mock player ({mode})</p>

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
                        Playhead {formatTimecode(playheadSec)} / {formatTimecode(totalDuration)}
                      </span>
                      <span>{segments.length} segments</span>
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
                      max={totalDuration}
                      step={1}
                      value={[playheadSec]}
                      onValueChange={(value) => setPlayheadSec(value[0] ?? 0)}
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
                    onClick={() =>
                      setSegments((prev) =>
                        prev.map((segment, index) => ({
                          ...segment,
                          text: index % 2 === 0 ? `${segment.text} [refined]` : segment.text
                        }))
                      )
                    }
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
              onClick={() => download(`${params.id}.srt`, toSrt(segments), "text/plain")}
            >
              <Download className="h-4 w-4" />
              Download SRT
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => download(`${params.id}.vtt`, toVtt(segments), "text/vtt")}
            >
              <Download className="h-4 w-4" />
              Download VTT
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start gap-2"
              onClick={() => download(`${params.id}.txt`, transcriptText, "text/plain")}
            >
              <Download className="h-4 w-4" />
              Download text
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Download video (Coming soon)
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
