import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createStubClient } from "@/lib/supabase/stub";

export function createClient(): SupabaseClient {
  // Without real credentials, degrade to a stub so auth forms surface a
  // readable error message instead of throwing on the client.
  if (!hasSupabaseEnv()) {
    return createStubClient() as SupabaseClient;
  }

  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
