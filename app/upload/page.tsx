"use client";

import { ChangeEvent, DragEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Film, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { outputLanguages, signLanguages, voiceOptions } from "@/lib/mock/data";

const exportOptions = ["SRT", "VTT", "Burn-in video", "Audio only", "Video+Audio"];

type MockFile = {
  id: string;
  name: string;
  size: string;
};

function sizeToReadable(size: number) {
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<MockFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [signLanguage, setSignLanguage] = useState("ASL");
  const [outputLanguage, setOutputLanguage] = useState("English");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voice, setVoice] = useState("nova");
  const [subtitleSize, setSubtitleSize] = useState("M");
  const [subtitlePosition, setSubtitlePosition] = useState("bottom");
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [selectedExports, setSelectedExports] = useState<string[]>(["SRT", "VTT"]);

  const onFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const mapped = Array.from(incoming).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: sizeToReadable(file.size || 6_000_000)
    }));
    setFiles((prev) => [...mapped, ...prev]);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    onFiles(event.dataTransfer.files);
  };

  const canStart = useMemo(() => files.length > 0, [files.length]);

  return (
    <section className="container pb-14 pt-12">
      <div className="mb-8 max-w-3xl">
        <h1 className="section-title">Upload Video</h1>
        <p className="section-copy mt-3">
          Полностью mock-загрузка: drag-and-drop зона, пресеты и запуск имитации обработки.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Видеофайлы</CardTitle>
            <CardDescription>Файлы не отправляются, список хранится только в UI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`flex min-h-60 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${
                dragActive
                  ? "border-primary/70 bg-primary/10"
                  : "border-white/20 bg-white/[0.02] hover:border-white/35"
              }`}
            >
              <FileUp className="mb-3 h-8 w-8 text-primary" />
              <p className="font-medium">Drag & drop video here</p>
              <p className="mt-1 text-sm text-muted-foreground">или выберите файл вручную</p>
              <input
                className="hidden"
                type="file"
                accept="video/*"
                multiple
                onChange={(event: ChangeEvent<HTMLInputElement>) => onFiles(event.target.files)}
              />
            </label>

            <div className="space-y-2">
              {files.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-muted-foreground">
                  Пока нет файлов.
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Film className="h-4 w-4 text-cyan-300" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{file.size}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WandSparkles className="h-5 w-5 text-fuchsia-300" />
              Настройки перед обработкой
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sign language</Label>
                <Select value={signLanguage} onValueChange={setSignLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {signLanguages.map((language) => (
                      <SelectItem key={language} value={language}>
                        {language}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Output language</Label>
                <Select value={outputLanguage} onValueChange={setOutputLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {outputLanguages.map((language) => (
                      <SelectItem key={language} value={language}>
                        {language}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="mb-2 text-sm font-medium">Export</p>
              <div className="grid grid-cols-2 gap-2">
                {exportOptions.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={selectedExports.includes(item)}
                      onCheckedChange={(checked) =>
                        setSelectedExports((prev) =>
                          checked ? [...prev, item] : prev.filter((value) => value !== item)
                        )
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <p className="mb-2 text-sm font-medium">Subtitle style</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select value={subtitleSize} onValueChange={setSubtitleSize}>
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
                <div className="space-y-2">
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
              <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <Label htmlFor="sub-bg">Background</Label>
                <Switch
                  id="sub-bg"
                  checked={subtitleBackground}
                  onCheckedChange={setSubtitleBackground}
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Voice settings</p>
                <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
              </div>
              <div className="mt-3">
                <Select value={voice} onValueChange={setVoice} disabled={!voiceEnabled}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voiceOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!canStart}
              onClick={() => {
                const mockId = `job_${Math.random().toString(36).slice(2, 7)}`;
                router.push(`/jobs/${mockId}`);
              }}
            >
              Start processing
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
