import type { Plan } from "@/lib/store";
import type { PlanContext } from "@/lib/plan-context";

// Explicit shape of a row coming back from Supabase for the plans table.
// When you run mcp__supabase__generate_typescript_types, replace this with the
// generated Database["public"]["Tables"]["plans"]["Row"] type instead.
export type DbPlanRow = {
  id: string;
  user_id: string;
  name: string;
  retirement_age: number;
  current_age: number;
  target_year: number;
  monthly_contribution: number;
  current_balance: number;
  target_balance: number;
  assumed_return: number;
  inflation: number;
  projected_balance: number | null;
  success_probability: number | null;
  monthly_income_at_retirement: number | null;
  allocation: Plan["allocation"];
  is_primary: boolean;
  context: PlanContext | null;
  created_at: string;
  updated_at: string;
};

// Translates a Supabase row (snake_case, Postgres convention) into the app's
// Plan type (camelCase, JS convention). Call this at every point data crosses
// the DB boundary — API routes, server components — never inside UI components.
export function planFromRow(row: DbPlanRow): Plan {
  return {
    id:                        row.id,
    name:                      row.name,
    targetYear:                row.target_year,
    retirementAge:             row.retirement_age,
    currentAge:                row.current_age,
    monthlyContribution:       row.monthly_contribution,
    currentBalance:            row.current_balance,
    targetBalance:             row.target_balance,
    assumedReturn:             row.assumed_return,
    inflation:                 row.inflation,
    projectedBalance:          row.projected_balance          ?? 0,
    successProbability:        row.success_probability        ?? 0,
    monthlyIncomeAtRetirement: row.monthly_income_at_retirement ?? 0,
    allocation:                row.allocation,
    isPrimary:                 row.is_primary ?? false,
    context:                   row.context ?? null,
  };
}
