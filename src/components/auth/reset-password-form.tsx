"use client";

import { useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { resetPassword } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/types";

export function ResetPasswordForm() {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    resetPassword,
    null
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <h1 className="font-display text-xl font-bold">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted">
          Pick something you haven&apos;t used before.
        </p>

        <form action={action} className="mt-6 space-y-4">
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field
            label="New password"
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
            label="Confirm new password"
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

          <SubmitButton className="w-full" size="lg" pendingLabel="Updating…">
            Update password
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
