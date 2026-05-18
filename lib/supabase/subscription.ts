import { createServerClient } from "./server";

export async function getActiveSubscription() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .single();

  if (!data) return null;
  if (data.status !== "active" && data.status !== "trialing") return null;
  if (new Date(data.current_period_end) < new Date()) return null;

  return data;
}

export async function isPremium(): Promise<boolean> {
  const sub = await getActiveSubscription();
  return sub !== null;
}
