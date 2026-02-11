"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { pricingPlans } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <section className="container pb-14 pt-12">
      <div className="mb-8 text-center">
        <h1 className="section-title">Pricing</h1>
        <p className="section-copy mt-3">
          Три плана: Free, Pro, Studio. Логика оплаты mock, только UI.
        </p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-3">
        <span className={cn("text-sm", !yearly ? "text-foreground" : "text-muted-foreground")}>
          Monthly
        </span>
        <Switch checked={yearly} onCheckedChange={setYearly} />
        <span className={cn("text-sm", yearly ? "text-foreground" : "text-muted-foreground")}>
          Yearly
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {pricingPlans.map((plan) => {
          const price = yearly ? plan.yearly : plan.monthly;

          return (
            <Card
              key={plan.name}
              className={cn(
                "h-full",
                plan.highlighted && "border-primary/40 bg-primary/[0.08] shadow-glow"
              )}
            >
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <p className="mt-3 font-accent text-4xl">{price === 0 ? "$0" : `$${price}`}</p>
                <p className="text-sm text-muted-foreground">per month</p>
              </CardHeader>
              <CardContent className="flex h-full flex-col">
                <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-cyan-300" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-auto w-full" variant={plan.highlighted ? "default" : "secondary"}>
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
