import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const DEFAULT_SETTINGS = {
  site_name: "NextGen Predict",
  site_tagline: "Predict the game. Own the outcome.",
  support_email: "support@nextgenpredict.com",
  trade_fee_percent: 0.5,
  trade_fee_min: 0.3,
  trade_fee_max: 1.0,
  market_liquidity_anchor: 500,
  min_deposit: 10,
  min_withdrawal: 20,
  withdraw_fee: 0.5,
  welcome_bonus_amount: 5,
  deposit_bonus_percent: 10,
  deposit_bonus_cap: 100,
  bonus_turnover_multiplier: 5,
  referral_commission_percent: 10,
  referral_min_deposit: 10,
  referral_signup_bonus: 2,
  social_twitter: "",
  social_telegram: "",
  social_discord: "",
  deposits_enabled: true,
  withdrawals_enabled: true,
  trading_enabled: true,
  maintenance_mode: false,
} as const;

export type SettingsKey = keyof typeof DEFAULT_SETTINGS;
export type Settings = { [K in SettingsKey]: (typeof DEFAULT_SETTINGS)[K] };

/** Reads all public settings, falling back to defaults for missing keys. */
export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key, value");

  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) {
    if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  }
  return merged as Settings;
});

export function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
