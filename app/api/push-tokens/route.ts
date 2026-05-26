import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const Body = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const jwt = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { error } = await admin
    .from("push_tokens")
    .upsert(
      { user_id: user.id, token: parsed.data.token, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
