import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

/**
 * Dense KPI tile matching the reference "IS THE TEA FLOWING" grid: small caps
 * label, large tabular number, muted sublabel, optional accent + progress bar.
 */
export function StatCard({
  label,
  value,
  sub,
  accent = false,
  icon: Icon,
  progress,
  progressColor = "hsl(var(--accent))",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  icon?: LucideIcon;
  progress?: number; // 0..1
  progressColor?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 border-border p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.1em]",
            accent ? "text-accent" : "text-muted-foreground"
          )}
        >
          {label}
        </p>
        {Icon && <Icon className={cn("h-4 w-4", accent ? "text-accent" : "text-muted-foreground/60")} />}
      </div>
      <div>
        <div className="font-serif text-3xl font-semibold leading-none tracking-tight tabular">{value}</div>
        {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {progress != null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%`, background: progressColor }}
          />
        </div>
      )}
    </div>
  );
}
