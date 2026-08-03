import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges the emailed or OAuth code for a session, then forwards the visitor
 * on. Handles the PKCE `code` flow (email links and Google) plus the older
 * `token_hash` links.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Behind a proxy nextUrl.origin is the internal host, which would send the
  // visitor somewhere unreachable. Trust the forwarded headers instead.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;

  // Google sends the visitor back with `error` when they cancel at consent.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] code exchange failed:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "signup" | "recovery" | "email_change" | "magiclink",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    console.error("[auth/callback] verifyOtp failed:", error.message);
  } else {
    console.error("[auth/callback] no code or token_hash on the callback URL");
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
