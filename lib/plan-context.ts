// Plan context — per-plan assumptions that drive projection math.
// Stored as a JSONB column on the plans table so each plan is independently configurable.

export type RiskTolerance = "low" | "medium" | "high";

export type PlanContext = {
  dateOfBirth?: string;           // ISO date "YYYY-MM-DD"
  annualIncome?: number;          // dollars/year
  targetMonthlyIncome?: number;   // desired monthly income in retirement
  riskTolerance?: RiskTolerance;
  narrative?: string;             // free-text — Claude writes assumptions, goals, caveats
};

// Assumed annual return by risk tolerance (nominal, pre-inflation).
export const RETURN_BY_RISK: Record<RiskTolerance, number> = {
  low: 5,
  medium: 7,
  high: 9,
};

// Default allocation mix by risk tolerance.
export const ALLOCATION_BY_RISK: Record<RiskTolerance, { label: string; pct: number; color: string }[]> = {
  low: [
    { label: "US Equities",            pct: 30, color: "#4bc3c8" },
    { label: "International Equities", pct: 10, color: "#3b82f6" },
    { label: "Bonds",                  pct: 45, color: "#f59e0b" },
    { label: "Cash & Alternatives",    pct: 15, color: "#8b5cf6" },
  ],
  medium: [
    { label: "US Equities",            pct: 60, color: "#4bc3c8" },
    { label: "International Equities", pct: 20, color: "#3b82f6" },
    { label: "Bonds",                  pct: 15, color: "#f59e0b" },
    { label: "Cash & Alternatives",    pct:  5, color: "#8b5cf6" },
  ],
  high: [
    { label: "US Equities",            pct: 75, color: "#4bc3c8" },
    { label: "International Equities", pct: 20, color: "#3b82f6" },
    { label: "Bonds",                  pct:  5, color: "#f59e0b" },
    { label: "Cash & Alternatives",    pct:  0, color: "#8b5cf6" },
  ],
};

export function ageFromDOB(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Derive the effective assumed return, target balance, and current age from
// context fields, falling back to the stored column values when context is absent.
export function resolveContextDefaults(
  ctx: PlanContext | null | undefined,
  fallbacks: { currentAge: number; assumedReturn: number; targetBalance: number },
) {
  const currentAge = ctx?.dateOfBirth ? ageFromDOB(ctx.dateOfBirth) : fallbacks.currentAge;
  const assumedReturn = ctx?.riskTolerance
    ? RETURN_BY_RISK[ctx.riskTolerance]
    : fallbacks.assumedReturn;
  const targetBalance = ctx?.targetMonthlyIncome
    ? Math.round((ctx.targetMonthlyIncome * 12) / 0.04)
    : fallbacks.targetBalance;

  return { currentAge, assumedReturn, targetBalance };
}
