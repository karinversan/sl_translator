"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleDot, Eraser, Mic2, Pause, Play, Settings2 } from "lucide-react";

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
  const [settings, setSettings] = useState<LiveSettingsState>(defaultSettings);
  const [subtitleLines, setSubtitleLines] = useState(seedSubtitles());
  const [confidence, setConfidence] = useState(86);
  const seedRef = useRef(2);
  const isDesktop = useMediaQuery("(min-width: 768px)");

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

  const status = isRunning ? "Connected" : "Idle";

  const confidenceVariant = useMemo(() => {
    if (confidence >= 90) return "success" as const;
    if (confidence >= 78) return "default" as const;
    return "warning" as const;
  }, [confidence]);

  return (
    <section className="relative h-[100dvh] overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#070b14] via-[#06060d] to-[#0a0f1c]" />
        <motion.div
          animate={{ x: ["-8%", "8%", "-8%"], y: ["2%", "-2%", "2%"] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[-10%] top-[-20%] h-[70vh] w-[60vw] rounded-full bg-cyan-500/20 blur-[120px]"
        />
        <motion.div
          animate={{ x: ["4%", "-6%", "4%"], y: ["-3%", "3%", "-3%"] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[-12%] top-[14%] h-[65vh] w-[50vw] rounded-full bg-fuchsia-500/15 blur-[120px]"
        />
      </div>

      <div className="absolute inset-0 scan-overlay opacity-70" />

      <div className="relative z-20 flex h-full flex-col">
        <header className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl md:mx-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-white/20 bg-white/10 p-1.5">
              <CircleDot className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <p className="font-accent text-sm tracking-wide">SignFlow Live</p>
              <p className="text-xs text-muted-foreground">Subtitle overlay demo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isRunning ? "success" : "secondary"}>{status}</Badge>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Settings2 className="h-4 w-4" />
                  Settings
                </Button>
              </SheetTrigger>
              <SheetContent side={isDesktop ? "right" : "bottom"} className="max-h-[90vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Live Settings</SheetTitle>
                  <SheetDescription>
                    Конфигурация демонстрационного live-потока.
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
          <SubtitleOverlay
            lines={subtitleLines}
            size={settings.subtitleSize}
            position={settings.subtitlePosition}
            withBackground={settings.subtitleBg}
          />

          <AnimatePresence>
            {!isRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm">
                  Нажмите Start, чтобы запустить mock поток субтитров
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
              <Mic2 className={cn("h-4 w-4", settings.voiceEnabled ? "text-cyan-300" : "text-muted-foreground")} />
              <span className="text-sm">Voice</span>
              <Switch
                checked={settings.voiceEnabled}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, voiceEnabled: checked }))
                }
              />
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
