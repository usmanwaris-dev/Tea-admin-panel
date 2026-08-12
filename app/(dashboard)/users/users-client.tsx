"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Users as UsersIcon, Ban, BadgeCheck, ShieldOff, MoreHorizontal, Flag, FileText, MessageSquare } from "lucide-react";
import type { AdminComment, AdminPost, AdminUser } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AliasCell, UserStatusBadges } from "@/components/badges";
import { AliasAvatar } from "@/components/ui/avatar";
import { PostView } from "@/components/content/post-view";
import { ConfirmAction } from "@/components/confirm-action";
import { formatDate, timeAgo, fullNumber, truncate } from "@/lib/utils";
import { setSuspendedAction, setVerifiedAction, loadUserActivityAction } from "@/lib/actions";

type Confirm =
  | { type: "suspend"; user: AdminUser }
  | { type: "unsuspend"; user: AdminUser }
  | null;

export function UsersClient({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [active, setActive] = React.useState<AdminUser | null>(null);
  const [confirm, setConfirm] = React.useState<Confirm>(null);

  async function verify(user: AdminUser, verified: boolean) {
    const res = await setVerifiedAction(user.id, verified);
    if (res.ok) {
      toast.success(verified ? "User verified" : "Verification removed");
      router.refresh();
    } else toast.error(res.message ?? "Failed");
  }

  const columns = React.useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        accessorKey: "alias",
        header: "User",
        cell: ({ row }) => (
          <AliasCell
            alias={row.original.alias}
            color={row.original.avatar_color}
            url={row.original.avatar_url}
            verified={row.original.is_verified}
            suspended={row.original.is_suspended}
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <UserStatusBadges
            isSuspended={row.original.is_suspended}
            isVerified={row.original.is_verified}
            isAdvisor={row.original.is_advisor}
          />
        ),
      },
      {
        accessorKey: "post_count",
        header: "Posts",
        meta: { className: "hidden lg:table-cell" },
        cell: ({ row }) => <span className="tabular text-muted-foreground">{fullNumber(row.original.post_count)}</span>,
      },
      {
        accessorKey: "comment_count",
        header: "Comments",
        meta: { className: "hidden lg:table-cell" },
        cell: ({ row }) => <span className="tabular text-muted-foreground">{fullNumber(row.original.comment_count)}</span>,
      },
      {
        accessorKey: "reports_against",
        header: "Reports",
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) =>
          row.original.reports_against > 0 ? (
            <span className="inline-flex items-center gap-1 tabular text-danger">
              <Flag className="h-3 w-3" />
              {row.original.reports_against}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "created_at",
        header: "Joined",
        meta: { className: "hidden md:table-cell" },
        sortingFn: (a, b) => new Date(a.original.created_at).getTime() - new Date(b.original.created_at).getTime(),
        cell: ({ row }) => <span className="tabular text-muted-foreground">{formatDate(row.original.created_at)}</span>,
      },
      {
        accessorKey: "last_active_at",
        header: "Last active",
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => <span className="tabular text-muted-foreground">{timeAgo(row.original.last_active_at)}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                trigger={
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal />
                  </Button>
                }
              >
                <DropdownItem onSelect={() => setActive(u)}>View profile</DropdownItem>
                {u.is_verified ? (
                  <DropdownItem onSelect={() => verify(u, false)}>
                    <ShieldOff /> Remove verification
                  </DropdownItem>
                ) : (
                  <DropdownItem onSelect={() => verify(u, true)}>
                    <BadgeCheck /> Verify user
                  </DropdownItem>
                )}
                <DropdownSeparator />
                {u.is_suspended ? (
                  <DropdownItem onSelect={() => setConfirm({ type: "unsuspend", user: u })}>Unsuspend</DropdownItem>
                ) : (
                  <DropdownItem danger onSelect={() => setConfirm({ type: "suspend", user: u })}>
                    <Ban /> Suspend
                  </DropdownItem>
                )}
              </Dropdown>
            </div>
          );
        },
      },
    ],
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        onRowClick={setActive}
        isRowActive={(u) => u.id === active?.id}
        emptyIcon={UsersIcon}
        emptyTitle="No users found"
        emptyDescription="Try a different search or status filter."
      />

      <Drawer
        open={!!active}
        onClose={() => setActive(null)}
        title={active?.alias}
        subtitle={active ? `Joined ${formatDate(active.created_at)}` : ""}
        footer={
          active && (
            <div className="flex items-center justify-end gap-2">
              {active.is_verified ? (
                <Button variant="outline" size="sm" onClick={() => verify(active, false)}>
                  <ShieldOff /> Unverify
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => verify(active, true)}>
                  <BadgeCheck /> Verify
                </Button>
              )}
              {active.is_suspended ? (
                <Button variant="accent" size="sm" onClick={() => setConfirm({ type: "unsuspend", user: active })}>
                  Unsuspend
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={() => setConfirm({ type: "suspend", user: active })}>
                  <Ban /> Suspend
                </Button>
              )}
            </div>
          )
        }
      >
        {active && <UserProfile user={active} />}
      </Drawer>

      <ConfirmAction
        open={confirm?.type === "suspend"}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "suspend" ? `Suspend @${confirm.user.alias}?` : "Suspend user?"}
        description="Immediately blocks the account from posting, commenting and voting."
        confirmLabel="Suspend account"
        requireReason
        reasonLabel="Suspension reason"
        onConfirm={async (reason) => {
          const res = await setSuspendedAction((confirm as any).user.id, true, reason);
          if (!res.ok) throw new Error(res.message);
          toast.success("Account suspended");
          setActive(null);
          router.refresh();
        }}
      />
      <ConfirmAction
        open={confirm?.type === "unsuspend"}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "unsuspend" ? `Unsuspend @${confirm.user.alias}?` : "Unsuspend user?"}
        description="Restores full access to the account."
        confirmLabel="Unsuspend"
        variant="accent"
        requireReason
        reasonLabel="Note"
        onConfirm={async (reason) => {
          const res = await setSuspendedAction((confirm as any).user.id, false, reason);
          if (!res.ok) throw new Error(res.message);
          toast.success("Account restored");
          setActive(null);
          router.refresh();
        }}
      />
    </>
  );
}

function UserProfile({ user }: { user: AdminUser }) {
  const [activity, setActivity] = React.useState<{ posts: AdminPost[]; comments: AdminComment[] } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActivity(null);
    loadUserActivityAction(user.id)
      .then((res) => !cancelled && setActivity(res))
      .catch(() => !cancelled && setActivity({ posts: [], comments: [] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <AliasAvatar alias={user.alias} color={user.avatar_color} url={user.avatar_url} size={56} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{user.alias}</span>
          </div>
          <UserStatusBadges isSuspended={user.is_suspended} isVerified={user.is_verified} isAdvisor={user.is_advisor} />
          {user.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}
        </div>
      </div>

      {user.is_suspended && user.suspension_reason && (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          <span className="font-medium text-danger">Suspended</span>{" "}
          <span className="text-muted-foreground">
            {user.suspended_at ? `· ${formatDate(user.suspended_at)}` : ""} — {user.suspension_reason}
          </span>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          { k: "Posts", v: user.post_count },
          { k: "Comments", v: user.comment_count },
          { k: "Reports", v: user.reports_against },
        ].map((s) => (
          <div key={s.k} className="rounded-lg border border-border bg-surface/50 p-3">
            <dd className="font-serif text-2xl font-semibold tabular">{fullNumber(s.v)}</dd>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{s.k}</dt>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">User ID</span>
          <p className="truncate font-mono text-xs">{user.id}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Last active</span>
          <p className="tabular">{timeAgo(user.last_active_at)}</p>
        </div>
      </div>

      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-4 space-y-3">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : activity && activity.posts.length ? (
            activity.posts.slice(0, 8).map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <PostView post={p} full={false} />
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No posts.</p>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-2">
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : activity && activity.comments.length ? (
            activity.comments.slice(0, 12).map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <p className="leading-relaxed">{c.content}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" /> on “{truncate(c.post_excerpt, 48)}” · {timeAgo(c.created_at)}
                </p>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No comments.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
