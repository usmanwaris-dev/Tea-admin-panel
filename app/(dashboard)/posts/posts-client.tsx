"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { FileText, Trash2, Pin, PinOff, Droplet, MessageSquare, Flag, ImageIcon, MoreHorizontal } from "lucide-react";
import type { AdminPost } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { AliasCell } from "@/components/badges";
import { TopicIcon } from "@/components/topic-icon";
import { PostView } from "@/components/content/post-view";
import { PostComments } from "@/components/content/post-comments";
import { ConfirmAction } from "@/components/confirm-action";
import { compactNumber, timeAgo, truncate, cn } from "@/lib/utils";
import { deletePostAction, setPostPinnedAction } from "@/lib/actions";

export function PostsClient({ posts }: { posts: AdminPost[] }) {
  const router = useRouter();
  const [active, setActive] = React.useState<AdminPost | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<AdminPost | null>(null);

  async function pin(post: AdminPost, pinned: boolean) {
    const res = await setPostPinnedAction(post.id, pinned);
    if (res.ok) {
      toast.success(pinned ? "Post pinned" : "Post unpinned");
      router.refresh();
    } else toast.error(res.message ?? "Failed");
  }

  const columns = React.useMemo<ColumnDef<AdminPost>[]>(
    () => [
      {
        id: "media",
        header: "",
        cell: ({ row }) => {
          const url = row.original.media_urls[0];
          return (
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "content",
        header: "Post",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="max-w-[360px]">
              <p className={cn("line-clamp-2 text-sm", p.is_deleted && "line-through opacity-50")}>
                {truncate(p.content ?? "(no text)", 120)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <AliasCell alias={p.author.alias} color={p.author.avatar_color} size={18} muted />
                {p.media_urls.length > 1 && (
                  <span className="text-xs text-muted-foreground">+{p.media_urls.length - 1} imgs</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "topic",
        header: "Topic",
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) =>
          row.original.topic ? (
            <Badge variant="outline">
              <TopicIcon icon={row.original.topic.icon} /> {row.original.topic.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "engagement",
        header: "Engagement",
        meta: { className: "hidden lg:table-cell" },
        cell: ({ row }) => {
          const s = row.original.stats;
          return (
            <div className="flex items-center gap-3 text-sm text-muted-foreground tabular">
              <span className="flex items-center gap-1" title="Sips">
                <Droplet className="h-3.5 w-3.5 text-accent" />
                {compactNumber(s.sip_count)}
              </span>
              <span className="flex items-center gap-1" title="Comments">
                <MessageSquare className="h-3.5 w-3.5" />
                {compactNumber(s.comment_count)}
              </span>
            </div>
          );
        },
      },
      {
        id: "reports",
        header: "Reports",
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) =>
          row.original.report_count > 0 ? (
            <Badge variant="danger">
              <Flag className="h-3 w-3" /> {row.original.report_count}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "created_at",
        header: "Created",
        meta: { className: "hidden md:table-cell" },
        sortingFn: (a, b) => new Date(a.original.created_at).getTime() - new Date(b.original.created_at).getTime(),
        cell: ({ row }) => <span className="tabular text-muted-foreground">{timeAgo(row.original.created_at)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                </Button>
              }
            >
              <DropdownItem onSelect={() => setActive(row.original)}>
                <FileText /> View detail
              </DropdownItem>
              <DropdownItem onSelect={() => pin(row.original, true)}>
                <Pin /> Pin post
              </DropdownItem>
              {!row.original.is_deleted && (
                <DropdownItem danger onSelect={() => setConfirmDelete(row.original)}>
                  <Trash2 /> Delete post
                </DropdownItem>
              )}
            </Dropdown>
          </div>
        ),
      },
    ],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={posts}
        onRowClick={setActive}
        isRowActive={(p) => p.id === active?.id}
        emptyIcon={FileText}
        emptyTitle="No posts found"
        emptyDescription="Try a different search or clear the filters."
      />

      <Drawer
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `Post #${active.id}` : ""}
        subtitle="Full content, media & engagement"
        footer={
          active && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => (active.is_deleted ? undefined : pin(active, true))}>
                <Pin /> Pin
              </Button>
              {!active.is_deleted && (
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(active)}>
                  <Trash2 /> Delete post
                </Button>
              )}
            </div>
          )
        }
      >
        {active && (
          <>
            <PostView post={active} />
            <PostComments postId={active.id} count={active.stats.comment_count} />
          </>
        )}
      </Drawer>

      <ConfirmAction
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete post #${confirmDelete?.id}?`}
        description="Soft-deletes the post so it's removed from every feed. Recorded in the audit log."
        confirmLabel="Delete post"
        requireReason
        onConfirm={async (reason) => {
          const res = await deletePostAction(confirmDelete!.id, reason);
          if (!res.ok) throw new Error(res.message);
          toast.success("Post deleted");
          setActive(null);
          router.refresh();
        }}
      />
    </>
  );
}
