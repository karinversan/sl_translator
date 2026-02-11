import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 pb-10 pt-6">
      <div className="container flex flex-col justify-between gap-6 text-sm text-muted-foreground md:flex-row md:items-center">
        <p>© 2026 SignFlow UI Demo</p>
        <div className="flex items-center gap-4">
          <Link className="hover:text-foreground" href="/about">
            About
          </Link>
          <Link className="hover:text-foreground" href="/docs">
            Docs
          </Link>
          <Link className="hover:text-foreground" href="/pricing">
            Pricing
          </Link>
        </div>
      </div>
    </footer>
  );
}
