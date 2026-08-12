import { getAuditLog } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput, FilterSelect, Pagination } from "@/components/table-controls";
import { AliasAvatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/utils";
import { ScrollText } from "lucide-react";
import type { AuditAction } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

const ACTION_META: Record<string, { label: string; variant: any }> = {
  "report.resolve": { label: "Resolved report", variant: "success" },
  "report.dismiss": { label: "Dismissed report", variant: "muted" },
  "post.delete": { label: "Deleted post", variant: "danger" },
  "post.pin": { label: "Pinned post", variant: "accent" },
  "post.unpin": { label: "Unpinned post", variant: "muted" },
  "comment.delete": { label: "Deleted comment", variant: "danger" },
  "user.suspend": { label: "Suspended user", variant: "danger" },
  "user.unsuspend": { label: "Unsuspended user", variant: "success" },
  "user.verify": { label: "Verified user", variant: "accent" },
  "user.unverify": { label: "Removed verification", variant: "muted" },
  "broadcast.send": { label: "Sent broadcast", variant: "accent" },
  "auth.login": { label: "Signed in", variant: "muted" },
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { q?: string; action?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const { rows, total } = await getAuditLog({
    search: searchParams.q,
    action: searchParams.action ?? "all",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every privileged admin action — who did it, to whom, when, and why."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search admin, target, reason…" />
        <FilterSelect
          paramKey="action"
          options={[
            { value: "all", label: "All actions" },
            ...Object.entries(ACTION_META).map(([value, m]) => ({ value, label: m.label })),
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries" description="Admin actions will be recorded here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface/95">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Admin</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">Target</th>
                  <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Reason</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const meta = ACTION_META[entry.action as AuditAction] ?? { label: entry.action, variant: "muted" };
                  return (
                    <tr key={entry.id} className="border-b border-border/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AliasAvatar alias={entry.actor_email} size={22} color="hsl(4 78% 62%)" />
                          <span className="text-xs">{entry.actor_email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{entry.target_label ?? "—"}</td>
                      <td className="hidden max-w-[280px] px-4 py-3 lg:table-cell">
                        <span className="line-clamp-1 text-muted-foreground">{entry.reason ?? "—"}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular">
                        {formatDateTime(entry.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
