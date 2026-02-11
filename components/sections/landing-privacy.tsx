import { Shield } from "lucide-react";

import { privacyItems } from "@/lib/mock/data";
import { Reveal } from "@/components/layout/reveal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingPrivacy() {
  return (
    <section className="container mb-14 mt-16 md:mt-24">
      <Reveal>
        <Card className="relative overflow-hidden">
          <div className="absolute -top-20 right-10 h-44 w-44 rounded-full bg-sky-500/15 blur-[90px]" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-300" />
              Приватность
            </CardTitle>
            <CardDescription>
              Блок отображает только принципы demo-режима без обещаний реальной обработки.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {privacyItems.map((line) => (
              <div
                key={line}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-muted-foreground"
              >
                {line}
              </div>
            ))}
          </CardContent>
        </Card>
      </Reveal>
    </section>
  );
}
