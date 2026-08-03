"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { signUp } from "@/app/actions/auth";
import { fmtMoney } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

export function SignupForm({
  referralCode,
  welcomeBonus,
}: {
  referralCode?: string;
  welcomeBonus: number;
}) {
  const [state, action] = useActionState<ActionResult<{ email: string }> | null, FormData>(
    signUp,
    null
  );

  if (state?.ok) {
    return (
      <Card className="mt-8">
        <CardContent className="p-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
            <MailCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold">Confirm your email</h1>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{state.data.email}</span>. Click it to
            activate your account.
          </p>
          <p className="mt-6 text-sm text-muted">
            Didn&apos;t arrive?{" "}
            <Link href="/verify" className="text-secondary hover:underline">
              Enter a code instead
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <h1 className="font-display text-xl font-bold">Create your account</h1>
        <p className="mt-1.5 text-sm text-muted">
          {welcomeBonus > 0
            ? `Start with a ${fmtMoney(welcomeBonus)} USDG welcome bonus.`
            : "Takes less than a minute."}
        </p>

        <div className="mt-6">
          <GoogleButton label="Sign up with Google" />
        </div>
        <AuthDivider />

        <form action={action} className="space-y-4">
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Full name" htmlFor="full_name" errors={errors?.full_name}>
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              required
              placeholder="Alex Morgan"
            />
          </Field>

          <Field label="Email" htmlFor="email" errors={errors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters with a number, an uppercase and a lowercase letter."
            errors={errors?.password}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field
            label="Confirm password"
            htmlFor="confirm_password"
            errors={errors?.confirm_password}
          >
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
            />
          </Field>

          <Field
            label="Referral code"
            htmlFor="referral_code"
            hint="Optional. Letters and numbers only."
            errors={errors?.referral_code}
          >
            <Input
              id="referral_code"
              name="referral_code"
              defaultValue={referralCode}
              placeholder="ABC123"
              className="uppercase"
            />
          </Field>

          <div className="flex items-start gap-3">
            <Checkbox id="accept_terms" name="accept_terms" value="true" required />
            <label htmlFor="accept_terms" className="text-xs leading-relaxed text-muted">
              I&apos;m 18 or older and I accept the{" "}
              <Link href="/terms" className="text-secondary hover:underline">
                terms of service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-secondary hover:underline">
                privacy policy
              </Link>
              .
            </label>
          </div>
          {errors?.accept_terms && (
            <p className="text-xs font-medium text-rose-300" role="alert">
              {errors.accept_terms[0]}
            </p>
          )}

          <SubmitButton className="w-full" size="lg" pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-secondary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
