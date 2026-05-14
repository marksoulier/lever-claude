import { z } from "zod";
import { projectBalance } from "@/lib/store";
import { createServerClient } from "@/lib/supabase/server";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("plans").select("*").order("retirement_age");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json((data as DbPlanRow[]).map(planFromRow));
}

// ── Validation schema ──────────────────────────────────────────────────────
// Only what the browser knows. Server derives id, projectedBalance, etc.

const CURRENT_AGE = 41;   // replace with user record when auth exists
// Hardcoded until auth session provides a real user ID.
// Every insert is attributed to this dev user.
const DEV_USER_ID = "568533f9-4ce3-48e8-881b-4f197a186142";

const CreatePlan = z.object({
  name: z.string().trim().min(1, "name must not be empty"),
  retirementAge: z
    .number({ error: "retirementAge must be a number" })
    .int()
    .gt(CURRENT_AGE, `retirementAge must be greater than current age (${CURRENT_AGE})`),
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
  // ── Layer 1: parse body ────────────────────────────────────────────────
  // request.json() throws if the body is missing or not valid JSON.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }

  // ── Layer 2 & 3: type and range validation ────────────────────────────
  const parsed = CreatePlan.safeParse(raw);
  if (!parsed.success) {
    // Return the first validation message — specific field + specific rule.
    const message = parsed.error.issues[0].message;
    return Response.json({ error: message }, { status: 400 });
  }

  const { name, retirementAge, monthlyContribution, currentBalance } = parsed.data;

  // ── Derive server-owned fields ────────────────────────────────────────
  const targetYear = new Date().getFullYear() + (retirementAge - CURRENT_AGE);
  const assumedReturn = 7;
  const inflation = 2.5;
  const years = retirementAge - CURRENT_AGE;
  const projectedBalance = projectBalance(currentBalance, monthlyContribution, assumedReturn, years);
  const targetBalance = 1_800_000; // placeholder until goal-setting exists
  const successProbability = Math.min(
    99,
    Math.max(10, Math.round(50 + (projectedBalance / targetBalance) * 40)),
  );
  const monthlyIncomeAtRetirement = Math.round((projectedBalance * 0.04) / 12);

  // ── Insert into Supabase ──────────────────────────────────────────────
  // Column names are snake_case (Postgres convention). planFromRow() maps
  // them back to camelCase before the response leaves this handler.
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("plans")
    .insert({
      user_id:                     DEV_USER_ID,
      name,
      retirement_age:              retirementAge,
      current_age:                 CURRENT_AGE,
      target_year:                 targetYear,
      monthly_contribution:        monthlyContribution,
      current_balance:             currentBalance,
      target_balance:              targetBalance,
      assumed_return:              assumedReturn,
      inflation,
      projected_balance:           projectedBalance,
      success_probability:         successProbability,
      monthly_income_at_retirement: monthlyIncomeAtRetirement,
      allocation: [
        { label: "US Equities",              pct: 60, color: "#4bc3c8" },
        { label: "International Equities",   pct: 20, color: "#3b82f6" },
        { label: "Bonds",                    pct: 15, color: "#f59e0b" },
        { label: "Cash & Alternatives",      pct:  5, color: "#8b5cf6" },
      ],
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // ── 201 Created — return the full record so the client needs no second request
  const plan = planFromRow(data as DbPlanRow);
  return Response.json(plan, {
    status: 201,
    headers: { Location: `/plan/${plan.id}` },
  });
}
