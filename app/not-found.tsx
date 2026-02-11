import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-accent text-5xl">404</h1>
      <p className="section-copy">Страница не найдена.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </section>
  );
}
