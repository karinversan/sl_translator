import type { Metadata } from "next";

import "./globals.css";

import { AmbientBackground } from "@/components/layout/ambient-background";
import { Chrome } from "@/components/layout/chrome";

export const metadata: Metadata = {
  title: "SignFlow - Subtitle First Sign Language UI",
  description: "Demo frontend for sign language translation into subtitles and voice."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans">
        <AmbientBackground />
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
