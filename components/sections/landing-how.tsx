import { landingSteps } from "@/lib/mock/data";

import { Reveal } from "@/components/layout/reveal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingHow() {
  return (
    <section className="container mt-20 md:mt-24">
      <Reveal>
        <div className="mb-8 flex flex-col gap-4 border-y border-white/10 py-8 md:flex-row md:items-end md:justify-between">
          <h2 className="section-title max-w-xl">Как работает</h2>
          <p className="section-copy max-w-md">
            От захвата жестов до субтитров и озвучки: компактный pipeline в три шага.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {landingSteps.map((step, idx) => (
          <Reveal key={step.title} delay={0.1 * idx}>
            <Card className="h-full border-0 bg-white/[0.03] shadow-none">
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/8">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Step 0{idx + 1}
                </div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
