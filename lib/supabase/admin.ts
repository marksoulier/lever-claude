import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS. Server-only. Never import in client components.
// Used by the MCP route (which has no user session cookie) and the Stripe webhook.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
