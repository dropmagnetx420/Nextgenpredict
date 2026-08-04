import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hasSupabaseEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createStubClient } from "@/lib/supabase/stub";

export async function createClient(): Promise<SupabaseClient> {
  // Without real credentials, degrade to a stub so pages render their
  // empty states instead of every route throwing at request time.
  if (!hasSupabaseEnv()) {
    return createStubClient() as SupabaseClient;
  }

  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; safe to ignore when middleware
            // is refreshing sessions.
          }
        },
      },
    }
  );
}
