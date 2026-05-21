import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { accountFromRow, ACCOUNT_TYPES, type DbAccountRow } from "@/lib/accounts";
import { upsertNetWorthSnapshot } from "@/lib/supabase/net-worth-snapshot";

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order")
    .order("created_at");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json((data as DbAccountRow[]).map(accountFromRow));
}

const CreateAccount = z.object({
  name:        z.string().trim().min(1, "name must not be empty"),
  type:        z.enum(ACCOUNT_TYPES as [string, ...string[]], { error: "invalid account type" }),
  balance:     z.number({ error: "balance must be a number" }).int("balance must be a whole number"),
  institution: z.string().trim().optional(),
  subtype:     z.string().trim().optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return Response.json({ error: "Request body must be JSON" }, { status: 400 }); }

  const parsed = CreateAccount.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id:     user.id,
      name:        parsed.data.name,
      type:        parsed.data.type,
      balance:     parsed.data.balance,
      institution: parsed.data.institution ?? null,
      subtype:     parsed.data.subtype ?? null,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Re-fetch all accounts to compute accurate net worth and auto-log snapshot
  const { data: allAccounts } = await supabase
    .from("accounts").select("*").eq("user_id", user.id);
  if (allAccounts) {
    await upsertNetWorthSnapshot(supabase, user.id, (allAccounts as DbAccountRow[]).map(accountFromRow));
  }

  return Response.json(accountFromRow(data as DbAccountRow), { status: 201 });
}
