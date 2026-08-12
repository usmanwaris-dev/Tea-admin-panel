"use client";

import * as React from "react";
import { MessageCircle, Eye, Flag, CheckCircle2, Coffee, Repeat2 } from "lucide-react";
import type { AdminPost } from "@/lib/types";
import { AliasCell } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { TopicIcon } from "@/components/topic-icon";
import { compactNumber, formatDateTime, cn } from "@/lib/utils";

// Exact colours from the Tea app (lib/theme/app_colors.dart).
export const TEA = { redFlag: "#FF453A", greenFlag: "#30D158", sip: "#FF9F0A" };

function StatChip({ icon: Icon, value, label, color, className }: { icon: any; value: number; label: string; color?: string; className?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-sm" title={`${value.toLocaleString()} ${label}`}>
      <Icon className={cn("h-4 w-4", !color && "text-muted-foreground", className)} style={color ? { color } : undefined} />
      <span className="tabular font-medium">{compactNumber(value)}</span>
    </div>
  );
}

export function MediaGallery({ urls, full = false }: { urls: string[]; full?: boolean }) {
  const [active, setActive] = React.useState<string | null>(null);
  if (!urls.length) return null;
  return (
    <>
      <div className={cn("grid gap-2", urls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {urls.map((u, i) => (
          <button
            key={i}
            onClick={() => setActive(u)}
            className={cn(
              "group relative overflow-hidden rounded-lg border border-border bg-surface",
              full ? "aspect-auto" : "aspect-video"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt={`Post media ${i + 1}`}
              loading="lazy"
              className={cn("w-full object-cover transition-transform group-hover:scale-[1.02]", full ? "max-h-[520px]" : "h-full")}
            />
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 animate-fade-in" onClick={() => setActive(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active} alt="Full size" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}

export function PollView({ poll }: { poll: NonNullable<AdminPost["poll"]> }) {
  const total = poll.options.reduce((s, o) => s + o.vote_count, 0) || 1;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface/50 p-3">
      {poll.question && <p className="text-sm font-medium">{poll.question}</p>}
      {poll.options.map((o) => {
        const pct = Math.round((o.vote_count / total) * 100);
        return (
          <div key={o.id} className="relative overflow-hidden rounded-md border border-border">
            <div className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between px-3 py-1.5 text-sm">
              <span>{o.text}</span>
              <span className="tabular text-muted-foreground">{pct}%</span>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground tabular">{total.toLocaleString()} votes</p>
    </div>
  );
}

/** Full inline rendering of a post — used in report + post detail drawers. */
export function PostView({ post, full = true }: { post: AdminPost; full?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <AliasCell
          alias={post.author.alias}
          color={post.author.avatar_color}
          url={post.author.avatar_url}
          verified={post.author.is_verified}
          suspended={post.author.is_suspended}
        />
        <div className="flex items-center gap-2">
          {post.topic && (
            <Badge variant="outline">
              <TopicIcon icon={post.topic.icon} /> {post.topic.name}
            </Badge>
          )}
          {post.is_deleted && <Badge variant="danger">Deleted</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Post #{post.id}</span>
        <span>·</span>
        <span>{formatDateTime(post.created_at)}</span>
        {post.mood && <span>· {post.mood}</span>}
        {post.report_count > 0 && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-danger">
              <Flag className="h-3 w-3" /> {post.report_count} reports
            </span>
          </>
        )}
      </div>

      {post.content && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>}

      {post.media_urls.length > 0 && <MediaGallery urls={post.media_urls} full={full} />}

      {post.poll && <PollView poll={post.poll} />}

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3">
        <StatChip icon={Flag} value={post.stats.red_flag_count} label="Red Flag" color={TEA.redFlag} />
        <StatChip icon={CheckCircle2} value={post.stats.green_flag_count} label="Green Flag" color={TEA.greenFlag} />
        <StatChip icon={Coffee} value={post.stats.same_count} label="Same" color={TEA.sip} />
        <StatChip icon={MessageCircle} value={post.stats.comment_count} label="comments" />
        <StatChip icon={Repeat2} value={post.stats.repost_count} label="reposts" />
        <StatChip icon={Eye} value={post.stats.view_count} label="views" />
      </div>
    </div>
  );
}
