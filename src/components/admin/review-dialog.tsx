"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import type { ActionResult } from "@/lib/types";

type ReviewAction<T> = (
  prev: ActionResult<T> | null,
  formData: FormData
) => Promise<ActionResult<T>>;

/**
 * Shared approve/reject dialog for the deposit, withdrawal and KYC queues.
 * All three post the same `reviewSchema` shape.
 */
export function ReviewDialog<T>({
  action,
  requestId,
  decision,
  title,
  description,
  requireTxHash = false,
  requireNote = false,
}: {
  action: ReviewAction<T>;
  requestId: string;
  decision: "approved" | "rejected";
  title: string;
  description: string;
  requireTxHash?: boolean;
  requireNote?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionResult<T> | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Done.");
      setOpen(false);
    }
  }, [state]);

  const approve = decision === "approved";
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={approve ? "success" : "outline"} size="sm">
          {approve ? "Approve" : "Reject"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="decision" value={decision} />

          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          {requireTxHash && (
            <Field
              label="Transaction hash"
              htmlFor={`tx_hash-${requestId}`}
              hint="Paste the on-chain hash of the transfer you broadcast."
              errors={errors?.tx_hash}
            >
              <Input
                id={`tx_hash-${requestId}`}
                name="tx_hash"
                required
                placeholder="0x…"
              />
            </Field>
          )}

          <Field
            label={approve ? "Internal note (optional)" : "Reason"}
            htmlFor={`note-${requestId}`}
            hint={
              approve
                ? "Kept on the record for audit."
                : "Shown to the member in their notification."
            }
            errors={errors?.note}
          >
            <Textarea
              id={`note-${requestId}`}
              name="note"
              rows={3}
              required={requireNote && !approve}
              maxLength={500}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton
              variant={approve ? "success" : "destructive"}
              pendingLabel={approve ? "Approving…" : "Rejecting…"}
            >
              {approve ? "Confirm approval" : "Confirm rejection"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
