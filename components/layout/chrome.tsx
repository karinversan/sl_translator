"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLive = pathname.startsWith("/live");

  return (
    <>
      {!isLive && <SiteHeader />}
      {children}
      {!isLive && <SiteFooter />}
    </>
  );
}
