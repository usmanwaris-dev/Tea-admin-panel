/**
 * Domain types for the Tea Admin dashboard.
 *
 * These mirror the live Supabase schema (see supabase/baseline_schema.sql in the
 * mobile repo) but are shaped for read-heavy admin views. The repository layer
 * (lib/data/*) returns these regardless of whether the source is mock data or
 * live Postgres, so pages never depend on the raw DB row shape.
 */

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "misinformation"
  | "other";

export const REPORT_REASONS: ReportReason[] = [
  "spam",
  "harassment",
  "hate_speech",
  "violence",
  "misinformation",
  "other",
];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate_speech: "Hate speech",
  violence: "Violence / threats",
  misinformation: "Misinformation",
  other: "Other",
};

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export type ReportTargetType = "post" | "comment" | "user";

export type VerdictType = "red_flag" | "green_flag" | "same";

export interface TopicRef {
  id: number;
  name: string;
  icon: string;
  color: string;
}

export interface AuthorRef {
  id: string;
  alias: string;
  avatar_color: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_suspended: boolean;
}

export interface PostStats {
  sip_count: number;
  comment_count: number;
  red_flag_count: number;
  green_flag_count: number;
  same_count: number;
  repost_count: number;
  view_count: number;
}

export interface PollOption {
  id: number;
  text: string;
  vote_count: number;
}

export interface Poll {
  id: number;
  question: string | null;
  options: PollOption[];
}

export interface AdminPost {
  id: number;
  author: AuthorRef;
  topic: TopicRef | null;
  type: "original" | "quote" | "repost";
  content: string | null;
  media_urls: string[];
  mood: string | null;
  is_deleted: boolean;
  comments_disabled: boolean;
  created_at: string;
  stats: PostStats;
  poll: Poll | null;
  report_count: number;
}

export interface AdminComment {
  id: number;
  post_id: number;
  post_excerpt: string;
  author: AuthorRef;
  content: string;
  upvotes: number;
  is_deleted: boolean;
  created_at: string;
  report_count: number;
}

export interface AdminUser {
  id: string;
  alias: string;
  avatar_color: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  is_suspended: boolean;
  is_advisor: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at: string;
  last_active_at: string | null;
  post_count: number;
  comment_count: number;
  reports_against: number;
}

/** A hand-driven seeding profile (users.is_seed = true) shown in the switcher. */
export interface SeedProfile {
  id: string;
  alias: string;
  avatar_color: string | null;
  avatar_url: string | null;
  preset_avatar_id: string | null;
  bio: string | null;
  is_verified: boolean;
  post_count: number;
  comment_count: number;
  created_at: string;
}

export interface AdminReport {
  id: number;
  reporter: AuthorRef; // anonymous alias only
  target_type: ReportTargetType;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  // Denormalized target snapshot for the queue + drawer
  post?: AdminPost | null;
  comment?: AdminComment | null;
  target_user?: AuthorRef | null;
}

/**
 * One row of the moderation Review Queue — a *held* post (published-then-held)
 * paired with a single pending report. Shape mirrors the `admin_list_review_queue`
 * RPC exactly. The same post can appear under more than one report row (an
 * auto-flag plus later user reports); each row carries its own `report_id`, and
 * the admin's publish/keep decision keys off the row they act on.
 */
export interface ReviewQueueAuthor {
  id: string;
  alias: string;
  avatar_shape: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  preset_avatar_id: string | null;
}

export interface ReviewQueueItem {
  report_id: number;
  reason: ReportReason;
  details: string | null; // machine reason, e.g. "Auto-flagged for review — targeting:accusation_named"
  status: ReportStatus;
  reported_at: string;
  is_system: boolean; // true = auto-flag (reporter_id IS NULL); false = user report
  post_id: number;
  content: string | null;
  media_urls: string[];
  mood: string | null;
  is_under_review: boolean;
  is_deleted: boolean;
  post_created_at: string;
  author: ReviewQueueAuthor;
  topic: TopicRef | null;
}

export type AuditAction =
  | "report.resolve"
  | "report.dismiss"
  | "post.delete"
  | "post.pin"
  | "post.unpin"
  | "comment.delete"
  | "user.suspend"
  | "user.unsuspend"
  | "user.verify"
  | "user.unverify"
  | "broadcast.send"
  | "auth.login"
  | "seed.act_as"
  | "seed.stop"
  | "seed.post"
  | "seed.comment"
  | "seed.verdict"
  | "seed.repost"
  | "seed.avatar";

export interface AuditEntry {
  id: string;
  actor_email: string;
  action: AuditAction;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  route: string | null;
  audience: string;
  status: "sent" | "failed" | "sending";
  recipients: number;
  delivered: number;
  sent_by: string;
  created_at: string;
}

export interface KpiSnapshot {
  dau: number;
  wau: number;
  total_users: number;
  new_signups_today: number;
  new_signups_week: number;
  posts_today: number;
  comments_today: number;
  posts_per_day_avg: number;
  comments_per_day_avg: number;
  pending_reports: number;
  reports_overdue: number; // past the 24h SLA
  verdicts_per_day_avg: number;
  suspended_accounts: number;
  banned_accounts: number;
  suspended_by_filter: number;
}

export interface TimeSeriesPoint {
  date: string; // ISO date
  users?: number;
  posts?: number;
  comments?: number;
  dau?: number;
  signups?: number;
  verdicts?: number;
}

export interface TopicVolume {
  name: string;
  color: string;
  posts: number;
}

export interface HashtagVolume {
  tag: string;
  count: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
}
