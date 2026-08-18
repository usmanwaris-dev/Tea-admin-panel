"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ListChecks,
  ShieldAlert,
  Flag,
  Check,
  EyeOff,
  Loader2,
  Clock,
} from "lucide-react";
import type { ReviewQueueItem } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AliasAvatar } from "@/components/ui/avatar";
import { TopicIcon } from "@/components/topic-icon";
import { ReasonBadge } from "@/components/badges";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmAction } from "@/components/confirm-action";
import { loadReviewQueueAction, resolveReviewAction } from "@/lib/actions";
import { timeAgo, formatDateTime, cn } from "@/lib/utils";

const PAGE_SIZE = 25;

type Decision = "dismissed" | "resolved";
type Confirm = { item: ReviewQueueItem; action: Decision } | null;

export function ReviewClient() {
  const [items, setItems] = React.useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  const load = React.useCallback(async (cursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    const res = await loadReviewQueueAction(cursor, PAGE_SIZE);
    if (!res.ok) {
      if (!append) setError(res.message);
      else toast.error(res.message);
    } else {
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setHasMore(res.items.length === PAGE_SIZE);
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  React.useEffect(() => {
    load(null, false);
  }, [load]);

  function loadMore() {
    const cursor = items.length ? items[items.length - 1].reported_at : null;
    load(cursor, true);
  }

  async function resolve(item: ReviewQueueItem, action: Decision, reason: string) {
    const res = await resolveReviewAction(item.report_id, action, reason);
    if (!res.ok) throw new Error(res.message ?? "Action failed");
    // Optimistically drop the resolved row — its status is no longer pending.
    setItems((prev) => prev.filter((i) => i.report_id !== item.report_id));
    toast.success(action === "dismissed" ? "Post approved & published" : "Post kept removed");
  }

  // How many pending reports each post carries in the current view, so a card
  // can say "1 of N pending reports on this post".
  const postCounts = React.useMemo(() => {
    const m = new Map<number, number>();
    for (const it of items) m.set(it.post_id, (m.get(it.post_id) ?? 0) + 1);
    return m;
  }, [items]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-32" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorState message={error} onRetry={() => load(null, false)} />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ListChecks}
          title="No posts awaiting review"
          description="Nothing is held right now. Posts that trip a content detector will appear here for you to approve or keep removed."
        />
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((item) => (
          <ReviewCard
            key={item.report_id}
            item={item}
            pendingOnPost={postCounts.get(item.post_id) ?? 1}
            onApprove={() => setConfirm({ item, action: "dismissed" })}
            onKeep={() => setConfirm({ item, action: "resolved" })}
            onOpenMedia={setLightbox}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="animate-spin" /> Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      {/* Approve & publish → dismissed */}
      <ConfirmAction
        open={confirm?.action === "dismissed"}
        onClose={() => setConfirm(null)}
        title="Approve & publish this post?"
        description="The post is un-hidden, goes live in public feeds, and counts toward its topic. This report is closed."
        confirmLabel="Approve & publish"
        variant="accent"
        optionalReason
        reasonLabel="Note"
        reasonPlaceholder="Why this is fine to publish (optional)…"
        onConfirm={(reason) => resolve(confirm!.item, "dismissed", reason)}
      />

      {/* Keep removed → resolved */}
      <ConfirmAction
        open={confirm?.action === "resolved"}
        onClose={() => setConfirm(null)}
        title="Keep this post removed?"
        description="The post stays hidden from every public feed. This report is closed as actioned."
        confirmLabel="Keep removed"
        variant="danger"
        optionalReason
        reasonLabel="Note"
        reasonPlaceholder="Why this stays down (optional)…"
        onConfirm={(reason) => resolve(confirm!.item, "resolved", reason)}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Full size" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}

function ReviewCard({
  item,
  pendingOnPost,
  onApprove,
  onKeep,
  onOpenMedia,
}: {
  item: ReviewQueueItem;
  pendingOnPost: number;
  onApprove: () => void;
  onKeep: () => void;
  onOpenMedia: (url: string) => void;
}) {
  return (
    <Card className="p-5">
      {/* Header: author · topic · flags · age */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <AliasAvatar
            alias={item.author.alias}
            color={item.author.avatar_color}
            url={item.author.avatar_url}
            presetAvatarId={item.author.preset_avatar_id}
            size={36}
          />
          <div className="min-w-0">
            <p className="font-medium leading-tight">{item.author.alias}</p>
            <p className="text-xs text-muted-foreground">
              Post #{item.post_id} · posted {timeAgo(item.post_created_at)}
            </p>
          </div>
          {item.topic && (
            <Badge variant="outline" className="ml-1">
              <TopicIcon icon={item.topic.icon} /> {item.topic.name}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {item.is_system ? (
            <Badge variant="warning">
              <ShieldAlert className="h-3 w-3" /> Auto-flagged
            </Badge>
          ) : (
            <Badge variant="accent">
              <Flag className="h-3 w-3" /> User report
            </Badge>
          )}
          <ReasonBadge reason={item.reason} />
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular"
            title={`Reported ${formatDateTime(item.reported_at)}`}
          >
            <Clock className="h-3 w-3" /> {timeAgo(item.reported_at)}
          </span>
        </div>
      </div>

      {/* Machine / reporter reason */}
      {item.details && (
        <p className="mt-3 rounded-md border border-border bg-surface/50 px-3 py-2 text-sm text-muted-foreground">
          {item.details}
        </p>
      )}

      {/* Content */}
      {item.content && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{item.content}</p>
      )}

      {/* Media thumbnails */}
      {item.media_urls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.media_urls.map((u, i) => (
            <button
              key={i}
              onClick={() => onOpenMedia(u)}
              className="h-20 w-20 overflow-hidden rounded-lg border border-border bg-surface transition-transform hover:scale-[1.02]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Media ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Status line */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.mood && <span className="text-base leading-none" title="Mood">{item.mood}</span>}
        <span className="inline-flex items-center gap-1">
          <EyeOff className="h-3 w-3" /> Hidden from public feeds
        </span>
        {pendingOnPost > 1 && (
          <Badge variant="muted">{pendingOnPost} pending reports on this post</Badge>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" size="sm" onClick={onKeep}>
          <EyeOff /> Keep removed
        </Button>
        <Button variant="accent" size="sm" onClick={onApprove}>
          <Check /> Approve &amp; publish
        </Button>
      </div>
    </Card>
  );
}
