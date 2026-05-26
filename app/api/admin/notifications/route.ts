import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { sendPushToUser } from "@/lib/expo-push";
import { z } from "zod";

const CreateNotification = z.object({
  userId: z.string().uuid("userId must be a UUID"),
  message: z.string().min(1, "message must not be empty"),
  send: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = CreateNotification.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { userId, message, send } = parsed.data;
  const now = new Date().toISOString();
  const admin = createAdminClient();

  if (send) {
    const pushResult = await sendPushToUser(userId, message);
    const status = pushResult === "sent" ? "sent" : "approved";
    const row: Record<string, string> = { user_id: userId, message, status, approved_at: now };
    if (pushResult === "sent") row.sent_at = now;

    const { data, error } = await admin.from("notifications").insert(row).select().single();
    if (error || !data) {
      return Response.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }
    return Response.json({ ...data, _pushed: pushResult === "sent" }, { status: 201 });
  }

  const { data, error } = await admin.from("notifications").insert({
    user_id: userId,
    message,
    status: "draft",
  }).select().single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
