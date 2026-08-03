"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { signIn } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/types";

export function LoginForm({
  next,
  linkExpired,
  oauthFailed,
}: {
  next?: string;
  linkExpired?: boolean;
  oauthFailed?: boolean;
}) {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    signIn,
    null
  );

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <h1 className="font-display text-xl font-bold">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">
          Sign in to place predictions and manage your positions.
        </p>

        <div className="mt-6 space-y-4">
          {linkExpired && (
            <FormBanner variant="info">
              That link has expired. Sign in with your password instead.
            </FormBanner>
          )}
          {oauthFailed && (
            <FormBanner>Google sign-in didn&apos;t complete. Please try again.</FormBanner>
          )}
          <GoogleButton next={next} />
        </div>
        <AuthDivider />

        <form action={action} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}

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

          <Field
            label="Password"
            htmlFor="password"
            errors={state && !state.ok ? state.fieldErrors?.password : undefined}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-secondary transition-colors hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <SubmitButton className="w-full" size="lg" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-secondary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
