import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { accountFromRow, ACCOUNT_TYPES, type DbAccountRow } from "@/lib/accounts";
import { upsertNetWorthSnapshot } from "@/lib/supabase/net-worth-snapshot";

const PatchAccount = z.object({
  name:        z.string().trim().min(1).optional(),
  balance:     z.number().int().optional(),
  institution: z.string().trim().nullable().optional(),
  subtype:     z.string().trim().nullable().optional(),
  type:        z.enum(ACCOUNT_TYPES as [string, ...string[]]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return Response.json({ error: "Request body must be JSON" }, { status: 400 }); }

  const parsed = PatchAccount.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name        !== undefined) updates.name        = parsed.data.name;
  if (parsed.data.balance     !== undefined) updates.balance     = parsed.data.balance;
  if (parsed.data.institution !== undefined) updates.institution = parsed.data.institution;
  if (parsed.data.subtype     !== undefined) updates.subtype     = parsed.data.subtype;
  if (parsed.data.type        !== undefined) updates.type        = parsed.data.type;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)   // ownership check
    .select()
    .single();

  if (error || !data) return Response.json({ error: error?.message ?? "Not found" }, { status: 404 });

  // Auto-log net worth snapshot with updated balances
  const { data: allAccounts } = await supabase
    .from("accounts").select("*").eq("user_id", user.id);
  if (allAccounts) {
    await upsertNetWorthSnapshot(supabase, user.id, (allAccounts as DbAccountRow[]).map(accountFromRow));
  }

  return Response.json(accountFromRow(data as DbAccountRow));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("accounts").delete().eq("id", id).eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Re-snapshot after deletion
  const { data: allAccounts } = await supabase
    .from("accounts").select("*").eq("user_id", user.id);
  if (allAccounts) {
    await upsertNetWorthSnapshot(supabase, user.id, (allAccounts as DbAccountRow[]).map(accountFromRow));
  }

  return new Response(null, { status: 204 });
}
