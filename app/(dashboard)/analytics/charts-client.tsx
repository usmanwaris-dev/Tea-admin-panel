"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compactNumber, fullNumber } from "@/lib/utils";
import type { HashtagVolume, TimeSeriesPoint, TopicVolume } from "@/lib/types";

// Colorblind-safe categorical palette (accent-led, consistent across charts).
const C = {
  accent: "#e5624d",
  blue: "#5b8def",
  green: "#4fbf8b",
  amber: "#e0a13c",
  purple: "#a879e6",
};

/** Theme-aware grid / axis / hover-cursor colors (invisible-in-light fix). */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";
  return {
    grid: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)",
    axis: dark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.45)",
    cursor: dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
  };
}

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

function fmtDate(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium">{fmtDate(label)}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 tabular">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{fullNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function AnalyticsClient({
  series,
  topics,
  hashtags,
}: {
  series: TimeSeriesPoint[];
  topics: TopicVolume[];
  hashtags: HashtagVolume[];
}) {
  const [range, setRange] = React.useState(30);
  const data = React.useMemo(() => series.slice(-range), [series, range]);
  const { grid, axis, cursor } = useChartColors();
  const axisProps = { stroke: axis, fontSize: 11, tickLine: false, axisLine: false };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              variant={range === r.days ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setRange(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User growth</CardTitle>
            <CardDescription>Cumulative registered accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="g-users" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} {...axisProps} minTickGap={28} />
                <YAxis tickFormatter={compactNumber} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="users" name="Users" stroke={C.accent} strokeWidth={2} fill="url(#g-users)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verdicts cast</CardTitle>
            <CardDescription>Red / green / same verdicts per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} {...axisProps} minTickGap={28} />
                <YAxis tickFormatter={compactNumber} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="verdicts" name="Verdicts" stroke={C.blue} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Posts & comments</CardTitle>
            <CardDescription>Content created per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} {...axisProps} minTickGap={28} />
                <YAxis tickFormatter={compactNumber} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="posts" name="Posts" stroke={C.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="comments" name="Comments" stroke={C.amber} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New signups</CardTitle>
            <CardDescription>Accounts created per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDate} {...axisProps} minTickGap={28} />
                <YAxis tickFormatter={compactNumber} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: cursor }} />
                <Bar dataKey="signups" name="Signups" fill={C.purple} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top topics</CardTitle>
            <CardDescription>Posts by topic</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topics} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid stroke={grid} horizontal={false} />
                <XAxis type="number" tickFormatter={compactNumber} {...axisProps} />
                <YAxis type="category" dataKey="name" {...axisProps} width={92} />
                <Tooltip cursor={{ fill: cursor }} content={<ChartTooltip />} />
                <Bar dataKey="posts" name="Posts" radius={[0, 3, 3, 0]}>
                  {topics.map((t, i) => (
                    <Cell key={i} fill={t.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trending hashtags</CardTitle>
            <CardDescription>Most-used tags this week</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {hashtags.slice(0, 9).map((h, i) => {
                const max = hashtags[0]?.count || 1;
                return (
                  <li key={h.tag} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs text-muted-foreground tabular">{i + 1}</span>
                    <span className="w-28 shrink-0 truncate text-sm font-medium">#{h.tag}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(h.count / max) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-xs text-muted-foreground tabular">{compactNumber(h.count)}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
