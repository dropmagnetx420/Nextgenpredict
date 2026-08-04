"use server";

import { revalidatePath } from "next/cache";
import { callRpc, fail, ok, parseForm } from "@/lib/action-utils";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { humanizeDbError, slugify } from "@/lib/utils";
import {
  announcementSchema,
  balanceAdjustSchema,
  depositAddressSchema,
  grantBonusSchema,
  marketOptionsSchema,
  marketSchema,
  partnerSchema,
  promoBannerSchema,
  resolveMarketSchema,
  reviewSchema,
  settingsSchema,
  userStatusSchema,
} from "@/lib/validators";
import type {
  ActionResult,
  DepositRequest,
  KycRequest,
  Market,
  WithdrawRequest,
} from "@/lib/types";

const nullable = (value: string | null | undefined) => (value ? value : null);

// ─── Markets ─────────────────────────────────────────────────

/**
 * The outcome editor posts parallel `option_label` / `option_price` fields,
 * which FormData flattens into repeated keys. Zip them back into rows.
 */
function parseOptions(formData: FormData) {
  const labels = formData.getAll("option_label");
  const prices = formData.getAll("option_price");

  const rows = labels.map((label, index) => ({
    label: String(label ?? ""),
    price: String(prices[index] ?? ""),
  }));

  return marketOptionsSchema.safeParse(rows);
}

export async function saveMarket(
  _prev: ActionResult<Market> | null,
  formData: FormData
): Promise<ActionResult<Market>> {
  await requireAdmin();

  const parsed = parseForm(marketSchema, formData);
  if (!parsed.success) return parsed.result;

  const options = parseOptions(formData);
  if (!options.success) {
    const first = options.error.issues[0];
    return fail(first?.message ?? "Check the outcomes and try again.", {
      options: options.error.issues.map((issue) => issue.message),
    });
  }

  const id = String(formData.get("id") ?? "").trim();
  const d = parsed.data;

  const market = {
    title: d.title,
    question: d.question,
    description: nullable(d.description),
    sport: d.sport,
    league: nullable(d.league),
    team_a: nullable(d.team_a),
    team_b: nullable(d.team_b),
    team_a_logo: d.team_a_logo ?? null,
    team_b_logo: d.team_b_logo ?? null,
    banner_url: d.banner_url ?? null,
    min_trade: d.min_trade,
    max_trade: d.max_trade,
    start_time: new Date(d.start_time).toISOString(),
    end_time: new Date(d.end_time).toISOString(),
    status: d.status,
    is_trending: Boolean(d.is_trending),
    is_featured: Boolean(d.is_featured),
    slug: slugify(d.title),
  };

  // The market row and its outcomes are written in one transaction so a
  // market can never exist with nothing to trade on.
  const result = await callRpc<Market>("admin_save_market", {
    p_market: market,
    p_options: options.data,
    p_id: id || null,
  });

  if (!result.ok) {
    if (result.error.includes("already exists")) {
      return fail("A market with a very similar title already exists.", {
        title: ["Pick a more distinct title."],
      });
    }
    return result;
  }

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  revalidatePath("/");

  return ok(result.data, id ? "Market updated." : "Market created.");
}

export async function resolveMarket(
  _prev: ActionResult<number> | null,
  formData: FormData
): Promise<ActionResult<number>> {
  await requireAdmin();

  const parsed = parseForm(resolveMarketSchema, formData);
  if (!parsed.success) return parsed.result;

  const result = await callRpc<number>("resolve_market", {
    p_market_id: parsed.data.market_id,
    p_winning_option_id: parsed.data.winning_option_id,
    p_note: nullable(parsed.data.note),
  });
  if (!result.ok) return result;

  revalidatePath("/admin/markets");
  revalidatePath("/markets");
  revalidatePath("/dashboard/positions");

  return ok(result.data, `Settled ${result.data} position(s).`);
}

export async function setMarketStatus(
  id: string,
  status: "draft" | "open" | "closed"
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("markets").update({ status }).eq("id", id);
  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/markets");
  revalidatePath("/markets");

  return ok(undefined, `Market moved to ${status}.`);
}

// ─── Deposits ────────────────────────────────────────────────

export async function reviewDeposit(
  _prev: ActionResult<DepositRequest> | null,
  formData: FormData
): Promise<ActionResult<DepositRequest>> {
  await requireAdmin();

  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return parsed.result;

  const { request_id, decision, note } = parsed.data;

  const result =
    decision === "approved"
      ? await callRpc<DepositRequest>("approve_deposit", { p_request_id: request_id })
      : await callRpc<DepositRequest>("reject_deposit", {
          p_request_id: request_id,
          p_reason: nullable(note),
        });

  if (!result.ok) return result;

  revalidatePath("/admin/deposits");
  revalidatePath("/admin");

  return ok(result.data, decision === "approved" ? "Deposit credited." : "Deposit rejected.");
}

// ─── Withdrawals ─────────────────────────────────────────────

export async function reviewWithdrawal(
  _prev: ActionResult<WithdrawRequest> | null,
  formData: FormData
): Promise<ActionResult<WithdrawRequest>> {
  await requireAdmin();

  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return parsed.result;

  const { request_id, decision, note, tx_hash } = parsed.data;

  const result = await callRpc<WithdrawRequest>("review_withdrawal", {
    p_request_id: request_id,
    p_decision: decision,
    p_note: nullable(note),
    p_tx_hash: nullable(tx_hash),
  });
  if (!result.ok) return result;

  revalidatePath("/admin/withdrawals");
  revalidatePath("/admin");

  return ok(
    result.data,
    decision === "approved" ? "Withdrawal approved." : "Withdrawal rejected and refunded."
  );
}

// ─── KYC ─────────────────────────────────────────────────────

export async function reviewKyc(
  _prev: ActionResult<KycRequest> | null,
  formData: FormData
): Promise<ActionResult<KycRequest>> {
  await requireAdmin();

  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return parsed.result;

  const result = await callRpc<KycRequest>("review_kyc", {
    p_request_id: parsed.data.request_id,
    p_decision: parsed.data.decision,
    p_note: nullable(parsed.data.note),
  });
  if (!result.ok) return result;

  revalidatePath("/admin/kyc");
  revalidatePath("/admin");

  return ok(
    result.data,
    parsed.data.decision === "approved" ? "Identity approved." : "Submission rejected."
  );
}

/** Signed URL for an admin to inspect a private KYC upload. */
export async function getKycFileUrl(path: string): Promise<string | null> {
  await requireAdmin();
  if (!path) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 300);

  return data?.signedUrl ?? null;
}

// ─── Users ───────────────────────────────────────────────────

export async function setUserStatus(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(userStatusSchema, formData);
  if (!parsed.success) return parsed.result;

  const { user_id, status, reason, suspended_until } = parsed.data;

  const result = await callRpc<null>("set_user_status", {
    p_user_id: user_id,
    p_status: status,
    p_reason: nullable(reason),
    p_suspended_until: suspended_until ? new Date(suspended_until).toISOString() : null,
  });
  if (!result.ok) return result;

  revalidatePath("/admin/users");

  return ok(undefined, `Account marked ${status}.`);
}

export async function setUserRole(
  userId: string,
  role: "user" | "admin"
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const result = await callRpc<null>("set_user_role", { p_user_id: userId, p_role: role });
  if (!result.ok) return result;

  revalidatePath("/admin/users");

  return ok(undefined, `Role set to ${role}.`);
}

export async function adjustBalance(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(balanceAdjustSchema, formData);
  if (!parsed.success) return parsed.result;

  const result = await callRpc<null>("admin_adjust_balance", {
    p_user_id: parsed.data.user_id,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (!result.ok) return result;

  revalidatePath("/admin/users");

  return ok(undefined, "Balance adjusted.");
}

export async function grantBonus(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(grantBonusSchema, formData);
  if (!parsed.success) return parsed.result;

  const result = await callRpc<null>("grant_bonus", {
    p_user_id: parsed.data.user_id,
    p_kind: parsed.data.kind,
    p_amount: parsed.data.amount,
    p_note: nullable(parsed.data.note),
  });
  if (!result.ok) return result;

  revalidatePath("/admin/users");

  return ok(undefined, "Bonus credited.");
}

// ─── Content: deposit addresses, banners, partners ───────────

export async function saveDepositAddress(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(depositAddressSchema, formData);
  if (!parsed.success) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.from("deposit_addresses").insert({
    network: parsed.data.network,
    asset: parsed.data.asset,
    address: parsed.data.address,
    label: nullable(parsed.data.label),
  });

  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/content");

  return ok(undefined, "Address added.");
}

export async function toggleDepositAddress(
  id: string,
  isActive: boolean
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("deposit_addresses")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/content");

  return ok(undefined, isActive ? "Address enabled." : "Address disabled.");
}

export async function savePromoBanner(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(promoBannerSchema, formData);
  if (!parsed.success) return parsed.result;

  const id = String(formData.get("id") ?? "").trim();
  const d = parsed.data;

  const row = {
    title: d.title,
    subtitle: nullable(d.subtitle),
    image_url: d.image_url ?? null,
    cta_label: nullable(d.cta_label),
    cta_link: nullable(d.cta_link),
    promo_bonus_percent: d.promo_bonus_percent ?? null,
    promo_bonus_cap: d.promo_bonus_cap ?? null,
    max_joiners: d.max_joiners ?? null,
    is_active: Boolean(d.is_active),
    sort_order: d.sort_order ?? 0,
    starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
    ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("promo_banners").update(row).eq("id", id)
    : await supabase.from("promo_banners").insert(row);

  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/content");
  revalidatePath("/");

  return ok(undefined, id ? "Banner updated." : "Banner created.");
}

export async function deletePromoBanner(id: string): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("promo_banners").delete().eq("id", id);
  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/content");
  revalidatePath("/");

  return ok(undefined, "Banner deleted.");
}

export async function savePartner(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(partnerSchema, formData);
  if (!parsed.success) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.from("partners").insert({
    name: parsed.data.name,
    logo_url: parsed.data.logo_url ?? null,
    website: parsed.data.website ?? null,
    is_active: Boolean(parsed.data.is_active),
    sort_order: parsed.data.sort_order ?? 0,
  });

  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/content");
  revalidatePath("/");

  return ok(undefined, "Partner added.");
}

export async function deletePartner(id: string): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/admin/content");
  revalidatePath("/");

  return ok(undefined, "Partner removed.");
}

// ─── Announcements ───────────────────────────────────────────

export async function broadcastAnnouncement(
  _prev: ActionResult<number> | null,
  formData: FormData
): Promise<ActionResult<number>> {
  await requireAdmin();

  const parsed = parseForm(announcementSchema, formData);
  if (!parsed.success) return parsed.result;

  const result = await callRpc<number>("broadcast_announcement", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_link: nullable(parsed.data.link),
  });
  if (!result.ok) return result;

  revalidatePath("/admin/announcements");

  return ok(result.data, `Sent to ${result.data} member(s).`);
}

// ─── Site settings ───────────────────────────────────────────

export async function saveSettings(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  await requireAdmin();

  const parsed = parseForm(settingsSchema, formData);
  if (!parsed.success) return parsed.result;

  // Unchecked switches never reach FormData, so they arrive as undefined.
  const flags = [
    "deposits_enabled",
    "withdrawals_enabled",
    "trading_enabled",
    "maintenance_mode",
  ] as const;

  const rows = Object.entries(parsed.data).map(([key, value]) => ({
    key,
    value: (flags as readonly string[]).includes(key) ? Boolean(value) : (value ?? ""),
  }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert(rows, { onConflict: "key" });

  if (error) return fail(humanizeDbError(error.message));

  revalidatePath("/", "layout");

  return ok(undefined, "Settings saved.");
}
