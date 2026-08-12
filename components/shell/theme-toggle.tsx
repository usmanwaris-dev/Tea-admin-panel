"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "text" }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme !== "light";

  if (variant === "text") {
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {mounted ? (isDark ? "Switch to light" : "Switch to dark") : "Switch theme"}
      </button>
    );
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {mounted && isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
