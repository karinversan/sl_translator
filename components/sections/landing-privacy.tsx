import { Shield } from "lucide-react";

import { privacyItems } from "@/lib/mock/data";
import { Reveal } from "@/components/layout/reveal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LandingPrivacy() {
  return (
    <section className="container mb-14 mt-20 md:mt-24">
      <Reveal>
        <Card className="relative overflow-hidden border-0 bg-white/[0.03] shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Privacy
            </CardTitle>
            <CardDescription>
              No unrealistic promises: only clear explanation of the mock mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {privacyItems.map((line) => (
              <div
                key={line}
                className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground"
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
