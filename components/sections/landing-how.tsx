import { landingSteps } from "@/lib/mock/data";
import { Reveal } from "@/components/layout/reveal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingHow() {
  return (
    <section className="container mt-16 md:mt-24">
      <Reveal>
        <div className="mb-8">
          <h2 className="section-title">Как работает</h2>
          <p className="section-copy mt-3 max-w-xl">
            Три коротких этапа, которые отражают путь от жестов до итоговых субтитров.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {landingSteps.map((step, idx) => (
          <Reveal key={step.title} delay={0.1 * idx}>
            <Card className="h-full">
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">Step 0{idx + 1}</div>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
