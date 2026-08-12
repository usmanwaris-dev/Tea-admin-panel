import { Badge } from "@/components/ui/badge";
import { REPORT_REASON_LABEL, type ReportReason, type ReportStatus } from "@/lib/types";
import { AliasAvatar } from "@/components/ui/avatar";
import { BadgeCheck, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const map: Record<ReportStatus, { label: string; variant: any }> = {
    pending: { label: "Pending", variant: "warning" },
    reviewing: { label: "Reviewing", variant: "accent" },
    resolved: { label: "Resolved", variant: "success" },
    dismissed: { label: "Dismissed", variant: "muted" },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function ReasonBadge({ reason }: { reason: ReportReason }) {
  const danger: ReportReason[] = ["hate_speech", "violence", "harassment"];
  return (
    <Badge variant={danger.includes(reason) ? "danger" : "outline"}>{REPORT_REASON_LABEL[reason]}</Badge>
  );
}

export function TargetTypeBadge({ type }: { type: "post" | "comment" | "user" }) {
  const label = { post: "Post", comment: "Comment", user: "User" }[type];
  return <Badge variant="muted">{label}</Badge>;
}

export function UserStatusBadges({
  isSuspended,
  isVerified,
  isAdvisor,
}: {
  isSuspended: boolean;
  isVerified: boolean;
  isAdvisor?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isSuspended ? (
        <Badge variant="danger">
          <Ban className="h-3 w-3" /> Suspended
        </Badge>
      ) : (
        <Badge variant="success">Active</Badge>
      )}
      {isVerified && (
        <Badge variant="accent">
          <BadgeCheck className="h-3 w-3" /> Verified
        </Badge>
      )}
      {isAdvisor && <Badge variant="muted">Advisor</Badge>}
    </div>
  );
}

/** Alias chip + optional verified mark, used across tables. */
export function AliasCell({
  alias,
  color,
  url,
  verified,
  suspended,
  size = 28,
  muted = false,
}: {
  alias: string;
  color?: string | null;
  url?: string | null;
  verified?: boolean;
  suspended?: boolean;
  size?: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <AliasAvatar alias={alias} color={color} url={url} size={size} />
      <div className="flex items-center gap-1">
        <span className={cn("font-medium", muted && "text-muted-foreground", suspended && "line-through opacity-60")}>
          {alias}
        </span>
        {verified && <BadgeCheck className="h-3.5 w-3.5 text-accent" />}
      </div>
    </div>
  );
}
