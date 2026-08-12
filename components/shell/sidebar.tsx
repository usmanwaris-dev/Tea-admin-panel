"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Flag,
  FileText,
  MessageSquare,
  Users,
  Megaphone,
  BarChart3,
  ScrollText,
  BellRing,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "reports";
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Moderation",
    items: [
      { href: "/reports", label: "Reports", icon: Flag, badgeKey: "reports" },
      { href: "/posts", label: "Posts", icon: FileText },
      { href: "/comments", label: "Comments", icon: MessageSquare },
      { href: "/users", label: "Users", icon: Users },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/broadcast", label: "Broadcast", icon: Megaphone },
      { href: "/health", label: "Push health", icon: BellRing },
      { href: "/audit", label: "Audit log", icon: ScrollText },
    ],
  },
];

export function Sidebar({
  pendingReports,
  adminEmail,
  variant = "desktop",
  isMock = false,
}: {
  pendingReports: number;
  adminEmail: string;
  variant?: "desktop" | "mobile";
  isMock?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex-col border-r border-border bg-surface/40",
        variant === "desktop" ? "hidden lg:flex" : "flex h-full bg-background"
      )}
    >
      <div className="flex h-16 items-center px-5">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const badge = item.badgeKey === "reports" && pendingReports > 0 ? pendingReports : null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-elevated text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-muted-foreground group-hover:text-foreground")}
                      />
                      <span className="flex-1">{item.label}</span>
                      {badge != null && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground tabular">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="truncate text-xs text-muted-foreground" title={adminEmail}>
          {adminEmail}
        </div>
        <ThemeToggle variant="text" />
        {!isMock && (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-danger"
            >
              Sign out
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
