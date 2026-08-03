"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { requestPasswordReset } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/types";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    requestPasswordReset,
    null
  );

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <h1 className="font-display text-xl font-bold">Reset your password</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form action={action} className="mt-6 space-y-4">
          {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field
            label="Email"
            htmlFor="email"
            errors={state && !state.ok ? state.fieldErrors?.email : undefined}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>

          <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
            Send reset link
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
