import Link from "next/link";
import { AlertTriangle, ArrowRight, Flag } from "lucide-react";
import { getAuditLog, getKpis, getReports, getTimeSeries } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AliasAvatar } from "@/components/ui/avatar";
import { ReasonBadge } from "@/components/badges";
import { OverviewTrend } from "@/components/overview-trend";
import { compactNumber, fullNumber, timeAgo, hoursSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [kpis, pending, series, audit] = await Promise.all([
    getKpis(),
    getReports({ status: "pending", pageSize: 6 }),
    getTimeSeries(30),
    getAuditLog({ pageSize: 6 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tea, live. Everything below excludes banned and admin accounts."
      />

      {/* Overdue reports alert */}
      {kpis.reports_overdue > 0 && (
        <Link href="/reports?status=pending" className="block">
          <div className="flex flex-col items-start gap-4 rounded-lg border border-danger/50 bg-danger/10 p-5 transition-colors hover:bg-danger/15 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="font-serif text-4xl font-semibold text-danger tabular">{kpis.reports_overdue}</span>
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  {kpis.reports_overdue} reports are past the 24-hour deadline
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {kpis.pending_reports} pending in total. Apple's guideline requires acting on
                  objectionable-content reports within 24 hours of receiving them.
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" className="sm:ml-auto">
              Work the queue <ArrowRight />
            </Button>
          </div>
        </Link>
      )}

      {/* KPI grid */}
      <section>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Is the tea flowing
        </p>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-2 divide-border md:grid-cols-4 [&>*]:border-b [&>*]:border-r [&>*:nth-child(2n)]:border-r-0 md:[&>*:nth-child(2n)]:border-r md:[&>*:nth-child(4n)]:border-r-0 [&>*:nth-last-child(-n+2)]:border-b-0 md:[&>*:nth-last-child(-n+4)]:border-b-0">
            <StatCard
              accent
              label="Pending reports"
              value={fullNumber(kpis.pending_reports)}
              sub={`${kpis.reports_overdue} past deadline`}
              progress={kpis.pending_reports ? Math.min(1, kpis.reports_overdue / kpis.pending_reports) : 0}
              progressColor="hsl(var(--danger))"
            />
            <StatCard
              accent
              label="DAU"
              value={compactNumber(kpis.dau)}
              sub={`WAU ${compactNumber(kpis.wau)}`}
            />
            <StatCard
              label="Users"
              value={fullNumber(kpis.total_users)}
              sub={`+${kpis.new_signups_today} today · +${kpis.new_signups_week} this week`}
            />
            <StatCard label="Posts" value={fullNumber(kpis.posts_today)} sub="today" />
            <StatCard label="Comments" value={fullNumber(kpis.comments_today)} sub="today" />
            <StatCard label="Verdicts" value={fullNumber(kpis.verdicts_per_day_avg)} sub="per day, 7-day avg" />
            <StatCard
              label="New this week"
              value={fullNumber(kpis.new_signups_week)}
              sub={`+${kpis.new_signups_today} today`}
            />
            <StatCard
              label="Suspended"
              value={fullNumber(kpis.suspended_accounts)}
              sub={
                kpis.suspended_by_filter > 0
                  ? `${kpis.suspended_by_filter} by the auto filter`
                  : "accounts"
              }
            />
          </div>
        </Card>
      </section>

      {/* Trend + needs attention */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Audience growth</CardTitle>
            <CardDescription>Total members · last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <OverviewTrend data={series} />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription>Oldest open reports</CardDescription>
            </div>
            <Link href="/reports">
              <Button variant="ghost" size="sm">
                View all <ArrowRight />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {pending.rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Queue is clear 🎉</p>
            ) : (
              <ul className="space-y-1">
                {pending.rows.map((r) => {
                  const overdue = hoursSince(r.created_at) > 24;
                  const text = r.post?.content ?? r.comment?.content ?? (r.target_user ? `@${r.target_user.alias}` : "content");
                  return (
                    <li key={r.id}>
                      <Link
                        href="/reports?status=pending"
                        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface"
                      >
                        <Flag className={`h-4 w-4 shrink-0 ${overdue ? "text-danger" : "text-muted-foreground"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm">{text}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <ReasonBadge reason={r.reason} />
                          </div>
                        </div>
                        <span className={`shrink-0 text-xs tabular ${overdue ? "text-danger" : "text-muted-foreground"}`}>
                          {timeAgo(r.created_at)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent admin activity */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent admin activity</CardTitle>
          <Link href="/audit">
            <Button variant="ghost" size="sm">
              Audit log <ArrowRight />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {audit.rows.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5 text-sm">
                <AliasAvatar alias={e.actor_email} size={22} color="hsl(4 78% 62%)" />
                <span className="text-muted-foreground">{e.actor_email}</span>
                <Badge variant="muted">{e.action}</Badge>
                <span className="truncate text-muted-foreground">{e.target_label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular">{timeAgo(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
