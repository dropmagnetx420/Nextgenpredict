"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { broadcastAnnouncement } from "@/app/actions/admin";
import type { ActionResult } from "@/lib/types";

export function AnnouncementForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<ActionResult<number> | null, FormData>(
    broadcastAnnouncement,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Announcement sent.");
      formRef.current?.reset();
    }
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card>
      <CardContent className="p-6">
        <form ref={formRef} action={action} className="space-y-4">
          {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Title" htmlFor="title" errors={errors?.title}>
            <Input
              id="title"
              name="title"
              required
              maxLength={120}
              placeholder="Scheduled maintenance this Sunday"
            />
          </Field>

          <Field
            label="Message"
            htmlFor="body"
            hint="Keep it short — this lands in every active member's notification list."
            errors={errors?.body}
          >
            <Textarea id="body" name="body" rows={5} required maxLength={600} />
          </Field>

          <Field
            label="Link (optional)"
            htmlFor="link"
            hint="Relative paths like /markets work best."
            errors={errors?.link}
          >
            <Input id="link" name="link" maxLength={300} placeholder="/markets" />
          </Field>

          <SubmitButton size="lg" pendingLabel="Sending…">
            Send announcement
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
