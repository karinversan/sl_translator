"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Captions, CircleDot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/upload", label: "Upload" },
  { href: "/history", label: "History" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Docs" }
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#06070c]/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded-lg border border-white/15 bg-white/5 p-1.5">
            <Captions className="h-4 w-4 text-cyan-300" />
          </span>
          <span className="font-accent text-base tracking-wide">SignFlow</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-200 sm:flex">
            <CircleDot className="h-3 w-3" />
            Demo mode
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/auth">Sign in</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
