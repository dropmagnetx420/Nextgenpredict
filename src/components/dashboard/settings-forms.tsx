"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { changePassword, updateProfile } from "@/app/actions/profile";
import type { ActionResult, AppUser } from "@/lib/types";

export function ProfileForm({ user }: { user: AppUser }) {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    updateProfile,
    null
  );

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Profile updated.");
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-base font-semibold">Profile</h2>
        <p className="mt-1.5 text-sm text-muted">
          Your email address is fixed to the one you signed up with.
        </p>

        <form action={action} className="mt-5 space-y-4">
          {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Email" htmlFor="email">
            <Input id="email" value={user.email} readOnly disabled />
          </Field>

          <Field label="Full name" htmlFor="full_name" errors={errors?.full_name}>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={user.full_name ?? ""}
              placeholder="Alex Morgan"
            />
          </Field>

          <Field
            label="Username"
            htmlFor="username"
            hint="Optional. 3–24 characters: letters, numbers, underscore."
            errors={errors?.username}
          >
            <Input
              id="username"
              name="username"
              defaultValue={user.username ?? ""}
              placeholder="alexm"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country" htmlFor="country" errors={errors?.country}>
              <Input
                id="country"
                name="country"
                defaultValue={user.country ?? ""}
                placeholder="Nigeria"
              />
            </Field>

            <Field label="Phone" htmlFor="phone" errors={errors?.phone}>
              <Input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={user.phone ?? ""}
                placeholder="+234 800 000 0000"
              />
            </Field>
          </div>

          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    changePassword,
    null
  );

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Password changed.");
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="font-display text-base font-semibold">Password</h2>
        <p className="mt-1.5 text-sm text-muted">
          Changing your password signs out other devices the next time they refresh.
        </p>

        <form action={action} className="mt-5 space-y-4">
          {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field
            label="New password"
            htmlFor="password"
            hint="At least 8 characters with an uppercase letter and a number."
            errors={errors?.password}
          >
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
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
              required
              autoComplete="new-password"
            />
          </Field>

          <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
