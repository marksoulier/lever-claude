import { z } from "zod";
import { projectBalance } from "@/lib/store";
import { createServerClient } from "@/lib/supabase/server";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";
import { resolveContextDefaults, ALLOCATION_BY_RISK } from "@/lib/plan-context";

export async function GET() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("plans").select("*").order("retirement_age");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json((data as DbPlanRow[]).map(planFromRow));
}

const FALLBACK_AGE = 41;
const FALLBACK_RETURN = 7;
const FALLBACK_TARGET = 1_800_000;

const CreatePlan = z.object({
  name: z.string().trim().min(1, "name must not be empty"),
  retirementAge: z
    .number({ error: "retirementAge must be a number" })
    .int()
    .gt(FALLBACK_AGE, `retirementAge must be greater than current age (${FALLBACK_AGE})`),
  monthlyContribution: z
    .number({ error: "monthlyContribution must be a number" })
    .positive("monthlyContribution must be positive"),
  currentBalance: z
    .number({ error: "currentBalance must be a number" })
    .nonnegative("currentBalance must be zero or positive")
    .optional()
    .default(0),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  const parsed = CreatePlan.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, retirementAge, monthlyContribution, currentBalance } = parsed.data;

  // Context is null on creation — filled in later via update_plan_context MCP tool.
  // Use fallback values so the plan is immediately computable.
  const { currentAge, assumedReturn, targetBalance } = resolveContextDefaults(null, {
    currentAge: FALLBACK_AGE,
    assumedReturn: FALLBACK_RETURN,
    targetBalance: FALLBACK_TARGET,
  });

  const targetYear = new Date().getFullYear() + (retirementAge - currentAge);
  const inflation = 2.5;
  const years = retirementAge - currentAge;
  const projectedBalance = projectBalance(currentBalance, monthlyContribution, assumedReturn, years);
  const successProbability = Math.min(
    99,
    Math.max(10, Math.round(50 + (projectedBalance / targetBalance) * 40)),
  );
  const monthlyIncomeAtRetirement = Math.round((projectedBalance * 0.04) / 12);

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("plans")
    .insert({
      user_id:                      user.id,
      name,
      retirement_age:               retirementAge,
      current_age:                  currentAge,
      target_year:                  targetYear,
      monthly_contribution:         monthlyContribution,
      current_balance:              currentBalance,
      target_balance:               targetBalance,
      assumed_return:               assumedReturn,
      inflation,
      projected_balance:            projectedBalance,
      success_probability:          successProbability,
      monthly_income_at_retirement: monthlyIncomeAtRetirement,
      context:                      null,
      allocation:                   ALLOCATION_BY_RISK.medium,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const plan = planFromRow(data as DbPlanRow);
  return Response.json(plan, { status: 201, headers: { Location: `/plan/${plan.id}` } });
}
