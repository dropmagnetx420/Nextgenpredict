"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail, getClientIp, ok, parseForm, rateLimit } from "@/lib/action-utils";
import {
  forgotPasswordSchema,
  otpSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validators";
import type { ActionResult } from "@/lib/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Only allow same-origin relative paths as post-login redirect targets. */
function safeNext(next: string | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

function humanizeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email or password is incorrect.";
  if (m.includes("email not confirmed")) {
    return "Confirm your email address first. Check your inbox for the link.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with that email already exists. Try signing in.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (m.includes("token has expired") || m.includes("invalid token")) {
    return "That code has expired. Request a new one.";
  }
  if (m.includes("weak password")) return "Choose a stronger password.";
  return "Authentication failed. Please try again.";
}

export async function signUp(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData
): Promise<ActionResult<{ email: string }>> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.success) return parsed.result;

  const ip = await getClientIp();
  if (!(await rateLimit("signup", ip, 5, 900))) {
    return fail("Too many sign-up attempts from this network. Try again later.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        full_name: parsed.data.full_name,
        referral_code: parsed.data.referral_code || null,
      },
    },
  });

  if (error) return fail(humanizeAuthError(error.message));

  // Supabase returns a user with no identities when the email already exists.
  if (data.user && data.user.identities?.length === 0) {
    return fail("An account with that email already exists. Try signing in.");
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return ok(
    { email: parsed.data.email },
    "Check your inbox — we sent a link to confirm your email."
  );
}

export async function signIn(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.success) return parsed.result;

  const ip = await getClientIp();
  if (!(await rateLimit("signin", `${ip}:${parsed.data.email}`, 10, 900))) {
    return fail("Too many sign-in attempts. Please wait before trying again.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return fail(humanizeAuthError(error.message));

  revalidatePath("/", "layout");
  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success) return parsed.result;

  const ip = await getClientIp();
  if (!(await rateLimit("reset_request", ip, 5, 900))) {
    return fail("Too many reset requests. Please wait before trying again.");
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  // Always report success so the form can't be used to enumerate accounts.
  return ok(undefined, "If that email is registered, a reset link is on its way.");
}

export async function resetPassword(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const parsed = parseForm(resetPasswordSchema, formData);
  if (!parsed.success) return parsed.result;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your reset link has expired. Request a new one.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(humanizeAuthError(error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function verifyOtp(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const parsed = parseForm(otpSchema, formData);
  if (!parsed.success) return parsed.result;

  const ip = await getClientIp();
  if (!(await rateLimit("verify_otp", `${ip}:${parsed.data.email}`, 10, 900))) {
    return fail("Too many attempts. Please request a new code.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) return fail(humanizeAuthError(error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendConfirmation(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success) return parsed.result;

  const ip = await getClientIp();
  if (!(await rateLimit("resend_confirm", ip, 5, 900))) {
    return fail("Too many requests. Please wait before trying again.");
  }

  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });

  return ok(undefined, "If that account needs confirming, a new link is on its way.");
}
