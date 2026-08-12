"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Flag, Trash2, Ban, Check, X, ShieldAlert, Clock, UserRound } from "lucide-react";
import type { AdminComment, AdminPost, AdminReport } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AliasCell, ReasonBadge, ReportStatusBadge, TargetTypeBadge, UserStatusBadges } from "@/components/badges";
import { AliasAvatar } from "@/components/ui/avatar";
import { PostView } from "@/components/content/post-view";
import { PostComments } from "@/components/content/post-comments";
import { ConfirmAction } from "@/components/confirm-action";
import { timeAgo, hoursSince, formatDateTime, truncate, cn } from "@/lib/utils";
import {
  resolveReportAction,
  deletePostAction,
  deleteCommentAction,
  setSuspendedAction,
  loadUserActivityAction,
} from "@/lib/actions";

type ConfirmKind =
  | { type: "resolve" }
  | { type: "dismiss" }
  | { type: "removePost"; postId: number }
  | { type: "removeComment"; commentId: number }
  | { type: "suspend"; userId: string; alias: string }
  | null;

export function ReportsClient({ reports }: { reports: AdminReport[] }) {
  const router = useRouter();
  const [active, setActive] = React.useState<AdminReport | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmKind>(null);

  const columns = React.useMemo<ColumnDef<AdminReport>[]>(
    () => [
      {
        accessorKey: "reporter",
        header: "Reporter",
        cell: ({ row }) => (
          <AliasCell alias={row.original.reporter.alias} color={row.original.reporter.avatar_color} muted />
        ),
      },
      {
        accessorKey: "target_type",
        header: "Target",
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => <TargetTypeBadge type={row.original.target_type} />,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => <ReasonBadge reason={row.original.reason} />,
      },
      {
        id: "preview",
        header: "Content",
        meta: { className: "hidden lg:table-cell" },
        cell: ({ row }) => {
          const r = row.original;
          const text = r.post?.content ?? r.comment?.content ?? (r.target_user ? `@${r.target_user.alias}` : "—");
          return <span className="line-clamp-1 max-w-[280px] text-muted-foreground">{text}</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ReportStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "created_at",
        header: "Age",
        sortingFn: (a, b) => new Date(a.original.created_at).getTime() - new Date(b.original.created_at).getTime(),
        cell: ({ row }) => {
          const overdue = row.original.status === "pending" && hoursSince(row.original.created_at) > 24;
          return (
            <span className={cn("inline-flex items-center gap-1 tabular", overdue ? "text-danger" : "text-muted-foreground")}>
              {overdue && <Clock className="h-3 w-3" />}
              {timeAgo(row.original.created_at)}
            </span>
          );
        },
      },
    ],
    []
  );

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    const res = await fn();
    if (!res.ok) throw new Error(res.message ?? "Action failed");
    toast.success(success);
    setActive(null);
    router.refresh();
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={reports}
        onRowClick={setActive}
        isRowActive={(r) => r.id === active?.id}
        emptyIcon={Flag}
        emptyTitle="No reports match these filters"
        emptyDescription="The queue is clear. Adjust filters to see resolved or dismissed reports."
      />

      <Drawer
        open={!!active}
        onClose={() => setActive(null)}
        title={active ? `Report #${active.id}` : ""}
        subtitle={
          active ? (
            <span className="flex items-center gap-2">
              <ReasonBadge reason={active.reason} />
              <ReportStatusBadge status={active.status} />
            </span>
          ) : null
        }
        footer={
          active && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm({ type: "dismiss" })}>
                <X /> Dismiss
              </Button>
              {active.post && !active.post.is_deleted && (
                <Button variant="outline" size="sm" onClick={() => setConfirm({ type: "removePost", postId: active.post!.id })}>
                  <Trash2 /> Remove post
                </Button>
              )}
              {active.comment && !active.comment.is_deleted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm({ type: "removeComment", commentId: active.comment!.id })}
                >
                  <Trash2 /> Remove comment
                </Button>
              )}
              {(() => {
                const author = active.post?.author ?? active.comment?.author ?? active.target_user;
                if (!author || author.is_suspended) return null;
                return (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirm({ type: "suspend", userId: author.id, alias: author.alias })}
                  >
                    <Ban /> Suspend author
                  </Button>
                );
              })()}
              <Button variant="accent" size="sm" onClick={() => setConfirm({ type: "resolve" })}>
                <Check /> Mark resolved
              </Button>
            </div>
          )
        }
      >
        {active && <ReportDetail report={active} />}
      </Drawer>

      {/* Confirmations */}
      <ConfirmAction
        open={confirm?.type === "dismiss"}
        onClose={() => setConfirm(null)}
        title="Dismiss report?"
        description="Marks this report as reviewed with no action. The content stays live."
        confirmLabel="Dismiss report"
        variant="default"
        requireReason
        reasonLabel="Note (optional but recorded)"
        onConfirm={(reason) =>
          run(() => resolveReportAction(active!.id, "dismissed", reason), "Report dismissed")
        }
      />
      <ConfirmAction
        open={confirm?.type === "resolve"}
        onClose={() => setConfirm(null)}
        title="Mark report resolved?"
        description="Closes the report after you've taken action."
        confirmLabel="Mark resolved"
        variant="accent"
        requireReason
        reasonLabel="Resolution note"
        onConfirm={(reason) => run(() => resolveReportAction(active!.id, "resolved", reason), "Report resolved")}
      />
      <ConfirmAction
        open={confirm?.type === "removePost"}
        onClose={() => setConfirm(null)}
        title="Remove this post?"
        description="Soft-deletes the post so it disappears from every feed. Also resolves this report."
        confirmLabel="Remove post"
        requireReason
        onConfirm={async (reason) =>
          run(async () => {
            const del = await deletePostAction((confirm as any).postId, reason);
            if (!del.ok) return del;
            return resolveReportAction(active!.id, "resolved", `Removed post: ${reason}`);
          }, "Post removed & report resolved")
        }
      />
      <ConfirmAction
        open={confirm?.type === "removeComment"}
        onClose={() => setConfirm(null)}
        title="Remove this comment?"
        description="Soft-deletes the comment. Also resolves this report."
        confirmLabel="Remove comment"
        requireReason
        onConfirm={async (reason) =>
          run(async () => {
            const del = await deleteCommentAction((confirm as any).commentId, reason);
            if (!del.ok) return del;
            return resolveReportAction(active!.id, "resolved", `Removed comment: ${reason}`);
          }, "Comment removed & report resolved")
        }
      />
      <ConfirmAction
        open={confirm?.type === "suspend"}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "suspend" ? `Suspend @${confirm.alias}?` : "Suspend author?"}
        description="The account is immediately suspended and blocked from posting. This is recorded in the audit log."
        confirmLabel="Suspend account"
        requireReason
        reasonLabel="Suspension reason"
        onConfirm={(reason) =>
          run(() => setSuspendedAction((confirm as any).userId, true, reason), "Account suspended")
        }
      />
    </>
  );
}

function ReportDetail({ report }: { report: AdminReport }) {
  const overdue = report.status === "pending" && hoursSince(report.created_at) > 24;
  // Who the report is against (the account an admin might action).
  const accused = report.target_user ?? report.post?.author ?? report.comment?.author ?? null;
  const accusedLabel = report.target_type === "user" ? "Reported user" : "Content author";

  return (
    <div className="space-y-6">
      {overdue && (
        <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          <Clock className="h-4 w-4" />
          Past the 24-hour review deadline ({Math.floor(hoursSince(report.created_at))}h old).
        </div>
      )}

      {/* Parties: who reported → who was reported */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" /> Reported by
          </p>
          <AliasCell alias={report.reporter.alias} color={report.reporter.avatar_color} size={26} muted />
          <p className="mt-2 text-xs text-muted-foreground tabular">Filed {formatDateTime(report.created_at)}</p>
        </div>
        {accused && (
          <div className="rounded-lg border border-border bg-surface/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> {accusedLabel}
            </p>
            <AliasCell
              alias={accused.alias}
              color={accused.avatar_color}
              url={accused.avatar_url}
              verified={accused.is_verified}
              suspended={accused.is_suspended}
              size={26}
            />
            <div className="mt-2">
              <UserStatusBadges isSuspended={accused.is_suspended} isVerified={accused.is_verified} />
            </div>
          </div>
        )}
      </div>

      {report.details && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reporter note</p>
          <p className="mt-1 rounded-md border border-border bg-surface/50 p-3 text-sm italic text-muted-foreground">
            “{report.details}”
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          {report.target_type === "user" ? "Reported user’s activity" : "Reported content"}
        </p>
        <div className="rounded-lg border border-border bg-card p-4">
          {report.post ? (
            <>
              <PostView post={report.post} />
              <PostComments postId={report.post.id} count={report.post.stats.comment_count} />
            </>
          ) : report.comment ? (
            <CommentPreview report={report} />
          ) : report.target_user ? (
            <ReportedUserPanel user={report.target_user} />
          ) : (
            <p className="text-sm text-muted-foreground">Target content is no longer available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** For a report filed against a *user*, load and show that user's posts so an
 *  admin can review what they've been posting before acting. */
function ReportedUserPanel({ user }: { user: NonNullable<AdminReport["target_user"]> }) {
  const [state, setState] = React.useState<{ posts: AdminPost[]; comments: AdminComment[] } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setState(null);
    loadUserActivityAction(user.id)
      .then((res) => !cancelled && setState(res))
      .catch(() => !cancelled && setState({ posts: [], comments: [] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AliasCell
          alias={user.alias}
          color={user.avatar_color}
          url={user.avatar_url}
          verified={user.is_verified}
          suspended={user.is_suspended}
        />
        {user.is_suspended && <Badge variant="danger">Suspended</Badge>}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent posts {state && !loading ? `(${state.posts.length})` : ""}
        </p>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : state && state.posts.length ? (
          <div className="space-y-3">
            {state.posts.slice(0, 6).map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-surface/40 p-3">
                <PostView post={p} full={false} />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border bg-surface/40 p-3 text-sm text-muted-foreground">
            This user hasn’t posted anything.
          </p>
        )}
      </div>

      {state && state.comments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent comments ({state.comments.length})
          </p>
          <div className="space-y-2">
            {state.comments.slice(0, 5).map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-surface/40 p-2.5 text-sm">
                <p className="leading-relaxed">{c.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">on “{truncate(c.post_excerpt, 48)}” · {timeAgo(c.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommentPreview({ report }: { report: AdminReport }) {
  const c = report.comment!;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <AliasCell alias={c.author.alias} color={c.author.avatar_color} suspended={c.author.is_suspended} size={26} />
        {c.is_deleted && <Badge variant="danger">Deleted</Badge>}
      </div>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{c.content}</p>
      {c.post_excerpt && (
        <p className="rounded-md border border-border bg-surface/50 p-2 text-xs text-muted-foreground">
          On post: “{c.post_excerpt}…”
        </p>
      )}
    </div>
  );
}
