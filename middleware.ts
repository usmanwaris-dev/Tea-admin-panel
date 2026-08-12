import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

function isMock() {
  const explicit = process.env.NEXT_PUBLIC_DATA_SOURCE;
  if (explicit === "mock") return true;
  if (explicit === "live") return false;
  return !process.env.SUPABASE_SERVICE_ROLE_KEY; // default to mock without service role
}

const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * Gate every route behind an authenticated admin session.
 *
 * - mock mode: auth is bypassed (the demo runs with no login), but /login still
 *   renders so the flow is visible.
 * - live mode: refresh the Supabase session cookie, then require both a session
 *   AND a row in `admins`. Anyone else is redirected to /login.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Mock mode: everything is open; just let requests through.
  if (isMock()) return NextResponse.next();

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name: string) => request.cookies.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        response.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: CookieOptions) => {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in admins hitting /login get sent to the dashboard.
  let isAdmin = false;
  if (user) {
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    isAdmin = Boolean(admin);
  }

  if (isPublic) {
    if (isAdmin && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  if (!isAdmin) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    if (user) loginUrl.searchParams.set("denied", "1"); // signed in but not an admin
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
