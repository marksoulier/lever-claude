// Derives scalar DB column values from simulation results.
// Called after every update_plan operation so the existing UI
// (which reads projected_balance, success_probability, etc.) stays current.
// See STEERING.md → Simulator infrastructure → Scalar column bridge.

import type { SimulationResult, PlanData } from './types';

export interface ScalarColumns {
  projected_balance: number;
  success_probability: number;
  monthly_income_at_retirement: number;
}

// Convert the simulation output to the scalar columns the plans table expects.
export function simulationToScalars(
  results: SimulationResult[],
  planData: PlanData,
  retirementAge: number,
  targetBalance: number,
): ScalarColumns {
  if (results.length === 0) {
    return { projected_balance: 0, success_probability: 10, monthly_income_at_retirement: 0 };
  }

  // Compute the day number for retirement
  const birth = new Date(planData.birth_date);
  const retirementDate = new Date(birth);
  retirementDate.setFullYear(birth.getFullYear() + retirementAge);
  const retirementDay = Math.floor((retirementDate.getTime() - birth.getTime()) / 86_400_000);

  // Pick the result closest to the retirement day
  const retirementResult = results.reduce((best, r) =>
    Math.abs(r.date - retirementDay) < Math.abs(best.date - retirementDay) ? r : best,
    results[0],
  );

  const projected = Math.round(retirementResult.value);
  const prob = Math.min(99, Math.max(10, Math.round(50 + (projected / targetBalance) * 40)));
  const income = Math.round((projected * 0.04) / 12);

  return {
    projected_balance: projected,
    success_probability: prob,
    monthly_income_at_retirement: income,
  };
}

// Derives simulation date bounds from plan_data and plan metadata.
export function simulationBounds(planData: PlanData, retirementAge: number): { startDay: number; endDay: number } {
  const birth = new Date(planData.birth_date);
  const now = new Date();
  const retirementDate = new Date(birth);
  retirementDate.setFullYear(birth.getFullYear() + retirementAge);

  // Start from birth (day 0) so the full timeline is available for visualization.
  // The extra iteration cost for 20-30 pre-today years is negligible (~7k iterations).
  const startDay = 0;
  const endDay = Math.floor((retirementDate.getTime() - birth.getTime()) / 86_400_000);

  return { startDay, endDay: Math.max(startDay + 365, endDay) };
}
