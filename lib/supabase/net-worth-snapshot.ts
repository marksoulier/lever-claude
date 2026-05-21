// Auto-log a net worth snapshot whenever account balances change.
// Upserts on (user_id, recorded_at=today) so multiple balance updates
// on the same day produce a single up-to-date snapshot, not duplicates.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeNetWorth, type Account } from "@/lib/accounts";

export async function upsertNetWorthSnapshot(
  supabase: SupabaseClient,
  userId: string,
  accounts: Account[],
): Promise<void> {
  const netWorth = computeNetWorth(accounts);
  const today = new Date().toISOString().slice(0, 10);

  await supabase.from("net_worth_snapshots").upsert(
    { user_id: userId, recorded_at: today, net_worth: netWorth },
    { onConflict: "user_id,recorded_at" },
  );
}
