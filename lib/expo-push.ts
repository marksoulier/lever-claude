import { createAdminClient } from "@/lib/supabase/admin";

export async function sendExpoPush(token: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: token, title: "Lever", body: message, sound: "default" }),
    });
    const json = await res.json() as { data?: { status?: string } };
    return json.data?.status === "ok";
  } catch {
    return false;
  }
}

/** Look up push token for a user and send. Returns "sent" | "no_token" | "failed". */
export async function sendPushToUser(userId: string, message: string): Promise<"sent" | "no_token" | "failed"> {
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId)
    .single();

  if (!tokenRow?.token) return "no_token";
  const ok = await sendExpoPush(tokenRow.token, message);
  return ok ? "sent" : "failed";
}
