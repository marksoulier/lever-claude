import { createClient } from "@supabase/supabase-js";

// Factory — called once per request, never shared across requests.
// Safe to use NEXT_PUBLIC_ vars here too; the anon key is the right credential
// for user-scoped queries. If you ever need to bypass RLS (admin operations only),
// use process.env.SUPABASE_SERVICE_ROLE_KEY — never NEXT_PUBLIC_.
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
