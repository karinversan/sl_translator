import { landingFeatures } from "@/lib/mock/data";

import { Reveal } from "@/components/layout/reveal";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingFeatures() {
  return (
    <section className="container mt-16 md:mt-24">
      <Reveal>
        <div className="mb-8">
          <h2 className="section-title">Возможности</h2>
          <p className="section-copy mt-3 max-w-2xl">
            Компоненты и сценарии уже готовы для demo-flow: live overlay, upload-пайплайн, редактирование
            транскрипта и экспорт из браузера.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {landingFeatures.map((feature, idx) => (
          <Reveal key={feature.title} delay={idx * 0.05}>
            <Card className="group h-full border-white/10 transition hover:border-primary/35 hover:shadow-glow">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 group-hover:border-primary/40 group-hover:bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary/90" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
