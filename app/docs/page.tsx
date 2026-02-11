import { docsFaq } from "@/lib/mock/data";
import Link from "next/link";
import { Home, Radio, Upload } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocsPage() {
  return (
    <section className="container pb-14 pt-12">
      <div className="page-head flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="page-kicker">Docs and FAQ</p>
          <h1 className="section-title">Docs</h1>
          <p className="page-lead">
            Quick start: open `/live` for simulated realtime streaming and `/upload` for the mock
            video workflow.
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

      <Card className="border-white/10 bg-black/45">
        <CardHeader>
          <CardTitle>Quick instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Live and start the stream with the Start button.</li>
            <li>Adjust language and style in the settings sheet.</li>
            <li>Go to Upload, add a mock file, and create a job.</li>
            <li>On the Job page, edit the transcript and download SRT/VTT.</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="mt-5 border-white/10 bg-black/45">
        <CardHeader>
          <CardTitle>FAQ</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            {docsFaq.map((item, index) => (
              <AccordionItem key={item.q} value={`item-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}
