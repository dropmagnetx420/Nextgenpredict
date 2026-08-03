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
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/form";
import { cancelTrade } from "@/app/actions/trade";
import { fmtMoney } from "@/lib/utils";
import type { ActionResult, Trade } from "@/lib/types";

export function CancelTradeButton({
  tradeId,
  stake,
  cancelFee,
}: {
  tradeId: string;
  stake: number;
  cancelFee: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionResult<Trade> | null, FormData>(
    cancelTrade,
    null
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Prediction cancelled.");
      setOpen(false);
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Cancel
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this prediction?</DialogTitle>
          <DialogDescription>
            Your {fmtMoney(stake)} USDG stake is returned, minus a{" "}
            {fmtMoney(cancelFee)} USDG cancellation fee. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form action={action}>
          <input type="hidden" name="trade_id" value={tradeId} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <SubmitButton variant="destructive" pendingLabel="Cancelling…">
              Cancel prediction
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
