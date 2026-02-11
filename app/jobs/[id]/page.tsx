"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Home, Radio, RefreshCcw, Sparkles, Upload, Volume2 } from "lucide-react";

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

type PreviewMode = "Original" | "Subtitled" | "Voiceover";

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
  const toSrtTs = (value: string) => `${value},000`;
  return segments
    .map((segment, index) => {
      return `${index + 1}\n${toSrtTs(segment.start)} --> ${toSrtTs(segment.end)}\n${segment.text}`;
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

export default function JobDetailsPage() {
  const params = useParams<{ id: string }>();
  const [progress, setProgress] = useState(18);
  const [status, setStatus] = useState<"Processing" | "Done">("Processing");
  const [mode, setMode] = useState<PreviewMode>("Subtitled");
  const [segments, setSegments] = useState<TranscriptSegment[]>(defaultTranscript);
  const [playhead, setPlayhead] = useState(28);
  const [activeSegmentId, setActiveSegmentId] = useState(defaultTranscript[0]?.id ?? "");
  const [subtitleSize, setSubtitleSize] = useState<"S" | "M" | "L">("M");
  const [subtitlePosition, setSubtitlePosition] = useState<"bottom" | "top">("bottom");
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [textCase, setTextCase] = useState<"normal" | "upper" | "lower">("normal");
  const [voiceTone, setVoiceTone] = useState("Natural");

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

  useEffect(() => {
    const index = Math.floor((playhead / 100) * (segments.length - 1));
    const segment = segments[Math.max(0, index)];
    if (segment) setActiveSegmentId(segment.id);
  }, [playhead, segments]);

  const updateSegment = (id: string, patch: Partial<TranscriptSegment>) => {
    setSegments((prev) => prev.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)));
  };

  const activeSegment = useMemo(
    () => segments.find((segment) => segment.id === activeSegmentId) ?? segments[0],
    [activeSegmentId, segments]
  );

  const formatByCase = useCallback(
    (value: string) => {
      if (textCase === "upper") return value.toUpperCase();
      if (textCase === "lower") return value.toLowerCase();
      return value;
    },
    [textCase]
  );

  const transcriptText = useMemo(() => segments.map((segment) => segment.text).join("\n"), [segments]);
  const previewText = useMemo(
    () => (activeSegment ? formatByCase(activeSegment.text) : ""),
    [activeSegment, formatByCase]
  );

  // Voiceover script intentionally derives from subtitles, so both stay in sync.
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
            Any subtitle change instantly updates both preview output and voiceover script.
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

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.42fr_0.88fr]">
        <Card className="border-white/10 bg-black/50">
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

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border border-white/12 bg-black/45 p-4">
                    <div className="relative flex h-[340px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                      <div className="absolute inset-0 scan-overlay opacity-35" />
                      <p className="text-sm text-muted-foreground">Mock player ({mode})</p>

                      {mode !== "Original" && activeSegment && (
                        <div
                          className={`absolute ${subtitlePositionClass} left-1/2 w-[90%] max-w-xl -translate-x-1/2 rounded-lg px-3 py-2 text-center leading-snug ${subtitleSizeClass} ${
                            subtitleBackground
                              ? "border border-white/15 bg-black/55"
                              : "border border-transparent bg-transparent"
                          }`}
                        >
                          {mode === "Subtitled"
                            ? previewText
                            : `Voiceover: ${previewText}`}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Timeline scrubber</span>
                        <span>{playhead}%</span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[playhead]}
                        onValueChange={(value) => setPlayhead(value[0] ?? 0)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Card className="border-white/10 bg-black/45">
                    <CardHeader>
                      <CardTitle className="text-base">Subtitle editor on video</CardTitle>
                      <CardDescription>
                          Select a segment and edit the text: overlay and voice script update immediately.
                      </CardDescription>
                    </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="max-h-[180px] space-y-2 overflow-auto pr-1">
                          {segments.map((segment) => (
                            <button
                              key={segment.id}
                              type="button"
                              onClick={() => setActiveSegmentId(segment.id)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                activeSegmentId === segment.id
                                  ? "border-white/28 bg-white/[0.08]"
                                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
                              }`}
                            >
                              <p className="text-xs text-muted-foreground">
                                {segment.start} - {segment.end}
                              </p>
                              <p className="mt-1 line-clamp-2">{segment.text}</p>
                            </button>
                          ))}
                        </div>

                        {activeSegment && (
                          <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                            <Label>Active subtitle text</Label>
                            <Textarea
                              value={activeSegment.text}
                              onChange={(event) =>
                                updateSegment(activeSegment.id, { text: event.target.value })
                              }
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-white/10 bg-black/45">
                      <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                          <Volume2 className="h-4 w-4 text-white/80" />
                          Voiceover script
                      </CardTitle>
                      <CardDescription>
                          Auto-generated from current subtitles for synchronized voice output.
                      </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm leading-relaxed text-muted-foreground">
                          {voiceoverScript}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="space-y-3">
                <div className="mt-4 space-y-3">
                  {segments.map((segment) => (
                    <div key={segment.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
                    </div>
                  ))}

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
                Any subtitle segment edit instantly updates the Voiceover script block.
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
