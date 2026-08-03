"use server";

import { revalidatePath } from "next/cache";
import { callRpc, fail, ok, parseForm, rateLimit } from "@/lib/action-utils";
import { getSessionUser } from "@/lib/auth";
import { kycSchema } from "@/lib/validators";
import type { ActionResult, KycRequest } from "@/lib/types";

export async function submitKyc(
  _prev: ActionResult<KycRequest> | null,
  formData: FormData
): Promise<ActionResult<KycRequest>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to continue.");

  const parsed = parseForm(kycSchema, formData);
  if (!parsed.success) return parsed.result;

  if (!(await rateLimit("submit_kyc", user.id, 5, 3600))) {
    return fail("Too many submissions. Please wait before trying again.");
  }

  // Storage paths must sit under the caller's own folder — the RPC and the
  // bucket policy both enforce this, so reject early with clearer copy.
  const paths = [parsed.data.front_path, parsed.data.back_path, parsed.data.selfie_path];
  for (const path of paths) {
    if (path && !path.startsWith(`${user.id}/`)) {
      return fail("Invalid upload. Please re-select your files and try again.");
    }
  }

  const result = await callRpc<KycRequest>("submit_kyc", {
    p_doc_type: parsed.data.doc_type,
    p_full_name: parsed.data.full_name,
    p_date_of_birth: parsed.data.date_of_birth,
    p_country: parsed.data.country,
    p_document_number: parsed.data.document_number,
    p_front_path: parsed.data.front_path,
    p_back_path: parsed.data.back_path || null,
    p_selfie_path: parsed.data.selfie_path,
  });
  if (!result.ok) return result;

  revalidatePath("/dashboard/kyc");
  revalidatePath("/dashboard");

  return ok(result.data, "Documents submitted. We'll review them within one business day.");
}
