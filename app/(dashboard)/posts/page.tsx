import { getPosts, getTopics } from "@/lib/data/repo";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput, FilterSelect, ToggleFilter, Pagination } from "@/components/table-controls";
import { PostsClient } from "./posts-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function PostsPage({
  searchParams,
}: {
  searchParams: { q?: string; topic?: string; reported?: string; deleted?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const topics = await getTopics();
  const { rows, total } = await getPosts({
    search: searchParams.q,
    topicId: searchParams.topic && searchParams.topic !== "all" ? Number(searchParams.topic) : "all",
    onlyReported: searchParams.reported === "1",
    includeDeleted: searchParams.deleted === "1",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div>
      <PageHeader title="Posts" description="Every post across the feed, with images and engagement." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search post text or author…" />
        <FilterSelect
          paramKey="topic"
          options={[{ value: "all", label: "All topics" }, ...topics.map((t) => ({ value: String(t.id), label: t.name }))]}
        />
        <ToggleFilter paramKey="reported" label="Reported only" />
        <ToggleFilter paramKey="deleted" label="Include deleted" />
      </div>

      <Card className="overflow-hidden">
        <PostsClient posts={rows} />
        <Pagination total={total} page={page} pageSize={PAGE_SIZE} />
      </Card>
    </div>
  );
}
