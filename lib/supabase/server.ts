import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

/**
 * Cookie-based Supabase client for Server Components, Route Handlers and Server
 * Actions. Uses the anon key + the signed-in admin's session cookie, so RLS
 * still applies. Privileged writes use the service-role client (./admin.ts)
 * instead, from server code only.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // set() throws in a pure Server Component render — safe to ignore;
          // the session is refreshed in middleware.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // ignore — see above
        }
      },
    },
  });
}
