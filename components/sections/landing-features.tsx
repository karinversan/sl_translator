import { landingFeatures } from "@/lib/mock/data";

import { Reveal } from "@/components/layout/reveal";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingFeatures() {
  return (
    <section className="container mt-20 md:mt-24">
      <Reveal>
        <div className="mb-8">
          <h2 className="section-title">Features</h2>
          <p className="section-copy mt-3 max-w-2xl">
            The interface is built as one design system: consistent cards, chips, statuses,
            toggles, and controls across all flows.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {landingFeatures.map((feature, idx) => (
          <Reveal key={feature.title} delay={idx * 0.06}>
            <Card className="group h-full border-0 bg-white/[0.03] shadow-none transition hover:bg-white/[0.05]">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/8 group-hover:bg-white/12">
                  <feature.icon className="h-5 w-5 text-primary" />
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
