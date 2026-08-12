import "server-only";
import { IS_MOCK } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";

export interface AdminIdentity {
  id: string;
  email: string;
  role: string;
}

/** Demo identity used when running against mock data (no real login required). */
export const MOCK_ADMIN: AdminIdentity = {
  id: "mock-admin",
  email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || "dev2@getsnippet.co",
  role: "owner",
};

/**
 * Resolve the current admin, or null if the caller is not a signed-in admin.
 *
 * - mock mode: always returns MOCK_ADMIN (zero-setup demo).
 * - live mode: requires a valid Supabase session AND a matching row in the
 *   `admins` table. Non-admins resolve to null (middleware bounces them).
 */
export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  if (IS_MOCK) return MOCK_ADMIN;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admins")
    .select("id, email, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const admin = data as { email: string | null; role: string | null } | null;
  if (!admin) return null;
  return { id: user.id, email: admin.email ?? user.email ?? "", role: admin.role ?? "admin" };
}

/** Server-action / route-handler guard. Throws if the caller isn't an admin. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error("Unauthorized: admin access required.");
  return admin;
}
