"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { saveSettings } from "@/app/actions/admin";
import type { Settings } from "@/lib/settings";
import type { ActionResult } from "@/lib/types";

type NumericKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

const GROUPS: {
  heading: string;
  blurb: string;
  fields: { name: NumericKey; label: string; step?: string; hint?: string }[];
}[] = [
  {
    heading: "Trading fees",
    blurb: "Charged when a position is opened, clamped between the min and max.",
    fields: [
      { name: "trade_fee_percent", label: "Fee percent", step: "0.01" },
      { name: "trade_fee_min", label: "Minimum fee (USDG)", step: "0.01" },
      { name: "trade_fee_max", label: "Maximum fee (USDG)", step: "0.01" },
      {
        name: "market_liquidity_anchor",
        label: "Liquidity anchor",
        step: "1",
        hint: "Higher values make odds move more slowly.",
      },
    ],
  },
  {
    heading: "Wallet limits",
    blurb: "Applied to every deposit and withdrawal request.",
    fields: [
      { name: "min_deposit", label: "Minimum deposit (USDG)", step: "0.01" },
      { name: "min_withdrawal", label: "Minimum withdrawal (USDG)", step: "0.01" },
      { name: "withdraw_fee", label: "Withdrawal fee (USDG)", step: "0.01" },
    ],
  },
  {
    heading: "Bonuses",
    blurb: "Turnover multiplier decides how much must be wagered before bonus funds unlock.",
    fields: [
      { name: "welcome_bonus_amount", label: "Welcome bonus (USDG)", step: "0.01" },
      { name: "deposit_bonus_percent", label: "Deposit bonus %", step: "0.1" },
      { name: "deposit_bonus_cap", label: "Deposit bonus cap (USDG)", step: "0.01" },
      { name: "bonus_turnover_multiplier", label: "Turnover multiplier", step: "0.1" },
    ],
  },
  {
    heading: "Referrals",
    blurb: "Commission is a share of the platform fee on each referred trade.",
    fields: [
      { name: "referral_commission_percent", label: "Commission %", step: "0.1" },
      { name: "referral_min_deposit", label: "Qualifying deposit (USDG)", step: "0.01" },
      { name: "referral_signup_bonus", label: "Signup bonus (USDG)", step: "0.01" },
    ],
  },
];

const TOGGLES: { name: keyof Settings; label: string; hint: string }[] = [
  {
    name: "trading_enabled",
    label: "Trading enabled",
    hint: "Turning this off blocks new positions but leaves existing ones intact.",
  },
  { name: "deposits_enabled", label: "Deposits enabled", hint: "Hides the deposit flow." },
  {
    name: "withdrawals_enabled",
    label: "Withdrawals enabled",
    hint: "Hides the withdrawal flow.",
  },
  {
    name: "maintenance_mode",
    label: "Maintenance mode",
    hint: "Shows a maintenance notice across the public site.",
  },
];

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState<ActionResult<undefined> | null, FormData>(
    saveSettings,
    null
  );

  useEffect(() => {
    if (state?.ok) toast.success(state.message ?? "Settings saved.");
  }, [state]);

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6">
      {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
      {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-base font-semibold">Identity</h2>
            <p className="mt-1 text-sm text-muted">Shown in the header, footer and metadata.</p>
          </div>

          <Field label="Site name" htmlFor="site_name" errors={errors?.site_name}>
            <Input
              id="site_name"
              name="site_name"
              required
              defaultValue={settings.site_name}
            />
          </Field>

          <Field label="Tagline" htmlFor="site_tagline" errors={errors?.site_tagline}>
            <Input
              id="site_tagline"
              name="site_tagline"
              defaultValue={settings.site_tagline}
            />
          </Field>

          <Field label="Support email" htmlFor="support_email" errors={errors?.support_email}>
            <Input
              id="support_email"
              name="support_email"
              type="email"
              required
              defaultValue={settings.support_email}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Twitter" htmlFor="social_twitter" errors={errors?.social_twitter}>
              <Input
                id="social_twitter"
                name="social_twitter"
                defaultValue={settings.social_twitter}
                placeholder="https://x.com/…"
              />
            </Field>
            <Field label="Telegram" htmlFor="social_telegram" errors={errors?.social_telegram}>
              <Input
                id="social_telegram"
                name="social_telegram"
                defaultValue={settings.social_telegram}
              />
            </Field>
            <Field label="Discord" htmlFor="social_discord" errors={errors?.social_discord}>
              <Input
                id="social_discord"
                name="social_discord"
                defaultValue={settings.social_discord}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {GROUPS.map((group) => (
        <Card key={group.heading}>
          <CardContent className="space-y-4 p-6">
            <div>
              <h2 className="font-display text-base font-semibold">{group.heading}</h2>
              <p className="mt-1 text-sm text-muted">{group.blurb}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => (
                <Field
                  key={field.name}
                  label={field.label}
                  htmlFor={field.name}
                  hint={field.hint}
                  errors={errors?.[field.name]}
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    step={field.step ?? "0.01"}
                    min={0}
                    required
                    defaultValue={settings[field.name]}
                  />
                </Field>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-base font-semibold">Switches</h2>
            <p className="mt-1 text-sm text-muted">Take features offline without a deploy.</p>
          </div>

          {TOGGLES.map((toggle) => (
            <label key={toggle.name} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name={toggle.name}
                value="true"
                defaultChecked={Boolean(settings[toggle.name])}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/25"
              />
              <span>
                {toggle.label}
                <span className="mt-0.5 block text-xs text-muted">{toggle.hint}</span>
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <SubmitButton size="lg" pendingLabel="Saving…">
        Save settings
      </SubmitButton>
    </form>
  );
}
