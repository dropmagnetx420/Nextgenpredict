/**
 * Supabase credentials, read once with a readable failure.
 *
 * Without this the SDK throws "supabaseUrl is required" from inside
 * middleware, which turns every route — including /login — into a 500 with
 * no hint that the real problem is a missing .env.local.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in your ` +
        `Supabase project values (Project Settings → API). On Vercel, add it ` +
        `under Settings → Environment Variables and redeploy.`
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when both public keys are present, for callers that degrade instead of throwing. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
