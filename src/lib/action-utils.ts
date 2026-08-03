import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { humanizeDbError } from "@/lib/utils";
import type { ActionResult } from "@/lib/types";

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

/** Parses FormData against a schema, returning flattened field errors. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData
): { success: true; data: z.output<S> } | { success: false; result: ActionResult<never> } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    raw[key] = value;
  }

  // Unchecked checkboxes are absent from FormData; normalise to false.
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten() as {
      formErrors: string[];
      fieldErrors: Record<string, string[]>;
    };
    const first =
      Object.values(flat.fieldErrors).flat()[0] ??
      flat.formErrors[0] ??
      "Please check the form and try again.";
    return {
      success: false,
      result: fail(first, flat.fieldErrors),
    };
  }
  return { success: true, data: parsed.data };
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/**
 * DB-backed sliding-window limiter. Serverless functions don't share memory,
 * so the counter lives in Postgres.
 */
export async function rateLimit(
  action: string,
  identifier: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: `${action}:${identifier}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // Fail open rather than lock users out on a limiter fault.
    return data === true;
  } catch {
    return true;
  }
}

/** Wraps an RPC call, translating Postgres errors into readable copy. */
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown>
): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return fail(humanizeDbError(error.message));
  return ok(data as T);
}
