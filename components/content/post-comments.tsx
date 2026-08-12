"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, ArrowUp, Trash2 } from "lucide-react";
import type { AdminComment } from "@/lib/types";
import { AliasCell } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmAction } from "@/components/confirm-action";
import { timeAgo, cn } from "@/lib/utils";
import { loadPostCommentsAction, deleteCommentAction } from "@/lib/actions";

/** Lazy-loaded thread of a post's comments, with inline moderation. */
export function PostComments({ postId, count }: { postId: number; count?: number }) {
  const router = useRouter();
  const [comments, setComments] = React.useState<AdminComment[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [toDelete, setToDelete] = React.useState<AdminComment | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    loadPostCommentsAction(postId)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [postId]);

  React.useEffect(() => {
    let cancelled = false;
    setComments(null);
    setLoading(true);
    loadPostCommentsAction(postId)
      .then((c) => !cancelled && setComments(c))
      .catch(() => !cancelled && setComments([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const shown = comments?.length ?? count ?? 0;

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Comments{shown ? ` (${shown})` : ""}
      </p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : comments && comments.length > 0 ? (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cn(
                "rounded-lg border border-border bg-surface/40 p-3",
                c.is_deleted && "opacity-60"
              )}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <AliasCell
                  alias={c.author.alias}
                  color={c.author.avatar_color}
                  url={c.author.avatar_url}
                  verified={c.author.is_verified}
                  suspended={c.author.is_suspended}
                  size={22}
                />
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular">
                    <ArrowUp className="h-3 w-3" />
                    {c.upvotes}
                  </span>
                  <span className="text-xs text-muted-foreground tabular">{timeAgo(c.created_at)}</span>
                  {c.is_deleted ? (
                    <Badge variant="muted">Deleted</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete comment"
                      onClick={() => setToDelete(c)}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  )}
                </div>
              </div>
              <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", c.is_deleted && "line-through")}>
                {c.content}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-border bg-surface/40 p-3 text-sm text-muted-foreground">
          No comments on this post.
        </p>
      )}

      <ConfirmAction
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete comment #${toDelete?.id}?`}
        description="Soft-deletes the comment. Recorded in the audit log."
        confirmLabel="Delete comment"
        requireReason
        onConfirm={async (reason) => {
          const res = await deleteCommentAction(toDelete!.id, reason);
          if (!res.ok) throw new Error(res.message);
          toast.success("Comment deleted");
          load();
          router.refresh();
        }}
      />
    </div>
  );
}
