"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import {
  adjustBalance,
  grantBonus,
  setUserRole,
  setUserStatus,
} from "@/app/actions/admin";
import type { ActionResult, AppUser } from "@/lib/types";

function useDialogAction(
  action: (
    prev: ActionResult<undefined> | null,
    formData: FormData
  ) => Promise<ActionResult<undefined>>,
  onDone: () => void
) {
  const [state, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Done.");
      onDone();
    }
  }, [state, onDone]);

  return { state, formAction };
}

export function UserActions({ user }: { user: AppUser }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <StatusDialog user={user} />
      <BalanceDialog user={user} />
      <BonusDialog user={user} />
      <RoleButton user={user} />
    </div>
  );
}

function StatusDialog({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useDialogAction(setUserStatus, () => setOpen(false));
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account status</DialogTitle>
          <DialogDescription>
            {user.email} is currently {user.status}. Suspended and banned members cannot
            trade or withdraw.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="user_id" value={user.id} />
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Status" htmlFor={`status-${user.id}`} errors={errors?.status}>
            <Select name="status" defaultValue={user.status}>
              <SelectTrigger id={`status-${user.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Reason"
            htmlFor={`reason-${user.id}`}
            hint="Shown to the member in their notification."
            errors={errors?.reason}
          >
            <Textarea id={`reason-${user.id}`} name="reason" rows={3} maxLength={300} />
          </Field>

          <Field
            label="Suspended until"
            htmlFor={`until-${user.id}`}
            hint="Only applies to suspensions. Leave blank for indefinite."
            errors={errors?.suspended_until}
          >
            <Input id={`until-${user.id}`} name="suspended_until" type="datetime-local" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Apply</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BalanceDialog({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useDialogAction(adjustBalance, () => setOpen(false));
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust balance</DialogTitle>
          <DialogDescription>
            Credits or debits {user.email}&apos;s main wallet and writes a transaction record.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="user_id" value={user.id} />
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field
            label="Amount (USDG)"
            htmlFor={`amount-${user.id}`}
            hint="Use a negative number to debit."
            errors={errors?.amount}
          >
            <Input
              id={`amount-${user.id}`}
              name="amount"
              type="number"
              step="0.01"
              required
              placeholder="25.00"
            />
          </Field>

          <Field label="Reason" htmlFor={`adj-reason-${user.id}`} errors={errors?.reason}>
            <Input
              id={`adj-reason-${user.id}`}
              name="reason"
              required
              maxLength={200}
              placeholder="Goodwill credit for market #123 delay"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Applying…">Apply adjustment</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BonusDialog({ user }: { user: AppUser }) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useDialogAction(grantBonus, () => setOpen(false));
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Bonus
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant bonus</DialogTitle>
          <DialogDescription>
            Bonus funds carry a turnover requirement before they can be withdrawn.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="user_id" value={user.id} />
          {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

          <Field label="Type" htmlFor={`kind-${user.id}`} errors={errors?.kind}>
            <Select name="kind" defaultValue="manual">
              <SelectTrigger id={`kind-${user.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="promo">Promo</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Amount (USDG)"
            htmlFor={`bonus-amount-${user.id}`}
            errors={errors?.amount}
          >
            <Input
              id={`bonus-amount-${user.id}`}
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="10.00"
            />
          </Field>

          <Field label="Note" htmlFor={`bonus-note-${user.id}`} errors={errors?.note}>
            <Input id={`bonus-note-${user.id}`} name="note" maxLength={200} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton variant="accent" pendingLabel="Crediting…">
              Grant bonus
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoleButton({ user }: { user: AppUser }) {
  const [pending, start] = useTransition();
  const next = user.role === "admin" ? "user" : "admin";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setUserRole(user.id, next);
          if (result.ok) toast.success(result.message ?? "Role updated.");
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Working…" : next === "admin" ? "Make admin" : "Revoke admin"}
    </Button>
  );
}
