import { getPushCoverage } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { fullNumber, timeAgo } from "@/lib/utils";
import { BellRing } from "lucide-react";

export const dynamic = "force-dynamic";

const OUTCOME_META: Record<string, { label: string; variant: any; healthy?: boolean }> = {
  saved: { label: "Token saved", variant: "success", healthy: true },
  no_permission: { label: "Permission denied", variant: "warning" },
  no_apns: { label: "No APNS token", variant: "danger" },
  no_fcm: { label: "No FCM token", variant: "danger" },
  no_session: { label: "No session", variant: "muted" },
  error: { label: "Error", variant: "danger" },
};

export default async function HealthPage() {
  const { rows, totalRegistered } = await getPushCoverage();
  const savedUsers = rows.filter((r) => r.outcome === "saved").reduce((s, r) => s + r.users, 0);
  const atRisk = rows
    .filter((r) => ["no_apns", "no_fcm", "error", "no_permission"].includes(r.outcome))
    .reduce((s, r) => s + r.users, 0);
  const deliverablePct = totalRegistered ? Math.round((savedUsers / totalRegistered) * 100) : 0;
  const maxUsers = Math.max(1, ...rows.map((r) => r.users));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Push health"
        description="Notification delivery readiness across the install base."
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 divide-border sm:grid-cols-3 [&>*]:border-b [&>*]:border-border sm:[&>*]:border-b-0 sm:[&>*:not(:last-child)]:border-r">
          <StatCard label="Devices registered" value={fullNumber(totalRegistered)} sub="have reported a status" />
          <StatCard
            accent
            label="Delivering"
            value={`${deliverablePct}%`}
            sub={`${fullNumber(savedUsers)} with a saved token`}
            progress={deliverablePct / 100}
            progressColor="hsl(var(--success))"
          />
          <StatCard
            label="Needs attention"
            value={fullNumber(atRisk)}
            sub="denied / no token / errored"
            progress={totalRegistered ? atRisk / totalRegistered : 0}
            progressColor="hsl(var(--danger))"
          />
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Breakdown by outcome
        </h2>
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={BellRing} title="No registration data" description="Push status reports will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface/95">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Outcome</th>
                    <th className="px-4 py-2.5 font-medium">Platform</th>
                    <th className="px-4 py-2.5 font-medium">Devices</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Share</th>
                    <th className="px-4 py-2.5 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const meta = OUTCOME_META[r.outcome] ?? { label: r.outcome, variant: "muted" };
                    return (
                      <tr key={i} className="border-b border-border/60">
                        <td className="px-4 py-3">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{r.platform ?? "—"}</td>
                        <td className="px-4 py-3 font-medium tabular">{fullNumber(r.users)}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-border">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(r.users / maxUsers) * 100}%`,
                                  background: meta.healthy ? "hsl(var(--success))" : "hsl(var(--accent))",
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground tabular">{r.pct}%</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular">
                          {timeAgo(r.most_recent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
