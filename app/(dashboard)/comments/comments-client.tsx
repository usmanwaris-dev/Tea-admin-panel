"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MessageSquare, Trash2, ArrowUp, Flag } from "lucide-react";
import type { AdminComment } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AliasCell } from "@/components/badges";
import { ConfirmAction } from "@/components/confirm-action";
import { timeAgo, truncate, cn } from "@/lib/utils";
import { deleteCommentAction } from "@/lib/actions";

export function CommentsClient({ comments }: { comments: AdminComment[] }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = React.useState<AdminComment | null>(null);

  const columns = React.useMemo<ColumnDef<AdminComment>[]>(
    () => [
      {
        accessorKey: "author",
        header: "Author",
        cell: ({ row }) => (
          <AliasCell alias={row.original.author.alias} color={row.original.author.avatar_color} size={24} muted />
        ),
      },
      {
        accessorKey: "content",
        header: "Comment",
        cell: ({ row }) => (
          <p className={cn("line-clamp-2 max-w-[420px] text-sm", row.original.is_deleted && "line-through opacity-50")}>
            {row.original.content}
          </p>
        ),
      },
      {
        accessorKey: "post_excerpt",
        header: "On post",
        meta: { className: "hidden lg:table-cell" },
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[220px] text-xs text-muted-foreground">
            {truncate(row.original.post_excerpt || `#${row.original.post_id}`, 60)}
          </span>
        ),
      },
      {
        accessorKey: "upvotes",
        header: "Upvotes",
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 tabular text-muted-foreground">
            <ArrowUp className="h-3 w-3" />
            {row.original.upvotes}
          </span>
        ),
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
        header: "Age",
        meta: { className: "hidden md:table-cell" },
        sortingFn: (a, b) => new Date(a.original.created_at).getTime() - new Date(b.original.created_at).getTime(),
        cell: ({ row }) => <span className="tabular text-muted-foreground">{timeAgo(row.original.created_at)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          !row.original.is_deleted ? (
            <div onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(row.original)} aria-label="Delete comment">
                <Trash2 className="text-danger" />
              </Button>
            </div>
          ) : (
            <Badge variant="muted">Deleted</Badge>
          ),
      },
    ],
    []
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={comments}
        emptyIcon={MessageSquare}
        emptyTitle="No comments found"
        emptyDescription="Try a different search or clear the filters."
      />

      <ConfirmAction
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete comment #${confirmDelete?.id}?`}
        description="Soft-deletes the comment. Recorded in the audit log."
        confirmLabel="Delete comment"
        requireReason
        onConfirm={async (reason) => {
          const res = await deleteCommentAction(confirmDelete!.id, reason);
          if (!res.ok) throw new Error(res.message);
          toast.success("Comment deleted");
          router.refresh();
        }}
      />
    </>
  );
}
