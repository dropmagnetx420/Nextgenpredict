/**
 * Supabase credentials, read once with a readable failure.
 *
 * Without this the SDK throws "supabaseUrl is required" from inside
 * middleware, which turns every route — including /login — into a 500 with
 * no hint that the real problem is a missing .env.local.
 */

// `.env.example` ships `your-…` stand-ins. Copied verbatim they point at a
// host that never resolves, so each Supabase call stalls until DNS gives up
// and pages render blank instead of naming the misconfiguration.
function isPlaceholder(value: string | undefined): boolean {
  return !value || /^your-|your-project-ref|^replace-with/.test(value);
}

function required(name: string, value: string | undefined): string {
  if (isPlaceholder(value)) {
    throw new Error(
      `Missing or placeholder ${name}. Copy .env.example to .env.local and ` +
        `fill in your real Supabase project values (Project Settings → API). ` +
        `On Vercel, add it under Settings → Environment Variables and redeploy.`
    );
  }
  return value!;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** True when both public keys are real, for callers that degrade instead of throwing. */
export function hasSupabaseEnv(): boolean {
  return (
    !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}
