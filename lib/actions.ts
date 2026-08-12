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
    const { error } = await supabase.rpc("admin_resolve_report", {
      p_report_id: reportId,
      p_status: status,
      p_reason: reason,
    });
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
    const { error } = await supabase.rpc("admin_delete_post", { p_post_id: postId, p_reason: reason });
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
    const { error } = await supabase.rpc("admin_pin_post", { p_post_id: postId, p_pinned: pinned });
    if (error) return { ok: false, message: error.message };
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
    const { error } = await supabase.rpc("admin_delete_comment", { p_comment_id: commentId, p_reason: reason });
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
    const { error } = await supabase.rpc("admin_set_suspended", {
      p_user_id: userId,
      p_suspended: suspended,
      p_reason: reason,
    });
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: suspended ? "user.suspend" : "user.unsuspend",
    target_type: "user",
    target_id: userId,
    target_label: mock.users.find((u) => u.id === userId)?.alias ?? userId,
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
    const { error } = await supabase.rpc("admin_set_verified", { p_user_id: userId, p_verified: verified });
    if (error) return { ok: false, message: error.message };
  }
  await audit({
    actor_email: admin.email,
    action: verified ? "user.verify" : "user.unverify",
    target_type: "user",
    target_id: userId,
    target_label: mock.users.find((u) => u.id === userId)?.alias ?? userId,
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
  audience: string;
}

export async function sendBroadcastAction(input: BroadcastInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!input.title.trim() || !input.body.trim()) {
    return { ok: false, message: "Title and body are required." };
  }

  let recipients = 0;
  let delivered = 0;

  if (IS_MOCK || !hasServiceRole) {
    recipients = input.audience.toLowerCase().includes("all") ? 6142 : 2100 + Math.floor(input.title.length * 7);
    delivered = Math.floor(recipients * 0.97);
    mock.broadcasts.unshift({
      id: `bc-live-${mock.broadcasts.length}`,
      title: input.title,
      body: input.body,
      route: input.route,
      audience: input.audience,
      status: "sent",
      recipients,
      delivered,
      sent_by: admin.email,
      created_at: new Date().toISOString(),
    });
  } else {
    // Invoke the existing send-broadcast Edge Function.
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.functions.invoke("send-broadcast", {
      body: { title: input.title, body: input.body, route: input.route, audience: input.audience },
    });
    if (error) return { ok: false, message: error.message };
    recipients = (data as any)?.recipients ?? 0;
    delivered = (data as any)?.delivered ?? recipients;
    await supabase.from("admin_broadcasts").insert({
      title: input.title,
      body: input.body,
      route: input.route,
      audience: input.audience,
      status: "sent",
      recipients,
      delivered,
      sent_by: admin.email,
    });
  }

  await audit({
    actor_email: admin.email,
    action: "broadcast.send",
    target_type: "broadcast",
    target_id: null,
    target_label: input.title,
    reason: null,
    metadata: { audience: input.audience, route: input.route, recipients },
  });
  revalidateAll();
  return { ok: true, message: `Sent to ${recipients.toLocaleString()} recipients` };
}
