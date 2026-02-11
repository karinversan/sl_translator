import { docsFaq } from "@/lib/mock/data";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DocsPage() {
  return (
    <section className="container pb-14 pt-12">
      <div className="mb-8 max-w-3xl">
        <h1 className="section-title">Docs</h1>
        <p className="section-copy mt-3">
          Быстрый старт: перейдите в `/live` для имитации потока и в `/upload` для mock-пайплайна
          задач.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Откройте Live и запустите поток кнопкой Start.</li>
            <li>Измените язык/стиль в settings sheet.</li>
            <li>Перейдите в Upload, добавьте mock-файл и создайте job.</li>
            <li>На странице Job отредактируйте transcript и скачайте SRT/VTT.</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="mt-5">
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
