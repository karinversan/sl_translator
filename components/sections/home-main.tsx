"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Clapperboard,
  Cpu,
  Mouse,
  Radio,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { landingFeatures, landingSteps, privacyItems } from "@/lib/mock/data";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const heroDescription =
  "SignFlow переводит жестовый язык в читаемые субтитры и синхронный voiceover. Это интерфейсный прототип: вы можете пройти полный UX-сценарий и протестировать редактор.";

const modeCards = [
  {
    id: "live",
    title: "Realtime",
    subtitle: "Для прямых эфиров и встреч",
    description: "Live overlay субтитров с мгновенным обновлением partial/final строк.",
    bullets: ["Старт за 1 клик", "Настройки языка и голоса", "Быстрый возврат на главный экран"],
    href: "/live",
    icon: Radio
  },
  {
    id: "video",
    title: "Video + Editor",
    subtitle: "Для постобработки видео",
    description: "Один файл -> сразу в редактор перевода, стиля и экспорта результатов.",
    bullets: ["Редактирование сегментов", "Синхронный voiceover script", "Экспорт SRT/VTT/TXT/Mock media"],
    href: "/upload",
    icon: Clapperboard
  }
] as const;

const audience = ["Создатели видео и short-form контента", "EdTech и образовательные команды", "Медиа- и продуктовые команды"];

const faqItems = [
  {
    q: "Это уже реальная модель перевода жестов?",
    a: "Нет. Текущая версия демонстрирует UX и клиентскую логику, без реальной ML-обработки видео."
  },
  {
    q: "Что я получаю на выходе?",
    a: "Mock-результаты в интерфейсе: редактируемый transcript, voiceover script, экспорт SRT/VTT/TXT и демонстрационный export media."
  },
  {
    q: "Как выбрать режим?",
    a: "Realtime для потока в реальном времени. Video + Editor для загрузки файла, редактуры и подготовки финального результата."
  },
  {
    q: "Что с приватностью?",
    a: "В этой демо-версии нет реальной отправки медиа. Все сценарии имитируются локально на фронтенде."
  },
  {
    q: "Насколько точен перевод?",
    a: "Точность не оценивается, потому что это прототип интерфейса. В будущем она будет зависеть от данных, условий съемки и модели."
  },
  {
    q: "Можно ли отключить анимации?",
    a: "Да. Сайт учитывает системную настройку prefers-reduced-motion и упрощает анимации автоматически."
  }
];

function Typewriter({ text }: { text: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(reducedMotion ? text : "");

  useEffect(() => {
    if (reducedMotion) {
      setValue(text);
      return;
    }

    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setValue(text.slice(0, index));
      if (index >= text.length) clearInterval(timer);
    }, 12);

    return () => clearInterval(timer);
  }, [text, reducedMotion]);

  return (
    <p className="max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
      {value}
      {value.length < text.length && <span className="ml-0.5 inline-block animate-pulse">|</span>}
    </p>
  );
}

export function HomeMain() {
  const reducedMotion = usePrefersReducedMotion();
  const [selectedMode, setSelectedMode] = useState<(typeof modeCards)[number]["id"]>("live");
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      const shouldShow = window.scrollY < 24;
      setShowScrollHint((prev) => (prev === shouldShow ? prev : shouldShow));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeMode = useMemo(
    () => modeCards.find((mode) => mode.id === selectedMode) ?? modeCards[0],
    [selectedMode]
  );

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <main id="main-content">
      <section id="hero" className="relative min-h-[100svh] overflow-hidden border-b border-white/10">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_0%,rgba(255,255,255,0.14),transparent_56%),radial-gradient(700px_280px_at_90%_18%,rgba(255,255,255,0.08),transparent_65%),linear-gradient(180deg,#0a0c12_0%,#06070b_52%,#040509_100%)]"
        />
        <div
          aria-hidden
          className={cn(
            "absolute -left-[14%] top-[28%] h-[420px] w-[420px] rounded-full border border-white/10 bg-white/[0.02] blur-2xl",
            !reducedMotion && "animate-float"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "absolute -right-[16%] top-[10%] h-[360px] w-[360px] rounded-full border border-white/10 bg-white/[0.02] blur-2xl",
            !reducedMotion && "animate-float"
          )}
          style={!reducedMotion ? { animationDelay: "0.35s" } : undefined}
        />
        <div className="absolute inset-x-0 top-[20%] h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

        <div className="container relative z-10 flex min-h-[100svh] flex-col justify-center pt-24">
          <div className="max-w-4xl">
            <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.28em] text-white/66">
              PIXEL-TEXT / SUBTITLE-FIRST SIGN INTERFACE
            </p>
            <h1 className="font-accent text-[clamp(3rem,10vw,8.4rem)] uppercase leading-[0.88] tracking-tight">
              Жесты -&gt; Субтитры -&gt; Речь
            </h1>
            <div className="mt-5">
              <Typewriter text={heroDescription} />
            </div>

            <ul className="mt-6 space-y-2 text-sm text-white/76 md:text-base">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-white/80" />
                Realtime субтитры с partial/final отображением.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-white/80" />
                Video editor для правки текста, визуала и озвучки.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-white/80" />
                Экспорт SRT/VTT/TXT и mock media прямо из интерфейса.
              </li>
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild className="h-12 rounded-full bg-white px-6 text-black hover:bg-white/90">
                <Link href={activeMode.href}>
                  Запустить перевод
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="secondary"
                className="h-12 rounded-full px-6"
                onClick={() => scrollToSection("how")}
              >
                Как это работает
              </Button>
            </div>

            <div className="mt-5 inline-flex rounded-full border border-white/14 bg-black/35 p-1">
              {modeCards.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelectedMode(mode.id)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm transition-colors",
                    selectedMode === mode.id ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                  )}
                >
                  {mode.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          data-cursor="scroll"
          onClick={() => scrollToSection("modes")}
          className={cn(
            "absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/72 transition-opacity",
            showScrollHint ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <span className="relative inline-flex h-6 w-4 items-start justify-center rounded-full border border-white/40">
            <span className={cn("mt-1 h-1.5 w-1.5 rounded-full bg-white/85", !reducedMotion && "animate-pulse")} />
          </span>
          <Mouse className="h-3.5 w-3.5" />
          Scroll to modes
        </button>
      </section>

      <section id="modes" className="container cv-auto py-20">
        <Reveal>
          <div className="mx-auto mb-10 max-w-4xl text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-white/60">Mode selector</p>
            <h2 className="mt-3 section-title">Выберите рабочий режим</h2>
            <p className="mx-auto mt-3 max-w-3xl section-copy">
              Нужен поток сейчас - выбирайте Realtime. Нужна точная правка результата - открывайте Video + Editor.
            </p>
          </div>
        </Reveal>

        <div className="grid gap-4 lg:grid-cols-2">
          {modeCards.map((mode, index) => (
            <Reveal key={mode.id} delay={index * 0.08}>
              <Card
                className={cn(
                  "h-full border-white/10 bg-black/45 backdrop-blur-none",
                  selectedMode === mode.id && "border-white/25 bg-white/[0.05]"
                )}
              >
                <CardHeader>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="rounded-lg border border-white/14 bg-white/[0.04] p-2">
                      <mode.icon className="h-5 w-5 text-white/90" />
                    </span>
                    <div>
                      <CardTitle className="text-2xl">{mode.title}</CardTitle>
                      <CardDescription>{mode.subtitle}</CardDescription>
                    </div>
                  </div>
                  <p className="section-copy">{mode.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-white/78">
                    {mode.bullets.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/75" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={selectedMode === mode.id ? "default" : "secondary"}
                    className="mt-6 h-11 rounded-full px-5"
                    onMouseEnter={() => setSelectedMode(mode.id)}
                  >
                    <Link href={mode.href}>
                      Открыть этот режим
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <h2 className="section-title">How it works</h2>
          <p className="mt-3 max-w-3xl section-copy">
            От захвата жестов до готового результата в 3 этапа. Порядок один и тот же для live и video pipeline.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {landingSteps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <Card className="h-full border-white/10 bg-black/42 backdrop-blur-none">
                <CardHeader>
                  <step.icon className="h-5 w-5 text-white/82" />
                  <CardTitle className="mt-3 text-2xl">{step.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">Step {index + 1}</p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="features" className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <h2 className="section-title">Ключевые возможности</h2>
          <p className="mt-3 max-w-3xl section-copy">
            Один интерфейс для real-time потока и постобработки видео с единым набором элементов управления.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {landingFeatures.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.06}>
              <Card className="h-full border-white/10 bg-black/45 backdrop-blur-none">
                <CardHeader>
                  <feature.icon className="h-5 w-5 text-white/84" />
                  <CardTitle className="mt-3 text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="demo" className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <h2 className="section-title">Demo preview</h2>
          <p className="mt-3 max-w-3xl section-copy">
            Быстрый предпросмотр двух сценариев: live overlay и video editor. Без реальной загрузки медиа.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card className="border-white/10 bg-black/48 backdrop-blur-none">
            <CardHeader>
              <CardTitle className="text-2xl">Realtime screen</CardTitle>
              <CardDescription>Камера-плейсхолдер, статус, confidence и поток строк.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-white/12 bg-black/40 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-white/60">
                  <span>Connected</span>
                  <span>Confidence: 92%</span>
                </div>
                <div className="relative h-44 rounded-lg border border-white/10 bg-white/[0.02]">
                  <div className="absolute bottom-3 left-3 right-3 rounded-md border border-white/15 bg-black/60 px-3 py-2 text-sm">
                    Сейчас поток показывает финальную фразу перевода.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-black/48 backdrop-blur-none">
            <CardHeader>
              <CardTitle className="text-2xl">Video + editor</CardTitle>
              <CardDescription>Сегменты, ручная правка и синхронный voiceover script.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 rounded-xl border border-white/12 bg-black/40 p-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                  00:00:01 - 00:00:04 -&gt; Привет, это пример редактируемой строки.
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                  00:00:05 - 00:00:08 -&gt; Изменения сразу попадают в script озвучки.
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                  00:00:09 - 00:00:13 -&gt; Экспорт готовится из текущего состояния.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="model" className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <h2 className="section-title">Модель и архитектура</h2>
          <p className="mt-3 max-w-4xl section-copy">
            Текущая версия описывает pipeline как интерфейсную схему: Vision encoder -&gt; текстовый декодер
            -&gt; слой partial/final субтитров -&gt; модуль voiceover. Это UX-прототип, не production inference.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-7 flex flex-wrap gap-2">
            <span className="glass-chip">Vision encoder</span>
            <span className="glass-chip">Temporal decoding</span>
            <span className="glass-chip">Subtitle compositor</span>
            <span className="glass-chip">Voiceover script generator</span>
            <span className="glass-chip">Client-side mock export</span>
          </div>
        </Reveal>
      </section>

      <section id="status" className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <h2 className="section-title">О проекте, статус и ограничения</h2>
          <p className="mt-3 max-w-4xl section-copy">
            Проект собран как демонстрационный frontend для проверки UX и пользовательских сценариев до интеграции
            реальной модели.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Reveal>
            <Card className="h-full border-white/10 bg-black/45 backdrop-blur-none">
              <CardHeader>
                <Cpu className="h-5 w-5 text-white/84" />
                <CardTitle className="mt-3 text-xl">Кому полезно</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-white/76">
                  {audience.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/75" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>
          <Reveal delay={0.06}>
            <Card className="h-full border-white/10 bg-black/45 backdrop-blur-none">
              <CardHeader>
                <ShieldCheck className="h-5 w-5 text-white/84" />
                <CardTitle className="mt-3 text-xl">Приватность</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-white/76">
                  {privacyItems.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/75" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>
          <Reveal delay={0.12}>
            <Card className="h-full border-white/10 bg-black/45 backdrop-blur-none">
              <CardHeader>
                <Sparkles className="h-5 w-5 text-white/84" />
                <CardTitle className="mt-3 text-xl">Roadmap</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-white/76">
                  <li>v0: UX-прототип live и video editor</li>
                  <li>v1: интеграция real ASR/SLR backend</li>
                  <li>v2: совместная редактура и QA-пайплайн</li>
                </ul>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      <section id="faq" className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <h2 className="section-title">FAQ</h2>
          <p className="mt-3 max-w-3xl section-copy">Короткие ответы по точности, форматам, статусу и ограничениям.</p>
        </Reveal>
        <Reveal delay={0.08}>
          <Card className="mt-8 border-white/10 bg-black/45 backdrop-blur-none">
            <CardContent className="p-0">
              <Accordion type="single" collapsible>
                {faqItems.map((item, index) => (
                  <AccordionItem key={item.q} value={`faq-${index}`} className="border-white/10 px-5">
                    <AccordionTrigger className="py-4 text-left text-base">
                      <span className="flex items-center gap-2">
                        <CircleHelp className="h-4 w-4 text-white/72" />
                        {item.q}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 text-base leading-relaxed text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </Reveal>
      </section>

      <section className="container cv-auto border-t border-white/10 py-20">
        <Reveal>
          <Card className="border-white/12 bg-black/45 backdrop-blur-none">
            <CardContent className="flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/62">Final CTA</p>
                <h2 className="mt-2 text-3xl font-semibold md:text-4xl">Запустить рабочий сценарий</h2>
                <p className="mt-2 max-w-2xl section-copy">
                  Выберите режим и перейдите к интерактивному интерфейсу переводчика без регистрации.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-full bg-white px-6 text-black">
                  <Link href="/live">Открыть Realtime</Link>
                </Button>
                <Button asChild variant="secondary" className="h-12 rounded-full px-6">
                  <Link href="/upload">Открыть Video + Editor</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </section>
    </main>
  );
}
