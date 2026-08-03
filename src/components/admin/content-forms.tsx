"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  deletePartner,
  deletePromoBanner,
  savePartner,
  saveDepositAddress,
  savePromoBanner,
  toggleDepositAddress,
} from "@/app/actions/admin";
import { NETWORKS, assetsForNetwork } from "@/lib/constants";
import type { ActionResult, AssetSymbol, ChainNetwork } from "@/lib/types";

type VoidAction = (
  prev: ActionResult<undefined> | null,
  formData: FormData
) => Promise<ActionResult<undefined>>;

function useResetOnSuccess(action: VoidAction) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    action,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Saved.");
      formRef.current?.reset();
    }
  }, [state]);

  return { formRef, state, formAction, errors: state && !state.ok ? state.fieldErrors : undefined };
}

export function DepositAddressForm() {
  const { formRef, state, formAction, errors } = useResetOnSuccess(saveDepositAddress);
  const [network, setNetwork] = useState<ChainNetwork>("robinhood");
  const [asset, setAsset] = useState<AssetSymbol>("USDG");

  const assets = assetsForNetwork(network);

  useEffect(() => {
    if (!assets.includes(asset)) setAsset(assets[0]!);
  }, [assets, asset]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="network" value={network} />
      <input type="hidden" name="asset" value={asset} />

      {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Network" htmlFor="addr-network">
          <Select value={network} onValueChange={(v) => setNetwork(v as ChainNetwork)}>
            <SelectTrigger id="addr-network">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NETWORKS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Asset" htmlFor="addr-asset" errors={errors?.asset}>
          <Select value={asset} onValueChange={(v) => setAsset(v as AssetSymbol)}>
            <SelectTrigger id="addr-asset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assets.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Address" htmlFor="addr-address" errors={errors?.address}>
        <Input id="addr-address" name="address" required placeholder="0x…" />
      </Field>

      <Field
        label="Label"
        htmlFor="addr-label"
        hint="Internal only, e.g. which custodian holds it."
        errors={errors?.label}
      >
        <Input id="addr-label" name="label" maxLength={40} />
      </Field>

      <SubmitButton pendingLabel="Adding…">Add address</SubmitButton>
    </form>
  );
}

export function ToggleAddressButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await toggleDepositAddress(id, !isActive);
          if (result.ok) toast.success(result.message ?? "Updated.");
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Working…" : isActive ? "Disable" : "Enable"}
    </Button>
  );
}

export function PromoBannerForm() {
  const { formRef, state, formAction, errors } = useResetOnSuccess(savePromoBanner);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

      <Field label="Title" htmlFor="promo-title" errors={errors?.title}>
        <Input id="promo-title" name="title" required maxLength={120} />
      </Field>

      <Field label="Subtitle" htmlFor="promo-subtitle" errors={errors?.subtitle}>
        <Textarea id="promo-subtitle" name="subtitle" rows={2} maxLength={240} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Image URL" htmlFor="promo-image" errors={errors?.image_url}>
          <Input id="promo-image" name="image_url" placeholder="https://…" />
        </Field>
        <Field label="CTA link" htmlFor="promo-cta-link" errors={errors?.cta_link}>
          <Input id="promo-cta-link" name="cta_link" placeholder="/markets" />
        </Field>
        <Field label="CTA label" htmlFor="promo-cta-label" errors={errors?.cta_label}>
          <Input id="promo-cta-label" name="cta_label" maxLength={40} placeholder="Trade now" />
        </Field>
        <Field label="Sort order" htmlFor="promo-sort" errors={errors?.sort_order}>
          <Input id="promo-sort" name="sort_order" type="number" min={0} defaultValue={0} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Bonus %"
          htmlFor="promo-bonus-percent"
          hint="Applied to deposits while live."
          errors={errors?.promo_bonus_percent}
        >
          <Input
            id="promo-bonus-percent"
            name="promo_bonus_percent"
            type="number"
            min={0}
            max={500}
            step="0.1"
          />
        </Field>
        <Field label="Bonus cap (USDG)" htmlFor="promo-bonus-cap" errors={errors?.promo_bonus_cap}>
          <Input id="promo-bonus-cap" name="promo_bonus_cap" type="number" min={0} step="0.01" />
        </Field>
        <Field label="Max joiners" htmlFor="promo-max-joiners" errors={errors?.max_joiners}>
          <Input id="promo-max-joiners" name="max_joiners" type="number" min={0} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts at" htmlFor="promo-starts" errors={errors?.starts_at}>
          <Input id="promo-starts" name="starts_at" type="datetime-local" />
        </Field>
        <Field label="Ends at" htmlFor="promo-ends" errors={errors?.ends_at}>
          <Input id="promo-ends" name="ends_at" type="datetime-local" />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="is_active"
          value="true"
          defaultChecked
          className="h-4 w-4 rounded border-white/20 bg-black/25"
        />
        Show on the homepage
      </label>

      <SubmitButton pendingLabel="Saving…">Create banner</SubmitButton>
    </form>
  );
}

export function PartnerForm() {
  const { formRef, state, formAction, errors } = useResetOnSuccess(savePartner);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

      <Field label="Name" htmlFor="partner-name" errors={errors?.name}>
        <Input id="partner-name" name="name" required maxLength={80} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo URL" htmlFor="partner-logo" errors={errors?.logo_url}>
          <Input id="partner-logo" name="logo_url" placeholder="https://…" />
        </Field>
        <Field label="Website" htmlFor="partner-website" errors={errors?.website}>
          <Input id="partner-website" name="website" placeholder="https://…" />
        </Field>
      </div>

      <Field label="Sort order" htmlFor="partner-sort" errors={errors?.sort_order}>
        <Input id="partner-sort" name="sort_order" type="number" min={0} defaultValue={0} />
      </Field>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="is_active"
          value="true"
          defaultChecked
          className="h-4 w-4 rounded border-white/20 bg-black/25"
        />
        Show in the partners strip
      </label>

      <SubmitButton pendingLabel="Adding…">Add partner</SubmitButton>
    </form>
  );
}

export function DeleteContentButton({
  id,
  kind,
}: {
  id: string;
  kind: "banner" | "partner";
}) {
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result =
            kind === "banner" ? await deletePromoBanner(id) : await deletePartner(id);
          if (result.ok) toast.success(result.message ?? "Removed.");
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
