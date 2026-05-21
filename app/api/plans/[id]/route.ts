import { z } from "zod";
import { projectBalance } from "@/lib/store";
import { createServerClient } from "@/lib/supabase/server";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";
import {
  resolveContextDefaults,
  ALLOCATION_BY_RISK,
  type PlanContext,
  type RiskTolerance,
} from "@/lib/plan-context";

const FALLBACK_AGE = 41;
const FALLBACK_RETURN = 7;
const FALLBACK_TARGET = 1_800_000;

const Body = z.object({
  monthlyContribution: z.number().positive().optional(),
  isPrimary: z.boolean().optional(),
  context: z
    .object({
      dateOfBirth:          z.string().optional(),
      annualIncome:         z.number().nonnegative().optional(),
      targetMonthlyIncome:  z.number().nonnegative().optional(),
      riskTolerance:        z.enum(["low", "medium", "high"]).optional(),
      narrative:            z.string().optional(),
    })
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error: fetchError } = await supabase
    .from("plans").select("*").eq("id", id).single();

  if (fetchError || !row) {
    return Response.json({ error: `Plan "${id}" not found` }, { status: 404 });
  }

  const plan = planFromRow(row as DbPlanRow);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── isPrimary ─────────────────────────────────────────────────────────────
  if (body.isPrimary !== undefined) {
    if (body.isPrimary) {
      await supabase.from("plans").update({ is_primary: false })
        .eq("user_id", user.id).neq("id", id);
    }
    const { error } = await supabase.from("plans")
      .update({ is_primary: body.isPrimary }).eq("id", id);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (body.monthlyContribution === undefined && body.context === undefined) {
      return Response.json({ isPrimary: body.isPrimary });
    }
  }

  // ── context update — merges into existing context, then recomputes projections
  if (body.context !== undefined) {
    const merged: PlanContext = { ...(plan.context ?? {}), ...body.context };
    const { currentAge, assumedReturn, targetBalance } = resolveContextDefaults(merged, {
      currentAge: plan.currentAge ?? FALLBACK_AGE,
      assumedReturn: plan.assumedReturn ?? FALLBACK_RETURN,
      targetBalance: plan.targetBalance ?? FALLBACK_TARGET,
    });

    const years = plan.retirementAge - currentAge;
    const contribution = body.monthlyContribution ?? plan.monthlyContribution;
    const projected = projectBalance(plan.currentBalance, contribution, assumedReturn, years);
    const prob = Math.min(99, Math.max(10, Math.round(50 + (projected / targetBalance) * 40)));
    const income = Math.round((projected * 0.04) / 12);
    const targetYear = new Date().getFullYear() + years;

    // Update allocation when risk tolerance changes
    const allocation = merged.riskTolerance
      ? ALLOCATION_BY_RISK[merged.riskTolerance as RiskTolerance]
      : plan.allocation;

    const { error: updateError } = await supabase.from("plans").update({
      context:                      merged,
      current_age:                  currentAge,
      assumed_return:               assumedReturn,
      target_balance:               targetBalance,
      target_year:                  targetYear,
      monthly_contribution:         contribution,
      projected_balance:            projected,
      success_probability:          prob,
      monthly_income_at_retirement: income,
      allocation,
    }).eq("id", id);

    if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

    return Response.json({
      context: merged,
      currentAge,
      assumedReturn,
      targetBalance,
      monthlyContribution: contribution,
      projectedBalance: projected,
      successProbability: prob,
      monthlyIncomeAtRetirement: income,
    });
  }

  // ── contribution-only update ──────────────────────────────────────────────
  if (body.monthlyContribution === undefined) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const years = plan.targetYear - new Date().getFullYear();
  const projected = projectBalance(plan.currentBalance, body.monthlyContribution, plan.assumedReturn, years);
  const prob = Math.min(99, Math.max(10, Math.round(50 + (projected / plan.targetBalance) * 40)));
  const income = Math.round((projected * 0.04) / 12);

  const { error: updateError } = await supabase.from("plans").update({
    monthly_contribution:         body.monthlyContribution,
    projected_balance:            projected,
    success_probability:          prob,
    monthly_income_at_retirement: income,
  }).eq("id", id);

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  return Response.json({
    monthlyContribution: body.monthlyContribution,
    projectedBalance: projected,
    successProbability: prob,
    monthlyIncomeAtRetirement: income,
  });
}
