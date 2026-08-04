/**
 * Stand-in Supabase client used when the real credentials are missing.
 *
 * Every query resolves to `{ data: null, error }` and auth reports "no
 * session", so public pages render with their defaults / empty states and
 * auth forms surface a readable message — instead of the entire site
 * crashing on a thrown "Missing NEXT_PUBLIC_SUPABASE_URL" error.
 */

const NOT_CONFIGURED = {
  message:
    "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable this feature.",
  code: "SUPABASE_NOT_CONFIGURED",
} as const;

const emptyResult = { data: null, error: NOT_CONFIGURED, count: null, status: 400, statusText: "Bad Request" };

/** Chainable, awaitable query builder: any method call returns itself, awaiting resolves empty. */
function createStubBuilder(): unknown {
  const builder: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(emptyResult);
      }
      return () => builder;
    },
    apply() {
      return builder;
    },
  });
  return builder;
}

const authResult = { data: { user: null, session: null }, error: NOT_CONFIGURED };

export function createStubClient(): any {
  return {
    from: () => createStubBuilder(),
    rpc: () => createStubBuilder(),
    storage: {
      from: () => createStubBuilder(),
    },
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => authResult,
      signInWithOAuth: async () => authResult,
      signUp: async () => authResult,
      resend: async () => authResult,
      resetPasswordForEmail: async () => authResult,
      updateUser: async () => authResult,
      verifyOtp: async () => authResult,
      exchangeCodeForSession: async () => authResult,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
}
