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
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { resolveMarket } from "@/app/actions/admin";
import { fmtCents } from "@/lib/utils";
import type { ActionResult, MarketOption } from "@/lib/types";

/** Empty string means "void the market and refund everyone". */
const VOID_VALUE = "";

export function ResolveMarketDialog({
  marketId,
  question,
  options,
}: {
  marketId: string;
  question: string;
  options: Pick<MarketOption, "id" | "label" | "price">[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult<number> | null, FormData>(
    resolveMarket,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Market settled.");
      setOpen(false);
    }
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          Settle
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle market</DialogTitle>
          <DialogDescription>
            {question} — this pays out every open position and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="market_id" value={marketId} />

          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field
            label="Winning outcome"
            htmlFor={`outcome-${marketId}`}
            errors={errors?.winning_option_id}
          >
            <Select name="winning_option_id" defaultValue={options[0]?.id ?? VOID_VALUE}>
              <SelectTrigger id={`outcome-${marketId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label} — {fmtCents(option.price)}
                  </SelectItem>
                ))}
                <SelectItem value={VOID_VALUE}>Void market — refund everyone</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Resolution note"
            htmlFor={`note-${marketId}`}
            hint="Shown on the market page as the record of how it settled."
            errors={errors?.note}
          >
            <Textarea id={`note-${marketId}`} name="note" rows={3} maxLength={500} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="accent" pendingLabel="Settling…">
              Settle market
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
