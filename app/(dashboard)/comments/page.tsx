import { getComments } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput, ToggleFilter, Pagination } from "@/components/table-controls";
import { CommentsClient } from "./comments-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: { q?: string; reported?: string; deleted?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const { rows, total } = await getComments({
    search: searchParams.q,
    onlyReported: searchParams.reported === "1",
    includeDeleted: searchParams.deleted === "1",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader title="Comments" description="Moderate comments in context of their parent post." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search comment text, author, post…" />
        <ToggleFilter paramKey="reported" label="Reported only" />
        <ToggleFilter paramKey="deleted" label="Include deleted" />
      </div>

      <Card className="overflow-hidden">
        <CommentsClient comments={rows} />
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
