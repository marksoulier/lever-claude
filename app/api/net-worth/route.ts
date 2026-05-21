import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export type NetWorthSnapshot = {
  id: string;
  recordedAt: string;
  netWorth: number;
};

type DbSnapshot = {
  id: string;
  user_id: string;
  recorded_at: string;
  net_worth: number;
  created_at: string;
};

function snapshotFromRow(row: DbSnapshot): NetWorthSnapshot {
  return {
    id: row.id,
    recordedAt: row.recorded_at,
    netWorth: row.net_worth,
  };
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json((data as DbSnapshot[]).map(snapshotFromRow));
}

const Body = z.object({
  netWorth: z.number({ error: "netWorth must be a number" }),
  recordedAt: z.string().optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .insert({
      user_id: user.id,
      net_worth: parsed.data.netWorth,
      ...(parsed.data.recordedAt ? { recorded_at: parsed.data.recordedAt } : {}),
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(snapshotFromRow(data as DbSnapshot), { status: 201 });
}
