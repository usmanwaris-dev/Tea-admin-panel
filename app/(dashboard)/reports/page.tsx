import { getReports } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput, FilterSelect, Pagination } from "@/components/table-controls";
import { REPORT_REASONS, REPORT_REASON_LABEL, type ReportStatus } from "@/lib/types";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; reason?: string; target?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const { rows, total } = await getReports({
    search: searchParams.q,
    status: (searchParams.status as ReportStatus) ?? "all",
    reason: searchParams.reason ?? "all",
    targetType: searchParams.target ?? "all",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Triage user reports. Apple's guideline requires acting on objectionable-content reports within 24 hours."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search content, reporter, notes…" />
        <FilterSelect
          paramKey="status"
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "reviewing", label: "Reviewing" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]}
        />
        <FilterSelect
          paramKey="reason"
          options={[
            { value: "all", label: "All reasons" },
            ...REPORT_REASONS.map((r) => ({ value: r, label: REPORT_REASON_LABEL[r] })),
          ]}
        />
        <FilterSelect
          paramKey="target"
          options={[
            { value: "all", label: "All targets" },
            { value: "post", label: "Posts" },
            { value: "comment", label: "Comments" },
            { value: "user", label: "Users" },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <ReportsClient reports={rows} />
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
