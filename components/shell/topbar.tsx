"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, Search, ShieldAlert, X } from "lucide-react";
import { Wordmark } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";
import { AliasAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function Topbar({
  adminEmail,
  pendingReports,
}: {
  adminEmail: string;
  pendingReports: number;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [mobileNav, setMobileNav] = React.useState(false);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/posts?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={() => setMobileNav(true)}
        >
          <Menu />
        </Button>

        <div className="lg:hidden">
          <Wordmark showTag={false} />
        </div>

        <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
          <ShieldAlert className="h-3.5 w-3.5" />
          Content is user-generated and unverified.
        </div>

        <form onSubmit={onSearch} className="relative ml-auto hidden w-full max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts…"
            className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <div className="hidden items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 sm:flex">
            <AliasAvatar alias={adminEmail} size={26} color="hsl(4 78% 62%)" />
            <span className="max-w-[160px] truncate text-xs font-medium">{adminEmail}</span>
          </div>
        </div>
      </header>

      {/* Mobile navigation overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setMobileNav(false)} />
          <div className="absolute left-0 top-0 h-full animate-slide-in-right" onClick={() => setMobileNav(false)}>
            <div className="relative h-full">
              <Sidebar pendingReports={pendingReports} adminEmail={adminEmail} variant="mobile" />
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-4"
                onClick={() => setMobileNav(false)}
                aria-label="Close navigation"
              >
                <X />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
