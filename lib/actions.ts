"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { IS_MOCK, hasServiceRole } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPostComments, getUserComments, getUserPosts } from "@/lib/data/repo";
import * as mock from "@/lib/mock/data";
import type { AdminComment, AdminPost, AuditAction, ReportStatus } from "@/lib/types";

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
  ["/", "/reports", "/posts", "/users", "/comments", "/audit", "/broadcast", "/analytics"].forEach((p) =>
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
