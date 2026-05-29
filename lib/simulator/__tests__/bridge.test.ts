// Track 1 — regression tests for the simulation→scalar bridge.
// Verifies that the scalar DB columns derived from simulation results are correct.

import { describe, it, expect } from 'vitest';
import { simulationToScalars, simulationBounds } from '../bridge';
import type { SimulationResult, PlanData } from '../types';

const BASE_PLAN: PlanData = {
  birth_date: '1990-01-01',
  inflation_rate: 0.03,
  adjust_for_inflation: true,
  accounts: [],
  events: [],
};

// Build a synthetic result set: net worth grows linearly from $0 to $finalValue over n days.
function makeResults(finalValue: number, days: number): SimulationResult[] {
  return Array.from({ length: days }, (_, i) => ({
    date: i,
    value: (finalValue / days) * i,
    parts: {},
  }));
}

describe('simulationToScalars', () => {
  it('returns zeroes for empty results', () => {
    const s = simulationToScalars([], BASE_PLAN, 65, 1_800_000);
    expect(s.projected_balance).toBe(0);
    expect(s.success_probability).toBe(10);
    expect(s.monthly_income_at_retirement).toBe(0);
  });

  it('picks the result closest to the retirement day', () => {
    // Birth 1990-01-01, retirement at 65 → ~23725 days
    const retirementDay = Math.floor(
      (new Date('2055-01-01').getTime() - new Date('1990-01-01').getTime()) / 86_400_000
    );
    const results = makeResults(1_000_000, retirementDay + 10);
    const s = simulationToScalars(results, BASE_PLAN, 65, 1_800_000);
    // Projected should be close to $1M
    expect(s.projected_balance).toBeGreaterThan(900_000);
    expect(s.projected_balance).toBeLessThanOrEqual(1_000_000);
  });

  it('success_probability is clamped between 10 and 99', () => {
    // Hugely over-funded → formula gives >99, clamps at 99
    const results = [{ date: 0, value: 100_000_000, parts: {} }];
    const s1 = simulationToScalars(results, BASE_PLAN, 30, 1_000_000);
    expect(s1.success_probability).toBe(99);

    // Zero balance: formula gives 50 + (0/target)*40 = 50, NOT 10.
    // The floor of 10 only triggers when the formula result is below 10,
    // which requires a substantially negative projected balance.
    const results2 = [{ date: 0, value: 0, parts: {} }];
    const s2 = simulationToScalars(results2, BASE_PLAN, 30, 1_000_000);
    expect(s2.success_probability).toBe(50);

    // Verify floor of 10 triggers for deeply negative balance
    const results3 = [{ date: 0, value: -5_000_000, parts: {} }];
    const s3 = simulationToScalars(results3, BASE_PLAN, 30, 1_000_000);
    expect(s3.success_probability).toBe(10);
  });

  it('monthly_income_at_retirement uses 4% rule', () => {
    const results = [{ date: 0, value: 1_200_000, parts: {} }];
    const s = simulationToScalars(results, BASE_PLAN, 30, 1_000_000);
    // 4% of 1.2M annually = 48000 / 12 = 4000/month
    expect(s.monthly_income_at_retirement).toBe(4_000);
  });

  it('success_probability is 90 when projected equals target', () => {
    // projected = target → 50 + (1)*40 = 90
    const results = [{ date: 0, value: 1_000_000, parts: {} }];
    const s = simulationToScalars(results, BASE_PLAN, 30, 1_000_000);
    expect(s.success_probability).toBe(90);
  });
});

describe('simulationBounds', () => {
  it('startDay is always 0', () => {
    const { startDay } = simulationBounds(BASE_PLAN, 65);
    expect(startDay).toBe(0);
  });

  it('endDay is approximately retirementAge * 365', () => {
    const { endDay } = simulationBounds(BASE_PLAN, 65);
    // Should be ~65 years of days
    expect(endDay).toBeGreaterThan(65 * 360);
    expect(endDay).toBeLessThan(65 * 370);
  });

  it('endDay is always at least startDay + 365', () => {
    // Plan with birth_date in the future would have a very short range — enforce minimum
    const plan = { ...BASE_PLAN, birth_date: '2090-01-01' };
    const { startDay, endDay } = simulationBounds(plan, 1);
    expect(endDay).toBeGreaterThanOrEqual(startDay + 365);
  });
});
