import { getUsers } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput, FilterSelect, Pagination } from "@/components/table-controls";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const { rows, total } = await getUsers({
    search: searchParams.q,
    status: (searchParams.status as any) ?? "all",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader title="Users" description="Search accounts, review activity, suspend or verify." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by alias or ID…" />
        <FilterSelect
          paramKey="status"
          options={[
            { value: "all", label: "All users" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "verified", label: "Verified" },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <UsersClient users={rows} />
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
