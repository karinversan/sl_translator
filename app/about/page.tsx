import { aboutValues } from "@/lib/mock/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <section className="container pb-14 pt-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="section-title">About SignFlow</h1>
        <p className="section-copy mt-4">
          Мы проектируем интерфейсы, где субтитры становятся центральным слоем коммуникации.
          Этот проект показывает визуальное направление и взаимодействия до подключения реального ML.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {aboutValues.map((value) => (
          <Card key={value.title}>
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
