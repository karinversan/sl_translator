"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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

  const transcriptText = useMemo(
    () => segments.map((segment) => segment.text).join("\n"),
    [segments]
  );

  return (
    <section className="container pb-14 pt-12">
      <Card>
        <CardHeader>
          <CardTitle>Job {params.id}</CardTitle>
          <CardDescription>
            Status: <span className="text-foreground">{status}</span>
          </CardDescription>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
        <Card>
          <CardHeader>
            <Tabs defaultValue="preview" className="w-full">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-3">
                <div className="mt-4 rounded-2xl border border-white/15 bg-black/35 p-4">
                  <div className="mb-3 flex gap-2">
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

                  <div className="relative flex h-72 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-transparent to-cyan-500/10">
                    <p className="text-sm text-muted-foreground">Mock player ({mode})</p>
                    {mode !== "Original" && (
                      <div className="absolute bottom-5 max-w-xl rounded-lg border border-white/15 bg-black/45 px-3 py-2 text-center text-lg">
                        Интерфейс демонстрирует предпросмотр субтитров без реальной обработки.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="space-y-3">
                <div className="mt-4 space-y-3">
                  {segments.map((segment) => (
                    <div
                      key={segment.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                    >
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <Input
                          value={segment.start}
                          onChange={(event) =>
                            setSegments((prev) =>
                              prev.map((item) =>
                                item.id === segment.id ? { ...item, start: event.target.value } : item
                              )
                            )
                          }
                        />
                        <Input
                          value={segment.end}
                          onChange={(event) =>
                            setSegments((prev) =>
                              prev.map((item) =>
                                item.id === segment.id ? { ...item, end: event.target.value } : item
                              )
                            )
                          }
                        />
                      </div>
                      <Textarea
                        value={segment.text}
                        onChange={(event) =>
                          setSegments((prev) =>
                            prev.map((item) =>
                              item.id === segment.id ? { ...item, text: event.target.value } : item
                            )
                          )
                        }
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

        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>Скачивание файлов формируется на клиенте через Blob.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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

            <Button asChild variant="ghost" className="mt-4 w-full">
              <Link href="/history">Back to history</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
