import Link from "next/link";
import { Home, Radio, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { aboutValues } from "@/lib/mock/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <section className="container pb-14 pt-12">
      <div className="page-head flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="page-kicker">About the project</p>
          <h1 className="section-title">About SignFlow</h1>
          <p className="page-lead">
            We design interfaces where subtitles become the central communication layer.
            This project presents visual direction and interactions before real ML integration.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/live">
              <Radio className="h-4 w-4" />
              Realtime
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Video
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {aboutValues.map((value) => (
          <Card key={value.title} className="border-white/10 bg-black/45">
            <CardHeader>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                <value.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>{value.title}</CardTitle>
              <CardDescription>{value.text}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Design principle</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
