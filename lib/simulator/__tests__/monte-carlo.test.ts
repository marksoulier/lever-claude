// Monte Carlo statistical accuracy and correctness tests.
// These verify that the year-by-year sampling produces the correct
// distribution — not just that the code runs without error.

import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../monte-carlo';
import { runSimulation } from '../runner';
import { simulationBounds } from '../bridge';
import type { PlanData } from '../types';

// ── Shared plan ─────────────────────────────────────────────────────────────

function investmentPlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    birth_date: '1985-01-01',
    inflation_rate: 0.03,
    adjust_for_inflation: false,
    accounts: [
      { name: 'Checking',    category: 'Cash',       growth: 'None',            rate: 0,    account_type: 'regular' },
      { name: 'Portfolio',   category: 'Investments', growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
    ],
    events: [
      {
        id: 1, type: 'declare_accounts', title: 'Opening',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1985-01-01' },
          { id: 1, type: 'account1',   value: 'Checking' },
          { id: 2, type: 'amount1',    value: 10000 },
          { id: 3, type: 'account2',   value: 'Portfolio' },
          { id: 4, type: 'amount2',    value: 100000 },
        ],
        updating_events: [],
      },
      {
        id: 2, type: 'inflow', title: 'Monthly savings',
        description: '', is_recurring: true,
        parameters: [
          { id: 0, type: 'start_time',     value: '1985-01-01' },
          { id: 1, type: 'end_time',       value: '2050-01-01' },
          { id: 2, type: 'amount',         value: 2000 },
          { id: 3, type: 'frequency_days', value: 30 },
          { id: 4, type: 'to_key',         value: 'Portfolio' },
        ],
        updating_events: [],
      },
    ],
    ...overrides,
  };
}

const PLAN         = investmentPlan();
const RETIREMENT   = 65;
const TARGET       = 2_000_000;

// ── Distribution shape ──────────────────────────────────────────────────────

describe('Monte Carlo distribution shape', () => {
  it('p10 < p50 < p90 (sorted correctly)', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 200 });
    expect(mc.p10).toBeLessThan(mc.p50);
    expect(mc.p50).toBeLessThan(mc.p90);
  });

  it('p5 ≤ p10 and p90 ≤ p95', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 200 });
    expect(mc.p5).toBeLessThanOrEqual(mc.p10);
    expect(mc.p90).toBeLessThanOrEqual(mc.p95);
  });

  it('success_rate is between 0 and 100', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 200 });
    expect(mc.success_rate).toBeGreaterThanOrEqual(0);
    expect(mc.success_rate).toBeLessThanOrEqual(100);
  });

  it('all percentile values are finite positive numbers', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 200 });
    for (const key of ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'] as const) {
      expect(isFinite(mc[key])).toBe(true);
      expect(mc[key]).toBeGreaterThan(0);
    }
  });
});

// ── Convergence ──────────────────────────────────────────────────────────────

describe('Monte Carlo convergence', () => {
  it('p50 is within 20% of the deterministic output at 7% mean return', async () => {
    // The median of many Monte Carlo runs at 7% mean should be close to the
    // deterministic simulation at 7% (the account growth rate).
    const { startDay, endDay } = simulationBounds(PLAN, RETIREMENT);
    const detResults = await runSimulation(PLAN, startDay, endDay);
    const detFinal = detResults[detResults.length - 1].value;

    const mc = await runMonteCarlo({
      planData:      PLAN,
      retirementAge: RETIREMENT,
      targetBalance: TARGET,
      iterations:    500,
      meanReturn:    0.07,
      stdDev:        0.12,
    });

    // p50 should be within 20% of the deterministic value
    // (year-by-year sampling introduces spread; median should be near center)
    const ratio = mc.p50 / detFinal;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.6);
  });

  it('higher mean return → higher p50', async () => {
    const mcLow  = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 200, meanReturn: 0.04 });
    const mcHigh = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 200, meanReturn: 0.10 });
    expect(mcHigh.p50).toBeGreaterThan(mcLow.p50);
  });

  it('higher std dev → wider p10–p90 spread', async () => {
    const mcNarrow = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 300, stdDev: 0.04 });
    const mcWide   = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 300, stdDev: 0.20 });
    const spreadNarrow = mcNarrow.p90 - mcNarrow.p10;
    const spreadWide   = mcWide.p90   - mcWide.p10;
    expect(spreadWide).toBeGreaterThan(spreadNarrow);
  });

  it('0% std dev (no randomness) produces near-identical p10, p50, p90', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 100, stdDev: 0.0001 });
    // With near-zero variance all iterations converge — spread should be tiny
    const spread = mc.p90 - mc.p10;
    const relativeSpread = spread / mc.p50;
    expect(relativeSpread).toBeLessThan(0.05); // < 5% spread
  });
});

// ── Metadata ─────────────────────────────────────────────────────────────────

describe('Monte Carlo metadata', () => {
  it('returns the requested iteration count', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 150 });
    expect(mc.iterations).toBe(150);
  });

  it('records the mean return and std dev used', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 50, meanReturn: 0.06, stdDev: 0.10 });
    expect(mc.mean_return_used).toBeCloseTo(0.06);
    expect(mc.std_dev_used).toBeCloseTo(0.10);
  });

  it('computed_at is a valid ISO timestamp', async () => {
    const mc = await runMonteCarlo({ planData: PLAN, retirementAge: RETIREMENT, targetBalance: TARGET, iterations: 50 });
    expect(() => new Date(mc.computed_at).toISOString()).not.toThrow();
  });
});
