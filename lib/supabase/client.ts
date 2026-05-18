"use client";

import { createBrowserClient } from "@supabase/ssr";

// Singleton — one instance reused across all client component renders.
// createBrowserClient (from @supabase/ssr) stores the session in cookies
// so the server can read the same session. The old createClient stored in
// localStorage which was invisible to Server Components and API routes.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
