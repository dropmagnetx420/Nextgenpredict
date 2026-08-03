"use server";

import { revalidatePath } from "next/cache";
import { callRpc, fail, getClientIp, ok, parseForm, rateLimit } from "@/lib/action-utils";
import { getSessionUser } from "@/lib/auth";
import { cancelTradeSchema, placeTradeSchema } from "@/lib/validators";
import { getSettings } from "@/lib/settings";
import type { ActionResult, Trade } from "@/lib/types";

export async function placeTrade(
  _prev: ActionResult<Trade> | null,
  formData: FormData
): Promise<ActionResult<Trade>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to place a prediction.");

  const settings = await getSettings();
  if (!settings.trading_enabled) {
    return fail("Trading is temporarily paused. Please try again later.");
  }

  const parsed = parseForm(placeTradeSchema, formData);
  if (!parsed.success) return parsed.result;

  const allowed = await rateLimit("place_trade", user.id, 20, 60);
  if (!allowed) return fail("You're placing trades too quickly. Wait a moment.");

  const result = await callRpc<Trade>("place_trade", {
    p_market_id: parsed.data.market_id,
    p_side: parsed.data.side,
    p_stake: parsed.data.stake,
  });
  if (!result.ok) return result;

  revalidatePath("/markets");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/positions");
  revalidatePath("/dashboard/wallet");

  return ok(result.data, "Prediction placed.");
}

export async function cancelTrade(
  _prev: ActionResult<Trade> | null,
  formData: FormData
): Promise<ActionResult<Trade>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to continue.");

  const parsed = parseForm(cancelTradeSchema, formData);
  if (!parsed.success) return parsed.result;

  const ip = await getClientIp();
  const allowed = await rateLimit("cancel_trade", `${user.id}:${ip}`, 20, 60);
  if (!allowed) return fail("Too many cancellations. Wait a moment.");

  const result = await callRpc<Trade>("cancel_trade", {
    p_trade_id: parsed.data.trade_id,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/positions");
  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard");

  return ok(result.data, "Prediction cancelled and stake refunded.");
}
