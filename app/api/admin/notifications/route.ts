import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { z } from "zod";

const CreateNotification = z.object({
  userId: z.string().uuid("userId must be a UUID"),
  message: z.string().min(1, "message must not be empty"),
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

  const admin = createAdminClient();
  const { data, error } = await admin.from("notifications").insert({
    user_id: parsed.data.userId,
    message: parsed.data.message,
    status: "draft",
  }).select().single();

  if (error || !data) {
    return Response.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
