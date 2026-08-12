"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TimeSeriesPoint } from "@/lib/types";
import { compactNumber, fullNumber } from "@/lib/utils";
import { useChartColors } from "@/app/(dashboard)/analytics/charts-client";

export function OverviewTrend({ data }: { data: TimeSeriesPoint[] }) {
  const { grid, axis } = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="ov-dau" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e5624d" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#e5624d" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          stroke={axis}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis tickFormatter={compactNumber} stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          content={({ active, payload, label }: any) =>
            active && payload?.length ? (
              <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                <p className="mb-1 font-medium">
                  {new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <p className="tabular text-muted-foreground">
                  Members: <span className="font-medium text-foreground">{fullNumber(payload[0].value)}</span>
                </p>
              </div>
            ) : null
          }
        />
        <Area type="monotone" dataKey="users" stroke="#e5624d" strokeWidth={2} fill="url(#ov-dau)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
