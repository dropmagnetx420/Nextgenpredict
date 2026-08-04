import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Only use for operations that genuinely cannot run as the user:
 *   - reading storage objects for admin KYC review (signed URLs)
 *   - the cron job that closes expired markets
 *   - bootstrapping the first admin
 *
 * Everything else must go through the request-scoped server client so RLS
 * and the SECURITY DEFINER functions remain the authorization boundary.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
