// Monte Carlo simulation for Lever financial plans.
// Runs the deterministic simulator N times with year-by-year randomized returns
// to produce a probability distribution of outcomes at retirement.
// Year-by-year sampling captures sequence-of-returns risk — the dominant risk
// factor for retirement planning.
// See STEERING.md → Monte Carlo: AI-triggered, not system-triggered.

import { runSimulation } from './runner';
import { simulationBounds } from './bridge';
import type { PlanData, MonteCarloResults } from './types';

// Historical US blended portfolio assumptions (60/40 stock/bond equivalent).
// Mean and std dev are annualized. Source: long-run US market data.
const HISTORICAL_MEAN = 0.07;   // 7% mean annual return
const HISTORICAL_STD  = 0.12;   // 12% standard deviation

// Box-Muller transform — standard normal sample with no external dependencies.
function sampleNormal(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// Sample one year's return, clamped to realistic bounds.
function sampleYearReturn(mean: number, std: number): number {
  return Math.max(-0.5, Math.min(0.8, sampleNormal(mean, std)));
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
  return sorted[idx];
}

export interface MonteCarloInput {
  planData:      PlanData;
  retirementAge: number;
  targetBalance: number;
  iterations?:   number;   // default 500
  meanReturn?:   number;   // override historical mean
  stdDev?:       number;   // override historical std dev
}

export async function runMonteCarlo({
  planData,
  retirementAge,
  targetBalance,
  iterations = 500,
  meanReturn = HISTORICAL_MEAN,
  stdDev     = HISTORICAL_STD,
}: MonteCarloInput): Promise<MonteCarloResults> {
  const { startDay, endDay } = simulationBounds(planData, retirementAge);

  // Compute the retirement day for extracting balance at retirement.
  const birth          = new Date(planData.birth_date);
  const retirementDate = new Date(birth);
  retirementDate.setFullYear(birth.getFullYear() + retirementAge);
  const retirementDay  = Math.floor((retirementDate.getTime() - birth.getTime()) / 86_400_000);

  // Number of simulation years determines how many year returns to sample.
  const simYears = Math.ceil((endDay - startDay) / 365) + 1;

  const balancesAtRetirement: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Sample a distinct annual return for each year of the simulation.
    // This captures sequence-of-returns risk — a bad decade at the start of
    // retirement is modeled differently from a bad decade during accumulation.
    const yearlyReturns: number[] = Array.from({ length: simYears }, () =>
      sampleYearReturn(meanReturn, stdDev),
    );

    const results = await runSimulation(planData, startDay, endDay, yearlyReturns);

    if (results.length === 0) {
      balancesAtRetirement.push(0);
      continue;
    }

    const retirementResult = results.reduce((best, r) =>
      Math.abs(r.date - retirementDay) < Math.abs(best.date - retirementDay) ? r : best,
      results[0],
    );
    balancesAtRetirement.push(retirementResult.value);
  }

  balancesAtRetirement.sort((a, b) => a - b);

  const successCount = balancesAtRetirement.filter(b => b >= targetBalance).length;

  return {
    iterations,
    success_rate:      Math.round((successCount / iterations) * 100),
    p5:                Math.round(percentile(balancesAtRetirement, 0.05)),
    p10:               Math.round(percentile(balancesAtRetirement, 0.10)),
    p25:               Math.round(percentile(balancesAtRetirement, 0.25)),
    p50:               Math.round(percentile(balancesAtRetirement, 0.50)),
    p75:               Math.round(percentile(balancesAtRetirement, 0.75)),
    p90:               Math.round(percentile(balancesAtRetirement, 0.90)),
    p95:               Math.round(percentile(balancesAtRetirement, 0.95)),
    mean_return_used:  meanReturn,
    std_dev_used:      stdDev,
    computed_at:       new Date().toISOString(),
  };
}
