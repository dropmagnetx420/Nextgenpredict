"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { verifyOtp } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/types";

export function VerifyForm({ email }: { email?: string }) {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    verifyOtp,
    null
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <h1 className="font-display text-xl font-bold">Enter your code</h1>
        <p className="mt-1.5 text-sm text-muted">
          Paste the 6-digit code from your confirmation email.
        </p>

        <form action={action} className="mt-6 space-y-4">
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Email" htmlFor="email" errors={errors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={email}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Verification code" htmlFor="token" errors={errors?.token}>
            <Input
              id="token"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="123456"
              className="text-center font-display text-lg tracking-[0.4em]"
            />
          </Field>

          <SubmitButton className="w-full" size="lg" pendingLabel="Verifying…">
            Verify and continue
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="text-secondary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
