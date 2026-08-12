"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = React.useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  return { params, setParam };
}

export function SearchInput({ placeholder = "Search…", paramKey = "q" }: { placeholder?: string; paramKey?: string }) {
  const { params, setParam } = useUrlState();
  const [value, setValue] = React.useState(params.get(paramKey) ?? "");
  const timer = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    setValue(params.get(paramKey) ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get(paramKey)]);

  function onChange(v: string) {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam({ [paramKey]: v || null }), 300);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
    </div>
  );
}

export function FilterSelect({
  paramKey,
  options,
  className,
}: {
  paramKey: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const { params, setParam } = useUrlState();
  const value = params.get(paramKey) ?? "all";
  return (
    <Select
      value={value}
      onChange={(e) => setParam({ [paramKey]: e.target.value })}
      className={cn("w-auto min-w-[9rem] pr-8", className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function ToggleFilter({ paramKey, label }: { paramKey: string; label: string }) {
  const { params, setParam } = useUrlState();
  const active = params.get(paramKey) === "1";
  return (
    <Button
      variant={active ? "accent" : "outline"}
      size="sm"
      onClick={() => setParam({ [paramKey]: active ? null : "1" })}
    >
      {label}
    </Button>
  );
}

export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const { setParam } = useUrlState();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground tabular">
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setParam({ page: String(page - 1) }, false)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground tabular">
          Page {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => setParam({ page: String(page + 1) }, false)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
