import { createServerClient } from "@/lib/supabase/server";
import type { PlanSnapshotRow } from "@/lib/supabase/plan-snapshot";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await props.params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("plan_snapshots")
    .select("id, recorded_at, projected_balance, success_probability, event_count, trigger_source, snapshot_note")
    .eq("plan_id", id)
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: true })
    .limit(180);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data as PlanSnapshotRow[]);
}
