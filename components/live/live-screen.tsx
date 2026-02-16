"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleDot, Eraser, Mic2, Pause, Play, Settings2 } from "lucide-react";

import { ApiModelVersion, listModels, livePredictChunk } from "@/lib/api/backend";
import { runtimeOutputLanguages, runtimeSignLanguages, runtimeVoiceOptions } from "@/lib/config/runtime-options";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

import { LiveSettings, LiveSettingsState } from "@/components/live/live-settings";
import { SubtitleLine, SubtitleOverlay } from "@/components/live/subtitle-overlay";

const defaultSettings: LiveSettingsState = {
  signLanguage: runtimeSignLanguages[0],
  outputLanguage: runtimeOutputLanguages[0],
  subtitleSize: "M",
  subtitlePosition: "bottom",
  subtitleBg: true,
  profile: "Speed",
  voiceEnabled: false,
  voice: runtimeVoiceOptions[0].value,
  smoothness: 62
};

const timeFormatter = new Intl.DateTimeFormat([], {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function formatLiveError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("load failed") ||
    normalized.includes("networkerror")
  ) {
    return "Cannot reach backend live API. Check that backend is running and NEXT_PUBLIC_API_BASE_URL is correct.";
  }
  if (message.includes("live_inference_failed")) {
    return "Model inference failed for this chunk. Verify active model files and runtime assets.";
  }
  if (message.includes("model_not_found")) {
    return "Selected model is not available anymore. Choose another model from settings.";
  }
  if (message.includes("model_framework_not_runtime_supported")) {
    return "Selected model framework is not supported for live runtime inference.";
  }
  return message;
}

function predictionsToLines(predictions: Array<{ label: string; text: string; confidence: number }>): SubtitleLine[] {
  return predictions.map((item, index) => ({
    id: `${Date.now()}-${index}`,
    text: item.text,
    confidence: Math.max(0, Math.min(item.confidence, 1)),
    kind: item.confidence >= 0.72 ? "final" : "partial",
    timestamp: timeFormatter.format(new Date())
  }));
}

export function LiveScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [settings, setSettings] = useState<LiveSettingsState>(defaultSettings);
  const [subtitleLines, setSubtitleLines] = useState<SubtitleLine[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [models, setModels] = useState<ApiModelVersion[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("active");

  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pendingChunkRef = useRef<Blob | null>(null);
  const isSendingChunkRef = useRef(false);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  const stopRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;
    pendingChunkRef.current = null;
    isSendingChunkRef.current = false;
  }, []);

  const stopCamera = useCallback(() => {
    stopRecorder();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, [stopRecorder]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API is not available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (cameraRef.current) {
        cameraRef.current.srcObject = stream;
        await cameraRef.current.play().catch(() => undefined);
      }
      setCameraError(null);
      setCameraReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera access denied";
      setCameraError(message);
      stopCamera();
    }
  }, [stopCamera]);

  const chunkDurationMs = useMemo(() => {
    const base = settings.profile === "Speed" ? 1200 : 2100;
    const smoothnessShift = Math.round((settings.smoothness - 50) * 12);
    return Math.max(900, Math.min(3200, base + smoothnessShift));
  }, [settings.profile, settings.smoothness]);

  const sendChunkForInference = useCallback(
    async (chunk: Blob) => {
      if (!chunk || chunk.size === 0) return;
      if (isSendingChunkRef.current) {
        pendingChunkRef.current = chunk;
        return;
      }

      isSendingChunkRef.current = true;
      try {
        const startedAt = performance.now();
        const modelVersionId = selectedModelId === "active" ? undefined : selectedModelId;
        const topK = settings.profile === "Quality" ? 4 : 2;
        const result = await livePredictChunk({
          file: chunk,
          fileName: "live-chunk.webm",
          modelVersionId,
          decoderMode: "realtime",
          topK,
        });

        const nextLines = predictionsToLines(result.predictions);
        if (nextLines.length) {
          setSubtitleLines((prev) => [...prev.slice(-1), ...nextLines].slice(-2));
          setConfidence(Math.round(nextLines.at(-1)!.confidence * 100));
        }
        setLatencyMs(Math.round(performance.now() - startedAt));
        setLiveError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "live_inference_failed";
        setLiveError(formatLiveError(message));
      } finally {
        isSendingChunkRef.current = false;
        const pending = pendingChunkRef.current;
        pendingChunkRef.current = null;
        if (pending) {
          void sendChunkForInference(pending);
        }
      }
    },
    [selectedModelId, settings.profile]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await listModels();
        setModels(fetched);
        const active = fetched.find((item) => item.is_active);
        if (active) {
          setSelectedModelId(active.id);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load model list";
        setLiveError(formatLiveError(message));
      }
    };

    void load();
  }, []);

  useEffect(() => {
    if (!isRunning || !cameraEnabled) {
      stopCamera();
      return;
    }
    void startCamera();
  }, [cameraEnabled, isRunning, startCamera, stopCamera]);

  useEffect(() => {
    if (!isRunning || !cameraEnabled || !cameraReady || !streamRef.current) {
      stopRecorder();
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setLiveError("MediaRecorder API is not available in this browser.");
      return;
    }

    const preferred = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    let mimeType = "";
    for (const candidate of preferred) {
      if (MediaRecorder.isTypeSupported(candidate)) {
        mimeType = candidate;
        break;
      }
    }

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
    } catch (error) {
      const message = error instanceof Error ? error.message : "live_recorder_init_failed";
      setLiveError(formatLiveError(message));
      return;
    }

    recorder.ondataavailable = (event: BlobEvent) => {
      if (!event.data || event.data.size === 0) return;
      void sendChunkForInference(event.data);
    };
    recorder.onerror = () => {
      setLiveError("Camera stream recorder failed.");
    };

    recorder.start(chunkDurationMs);
    recorderRef.current = recorder;

    return () => {
      if (recorder.state !== "inactive") recorder.stop();
      if (recorderRef.current === recorder) recorderRef.current = null;
      pendingChunkRef.current = null;
      isSendingChunkRef.current = false;
    };
  }, [cameraEnabled, cameraReady, chunkDurationMs, isRunning, sendChunkForInference, stopRecorder]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const status = isRunning ? "Connected" : "Idle";

  const confidenceVariant = useMemo(() => {
    if (confidence >= 90) return "success" as const;
    if (confidence >= 78) return "default" as const;
    return "warning" as const;
  }, [confidence]);

  const modelOptions = useMemo(() => {
    return models.filter((item) => ["torch", "torchscript"].includes(item.framework.toLowerCase()));
  }, [models]);

  return (
    <section className="relative h-[calc(100dvh-4rem)] min-h-[560px] overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_0%,rgba(255,255,255,0.08),transparent_58%),linear-gradient(180deg,#0e1118_0%,#080a0f_45%,#06070a_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_68%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="absolute inset-0 scan-overlay opacity-70" />

      <div className="relative z-20 flex h-full flex-col">
        <header className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-xl md:mx-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/20 bg-white/10 p-1.5">
              <CircleDot className="h-4 w-4 text-white/80" />
            </div>
            <div>
              <p className="font-accent text-sm tracking-wide">SignFlow Live</p>
              <p className="text-xs text-muted-foreground">Realtime subtitles from active runtime model</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
            <Badge variant={isRunning ? "success" : "secondary"}>{status}</Badge>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </SheetTrigger>
              <SheetContent side={isDesktop ? "right" : "bottom"} className="max-h-[90vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Live Settings</SheetTitle>
                  <SheetDescription>
                    Configuration for runtime live stream.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <LiveSettings state={settings} setState={setSettings} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="relative flex-1">
          <div className="absolute inset-4 rounded-3xl border border-white/15 bg-black/25 md:inset-6" />
          {cameraEnabled && (
            <div className="absolute inset-4 overflow-hidden rounded-3xl bg-black/50 md:inset-6">
              <video ref={cameraRef} className="h-full w-full object-cover" muted playsInline />
            </div>
          )}
          {subtitlesEnabled && (
            <SubtitleOverlay
              lines={subtitleLines}
              size={settings.subtitleSize}
              position={settings.subtitlePosition}
              withBackground={settings.subtitleBg}
            />
          )}

          <AnimatePresence>
            {!isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm">
                  Press Start to begin live model inference
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isRunning && cameraEnabled && cameraError && (
            <div className="absolute inset-x-0 top-6 flex justify-center px-4">
              <div className="rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Camera unavailable: {cameraError}
              </div>
            </div>
          )}
          {isRunning && liveError && (
            <div className="absolute inset-x-0 top-16 flex justify-center px-4">
              <div className="max-w-2xl rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-xs text-red-100">
                {liveError}
              </div>
            </div>
          )}
        </div>

        <div className="mx-4 mb-4 mt-3 rounded-xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl md:mx-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                setIsRunning((prev) => !prev);
                if (isRunning) {
                  setLatencyMs(null);
                }
              }}
              className="min-w-24 gap-1.5"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isRunning ? "Pause" : "Start"}
            </Button>

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5">
              <Mic2 className={cn("h-4 w-4", settings.voiceEnabled ? "text-white/90" : "text-muted-foreground")} />
              <span className="text-sm">Voice</span>
              <Switch
                checked={settings.voiceEnabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, voiceEnabled: checked }))
                }
              />
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5">
              <span className="text-sm">Subtitles</span>
              <Switch checked={subtitlesEnabled} onCheckedChange={setSubtitlesEnabled} />
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5">
              <Camera className={cn("h-4 w-4", cameraEnabled ? "text-white/90" : "text-muted-foreground")} />
              <span className="text-sm">Camera</span>
              <Switch checked={cameraEnabled} onCheckedChange={setCameraEnabled} />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSubtitleLines([]);
                setConfidence(0);
                setLatencyMs(null);
                setLiveError(null);
              }}
              className="gap-1.5"
            >
              <Eraser className="h-4 w-4" />
              Clear
            </Button>

            <div className="min-w-64 rounded-lg border border-white/15 bg-white/[0.03] px-2 py-1.5">
              <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                <SelectTrigger className="h-8 border-0 bg-transparent px-1 text-xs">
                  <SelectValue placeholder="Select runtime model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Use active model</SelectItem>
                  {modelOptions.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name} {model.framework === "torchscript" || model.framework === "torch" ? "(PyTorch)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto min-w-52 flex-1 md:max-w-xs">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <Progress value={confidence} />
            </div>

            <Badge variant={confidenceVariant}>{subtitleLines.at(-1)?.kind ?? "waiting"}</Badge>
            <Badge variant="secondary">{latencyMs === null ? "latency --" : `${latencyMs} ms`}</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
