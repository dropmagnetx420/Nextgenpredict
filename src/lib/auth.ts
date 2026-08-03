import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser, Wallet } from "@/lib/types";

/**
 * Current session user joined with their profile row.
 * `cache` dedupes this across a single render pass.
 */
export const getSessionUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<AppUser>();

  if (!profile) return null;

  // Promote bootstrap admins listed in ADMIN_BOOTSTRAP_EMAILS. Runs once per
  // account; afterwards roles are managed from the admin panel.
  const bootstrap = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Fall back to the auth identity's email: an OAuth profile row can be
  // created before the email column is populated.
  const email = (profile.email ?? user.email ?? "").toLowerCase();

  if (profile.role !== "admin" && email && bootstrap.includes(email)) {
    // A failure here must not break session loading, so it is logged and
    // swallowed rather than thrown.
    try {
      const admin = createAdminClient();
      const { data: promoted, error } = await admin
        .from("users")
        .update({ role: "admin" })
        .eq("id", profile.id)
        .select("*")
        .maybeSingle<AppUser>();
      if (error) console.error("[auth] admin bootstrap failed:", error.message);
      if (promoted) return promoted;
    } catch (err) {
      console.error("[auth] admin bootstrap threw:", (err as Error).message);
    }
  }

  return profile;
});

export const getWallet = cache(async (userId: string): Promise<Wallet | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<Wallet>();
  return data;
});

/** Redirects unauthenticated visitors to login, preserving the target path. */
export async function requireUser(returnTo?: string): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  if (user.status === "banned") redirect("/suspended?reason=banned");
  if (user.status === "suspended") redirect("/suspended?reason=suspended");
  return user;
}

/**
 * Admin gate. Non-admins get a 404 rather than a redirect so the panel's
 * existence is not discoverable by probing the URL.
 */
export async function requireAdmin(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") notFound();
  if (user.status === "banned") redirect("/suspended?reason=banned");
  if (user.status === "suspended") redirect("/suspended?reason=suspended");
  return user;
}

/** Unread notification count for the topbar bell. */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}
