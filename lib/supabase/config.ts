/**
 * Central place to read Supabase-related environment and decide the data source.
 *
 * DATA SOURCE
 *  - "mock"  → the dashboard reads from lib/mock/data.ts (default; runs with zero
 *              backend setup, before any admin RPCs / service-role key exist).
 *  - "live"  → the repository queries the real Supabase project.
 *
 * Selection order:
 *  1. NEXT_PUBLIC_DATA_SOURCE ("mock" | "live") if set explicitly.
 *  2. "live" when a Supabase URL + service-role key are configured server-side.
 *  3. "mock" otherwise.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Support both the newer publishable key and the classic anon key naming.
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

// Server-only. NEVER expose this to the browser.
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasSupabaseAuth = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const hasServiceRole = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

export type DataSource = "mock" | "live";

export function resolveDataSource(): DataSource {
  const explicit = process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource | undefined;
  if (explicit === "mock" || explicit === "live") return explicit;
  return hasServiceRole ? "live" : "mock";
}

export const DATA_SOURCE = resolveDataSource();
export const IS_MOCK = DATA_SOURCE === "mock";

/** The Storage bucket that holds post images in the Tea backend. */
export const POST_MEDIA_BUCKET = "post-media";
