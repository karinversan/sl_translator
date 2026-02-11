"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const heroDescription =
  "SignFlow переводит жестовый язык в читаемые субтитры и синхронный voiceover. Это UI-прототип с живым сценарием: live, upload, editing и export.";

function Typewriter({ text }: { text: string }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setValue(text.slice(0, index));
      if (index >= text.length) clearInterval(timer);
    }, 18);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <p className="max-w-2xl text-sm leading-relaxed text-white/78 md:text-base">
      {value}
      {value.length < text.length && <span className="ml-0.5 inline-block animate-pulse">|</span>}
    </p>
  );
}

export function LandingHero() {
  const [revealCTA, setRevealCTA] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setRevealCTA(window.scrollY > 120);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="relative h-[170vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#07080d]">
        <div className="absolute inset-0 bg-[radial-gradient(920px_380px_at_50%_-5%,rgba(255,255,255,0.14),transparent_60%),linear-gradient(180deg,#12151c_0%,#0b0d12_52%,#06070b_100%)]" />
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:120px_120px]" />
        <div className="absolute inset-x-0 top-[22%] h-px bg-white/15" />
        <div className="absolute inset-x-0 bottom-[17%] h-px bg-white/10" />

        <div className="relative mx-auto h-full w-full max-w-7xl px-5 md:px-10">
          <div className="absolute left-5 right-5 top-24 z-20 md:left-10 md:right-10 md:top-28">
            <h1 className="font-accent text-[16vw] uppercase leading-[0.82] tracking-tight text-white md:text-[10.2rem]">
              Signflow
            </h1>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/24 p-4 backdrop-blur-sm md:inline-block md:px-5">
              <Typewriter text={heroDescription} />
            </div>
          </div>

          <div
            className={cn(
              "absolute bottom-16 left-5 right-5 z-30 transition-all duration-500 md:left-10 md:right-10",
              revealCTA ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"
            )}
          >
            <div className="mx-auto mb-5 max-w-3xl text-center text-xs uppercase tracking-[0.22em] text-white/70">
              <span className="inline-flex items-center gap-2">
                <ChevronDown className="h-3.5 w-3.5" />
                Scroll to open translation modes
              </span>
            </div>

            <div className="mx-auto grid max-w-4xl gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/14 bg-black/38 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/58">Mode 01</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Live субтитры</h3>
                <p className="mt-2 text-sm text-white/72">
                  Режим реального времени: overlay субтитров, confidence и панель настроек.
                </p>
                <Button asChild size="lg" className="mt-4 w-full rounded-full bg-white text-black hover:bg-white/90">
                  <Link href="/live">Открыть Live</Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-white/14 bg-black/38 p-5 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-white/58">Mode 02</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Загрузить видео</h3>
                <p className="mt-2 text-sm text-white/72">
                  Пост-обработка: загрузка, редактирование сегментов, выбор стиля и экспорт.
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="mt-4 w-full rounded-full border-white/15 bg-black/48 text-white hover:bg-black/60"
                >
                  <Link href="/upload">Открыть Upload</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-5 right-5 z-20 flex items-end justify-between gap-3 text-xs uppercase tracking-[0.2em] text-white/68 md:left-10 md:right-10">
            <p>Subtitle-first platform</p>
            <p className="text-right">Live / Upload / Jobs</p>
          </div>
        </div>
      </div>
    </section>
  );
}
