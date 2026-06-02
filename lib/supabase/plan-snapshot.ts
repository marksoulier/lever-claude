// Records a snapshot of a plan's current projection.
// Called after every meaningful plan change so the UI can show
// how the projected retirement balance evolved over time.
// Fire-and-forget — never blocks the operation that triggered it.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SnapshotTrigger =
  | "create_plan"
  | "update_plan"
  | "update_context"
  | "update_contribution"
  | "document_read"
  | "monte_carlo";

export interface PlanSnapshotInput {
  planId:                   string;
  userId:                   string;
  projectedBalance:         number;
  successProbability?:      number;
  monthlyIncomeAtRetirement?: number;
  monthlyContribution?:     number;
  eventCount?:              number;
  triggerSource:            SnapshotTrigger;
  snapshotNote?:            string;
}

export async function recordPlanSnapshot(
  supabase: SupabaseClient,
  input: PlanSnapshotInput,
): Promise<void> {
  try {
    await supabase.from("plan_snapshots").insert({
      plan_id:                     input.planId,
      user_id:                     input.userId,
      projected_balance:           Math.round(input.projectedBalance),
      success_probability:         input.successProbability ?? null,
      monthly_income_at_retirement: input.monthlyIncomeAtRetirement ?? null,
      monthly_contribution:        input.monthlyContribution ?? null,
      event_count:                 input.eventCount ?? 0,
      trigger_source:              input.triggerSource,
      snapshot_note:               input.snapshotNote ?? null,
    });
  } catch {
    // Observability must never break the plan operation that triggered it
  }
}

export interface PlanSnapshotRow {
  id:                          string;
  recorded_at:                 string;
  projected_balance:           number;
  success_probability:         number | null;
  monthly_income_at_retirement: number | null;
  monthly_contribution:        number | null;
  event_count:                 number | null;
  trigger_source:              string | null;
  snapshot_note:               string | null;
}

export async function getPlanSnapshots(
  supabase: SupabaseClient,
  planId: string,
  limit = 90,
): Promise<PlanSnapshotRow[]> {
  const { data } = await supabase
    .from("plan_snapshots")
    .select("*")
    .eq("plan_id", planId)
    .order("recorded_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as PlanSnapshotRow[];
}
