"use server";

import { revalidatePath } from "next/cache";
import { callRpc, fail, ok, parseForm, rateLimit } from "@/lib/action-utils";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { depositSchema, withdrawSchema } from "@/lib/validators";
import type {
  ActionResult,
  AssetSymbol,
  ChainNetwork,
  DepositRequest,
  WithdrawRequest,
} from "@/lib/types";

/** Returns one rotating custody address for the chosen network + asset. */
export async function getDepositAddress(
  network: ChainNetwork,
  asset: AssetSymbol
): Promise<{ address: string; label: string | null } | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("random_deposit_address", { p_network: network, p_asset: asset })
    .maybeSingle<{ id: string; address: string; label: string | null }>();

  if (!data) return null;
  return { address: data.address, label: data.label };
}

export async function submitDeposit(
  _prev: ActionResult<DepositRequest> | null,
  formData: FormData
): Promise<ActionResult<DepositRequest>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to continue.");

  const settings = await getSettings();
  if (!settings.deposits_enabled) {
    return fail("Deposits are temporarily paused. Please try again later.");
  }

  const parsed = parseForm(depositSchema, formData);
  if (!parsed.success) return parsed.result;

  if (!(await rateLimit("deposit", user.id, 10, 3600))) {
    return fail("Too many deposit submissions. Please wait before trying again.");
  }

  const result = await callRpc<DepositRequest>("create_deposit_request", {
    p_amount: parsed.data.amount,
    p_network: parsed.data.network,
    p_asset: parsed.data.asset,
    p_tx_hash: parsed.data.tx_hash,
    p_to_address: parsed.data.to_address,
    p_receipt_url: parsed.data.receipt_path || null,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/deposit");

  return ok(result.data, "Deposit submitted. We'll credit your balance once it confirms.");
}

export async function submitWithdrawal(
  _prev: ActionResult<WithdrawRequest> | null,
  formData: FormData
): Promise<ActionResult<WithdrawRequest>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to continue.");

  const settings = await getSettings();
  if (!settings.withdrawals_enabled) {
    return fail("Withdrawals are temporarily paused. Please try again later.");
  }
  if (user.kyc_status !== "approved") {
    return fail("Verify your identity before withdrawing.");
  }

  const parsed = parseForm(withdrawSchema, formData);
  if (!parsed.success) return parsed.result;

  if (!(await rateLimit("withdraw", user.id, 5, 3600))) {
    return fail("Too many withdrawal requests. Please wait before trying again.");
  }

  const result = await callRpc<WithdrawRequest>("create_withdraw_request", {
    p_amount: parsed.data.amount,
    p_network: parsed.data.network,
    p_asset: parsed.data.asset,
    p_to_address: parsed.data.to_address,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard/withdraw");

  return ok(result.data, "Withdrawal requested. Our team reviews it shortly.");
}
