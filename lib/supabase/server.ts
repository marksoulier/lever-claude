import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Factory — called once per request, never shared across requests.
// Now async because Next.js 16's cookies() is async.
// createSSRClient (from @supabase/ssr) wires auth tokens to cookies so the
// session is readable by middleware and all server-side code.
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from a Server Component where cookies are
            // read-only. The middleware handles token refresh in that case.
          }
        },
      },
    },
  );
}
