export type Allocation = {
  label: string;
  pct: number;
  color: string;
};

export type Plan = {
  id: string;
  name: string;
  targetYear: number;
  retirementAge: number;
  currentAge: number;
  monthlyContribution: number;
  currentBalance: number;
  projectedBalance: number;
  targetBalance: number;
  successProbability: number;
  assumedReturn: number;
  inflation: number;
  monthlyIncomeAtRetirement: number;
  allocation: Allocation[];
};

export function projectBalance(
  currentBalance: number,
  monthlyContribution: number,
  annualReturn: number,
  years: number,
): number {
  const r = annualReturn / 100 / 12;
  const n = years * 12;
  const fvBalance = currentBalance * Math.pow(1 + r, n);
  const fvContributions = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);
  return Math.round(fvBalance + fvContributions);
}

export const plans: Record<string, Plan> = {
  "retire-65": {
    id: "retire-65",
    name: "Retire at 65",
    targetYear: 2049,
    retirementAge: 65,
    currentAge: 41,
    monthlyContribution: 3200,
    currentBalance: 487200,
    projectedBalance: 1840000,
    targetBalance: 1800000,
    successProbability: 87,
    assumedReturn: 7,
    inflation: 2.5,
    monthlyIncomeAtRetirement: 7200,
    allocation: [
      { label: "US Equities", pct: 50, color: "#4bc3c8" },
      { label: "International Equities", pct: 20, color: "#3b82f6" },
      { label: "Bonds", pct: 20, color: "#f59e0b" },
      { label: "Cash & Alternatives", pct: 10, color: "#8b5cf6" },
    ],
  },
  "retire-60": {
    id: "retire-60",
    name: "Retire early at 60",
    targetYear: 2044,
    retirementAge: 60,
    currentAge: 41,
    monthlyContribution: 3200,
    currentBalance: 487200,
    projectedBalance: 1210000,
    targetBalance: 1450000,
    successProbability: 61,
    assumedReturn: 7,
    inflation: 2.5,
    monthlyIncomeAtRetirement: 4800,
    allocation: [
      { label: "US Equities", pct: 60, color: "#4bc3c8" },
      { label: "International Equities", pct: 20, color: "#3b82f6" },
      { label: "Bonds", pct: 15, color: "#f59e0b" },
      { label: "Cash & Alternatives", pct: 5, color: "#8b5cf6" },
    ],
  },
};
