"use client";

import { createClient } from "@supabase/supabase-js";

// Singleton — one instance reused across all client component renders.
// NEXT_PUBLIC_ vars are safe here: they're designed to be in the browser bundle.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
