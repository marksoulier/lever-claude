import { z } from "zod";
import { projectBalance } from "@/lib/store";
import { createServerClient } from "@/lib/supabase/server";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";

const Body = z.object({
  monthlyContribution: z.number().positive(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return Response.json({ error: `Plan "${id}" not found` }, { status: 404 });
  }

  const plan = planFromRow(data as DbPlanRow);

  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json(
      { error: "monthlyContribution must be a positive number" },
      { status: 400 },
    );
  }

  const years = plan.targetYear - new Date().getFullYear();
  const projected = projectBalance(
    plan.currentBalance,
    body.monthlyContribution,
    plan.assumedReturn,
    years,
  );
  const prob = Math.min(
    99,
    Math.max(10, Math.round(50 + (projected / plan.targetBalance) * 40)),
  );
  const income = Math.round((projected * 0.04) / 12);

  // Persist the new contribution and recomputed fields back to the database.
  // updated_at is handled automatically by the set_updated_at trigger.
  const { error: updateError } = await supabase
    .from("plans")
    .update({
      monthly_contribution:         body.monthlyContribution,
      projected_balance:            projected,
      success_probability:          prob,
      monthly_income_at_retirement: income,
    })
    .eq("id", id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({
    monthlyContribution: body.monthlyContribution,
    projectedBalance: projected,
    successProbability: prob,
    monthlyIncomeAtRetirement: income,
  });
}

