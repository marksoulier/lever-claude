import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { sendPushToUser } from "@/lib/expo-push";
import { z } from "zod";

const PatchNotification = z.object({
  status: z.enum(["approved", "discarded", "sent"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = PatchNotification.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();

  // On approve: look up the notification, try to push, then write final status
  if (parsed.data.status === "approved") {
    const { data: notif } = await admin
      .from("notifications")
      .select("user_id, message")
      .eq("id", id)
      .single();

    let finalStatus = "approved";
    const patch: Record<string, string> = { status: "approved", approved_at: now };

    if (notif) {
      const result = await sendPushToUser(notif.user_id, notif.message);
      if (result === "sent") {
        finalStatus = "sent";
        patch.status = "sent";
        patch.sent_at = now;
      }
    }

    const { data, error } = await admin
      .from("notifications")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return Response.json({ error: error?.message ?? "Update failed" }, { status: 500 });
    }

    return Response.json({ ...data, _pushed: finalStatus === "sent" });
  }

  // discard / manual sent
  const patch: Record<string, string> = { status: parsed.data.status };
  if (parsed.data.status === "sent") patch.sent_at = now;

  const { data, error } = await admin
    .from("notifications")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return Response.json(data);
}
