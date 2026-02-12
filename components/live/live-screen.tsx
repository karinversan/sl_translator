"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, CircleDot, Eraser, Mic2, Pause, Play, Settings2 } from "lucide-react";

import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { generateSubtitleChunk, seedSubtitles } from "@/lib/mock/subtitles";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { SubtitleOverlay } from "@/components/live/subtitle-overlay";

const defaultSettings: LiveSettingsState = {
  signLanguage: "ASL",
  outputLanguage: "English",
  subtitleSize: "M",
  subtitlePosition: "bottom",
  subtitleBg: true,
  profile: "Speed",
  voiceEnabled: false,
  voice: "nova",
  smoothness: 62
};

export function LiveScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [settings, setSettings] = useState<LiveSettingsState>(defaultSettings);
  const [subtitleLines, setSubtitleLines] = useState<ReturnType<typeof seedSubtitles>>([]);
  const [confidence, setConfidence] = useState(86);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const seedRef = useRef(2);
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (cameraRef.current) {
      cameraRef.current.srcObject = null;
    }
  }, []);

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera access denied";
      setCameraError(message);
      stopCamera();
    }
  }, [stopCamera]);

  useEffect(() => {
    const seeded = seedSubtitles();
    setSubtitleLines(seeded);
    if (seeded[1]) setConfidence(seeded[1].confidence);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const chunk = generateSubtitleChunk(seedRef.current++);
      setSubtitleLines((prev) => [...prev.slice(-1), chunk]);
      setConfidence(chunk.confidence);
      timeoutId = setTimeout(tick, 1000 + Math.random() * 1000);
    };

    timeoutId = setTimeout(tick, 800);

    return () => clearTimeout(timeoutId);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning || !cameraEnabled) {
      stopCamera();
      return;
    }
    void startCamera();
  }, [cameraEnabled, isRunning, startCamera, stopCamera]);

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
              <p className="text-xs text-muted-foreground">Realtime subtitles and voice controls</p>
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
                    Configuration for the demo live stream.
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
                  Press Start to begin the mock subtitle stream
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
        </div>

        <div className="mx-4 mb-4 mt-3 rounded-xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl md:mx-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => setIsRunning((prev) => !prev)}
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
                setSubtitleLines(seedSubtitles());
                setConfidence(82);
              }}
              className="gap-1.5"
            >
              <Eraser className="h-4 w-4" />
              Clear
            </Button>

            <div className="ml-auto min-w-52 flex-1 md:max-w-xs">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <Progress value={confidence} />
            </div>

            <Badge variant={confidenceVariant}>{subtitleLines.at(-1)?.kind ?? "partial"}</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
