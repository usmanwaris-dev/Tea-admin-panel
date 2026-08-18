import "server-only";
import { IS_MOCK, POST_MEDIA_BUCKET, SUPABASE_URL } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import * as mock from "@/lib/mock/data";

/**
 * Admin reads use the SERVICE-ROLE client, not the caller's session.
 *
 * This is deliberate: the app's RLS scopes rows to the owner
 * (e.g. `reports_select` is `reporter_id = auth.uid()`, and posts/comments hide
 * `is_deleted` rows), so a session-scoped read would show an admin almost
 * nothing. These functions are server-only and every dashboard route is already
 * gated to admins by middleware + the layout guard, so bypassing RLS here is
 * the correct posture for an internal moderation tool. RLS still protects the
 * DB from the public anon key.
 */
const liveDb = () => createSupabaseAdminClient();
// The review-queue RPCs are SECURITY DEFINER and gated on is_admin() (= auth.uid()
// is in `admins`). The service-role client has no auth.uid(), so it would be
// rejected — these RPCs must run on the signed-in admin's *session* client.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdminComment,
  AdminPost,
  AdminReport,
  AdminUser,
  AuthorRef,
  AuditEntry,
  Broadcast,
  HashtagVolume,
  KpiSnapshot,
  Paginated,
  ReportStatus,
  ReviewQueueItem,
  SeedProfile,
  TimeSeriesPoint,
  TopicVolume,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Query option shapes
// ---------------------------------------------------------------------------
export interface ReportQuery {
  status?: ReportStatus | "all";
  reason?: string | "all";
  targetType?: string | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}
export interface PostQuery {
  search?: string;
  topicId?: number | "all";
  onlyReported?: boolean;
  includeDeleted?: boolean;
  authorId?: string;
  page?: number;
  pageSize?: number;
}
export interface UserQuery {
  search?: string;
  status?: "all" | "active" | "suspended" | "verified";
  page?: number;
  pageSize?: number;
}
export interface CommentQuery {
  search?: string;
  onlyReported?: boolean;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
}
export interface AuditQuery {
  search?: string;
  action?: string | "all";
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 25;

function paginate<T>(rows: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total };
}

// ===========================================================================
// KPIs
// ===========================================================================
/** Cheap `count=exact, head=true` count with an optional filter builder. */
async function countWhere(
  table: "users" | "posts" | "comments" | "reports" | "verdicts",
  build?: (q: any) => any
): Promise<number> {
  let q: any = liveDb().from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count } = await q;
  return count ?? 0;
}

export async function getKpis(): Promise<KpiSnapshot> {
  if (IS_MOCK) return mock.kpiSnapshot();
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [
    totalUsers,
    dau,
    wau,
    signupsToday,
    signupsWeek,
    postsToday,
    postsWeek,
    commentsToday,
    commentsWeek,
    verdictsWeek,
    suspended,
    pendingReportsData,
  ] = await Promise.all([
    countWhere("users"),
    countWhere("users", (q) => q.gte("last_active_at", dayAgo)),
    countWhere("users", (q) => q.gte("last_active_at", weekAgo)),
    countWhere("users", (q) => q.gte("created_at", dayAgo)),
    countWhere("users", (q) => q.gte("created_at", weekAgo)),
    countWhere("posts", (q) => q.gte("created_at", dayAgo)),
    countWhere("posts", (q) => q.gte("created_at", weekAgo)),
    countWhere("comments", (q) => q.gte("created_at", dayAgo)),
    countWhere("comments", (q) => q.gte("created_at", weekAgo)),
    countWhere("verdicts", (q) => q.gte("created_at", weekAgo)),
    countWhere("users", (q) => q.eq("is_suspended", true)),
    liveDb().from("reports").select("created_at", { count: "exact" }).eq("status", "pending"),
  ]);

  const overdue = ((pendingReportsData.data ?? []) as any[]).filter(
    (r) => (Date.now() - new Date(r.created_at ?? "").getTime()) / 36e5 > 24
  ).length;

  return {
    dau,
    wau,
    total_users: totalUsers,
    new_signups_today: signupsToday,
    new_signups_week: signupsWeek,
    posts_today: postsToday,
    comments_today: commentsToday,
    posts_per_day_avg: Math.round(postsWeek / 7),
    comments_per_day_avg: Math.round(commentsWeek / 7),
    pending_reports: pendingReportsData.count ?? 0,
    reports_overdue: overdue,
    verdicts_per_day_avg: Math.round(verdictsWeek / 7),
    suspended_accounts: suspended,
    banned_accounts: 0,
    suspended_by_filter: 0,
  };
}

// ===========================================================================
// Reports
// ===========================================================================
export async function getReports(q: ReportQuery = {}): Promise<Paginated<AdminReport>> {
  if (IS_MOCK) {
    let rows = [...mock.reports].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.reason && q.reason !== "all") rows = rows.filter((r) => r.reason === q.reason);
    if (q.targetType && q.targetType !== "all") rows = rows.filter((r) => r.target_type === q.targetType);
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reporter.alias.toLowerCase().includes(s) ||
          (r.details ?? "").toLowerCase().includes(s) ||
          (r.post?.content ?? "").toLowerCase().includes(s) ||
          (r.comment?.content ?? "").toLowerCase().includes(s)
      );
    }
    return paginate(rows, q.page, q.pageSize);
  }
  // Live: embed the reported post/comment (+ their author) and the reporter so
  // the queue and drawer show real content, not just IDs.
  const supabase = liveDb();
  const authorCols = "id,alias,avatar_color,avatar_url,is_verified,is_suspended";
  let query = supabase
    .from("reports")
    .select(
      `*,
       reporter:reporter_id(${authorCols}),
       post:post_id(id,author_id,topic_id,type,content,media_urls,mood,is_deleted,comments_disabled,view_count,created_at,users:author_id(${authorCols}),topics:topic_id(id,name,icon,color),post_stats(sip_count,comment_count,red_flag_count,green_flag_count,same_count,repost_count)),
       comment:comment_id(id,post_id,author_id,content,upvotes,is_deleted,created_at,users:author_id(${authorCols}))`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });
  if (q.status && q.status !== "all") query = query.eq("status", q.status);
  if (q.reason && q.reason !== "all") query = query.eq("reason", q.reason as any);
  const page = q.page ?? 1;
  const size = q.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, count } = await query.range((page - 1) * size, page * size - 1);

  const toAuthor = (u: any): AuthorRef | null =>
    u
      ? {
          id: u.id,
          alias: u.alias,
          avatar_color: u.avatar_color,
          avatar_url: u.avatar_url,
          is_verified: !!u.is_verified,
          is_suspended: !!u.is_suspended,
        }
      : null;

  const rows: AdminReport[] = ((data ?? []) as any[]).map((r) => {
    const post: AdminPost | null = r.post
      ? {
          id: r.post.id,
          author: toAuthor(r.post.users) ?? { id: r.post.author_id, alias: "unknown", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
          topic: r.post.topics ? { id: r.post.topics.id, name: r.post.topics.name, icon: r.post.topics.icon, color: r.post.topics.color } : null,
          type: r.post.type ?? "original",
          content: r.post.content,
          media_urls: (r.post.media_urls ?? []).map(publicMediaUrl),
          mood: r.post.mood,
          is_deleted: !!r.post.is_deleted,
          comments_disabled: !!r.post.comments_disabled,
          created_at: r.post.created_at,
          stats: {
            sip_count: r.post.post_stats?.sip_count ?? 0,
            comment_count: r.post.post_stats?.comment_count ?? 0,
            red_flag_count: r.post.post_stats?.red_flag_count ?? 0,
            green_flag_count: r.post.post_stats?.green_flag_count ?? 0,
            same_count: r.post.post_stats?.same_count ?? 0,
            repost_count: r.post.post_stats?.repost_count ?? 0,
            view_count: r.post.view_count ?? 0,
          },
          poll: null,
          report_count: 0,
        }
      : null;
    const comment: AdminComment | null = r.comment
      ? {
          id: r.comment.id,
          post_id: r.comment.post_id,
          post_excerpt: "",
          author: toAuthor(r.comment.users) ?? { id: r.comment.author_id, alias: "unknown", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
          content: r.comment.content,
          upvotes: r.comment.upvotes ?? 0,
          is_deleted: !!r.comment.is_deleted,
          created_at: r.comment.created_at,
          report_count: 0,
        }
      : null;
    return {
      id: r.id,
      reporter: toAuthor(r.reporter) ?? { id: r.reporter_id, alias: "anon", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
      target_type: r.post_id ? "post" : r.comment_id ? "comment" : "user",
      reason: r.reason,
      details: r.details,
      status: (r.status as ReportStatus) ?? "pending",
      created_at: r.created_at ?? new Date().toISOString(),
      resolved_at: null,
      post,
      comment,
      target_user: null,
    };
  });
  return { rows, total: count ?? rows.length };
}

export async function getReportById(id: number): Promise<AdminReport | null> {
  if (IS_MOCK) return mock.reports.find((r) => r.id === id) ?? null;
  const list = await getReports({ pageSize: 500 });
  return list.rows.find((r) => r.id === id) ?? null;
}

// ===========================================================================
// Review queue (published-then-held moderation)
// ===========================================================================
export interface ReviewQueueQuery {
  limit?: number;
  /** Pass the last item's `reported_at` to page forward (newest-first). */
  cursor?: string | null;
}

const REVIEW_PAGE_SIZE = 25;

function mapReviewItem(r: any): ReviewQueueItem {
  return {
    report_id: r.report_id,
    reason: r.reason,
    details: r.details ?? null,
    status: r.status ?? "pending",
    reported_at: r.reported_at,
    is_system: !!r.is_system,
    post_id: r.post_id,
    content: r.content ?? null,
    media_urls: (r.media_urls ?? []).map(publicMediaUrl),
    mood: r.mood ?? null,
    is_under_review: !!r.is_under_review,
    is_deleted: !!r.is_deleted,
    post_created_at: r.post_created_at,
    author: {
      id: r.author?.id ?? "",
      alias: r.author?.alias ?? "anon",
      avatar_shape: r.author?.avatar_shape ?? null,
      avatar_color: r.author?.avatar_color ?? null,
      avatar_url: r.author?.avatar_url ?? null,
      preset_avatar_id: r.author?.preset_avatar_id ?? null,
    },
    topic: r.topic
      ? { id: r.topic.id, name: r.topic.name, icon: r.topic.icon, color: r.topic.color }
      : null,
  };
}

/**
 * The moderation Review Queue: held posts (is_under_review) each paired with a
 * pending report, newest first. Uses the `admin_list_review_queue` RPC only —
 * RLS hides system auto-flags from clients, and the RPC is the single authorized
 * surface. Runs on the admin's *session* client (see the import note above).
 */
export async function getReviewQueue(q: ReviewQueueQuery = {}): Promise<ReviewQueueItem[]> {
  const limit = q.limit ?? REVIEW_PAGE_SIZE;
  const cursor = q.cursor ?? null;

  if (IS_MOCK) {
    let rows = mock.reviewQueue; // already newest-first
    if (cursor) rows = rows.filter((r) => new Date(r.reported_at).getTime() < new Date(cursor).getTime());
    return rows.slice(0, limit);
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_review_queue" as any, {
    p_limit: limit,
    p_cursor: cursor,
  } as any);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(mapReviewItem);
}

// ===========================================================================
// Posts
// ===========================================================================
function publicMediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/${POST_MEDIA_BUCKET}/${path}`;
}

export async function getPosts(q: PostQuery = {}): Promise<Paginated<AdminPost>> {
  if (IS_MOCK) {
    let rows = [...mock.posts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (!q.includeDeleted) rows = rows.filter((p) => !p.is_deleted);
    if (q.authorId) rows = rows.filter((p) => p.author.id === q.authorId);
    if (q.topicId && q.topicId !== "all") rows = rows.filter((p) => p.topic?.id === q.topicId);
    if (q.onlyReported) rows = rows.filter((p) => p.report_count > 0);
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (p) => (p.content ?? "").toLowerCase().includes(s) || p.author.alias.toLowerCase().includes(s)
      );
    }
    return paginate(rows, q.page, q.pageSize);
  }
  const supabase = liveDb();
  let query = supabase
    .from("posts")
    .select(
      "id, author_id, topic_id, type, content, media_urls, mood, is_deleted, comments_disabled, view_count, created_at, users:author_id(id,alias,avatar_color,avatar_url,is_verified,is_suspended), topics:topic_id(id,name,icon,color), post_stats(sip_count,comment_count,red_flag_count,green_flag_count,same_count,repost_count)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });
  if (!q.includeDeleted) query = query.eq("is_deleted", false);
  if (q.authorId) query = query.eq("author_id", q.authorId);
  if (q.topicId && q.topicId !== "all") query = query.eq("topic_id", q.topicId);
  if (q.search) query = query.ilike("content", `%${q.search}%`);
  const page = q.page ?? 1;
  const size = q.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, count } = await query.range((page - 1) * size, page * size - 1);
  const rows: AdminPost[] = (data ?? []).map((p: any) => ({
    id: p.id,
    author: p.users
      ? { id: p.users.id, alias: p.users.alias, avatar_color: p.users.avatar_color, avatar_url: p.users.avatar_url, is_verified: !!p.users.is_verified, is_suspended: !!p.users.is_suspended }
      : { id: p.author_id, alias: "unknown", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
    topic: p.topics ? { id: p.topics.id, name: p.topics.name, icon: p.topics.icon, color: p.topics.color } : null,
    type: p.type ?? "original",
    content: p.content,
    media_urls: (p.media_urls ?? []).map(publicMediaUrl),
    mood: p.mood,
    is_deleted: !!p.is_deleted,
    comments_disabled: !!p.comments_disabled,
    created_at: p.created_at,
    stats: {
      sip_count: p.post_stats?.sip_count ?? 0,
      comment_count: p.post_stats?.comment_count ?? 0,
      red_flag_count: p.post_stats?.red_flag_count ?? 0,
      green_flag_count: p.post_stats?.green_flag_count ?? 0,
      same_count: p.post_stats?.same_count ?? 0,
      repost_count: p.post_stats?.repost_count ?? 0,
      view_count: p.view_count ?? 0,
    },
    poll: null,
    report_count: 0,
  }));
  return { rows, total: count ?? rows.length };
}

export async function getPostById(id: number): Promise<AdminPost | null> {
  if (IS_MOCK) return mock.posts.find((p) => p.id === id) ?? null;
  const { rows } = await getPosts({ pageSize: 1, search: undefined });
  return rows.find((p) => p.id === id) ?? null;
}

// ===========================================================================
// Users
// ===========================================================================
export async function getUsers(q: UserQuery = {}): Promise<Paginated<AdminUser>> {
  if (IS_MOCK) {
    let rows = [...mock.users].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (q.status === "suspended") rows = rows.filter((u) => u.is_suspended);
    else if (q.status === "verified") rows = rows.filter((u) => u.is_verified);
    else if (q.status === "active") rows = rows.filter((u) => !u.is_suspended);
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter((u) => u.alias.toLowerCase().includes(s) || u.id.includes(s));
    }
    return paginate(rows, q.page, q.pageSize);
  }
  const supabase = liveDb();
  let query = supabase.from("users").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (q.status === "suspended") query = query.eq("is_suspended", true);
  else if (q.status === "verified") query = query.eq("is_verified", true);
  else if (q.status === "active") query = query.eq("is_suspended", false);
  if (q.search) query = query.ilike("alias", `%${q.search}%`);
  const page = q.page ?? 1;
  const size = q.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, count } = await query.range((page - 1) * size, page * size - 1);
  const rows: AdminUser[] = ((data ?? []) as any[]).map(mapUserRow);
  await attachUserCounts(rows);
  return { rows, total: count ?? rows.length };
}

function mapUserRow(u: any): AdminUser {
  return {
    id: u.id,
    alias: u.alias,
    avatar_color: u.avatar_color,
    avatar_url: u.avatar_url,
    bio: u.bio,
    is_verified: !!u.is_verified,
    is_suspended: !!u.is_suspended,
    is_advisor: !!u.is_advisor,
    suspended_at: u.suspended_at,
    suspension_reason: u.suspension_reason,
    created_at: u.created_at ?? new Date().toISOString(),
    last_active_at: u.last_active_at,
    post_count: 0,
    comment_count: 0,
    reports_against: 0,
  };
}

/** Tally post + comment counts for the given users in two bounded queries. */
async function attachUserCounts(users: AdminUser[]): Promise<void> {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const [p, c] = await Promise.all([
    liveDb().from("posts").select("author_id").in("author_id", ids),
    liveDb().from("comments").select("author_id").in("author_id", ids),
  ]);
  const pc = new Map<string, number>();
  const cc = new Map<string, number>();
  for (const r of (p.data ?? []) as any[]) pc.set(r.author_id, (pc.get(r.author_id) ?? 0) + 1);
  for (const r of (c.data ?? []) as any[]) cc.set(r.author_id, (cc.get(r.author_id) ?? 0) + 1);
  for (const u of users) {
    u.post_count = pc.get(u.id) ?? 0;
    u.comment_count = cc.get(u.id) ?? 0;
  }
}

export async function getUserById(id: string): Promise<AdminUser | null> {
  if (IS_MOCK) return mock.users.find((u) => u.id === id) ?? null;
  const { data } = await liveDb().from("users").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const user = mapUserRow(data);
  await attachUserCounts([user]);
  return user;
}

export async function getUserPosts(userId: string): Promise<AdminPost[]> {
  if (IS_MOCK) return mock.posts.filter((p) => p.author.id === userId);
  const { rows } = await getPosts({ authorId: userId, includeDeleted: true, pageSize: 50 });
  return rows;
}

/** All comments on a given post (for the post-detail drawer). Includes deleted,
 *  marked as such, so admins see the full thread. */
export async function getPostComments(postId: number): Promise<AdminComment[]> {
  if (IS_MOCK) {
    return mock.comments
      .filter((c) => c.post_id === postId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  const { data } = await liveDb()
    .from("comments")
    .select(
      "id, post_id, author_id, content, upvotes, is_deleted, created_at, users:author_id(id,alias,avatar_color,avatar_url,is_verified,is_suspended)"
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    post_id: c.post_id,
    post_excerpt: "",
    author: c.users
      ? { id: c.users.id, alias: c.users.alias, avatar_color: c.users.avatar_color, avatar_url: c.users.avatar_url, is_verified: !!c.users.is_verified, is_suspended: !!c.users.is_suspended }
      : { id: c.author_id, alias: "unknown", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
    content: c.content,
    upvotes: c.upvotes ?? 0,
    is_deleted: !!c.is_deleted,
    created_at: c.created_at,
    report_count: 0,
  }));
}

export async function getUserComments(userId: string): Promise<AdminComment[]> {
  if (IS_MOCK) return mock.comments.filter((c) => c.author.id === userId);
  const { data } = await liveDb()
    .from("comments")
    .select("id, post_id, content, upvotes, is_deleted, created_at, posts:post_id(content)")
    .eq("author_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    post_id: c.post_id,
    post_excerpt: (c.posts?.content ?? "").slice(0, 70),
    author: { id: userId, alias: "", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
    content: c.content,
    upvotes: c.upvotes ?? 0,
    is_deleted: !!c.is_deleted,
    created_at: c.created_at,
    report_count: 0,
  }));
}

// ===========================================================================
// Comments
// ===========================================================================
export async function getComments(q: CommentQuery = {}): Promise<Paginated<AdminComment>> {
  if (IS_MOCK) {
    let rows = [...mock.comments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (!q.includeDeleted) rows = rows.filter((c) => !c.is_deleted);
    if (q.onlyReported) rows = rows.filter((c) => c.report_count > 0);
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.content.toLowerCase().includes(s) ||
          c.author.alias.toLowerCase().includes(s) ||
          c.post_excerpt.toLowerCase().includes(s)
      );
    }
    return paginate(rows, q.page, q.pageSize);
  }
  const supabase = liveDb();
  let query = supabase
    .from("comments")
    .select("id, post_id, author_id, content, upvotes, is_deleted, created_at, users:author_id(id,alias,avatar_color,avatar_url,is_verified,is_suspended)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (!q.includeDeleted) query = query.eq("is_deleted", false);
  if (q.search) query = query.ilike("content", `%${q.search}%`);
  const page = q.page ?? 1;
  const size = q.pageSize ?? DEFAULT_PAGE_SIZE;
  const { data, count } = await query.range((page - 1) * size, page * size - 1);
  const rows: AdminComment[] = (data ?? []).map((c: any) => ({
    id: c.id,
    post_id: c.post_id,
    post_excerpt: "",
    author: c.users
      ? { id: c.users.id, alias: c.users.alias, avatar_color: c.users.avatar_color, avatar_url: c.users.avatar_url, is_verified: !!c.users.is_verified, is_suspended: !!c.users.is_suspended }
      : { id: c.author_id, alias: "unknown", avatar_color: null, avatar_url: null, is_verified: false, is_suspended: false },
    content: c.content,
    upvotes: c.upvotes ?? 0,
    is_deleted: !!c.is_deleted,
    created_at: c.created_at,
    report_count: 0,
  }));
  return { rows, total: count ?? rows.length };
}

// ===========================================================================
// Broadcasts
// ===========================================================================
export async function getBroadcasts(): Promise<Broadcast[]> {
  if (IS_MOCK) return mock.broadcasts;
  const supabase = liveDb();
  const { data } = await supabase.from("admin_broadcasts").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Broadcast[];
}

// ===========================================================================
// Audit log
// ===========================================================================
export async function getAuditLog(q: AuditQuery = {}): Promise<Paginated<AuditEntry>> {
  if (IS_MOCK) {
    let rows = [...mock.auditLog].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (q.action && q.action !== "all") rows = rows.filter((a) => a.action === q.action);
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.actor_email.toLowerCase().includes(s) ||
          (a.target_label ?? "").toLowerCase().includes(s) ||
          (a.reason ?? "").toLowerCase().includes(s)
      );
    }
    return paginate(rows, q.page, q.pageSize ?? 40);
  }
  const supabase = liveDb();
  let query = supabase.from("admin_audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (q.action && q.action !== "all") query = query.eq("action", q.action);
  const page = q.page ?? 1;
  const size = q.pageSize ?? 40;
  const { data, count } = await query.range((page - 1) * size, page * size - 1);
  const rows = (data ?? []).map((a: any) => ({
    id: a.id,
    actor_email: a.actor_email,
    action: a.action,
    target_type: a.target_type,
    target_id: a.target_id,
    target_label: a.target_label,
    reason: a.reason,
    metadata: a.metadata,
    created_at: a.created_at,
  })) as AuditEntry[];
  return { rows, total: count ?? rows.length };
}

// ===========================================================================
// Analytics (charts)
// ===========================================================================
/**
 * Fetch a single timestamp column from `sinceISO` forward, paging past the 1000-row
 * PostgREST cap. Returns the raw ISO strings; caller buckets by day. Capped at
 * 50 pages (50k rows) as a safety valve.
 */
async function fetchTimestampsSince(
  table: "users" | "posts" | "comments" | "verdicts",
  col: string,
  sinceISO: string
): Promise<string[]> {
  const out: string[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 50; page++) {
    const { data } = await liveDb()
      .from(table)
      .select(col)
      .gte(col, sinceISO)
      .order(col, { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    const rows = (data ?? []) as any[];
    for (const r of rows) if (r[col]) out.push(r[col]);
    if (rows.length < PAGE) break;
  }
  return out;
}

const dayKey = (iso: string) => iso.slice(0, 10);

export async function getTimeSeries(days: number): Promise<TimeSeriesPoint[]> {
  if (IS_MOCK) return mock.timeSeries(days);

  const since = new Date(Date.now() - days * 864e5);
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  const [signupTs, postTs, commentTs, verdictTs, baseUsers] = await Promise.all([
    fetchTimestampsSince("users", "created_at", sinceISO),
    fetchTimestampsSince("posts", "created_at", sinceISO),
    fetchTimestampsSince("comments", "created_at", sinceISO),
    fetchTimestampsSince("verdicts", "created_at", sinceISO),
    countWhere("users", (q) => q.lt("created_at", sinceISO)), // members before the window
  ]);

  const bucket = (arr: string[]) => {
    const m = new Map<string, number>();
    for (const iso of arr) m.set(dayKey(iso), (m.get(dayKey(iso)) ?? 0) + 1);
    return m;
  };
  const sB = bucket(signupTs), pB = bucket(postTs), cB = bucket(commentTs), vB = bucket(verdictTs);

  const out: TimeSeriesPoint[] = [];
  let cumulative = baseUsers;
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    const signups = sB.get(day) ?? 0;
    cumulative += signups;
    out.push({
      date: day,
      signups,
      users: cumulative,
      posts: pB.get(day) ?? 0,
      comments: cB.get(day) ?? 0,
      verdicts: vB.get(day) ?? 0,
    });
  }
  return out;
}

export async function getTopicVolume(): Promise<TopicVolume[]> {
  if (IS_MOCK) return mock.topicVolume;
  const { data } = await liveDb().rpc("get_trending_topics" as any, {} as any);
  const rows = (data ?? []) as any[];
  return rows
    .map((t) => ({ name: t.name, color: t.color, posts: t.post_count ?? 0 }))
    .sort((a, b) => b.posts - a.posts);
}

export async function getTrendingHashtags(): Promise<HashtagVolume[]> {
  if (IS_MOCK) return mock.trendingHashtags;
  const { data } = await liveDb().rpc("get_trending_hashtags" as any, {} as any);
  const rows = (data ?? []) as any[];
  return rows.map((h) => ({ tag: h.hashtag ?? h.tag, count: h.post_count ?? h.count ?? 0 }));
}

export async function getTopics(): Promise<{ id: number; name: string; icon: string; color: string }[]> {
  if (IS_MOCK) return mock.TOPICS;
  const { data } = await liveDb().from("topics").select("id,name,icon,color").order("id");
  return (data ?? []) as any[];
}

export interface PushCoverageRow {
  outcome: string;
  platform: string | null;
  users: number;
  pct: number;
  most_recent: string | null;
}

export async function getPushCoverage(): Promise<{ rows: PushCoverageRow[]; totalRegistered: number }> {
  if (IS_MOCK) {
    const rows = mock.pushCoverage;
    return { rows, totalRegistered: rows.reduce((s, r) => s + r.users, 0) };
  }
  const { data } = await liveDb()
    .from("push_registration_coverage" as any)
    .select("*")
    .order("users", { ascending: false });
  const rows = ((data ?? []) as any[]) as PushCoverageRow[];
  return { rows, totalRegistered: rows.reduce((s, r) => s + (r.users ?? 0), 0) };
}

// ---------------------------------------------------------------------------
// Seed profiles (users.is_seed = true) — the "act as" switcher roster.
// ---------------------------------------------------------------------------
export async function getSeedProfiles(): Promise<SeedProfile[]> {
  if (IS_MOCK) {
    // Surface the first slice of mock users as stand-in seed profiles so the
    // switcher renders with zero backend setup.
    return mock.users.slice(0, 20).map((u, i) => ({
      id: u.id,
      alias: u.alias,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url,
      // Give the mock stand-ins a spread of presets so the switcher demos faces.
      preset_avatar_id: ["p1", "m1", "p3", "a2", "m3", "w3", "p4", "m6", "m5", "p2"][i % 10],
      bio: u.bio,
      is_verified: u.is_verified,
      post_count: u.post_count,
      comment_count: u.comment_count,
      created_at: u.created_at,
    }));
  }
  // post_count / comment_count are NOT columns on users (they're computed with
  // extra count queries elsewhere). The switcher doesn't need live totals, so we
  // skip that cost and report 0 — the roster is small and the seeder knows who
  // they've posted as from the audit log.
  const { data } = await liveDb()
    .from("users")
    .select("id, alias, avatar_color, avatar_url, preset_avatar_id, bio, is_verified, created_at")
    // is_seed is a new column, not yet in the generated Database types.
    .eq("is_seed" as any, true)
    .order("alias", { ascending: true });
  return (data ?? []).map((u: any) => ({
    id: u.id,
    alias: u.alias,
    avatar_color: u.avatar_color ?? null,
    avatar_url: u.avatar_url ?? null,
    preset_avatar_id: u.preset_avatar_id ?? null,
    bio: u.bio ?? null,
    is_verified: !!u.is_verified,
    post_count: 0,
    comment_count: 0,
    created_at: u.created_at,
  }));
}
