import { cn } from "@/lib/utils";

export function Wordmark({ className, showTag = true }: { className?: string; showTag?: boolean }) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="font-serif text-2xl font-semibold leading-none tracking-tight text-foreground">
        Tea<span className="text-accent">.</span>
      </span>
      {showTag && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Admin
        </span>
      )}
    </div>
  );
}
