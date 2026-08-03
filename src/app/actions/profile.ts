"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, parseForm } from "@/lib/action-utils";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, resetPasswordSchema } from "@/lib/validators";
import { humanizeDbError } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

export async function updateProfile(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to continue.");

  const parsed = parseForm(profileSchema, formData);
  if (!parsed.success) return parsed.result;

  const { full_name, username, country, phone } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name,
      username: username || null,
      country: country || null,
      phone: phone || null,
    })
    .eq("id", user.id);

  if (error) {
    if (error.message.includes("users_username_key")) {
      return fail("That username is already taken.", {
        username: ["That username is already taken."],
      });
    }
    return fail(humanizeDbError(error.message));
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard", "layout");

  return ok(undefined, "Profile updated.");
}

export async function changePassword(
  _prev: ActionResult<undefined> | null,
  formData: FormData
): Promise<ActionResult<undefined>> {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in to continue.");

  const parsed = parseForm(resetPasswordSchema, formData);
  if (!parsed.success) return parsed.result;

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return fail(
      error.message.toLowerCase().includes("different")
        ? "Choose a password you haven't used before."
        : "Couldn't update your password. Please try again."
    );
  }

  return ok(undefined, "Password changed.");
}
