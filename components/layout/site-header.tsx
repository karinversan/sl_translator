"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Captions, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const homeSections = [
  { id: "hero", label: "Главная" },
  { id: "modes", label: "Режимы" },
  { id: "how", label: "Как работает" },
  { id: "features", label: "Возможности" },
  { id: "model", label: "Модель" },
  { id: "faq", label: "FAQ" }
];

const pageLinks = [
  { href: "/live", label: "Realtime" },
  { href: "/upload", label: "Video+Editor" },
  { href: "/docs", label: "Docs" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    if (!isHome) return;

    const sections = homeSections
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0.2, 0.45, 0.72] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isHome]);

  const activePageLink = useMemo(
    () => pageLinks.find((link) => pathname.startsWith(link.href))?.href,
    [pathname]
  );

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className={cn("sticky top-0 z-40 px-0 pt-0")}>
        <div
          className={cn(
            "mx-auto flex h-16 items-center justify-between gap-4 px-4 md:px-6",
            isHome
              ? "max-w-7xl bg-black/28 text-white backdrop-blur-xl"
              : "max-w-6xl border-b border-white/10 bg-black/55 text-white backdrop-blur-xl"
          )}
        >
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="rounded-md border border-white/14 bg-white/[0.02] p-1.5">
              <Captions className="h-4 w-4 text-[#ff8a33]" />
            </span>
            <span className="font-accent text-base tracking-[0.16em]">SIGNFLOW</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {isHome &&
              homeSections.map((item) => {
                const active = activeSection === item.id;
                return (
                  <Link
                    key={item.id}
                    href={`/#${item.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-2 text-xs tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                      active ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            {!isHome &&
              pageLinks.map((item) => {
                const active = activePageLink === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-2 text-xs tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
                      active ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-10 rounded-full bg-white px-4 text-black hover:bg-white/90">
              <Link href="/live">Запустить демо</Link>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full md:hidden"
                  aria-label="Открыть меню"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[90vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle>Навигация</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  {homeSections.map((item) => (
                    <Link
                      key={item.id}
                      href={`/#${item.id}`}
                      className="block rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm hover:border-white/25"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {pageLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm hover:border-white/25"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Button asChild className="mt-3 h-11 w-full rounded-xl bg-white text-black">
                    <Link href="/live">Запустить демо</Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
}
