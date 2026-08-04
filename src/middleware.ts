import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";

// `/admin` is deliberately absent: the admin layout answers 404 for anyone
// who is not an admin, so probing the URL reveals nothing about the panel.
const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

/**
 * Pages that render identically for every visitor. Refreshing the session on
 * these costs a Supabase round trip per navigation and changes nothing, so
 * they skip it; the header still reads the session on its own.
 */
const PUBLIC_PREFIXES = [
  "/markets",
  "/how-it-works",
  "/faq",
  "/privacy",
  "/terms",
  "/responsible-trading",
];

function needsSession(pathname: string): boolean {
  if (pathname === "/") return false;
  return !PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname, searchParams } = request.nextUrl;

  // Without the keys createServerClient throws, which would turn every route
  // — including the ones explaining the misconfiguration — into a 500.
  if (!hasSupabaseEnv() || !needsSession(pathname)) return response;

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshes the session cookie. Must run before any redirect decision.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (user && AUTH_ROUTES.includes(pathname)) {
    const next = searchParams.get("next");
    const url = request.nextUrl.clone();
    // `//host` would be read as a protocol-relative URL and send the visitor
    // off-site, so only plain relative paths are honoured.
    url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need
     * a session refresh and skipping them keeps edge latency down.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
