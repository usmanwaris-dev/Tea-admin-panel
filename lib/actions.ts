"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { IS_MOCK, hasServiceRole, SEED_AVATAR_BUCKET, POST_MEDIA_BUCKET, SUPABASE_URL } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPostComments, getReviewQueue, getUserComments, getUserPosts } from "@/lib/data/repo";
import * as mock from "@/lib/mock/data";
import type { AdminComment, AdminPost, AuditAction, ReportStatus, ReviewQueueItem, VerdictType } from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Write an audit entry for every privileged action. In live mode this inserts
 * into admin_audit_log via the service-role client; in mock mode it prepends to
 * the in-memory log so the Audit page reflects the action immediately.
 */
async function audit(entry: {
  actor_email: string;
  action: AuditAction;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  reason: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  if (IS_MOCK || !hasServiceRole) {
    mock.auditLog.unshift({
      id: `audit-live-${mock.auditLog.length}-${entry.target_id ?? "x"}`,
      actor_email: entry.actor_email,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      target_label: entry.target_label,
      reason: entry.reason,
      metadata: entry.metadata ?? null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const supabase = createSupabaseAdminClient();
  await supabase.from("admin_audit_log").insert({
    actor_email: entry.actor_email,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    target_label: entry.target_label,
    reason: entry.reason,
    metadata: (entry.metadata ?? null) as any,
  });
}

/** Resolve a user's alias for the audit label (live mode looks it up in the DB). */
async function userLabel(userId: string): Promise<string> {
  const mockU = mock.users.find((u) => u.id === userId);
  if (mockU) return mockU.alias;
  if (!IS_MOCK && hasServiceRole) {
    const { data } = await createSupabaseAdminClient().from("users").select("alias").eq("id", userId).maybeSingle();
    return data?.alias ?? userId;
  }
  return userId;
}

function revalidateAll() {
  ["/", "/reports", "/review", "/posts", "/users", "/comments", "/audit", "/broadcast", "/analytics", "/seed"].forEach((p) =>
    revalidatePath(p)
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export async function resolveReportAction(
  reportId: number,
  status: ReportStatus,
  reason: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (IS_MOCK || !hasServiceRole) {
    const r = mock.reports.find((r) => r.id === reportId);
    if (r) {
      r.status = status;
      r.resolved_at = status === "resolved" || status === "dismissed" ? new Date().toISOString() : null;
    }
  } else {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("reports")
      .update({ status, resolved: status === "resolved" || status === "dismissed" })
      .eq("id", reportId);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: status === "dismissed" ? "report.dismiss" : "report.resolve",
    target_type: "report",
    target_id: String(reportId),
    target_label: `Report #${reportId}`,
    reason: reason || null,
  });
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Review queue (published-then-held moderation)
// ---------------------------------------------------------------------------
export type ReviewLoadResult =
  | { ok: true; items: ReviewQueueItem[] }
  | { ok: false; message: string };

/** Fetch a page of the review queue for the client (initial load + "load more"). */
export async function loadReviewQueueAction(
  cursor: string | null,
  limit = 25
): Promise<ReviewLoadResult> {
  try {
    await requireAdmin();
    const items = await getReviewQueue({ cursor, limit });
    return { ok: true, items };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to load the review queue" };
  }
}

/**
 * Resolve one held-post report via the `admin_resolve_report` RPC.
 *  - "dismissed" → Approve & publish (post goes live, counts toward its topic)
 *  - "resolved"  → Keep removed (post stays hidden)
 * The RPC re-checks is_admin() and writes its own audit row, so in live mode we
 * do NOT double-audit here. In mock mode we drop the item and log locally.
 */
export async function resolveReviewAction(
  reportId: number,
  status: "dismissed" | "resolved",
  reason: string
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (IS_MOCK || !hasServiceRole) {
    const idx = mock.reviewQueue.findIndex((r) => r.report_id === reportId);
    if (idx >= 0) mock.reviewQueue.splice(idx, 1);
    await audit({
      actor_email: admin.email,
      action: status === "dismissed" ? "report.dismiss" : "report.resolve",
      target_type: "report",
      target_id: String(reportId),
      target_label: `Review report #${reportId}`,
      reason: reason || null,
    });
    revalidateAll();
    return { ok: true };
  }

  // Session client — the RPC is is_admin()-gated (service role has no auth.uid()).
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_resolve_report" as any, {
    p_report_id: reportId,
    p_status: status,
    p_reason: reason,
  } as any);
  if (error) return { ok: false, message: error.message };
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
export async function deletePostAction(postId: number, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (IS_MOCK || !hasServiceRole) {
    const p = mock.posts.find((p) => p.id === postId);
    if (p) p.is_deleted = true;
  } else {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("posts").update({ is_deleted: true }).eq("id", postId);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: "post.delete",
    target_type: "post",
    target_id: String(postId),
    target_label: `Post #${postId}`,
    reason,
  });
  revalidateAll();
  return { ok: true };
}

export async function setPostPinnedAction(postId: number, pinned: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!IS_MOCK && hasServiceRole) {
    const supabase = createSupabaseAdminClient();
    const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
    if (post?.author_id) {
      const { error } = await supabase
        .from("users")
        .update({ pinned_post_id: pinned ? postId : null })
        .eq("id", post.author_id);
      if (error) return { ok: false, message: error.message };
    }
  }
  await audit({
    actor_email: admin.email,
    action: pinned ? "post.pin" : "post.unpin",
    target_type: "post",
    target_id: String(postId),
    target_label: `Post #${postId}`,
    reason: null,
  });
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------
export async function deleteCommentAction(commentId: number, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (IS_MOCK || !hasServiceRole) {
    const c = mock.comments.find((c) => c.id === commentId);
    if (c) c.is_deleted = true;
  } else {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("comments").update({ is_deleted: true }).eq("id", commentId);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: "comment.delete",
    target_type: "comment",
    target_id: String(commentId),
    target_label: `Comment #${commentId}`,
    reason,
  });
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function setSuspendedAction(
  userId: string,
  suspended: boolean,
  reason: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (IS_MOCK || !hasServiceRole) {
    const u = mock.users.find((u) => u.id === userId);
    if (u) {
      u.is_suspended = suspended;
      u.suspended_at = suspended ? new Date().toISOString() : null;
      u.suspension_reason = suspended ? reason : null;
    }
  } else {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("users")
      .update({
        is_suspended: suspended,
        suspended_at: suspended ? new Date().toISOString() : null,
        suspension_reason: suspended ? reason : null,
      })
      .eq("id", userId);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: suspended ? "user.suspend" : "user.unsuspend",
    target_type: "user",
    target_id: userId,
    target_label: await userLabel(userId),
    reason: suspended ? reason : null,
  });
  revalidateAll();
  return { ok: true };
}

/** Lazy-load a post's comments for the post-detail drawer (admin only). */
export async function loadPostCommentsAction(postId: number): Promise<AdminComment[]> {
  await requireAdmin();
  return getPostComments(postId);
}

/** Lazy-load a user's posts + comments for the profile drawer (admin only). */
export async function loadUserActivityAction(
  userId: string
): Promise<{ posts: AdminPost[]; comments: AdminComment[] }> {
  await requireAdmin();
  const [posts, comments] = await Promise.all([getUserPosts(userId), getUserComments(userId)]);
  return { posts, comments };
}

export async function setVerifiedAction(userId: string, verified: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (IS_MOCK || !hasServiceRole) {
    const u = mock.users.find((u) => u.id === userId);
    if (u) u.is_verified = verified;
  } else {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("users").update({ is_verified: verified }).eq("id", userId);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: verified ? "user.verify" : "user.unverify",
    target_type: "user",
    target_id: userId,
    target_label: await userLabel(userId),
    reason: null,
  });
  revalidateAll();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------
export interface BroadcastInput {
  title: string;
  body: string;
  route: string | null;
  /** Preview the recipient count without sending (uses the function's dry_run). */
  dryRun?: boolean;
  /** Send only to this single FCM token (a safe test to your own device). */
  testToken?: string | null;
}

/**
 * The send-broadcast Edge Function targets EVERY user with a saved fcm_token
 * (there is no segment/audience support server-side). We therefore expose only
 * honest options: a dry-run count, a single-device test, or a real send-to-all.
 */
export async function sendBroadcastAction(
  input: BroadcastInput
): Promise<ActionResult & { recipients?: number }> {
  const admin = await requireAdmin();
  if (!input.title.trim() || !input.body.trim()) {
    return { ok: false, message: "Title and body are required." };
  }

  const audienceLabel = input.testToken ? "Test device" : "All users with push enabled";

  // ---- Mock mode ----
  if (IS_MOCK || !hasServiceRole) {
    const recipients = input.testToken ? 1 : 3530;
    if (input.dryRun) {
      return { ok: true, message: `${recipients.toLocaleString()} devices would receive this`, recipients };
    }
    const delivered = Math.floor(recipients * 0.97);
    mock.broadcasts.unshift({
      id: `bc-live-${mock.broadcasts.length}`,
      title: input.title,
      body: input.body,
      route: input.route,
      audience: audienceLabel,
      status: "sent",
      recipients,
      delivered,
      sent_by: admin.email,
      created_at: new Date().toISOString(),
    });
    await audit({
      actor_email: admin.email,
      action: "broadcast.send",
      target_type: "broadcast",
      target_id: null,
      target_label: input.title,
      reason: null,
      metadata: { route: input.route, recipients, test: !!input.testToken },
    });
    revalidateAll();
    return { ok: true, message: `Sent to ${recipients.toLocaleString()} devices`, recipients };
  }

  // ---- Live: invoke the send-broadcast Edge Function ----
  const supabase = createSupabaseAdminClient();
  const payload: Record<string, unknown> = { title: input.title, body: input.body };
  if (input.route) payload.route = input.route;
  if (input.dryRun) payload.dry_run = true;
  if (input.testToken) payload.token = input.testToken;

  const { data, error } = await supabase.functions.invoke("send-broadcast", { body: payload });
  if (error) return { ok: false, message: error.message };
  const d = data as any;
  const recipients = d?.recipients ?? 0;
  const delivered = d?.sent ?? d?.delivered ?? recipients;

  // Dry-run: report the count, record nothing.
  if (input.dryRun) {
    return { ok: true, message: `${recipients.toLocaleString()} devices would receive this`, recipients };
  }

  await supabase.from("admin_broadcasts").insert({
    title: input.title,
    body: input.body,
    route: input.route,
    audience: audienceLabel,
    status: "sent",
    recipients,
    delivered,
    sent_by: admin.email,
  });
  await audit({
    actor_email: admin.email,
    action: "broadcast.send",
    target_type: "broadcast",
    target_id: null,
    target_label: input.title,
    reason: null,
    metadata: { route: input.route, recipients, test: !!input.testToken },
  });
  revalidateAll();
  return {
    ok: true,
    message: input.testToken ? "Test notification sent to your device" : `Sent to ${recipients.toLocaleString()} devices`,
    recipients,
  };
}

// ---------------------------------------------------------------------------
// Seed profiles — "act as" impersonation for content seeding.
//
// An admin picks a seed profile (users.is_seed = true); the chosen id is held in
// an httpOnly cookie. Post / comment / verdict then write under that profile via
// the service-role client (which bypasses the auth.uid()=owner RLS), while the
// audit trail records the real admin behind every write. Only is_seed accounts
// can ever be targeted — a real user's account can never be impersonated.
// ---------------------------------------------------------------------------

/** Cookie holding the id of the profile the admin is currently acting as. */
const ACTING_COOKIE = "tea_acting_as";

/** In mock mode the first 20 mock users stand in for seed profiles. */
function mockSeedUsers() {
  return mock.users.slice(0, 20);
}

/** True if `userId` is a genuine seed profile in the current data source. */
async function isSeedProfile(userId: string): Promise<boolean> {
  if (IS_MOCK || !hasServiceRole) {
    return mockSeedUsers().some((u) => u.id === userId);
  }
  const { data } = await createSupabaseAdminClient()
    .from("users")
    .select("id")
    .eq("id", userId)
    // is_seed is a new column, not yet in the generated Database types.
    .eq("is_seed" as any, true)
    .maybeSingle();
  return !!data;
}

/** Read the active seed-author id from the cookie (null if not acting as anyone). */
export async function getActingAsId(): Promise<string | null> {
  await requireAdmin();
  return cookies().get(ACTING_COOKIE)?.value ?? null;
}

export interface ActingAsProfile {
  id: string;
  alias: string;
  avatar_color: string | null;
  avatar_url: string | null;
  preset_avatar_id: string | null;
}

/** Resolve the active seed profile (id + display bits), or null if none selected. */
export async function getActingAsProfile(): Promise<ActingAsProfile | null> {
  await requireAdmin();
  const id = cookies().get(ACTING_COOKIE)?.value ?? null;
  if (!id) return null;
  if (IS_MOCK || !hasServiceRole) {
    const u = mockSeedUsers().find((x) => x.id === id);
    return u ? { id: u.id, alias: u.alias, avatar_color: u.avatar_color, avatar_url: u.avatar_url, preset_avatar_id: null } : null;
  }
  const { data } = await createSupabaseAdminClient()
    .from("users")
    .select("id, alias, avatar_color, avatar_url, preset_avatar_id")
    .eq("id", id)
    .eq("is_seed" as any, true)
    .maybeSingle();
  const u = data as any;
  return u
    ? { id: u.id, alias: u.alias, avatar_color: u.avatar_color ?? null, avatar_url: u.avatar_url ?? null, preset_avatar_id: u.preset_avatar_id ?? null }
    : null;
}

/** Begin acting as a seed profile. Rejects any target that isn't a seed account. */
export async function actAsProfileAction(seedId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!(await isSeedProfile(seedId))) {
    return { ok: false, message: "That account is not a seed profile — cannot act as it." };
  }
  cookies().set(ACTING_COOKIE, seedId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h working session
  });
  await audit({
    actor_email: admin.email,
    action: "seed.act_as",
    target_type: "user",
    target_id: seedId,
    target_label: await userLabel(seedId),
    reason: null,
  });
  revalidateAll();
  return { ok: true };
}

/** Stop acting as any profile. */
export async function stopActingAsAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const prev = cookies().get(ACTING_COOKIE)?.value ?? null;
  cookies().delete(ACTING_COOKIE);
  await audit({
    actor_email: admin.email,
    action: "seed.stop",
    target_type: "user",
    target_id: prev,
    target_label: prev ? await userLabel(prev) : null,
    reason: null,
  });
  revalidateAll();
  return { ok: true };
}

/** Resolve the active seed author, or throw a clear error if none is selected. */
async function requireSeedAuthor(): Promise<{ authorId: string; alias: string; adminEmail: string }> {
  const admin = await requireAdmin();
  const authorId = cookies().get(ACTING_COOKIE)?.value ?? null;
  if (!authorId) throw new Error("Pick a profile to act as before posting.");
  if (!(await isSeedProfile(authorId))) throw new Error("The selected profile is no longer a seed account.");
  return { authorId, alias: await userLabel(authorId), adminEmail: admin.email };
}

/** Post a comment on `postId` as the active seed profile. */
export async function seedCommentAction(postId: number, content: string): Promise<ActionResult> {
  const { authorId, alias, adminEmail } = await requireSeedAuthor();
  const text = content.trim();
  if (!text) return { ok: false, message: "Comment can't be empty." };

  if (IS_MOCK || !hasServiceRole) {
    const post = mock.posts.find((p) => p.id === postId);
    const u = mock.users.find((x) => x.id === authorId);
    mock.comments.unshift({
      id: 90000 + mock.comments.length,
      post_id: postId,
      post_excerpt: (post?.content ?? "").slice(0, 70),
      author: {
        id: authorId,
        alias: u?.alias ?? alias,
        avatar_color: u?.avatar_color ?? null,
        avatar_url: u?.avatar_url ?? null,
        is_verified: u?.is_verified ?? false,
        is_suspended: false,
      },
      content: text,
      upvotes: 0,
      is_deleted: false,
      created_at: new Date().toISOString(),
      report_count: 0,
    });
  } else {
    const { error } = await createSupabaseAdminClient()
      .from("comments")
      .insert({ post_id: postId, author_id: authorId, content: text });
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: adminEmail,
    action: "seed.comment",
    target_type: "post",
    target_id: String(postId),
    target_label: `Comment on post #${postId}`,
    reason: null,
    metadata: { as: authorId, alias },
  });
  revalidateAll();
  return { ok: true, message: `Commented as ${alias}` };
}

/** Cast (or update) a verdict on `postId` as the active seed profile. */
export async function seedVerdictAction(postId: number, type: VerdictType): Promise<ActionResult> {
  const { authorId, alias, adminEmail } = await requireSeedAuthor();

  if (IS_MOCK || !hasServiceRole) {
    const post = mock.posts.find((p) => p.id === postId);
    if (post) {
      if (type === "red_flag") post.stats.red_flag_count += 1;
      else if (type === "green_flag") post.stats.green_flag_count += 1;
      else post.stats.same_count += 1;
    }
  } else {
    // PK (user_id, post_id): upsert so re-casting changes the vote, never dupes.
    // verdicts isn't in the generated Database types, so cast the table + row.
    const { error } = await createSupabaseAdminClient()
      .from("verdicts" as any)
      .upsert({ post_id: postId, user_id: authorId, type } as any, { onConflict: "user_id,post_id" });
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: adminEmail,
    action: "seed.verdict",
    target_type: "post",
    target_id: String(postId),
    target_label: `${type} on post #${postId}`,
    reason: null,
    metadata: { as: authorId, alias, type },
  });
  revalidateAll();
  return { ok: true, message: `Voted ${type.replace("_", " ")} as ${alias}` };
}

export interface SeedPostInput {
  content: string;
  topicId: number;
  /** Public image URLs already uploaded via uploadSeedImageAction. */
  mediaUrls?: string[];
  /** Poll choices; a poll is created only when ≥2 non-empty options are given. */
  pollOptions?: string[];
}

/** Create an original post as the active seed profile — with optional media + poll. */
export async function seedPostAction(input: SeedPostInput): Promise<ActionResult> {
  const { authorId, alias, adminEmail } = await requireSeedAuthor();
  const text = input.content.trim();
  const media = (input.mediaUrls ?? []).filter(Boolean);
  const pollOptions = (input.pollOptions ?? []).map((o) => o.trim()).filter(Boolean);
  if (!text && media.length === 0) return { ok: false, message: "Add some text or an image." };
  if (!input.topicId) return { ok: false, message: "Pick a topic." };
  if (pollOptions.length === 1) return { ok: false, message: "A poll needs at least 2 options." };
  if (pollOptions.length > 6) return { ok: false, message: "A poll can have at most 6 options." };

  let newId: number | null = null;
  if (IS_MOCK || !hasServiceRole) {
    const u = mock.users.find((x) => x.id === authorId);
    const topic = mock.TOPICS.find((t) => t.id === input.topicId) ?? null;
    newId = 80000 + mock.posts.length;
    mock.posts.unshift({
      id: newId,
      author: {
        id: authorId,
        alias: u?.alias ?? alias,
        avatar_color: u?.avatar_color ?? null,
        avatar_url: u?.avatar_url ?? null,
        is_verified: u?.is_verified ?? false,
        is_suspended: false,
      },
      topic,
      type: "original",
      content: text,
      media_urls: media,
      mood: null,
      is_deleted: false,
      comments_disabled: false,
      created_at: new Date().toISOString(),
      stats: { sip_count: 0, comment_count: 0, red_flag_count: 0, green_flag_count: 0, same_count: 0, repost_count: 0, view_count: 0 },
      poll:
        pollOptions.length >= 2
          ? { id: 70000 + mock.posts.length, question: null, options: pollOptions.map((t, i) => ({ id: i + 1, text: t, vote_count: 0 })) }
          : null,
      report_count: 0,
    });
  } else {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("posts")
      .insert({ author_id: authorId, topic_id: input.topicId, type: "original", content: text, media_urls: media })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    newId = (data as any)?.id ?? null;

    // Attach a poll via the existing SECURITY DEFINER helper.
    if (newId != null && pollOptions.length >= 2) {
      const { error: pollErr } = await supabase.rpc("create_poll_for_post" as any, {
        p_post_id: newId,
        p_options: pollOptions,
      } as any);
      if (pollErr) return { ok: false, message: `Post created, but poll failed: ${pollErr.message}` };
    }
  }
  await audit({
    actor_email: adminEmail,
    action: "seed.post",
    target_type: "post",
    target_id: newId != null ? String(newId) : null,
    target_label: `New post by ${alias}`,
    reason: null,
    metadata: { as: authorId, alias, topic_id: input.topicId, media: media.length, poll: pollOptions.length || undefined },
  });
  revalidateAll();
  return { ok: true, message: `Posted as ${alias}` };
}

/**
 * Repost an existing post as the active seed profile. A repost carries no body of
 * its own — its content is the sentinel `repost:<originalId>:<ts>` (matching the
 * app), the real content being the quoted original. One repost per profile per
 * post; a second is a no-op.
 */
export async function seedRepostAction(originalPostId: number): Promise<ActionResult> {
  const { authorId, alias, adminEmail } = await requireSeedAuthor();
  const sentinel = `repost:${originalPostId}:${Date.now()}`;

  if (IS_MOCK || !hasServiceRole) {
    const original = mock.posts.find((p) => p.id === originalPostId);
    if (!original) return { ok: false, message: "Original post not found." };
    if (mock.posts.some((p) => p.type === "repost" && p.author.id === authorId && (p.content ?? "").startsWith(`repost:${originalPostId}:`))) {
      return { ok: false, message: `${alias} already reposted this.` };
    }
    const u = mock.users.find((x) => x.id === authorId);
    mock.posts.unshift({
      id: 85000 + mock.posts.length,
      author: { id: authorId, alias: u?.alias ?? alias, avatar_color: u?.avatar_color ?? null, avatar_url: u?.avatar_url ?? null, is_verified: u?.is_verified ?? false, is_suspended: false },
      topic: original.topic,
      type: "repost",
      content: sentinel,
      media_urls: [],
      mood: null,
      is_deleted: false,
      comments_disabled: false,
      created_at: new Date().toISOString(),
      stats: { sip_count: 0, comment_count: 0, red_flag_count: 0, green_flag_count: 0, same_count: 0, repost_count: 0, view_count: 0 },
      poll: null,
      report_count: 0,
    });
  } else {
    const supabase = createSupabaseAdminClient();
    const { data: original } = await supabase
      .from("posts")
      .select("id, topic_id, is_deleted")
      .eq("id", originalPostId)
      .maybeSingle();
    if (!original || (original as any).is_deleted) return { ok: false, message: "Original post not found." };
    // One repost per profile per post.
    const { data: dupe } = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", authorId)
      .eq("quoted_post_id" as any, originalPostId)
      .eq("type", "repost")
      .eq("is_deleted", false)
      .maybeSingle();
    if (dupe) return { ok: false, message: `${alias} already reposted this.` };

    const { error } = await supabase.from("posts").insert({
      author_id: authorId,
      topic_id: (original as any).topic_id ?? 1,
      type: "repost",
      quoted_post_id: originalPostId,
      content: sentinel,
    } as any);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: adminEmail,
    action: "seed.repost",
    target_type: "post",
    target_id: String(originalPostId),
    target_label: `Repost of #${originalPostId} by ${alias}`,
    reason: null,
    metadata: { as: authorId, alias, kind: "repost" },
  });
  revalidateAll();
  return { ok: true, message: `Reposted as ${alias}` };
}

/** Quote-post an existing post as the active seed profile, with added commentary. */
export async function seedQuoteAction(originalPostId: number, commentary: string): Promise<ActionResult> {
  const { authorId, alias, adminEmail } = await requireSeedAuthor();
  const text = commentary.trim();
  if (!text) return { ok: false, message: "Add a comment to quote with." };

  if (IS_MOCK || !hasServiceRole) {
    const original = mock.posts.find((p) => p.id === originalPostId);
    if (!original) return { ok: false, message: "Original post not found." };
    const u = mock.users.find((x) => x.id === authorId);
    mock.posts.unshift({
      id: 86000 + mock.posts.length,
      author: { id: authorId, alias: u?.alias ?? alias, avatar_color: u?.avatar_color ?? null, avatar_url: u?.avatar_url ?? null, is_verified: u?.is_verified ?? false, is_suspended: false },
      topic: original.topic,
      type: "quote",
      content: text,
      media_urls: [],
      mood: null,
      is_deleted: false,
      comments_disabled: false,
      created_at: new Date().toISOString(),
      stats: { sip_count: 0, comment_count: 0, red_flag_count: 0, green_flag_count: 0, same_count: 0, repost_count: 0, view_count: 0 },
      poll: null,
      report_count: 0,
    });
  } else {
    const supabase = createSupabaseAdminClient();
    const { data: original } = await supabase
      .from("posts")
      .select("id, topic_id, is_deleted")
      .eq("id", originalPostId)
      .maybeSingle();
    if (!original || (original as any).is_deleted) return { ok: false, message: "Original post not found." };
    const { error } = await supabase.from("posts").insert({
      author_id: authorId,
      topic_id: (original as any).topic_id ?? 1,
      type: "quote",
      quoted_post_id: originalPostId,
      content: text,
    } as any);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: adminEmail,
    action: "seed.repost",
    target_type: "post",
    target_id: String(originalPostId),
    target_label: `Quote of #${originalPostId} by ${alias}`,
    reason: null,
    metadata: { as: authorId, alias, kind: "quote" },
  });
  revalidateAll();
  return { ok: true, message: `Quoted as ${alias}` };
}

/**
 * Upload one image for a seed post to the post-media bucket and return its public
 * URL. The composer uploads on pick, then passes the URLs to seedPostAction.
 */
export async function uploadSeedImageAction(formData: FormData): Promise<ActionResult & { url?: string }> {
  await requireSeedAuthor(); // must be acting as a seed profile
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "No image selected." };
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return { ok: false, message: "Use a PNG, JPEG, WebP, or GIF image." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, message: "Image must be under 8MB." };

  if (IS_MOCK || !hasServiceRole) {
    return { ok: true, url: `https://picsum.photos/seed/seedpost-${Date.now()}/800/600` };
  }
  const supabase = createSupabaseAdminClient();
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const path = `seed/${Date.now()}-${Math.round(file.size)}.${ext}`;
  const { error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, message: `Upload failed: ${error.message}` };
  return { ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/${POST_MEDIA_BUCKET}/${path}` };
}

// ---- Avatar images ---------------------------------------------------------

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

/**
 * Upload a custom avatar image for a seed profile. Takes FormData with `seedId`
 * and `file`. Stores it in the seed-avatars bucket (created on first use) and
 * points users.avatar_url at the public URL. The picker restricts to images; we
 * re-validate type + size server-side and only ever target seed profiles.
 */
export async function setSeedAvatarAction(formData: FormData): Promise<ActionResult & { url?: string }> {
  const admin = await requireAdmin();
  const seedId = String(formData.get("seedId") ?? "");
  const file = formData.get("file");

  if (!seedId || !(await isSeedProfile(seedId))) {
    return { ok: false, message: "Not a seed profile." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No image selected." };
  }
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    return { ok: false, message: "Use a PNG, JPEG, WebP, or GIF image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, message: "Image must be under 3MB." };
  }

  let url: string;
  if (IS_MOCK || !hasServiceRole) {
    // No storage in mock — show an illustrated placeholder so the demo reflects
    // the change. (Real uploads go to Supabase Storage in live mode.)
    const u = mockSeedUsers().find((x) => x.id === seedId);
    url = `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(u?.alias ?? seedId)}`;
    if (u) u.avatar_url = url;
  } else {
    const supabase = createSupabaseAdminClient();
    // Ensure the bucket exists (public). Ignore "already exists".
    const { error: bucketErr } = await supabase.storage.createBucket(SEED_AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: MAX_AVATAR_BYTES,
    });
    if (bucketErr && !/exist/i.test(bucketErr.message)) {
      return { ok: false, message: `Storage: ${bucketErr.message}` };
    }
    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const path = `${seedId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(SEED_AVATAR_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) return { ok: false, message: `Upload failed: ${upErr.message}` };

    // Cache-bust: upsert keeps the same URL, so append a version so the new
    // image shows immediately instead of the browser-cached old one.
    const base = `${SUPABASE_URL}/storage/v1/object/public/${SEED_AVATAR_BUCKET}/${path}`;
    url = `${base}?v=${Date.now()}`;
    const { error: updErr } = await supabase.from("users").update({ avatar_url: url }).eq("id", seedId);
    if (updErr) return { ok: false, message: updErr.message };
  }

  await audit({
    actor_email: admin.email,
    action: "seed.avatar",
    target_type: "user",
    target_id: seedId,
    target_label: await userLabel(seedId),
    reason: null,
    metadata: { set: true },
  });
  revalidateAll();
  return { ok: true, message: "Avatar updated", url };
}

/** Clear a seed profile's avatar image, reverting to the shape+colour avatar. */
export async function removeSeedAvatarAction(seedId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!(await isSeedProfile(seedId))) return { ok: false, message: "Not a seed profile." };

  if (IS_MOCK || !hasServiceRole) {
    const u = mockSeedUsers().find((x) => x.id === seedId);
    if (u) u.avatar_url = null;
  } else {
    const { error } = await createSupabaseAdminClient()
      .from("users")
      .update({ avatar_url: null })
      .eq("id", seedId);
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: "seed.avatar",
    target_type: "user",
    target_id: seedId,
    target_label: await userLabel(seedId),
    reason: null,
    metadata: { set: false },
  });
  revalidateAll();
  return { ok: true, message: "Avatar removed" };
}
