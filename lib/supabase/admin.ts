import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, hasServiceRole } from "./config";
import type { Database } from "./database.types";

/**
 * Service-role Supabase client — bypasses RLS. SERVER-ONLY.
 *
 * `import "server-only"` makes the build fail if this module is ever pulled into
 * a client bundle. Use exclusively inside route handlers / server actions for
 * privileged admin writes (delete someone else's post, suspend a user, etc.),
 * and always after verifying the caller is an admin.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (!hasServiceRole) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Privileged admin writes require it. " +
        "Add it to .env.local (server-only) or keep NEXT_PUBLIC_DATA_SOURCE=mock."
    );
  }
  if (!cached) {
    cached = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
