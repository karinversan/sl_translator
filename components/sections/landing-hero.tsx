import Link from "next/link";
import { ArrowUpRight, Captions, UploadCloud } from "lucide-react";

import { Reveal } from "@/components/layout/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingHero() {
  return (
    <section className="container pt-16 md:pt-24">
      <Reveal className="mx-auto max-w-4xl text-center">
        <Badge className="mx-auto mb-5 w-fit" variant="secondary">
          Subtitle-first Sign Language UX
        </Badge>
        <h1 className="section-title text-balance text-4xl md:text-7xl">
          Перевод жестового языка
          <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 bg-clip-text text-transparent">
            {" "}
            в субтитры
          </span>
          <span className="text-foreground/80"> и речь</span>
        </h1>
        <p className="section-copy mx-auto mt-6 max-w-2xl">
          Реалтайм-демо интерфейс: фокус на читаемые live-субтитры, стабильный overlay и
          экспорт результатов в привычные форматы.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/live">Открыть Live режим</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/upload">Загрузить видео</Link>
          </Button>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Reveal delay={0.1}>
          <Card className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live субтитры</span>
                <Captions className="h-5 w-5 text-cyan-300" />
              </CardTitle>
              <CardDescription>
                Полноэкранный режим с имитацией камеры, частичными/финальными фразами и
                настройками в sheet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="group/btn w-full justify-between">
                <Link href="/live">
                  Открыть /live
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.2}>
          <Card className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Загрузить видео</span>
                <UploadCloud className="h-5 w-5 text-fuchsia-300" />
              </CardTitle>
              <CardDescription>
                Drag-and-drop зона, пресеты экспорта и быстрый переход в детали mock-задачи.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="group/btn w-full justify-between">
                <Link href="/upload">
                  Открыть /upload
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
