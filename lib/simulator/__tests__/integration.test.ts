// Track 2 — integration tests for multi-event life plans.
// Each test combines multiple event handlers and asserts that their interactions
// are correct over real time horizons (years, not days).
// These catch bugs that unit tests miss: handler ordering issues, account
// reference conflicts, and accumulated rounding errors over decades.

import { describe, it, expect } from 'vitest';
import { runSimulation } from '../runner';
import type { PlanData, SimEvent } from '../types';

const approx = (a: number, b: number, tol = 50) => Math.abs(a - b) <= tol;
const YEAR = 365;

// ── Shared plan builder ────────────────────────────────────────────────────

function lifePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    birth_date: '1990-01-01',
    inflation_rate: 0.03,
    adjust_for_inflation: false,
    accounts: [
      { name: 'Checking',              category: 'Cash',       growth: 'None',            rate: 0,    account_type: 'regular' },
      { name: 'Savings',               category: 'Cash',       growth: 'Daily Compound',  rate: 0.04, account_type: 'regular' },
      { name: '401k',                  category: 'Retirement', growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
      { name: 'Roth IRA',              category: 'Retirement', growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
      { name: 'Investments',           category: 'Investments',growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
      { name: 'Home',                  category: 'Assets',     growth: 'Appreciation',    rate: 0.03, account_type: 'regular' },
      { name: 'Mortgage',              category: 'Debt',       growth: 'None',            rate: 0.065,account_type: 'regular' },
      { name: 'Federal Withholdings',  category: 'Tax',        growth: 'None',            rate: 0,    account_type: 'system-controlled' },
      { name: 'State Withholdings',    category: 'Tax',        growth: 'None',            rate: 0,    account_type: 'system-controlled' },
      { name: 'Local Withholdings',    category: 'Tax',        growth: 'None',            rate: 0,    account_type: 'system-controlled' },
      { name: 'Taxable Income',        category: 'Tax',        growth: 'None',            rate: 0,    account_type: 'non-networth-account' },
    ],
    events: [],
    ...overrides,
  };
}

function declareEvent(id: number, balances: Record<string, number>, startDate = '1990-01-01'): SimEvent {
  const parameters = [
    { id: 0, type: 'start_time', value: startDate },
    ...Object.entries(balances).flatMap(([account, amount], i) => [
      { id: i * 2 + 1, type: `account${i + 1}`, value: account },
      { id: i * 2 + 2, type: `amount${i + 1}`,  value: amount },
    ]),
  ];
  return { id, type: 'declare_accounts', title: 'Opening balances', description: '', is_recurring: false, parameters, updating_events: [] };
}

async function balanceAt(plan: PlanData, days: number, account: string): Promise<number> {
  const results = await runSimulation(plan, 0, days);
  const last = results[results.length - 1];
  return last.parts[account] ?? last.nonNetworthParts?.[account] ?? 0;
}

async function networthAt(plan: PlanData, days: number): Promise<number> {
  const results = await runSimulation(plan, 0, days);
  return results[results.length - 1].value;
}

// ── Scenario 1: Job + 401k over 10 years ──────────────────────────────────

describe('Scenario: job with 401k over 10 years', () => {
  // $80k salary, 8% 401k contribution, 4% employer match, biweekly pay
  // Expected 401k after 10 years: contributions + match + 7% compound growth
  const plan = lifePlan({
    events: [
      declareEvent(1, { Checking: 5000 }),
      {
        id: 2, type: 'get_job', title: 'Software Engineer',
        description: '', is_recurring: false,
        parameters: [
          { id: 0,  type: 'start_time',              value: '1990-01-01' },
          { id: 1,  type: 'end_time',                value: '2000-01-01' },
          { id: 2,  type: 'salary',                  value: 80000 },
          { id: 3,  type: 'pay_period',              value: 26 },
          { id: 4,  type: 'federal_income_tax',      value: 0.22 },
          { id: 5,  type: 'state_income_tax',        value: 0.05 },
          { id: 6,  type: 'local_income_tax',        value: 0 },
          { id: 7,  type: 'social_security_tax',     value: 0.062 },
          { id: 8,  type: 'medicare_tax',            value: 0.0145 },
          { id: 9,  type: 'p_401k_contribution',     value: 0.08 },
          { id: 10, type: 'p_401k_match',            value: 0.04 },
          { id: 11, type: 'to_key',                  value: 'Checking' },
          { id: 12, type: 'p_401k_key',              value: '401k' },
          { id: 13, type: 'taxable_income_key',      value: 'Taxable Income' },
          { id: 14, type: 'federal_withholdings_key',value: 'Federal Withholdings' },
          { id: 15, type: 'state_withholdings_key',  value: 'State Withholdings' },
          { id: 16, type: 'local_withholdings_key',  value: 'Local Withholdings' },
        ],
        updating_events: [],
      },
    ],
  });

  it('401k grows over 10 years (contributions + match + 7% compound)', async () => {
    // Employee: 80000 * 0.08 / 26 = $246.15/paycheck
    // Employer:  80000 * 0.04 / 26 = $123.08/paycheck
    // Total per paycheck: ~$369.23, 26 paychecks/year = $9,600/year
    // After 10 years at 7% compound: roughly $130K–$145K
    const bal = await balanceAt(plan, 10 * YEAR, '401k');
    expect(bal).toBeGreaterThan(100_000);
    expect(bal).toBeLessThan(200_000);
  });

  it('checking receives net pay (positive balance after 1 year)', async () => {
    const bal = await balanceAt(plan, YEAR, 'Checking');
    expect(bal).toBeGreaterThan(5000);   // started with 5k, should grow
  });

  it('job stops producing income after end_time', async () => {
    // At year 10 (end_time reached), then 1 more year of no income
    const balAtEnd  = await balanceAt(plan, 10 * YEAR, 'Checking');
    const balAfter  = await balanceAt(plan, 11 * YEAR, 'Checking');
    // Checking should stay roughly flat or slightly decline (no new income, no outflows)
    expect(Math.abs(balAfter - balAtEnd)).toBeLessThan(1000);
  });
});

// ── Scenario 2: Job + mortgage interaction ─────────────────────────────────

describe('Scenario: job + 30-year mortgage', () => {
  const plan = lifePlan({
    events: [
      declareEvent(1, { Checking: 80000 }),  // down payment + cushion
      {
        id: 2, type: 'get_job', title: 'Engineer',
        description: '', is_recurring: false,
        parameters: [
          { id: 0,  type: 'start_time',              value: '1990-01-01' },
          { id: 1,  type: 'end_time',                value: '2030-01-01' },
          { id: 2,  type: 'salary',                  value: 90000 },
          { id: 3,  type: 'pay_period',              value: 26 },
          { id: 4,  type: 'federal_income_tax',      value: 0.22 },
          { id: 5,  type: 'state_income_tax',        value: 0.05 },
          { id: 6,  type: 'local_income_tax',        value: 0 },
          { id: 7,  type: 'social_security_tax',     value: 0.062 },
          { id: 8,  type: 'medicare_tax',            value: 0.0145 },
          { id: 9,  type: 'p_401k_contribution',     value: 0.06 },
          { id: 10, type: 'p_401k_match',            value: 0.03 },
          { id: 11, type: 'to_key',                  value: 'Checking' },
          { id: 12, type: 'p_401k_key',              value: '401k' },
          { id: 13, type: 'taxable_income_key',      value: 'Taxable Income' },
          { id: 14, type: 'federal_withholdings_key',value: 'Federal Withholdings' },
          { id: 15, type: 'state_withholdings_key',  value: 'State Withholdings' },
          { id: 16, type: 'local_withholdings_key',  value: 'Local Withholdings' },
        ],
        updating_events: [],
      },
      {
        id: 3, type: 'buy_house', title: 'Buy home',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time',         value: '1990-01-01' },
          { id: 1, type: 'home_value',         value: 350000 },
          { id: 2, type: 'downpayment',        value: 70000 },
          { id: 3, type: 'loan_term_years',    value: 30 },
          { id: 4, type: 'property_tax_rate',  value: 0 },
          { id: 5, type: 'from_key',           value: 'Checking' },
          { id: 6, type: 'to_key',             value: 'Home' },
          { id: 7, type: 'mortgage_account',   value: 'Mortgage' },
        ],
        event_functions: [
          { type: 'downpayment',     title: 'Down Payment',    enabled: true },
          { type: 'home_asset',      title: 'Home Asset',      enabled: true },
          { type: 'morgage_loan',    title: 'Mortgage Loan',   enabled: true },
          { type: 'mortgage_payment',title: 'Monthly Payment', enabled: true },
          { type: 'property_tax',    title: 'Property Tax',    enabled: false },
          { type: 'final_home_payment_correction', title: 'Final Correction', enabled: true },
        ],
        updating_events: [],
      },
    ],
  });

  it('net worth is positive after 1 year (income outweighs mortgage drain)', async () => {
    const nw = await networthAt(plan, YEAR);
    expect(nw).toBeGreaterThan(0);
  });

  it('home appreciates in value over 10 years at 3%', async () => {
    // $350k at 3% appreciation for 10 years ≈ $350k * 1.03^10 ≈ $470k
    const homeVal = await balanceAt(plan, 10 * YEAR, 'Home');
    expect(homeVal).toBeGreaterThan(400_000);
    expect(homeVal).toBeLessThan(550_000);
  });

  it('mortgage principal decreases each year', async () => {
    const mortgageY1  = await balanceAt(plan, 1  * YEAR, 'Mortgage');
    const mortgageY10 = await balanceAt(plan, 10 * YEAR, 'Mortgage');
    // Both negative (debt), but year 10 balance should be less negative
    expect(mortgageY10).toBeGreaterThan(mortgageY1);
  });

  it('mortgage reaches zero by year 30', async () => {
    const mortgageY30 = await balanceAt(plan, 30 * YEAR, 'Mortgage');
    expect(mortgageY30).toBeGreaterThanOrEqual(-500); // within $500 of payoff
  });
});

// ── Scenario 3: New event handlers ────────────────────────────────────────

describe('windfall handler', () => {
  it('deposits a one-time amount on trigger day', async () => {
    const plan = lifePlan({
      events: [
        declareEvent(1, { Checking: 1000 }),
        {
          id: 2, type: 'windfall', title: 'Inheritance',
          description: '', is_recurring: false,
          parameters: [
            { id: 0, type: 'start_time', value: '1990-01-01' },
            { id: 1, type: 'amount',     value: 50000 },
            { id: 2, type: 'to_key',     value: 'Checking' },
          ],
          updating_events: [],
        },
      ],
    });
    const bal = await balanceAt(plan, 0, 'Checking');
    expect(approx(bal, 51000)).toBe(true);
  });

  it('does not fire before start_time', async () => {
    const plan = lifePlan({
      events: [
        declareEvent(1, { Checking: 1000 }),
        {
          id: 2, type: 'windfall', title: 'Future windfall',
          description: '', is_recurring: false,
          parameters: [
            { id: 0, type: 'start_time', value: '1991-01-01' },  // 1 year later
            { id: 1, type: 'amount',     value: 50000 },
            { id: 2, type: 'to_key',     value: 'Checking' },
          ],
          updating_events: [],
        },
      ],
    });
    const bal = await balanceAt(plan, 0, 'Checking');
    expect(approx(bal, 1000)).toBe(true);  // windfall not yet triggered
  });
});

describe('rent_payment handler', () => {
  it('deducts monthly rent from checking', async () => {
    const plan = lifePlan({
      events: [
        declareEvent(1, { Checking: 20000 }),
        {
          id: 2, type: 'rent_payment', title: 'Monthly rent',
          description: '', is_recurring: true,
          parameters: [
            { id: 0, type: 'start_time',     value: '1990-01-01' },
            { id: 1, type: 'end_time',       value: '1992-01-01' },
            { id: 2, type: 'amount',         value: 1400 },
            { id: 3, type: 'frequency_days', value: 30 },
            { id: 4, type: 'from_key',       value: 'Checking' },
          ],
          updating_events: [],
        },
      ],
    });
    // Day 0 (start) + day 30 + day 60 (recurring, 30-day interval) = 3 deductions
    const bal = await balanceAt(plan, 60, 'Checking');
    expect(approx(bal, 20000 - 1400 * 3)).toBe(true);
  });
});

describe('roth_ira_contribution handler', () => {
  it('transfers monthly contribution to Roth IRA', async () => {
    const plan = lifePlan({
      events: [
        declareEvent(1, { Checking: 10000, 'Roth IRA': 0 }),
        {
          id: 2, type: 'roth_ira_contribution', title: 'Roth contribution',
          description: '', is_recurring: true,
          parameters: [
            { id: 0, type: 'start_time',           value: '1990-01-01' },
            { id: 1, type: 'end_time',             value: '1992-01-01' },
            { id: 2, type: 'frequency_days',       value: 30 },
            { id: 3, type: 'monthly_contribution', value: 500 },
            { id: 4, type: 'from_key',             value: 'Checking' },
            { id: 5, type: 'to_key',               value: 'Roth IRA' },
          ],
          updating_events: [],
        },
      ],
    });
    // After 60 days: 2 transfers ($500 each)
    const roth = await balanceAt(plan, 60, 'Roth IRA');
    expect(roth).toBeGreaterThan(900);   // 2 × $500 + some growth
    const checking = await balanceAt(plan, 60, 'Checking');
    expect(checking).toBeLessThan(10000); // reduced by contributions
  });
});

describe('freelance_income handler', () => {
  it('deposits recurring freelance income', async () => {
    const plan = lifePlan({
      events: [
        declareEvent(1, { Checking: 0 }),
        {
          id: 2, type: 'freelance_income', title: 'Consulting',
          description: '', is_recurring: true,
          parameters: [
            { id: 0, type: 'start_time',     value: '1990-01-01' },
            { id: 1, type: 'end_time',       value: '1992-01-01' },
            { id: 2, type: 'amount',         value: 3000 },
            { id: 3, type: 'frequency_days', value: 30 },
            { id: 4, type: 'to_key',         value: 'Checking' },
          ],
          updating_events: [],
        },
      ],
    });
    // Day 0 (start) + day 30 + day 60 = 3 deposits
    const bal = await balanceAt(plan, 60, 'Checking');
    expect(approx(bal, 9000)).toBe(true);
  });
});

describe('invest_money handler', () => {
  it('transfers recurring amount to investment account', async () => {
    const plan = lifePlan({
      events: [
        declareEvent(1, { Checking: 10000, Investments: 0 }),
        {
          id: 2, type: 'invest_money', title: 'Monthly DCA',
          description: '', is_recurring: true,
          parameters: [
            { id: 0, type: 'start_time',     value: '1990-01-01' },
            { id: 1, type: 'end_time',       value: '1992-01-01' },
            { id: 2, type: 'amount',         value: 1000 },
            { id: 3, type: 'frequency_days', value: 30 },
            { id: 4, type: 'from_key',       value: 'Checking' },
            { id: 5, type: 'to_key',         value: 'Investments' },
          ],
          updating_events: [],
        },
      ],
    });
    const investments = await balanceAt(plan, 60, 'Investments');
    expect(investments).toBeGreaterThan(1900); // 2 × $1000 + growth
    const checking = await balanceAt(plan, 60, 'Checking');
    expect(checking).toBeLessThan(10000);
  });
});

// ── Net worth invariants ───────────────────────────────────────────────────

describe('net worth invariants', () => {
  const complexPlan = lifePlan({
    events: [
      declareEvent(1, { Checking: 20000, '401k': 50000 }),
      {
        id: 2, type: 'get_job', title: 'Job',
        description: '', is_recurring: false,
        parameters: [
          { id: 0,  type: 'start_time',              value: '1990-01-01' },
          { id: 1,  type: 'end_time',                value: '2025-01-01' },
          { id: 2,  type: 'salary',                  value: 75000 },
          { id: 3,  type: 'pay_period',              value: 26 },
          { id: 4,  type: 'federal_income_tax',      value: 0.22 },
          { id: 5,  type: 'state_income_tax',        value: 0.05 },
          { id: 6,  type: 'local_income_tax',        value: 0 },
          { id: 7,  type: 'social_security_tax',     value: 0.062 },
          { id: 8,  type: 'medicare_tax',            value: 0.0145 },
          { id: 9,  type: 'p_401k_contribution',     value: 0.06 },
          { id: 10, type: 'p_401k_match',            value: 0.03 },
          { id: 11, type: 'to_key',                  value: 'Checking' },
          { id: 12, type: 'p_401k_key',              value: '401k' },
          { id: 13, type: 'taxable_income_key',      value: 'Taxable Income' },
          { id: 14, type: 'federal_withholdings_key',value: 'Federal Withholdings' },
          { id: 15, type: 'state_withholdings_key',  value: 'State Withholdings' },
          { id: 16, type: 'local_withholdings_key',  value: 'Local Withholdings' },
        ],
        updating_events: [],
      },
      {
        id: 3, type: 'outflow', title: 'Rent',
        description: '', is_recurring: true,
        parameters: [
          { id: 0, type: 'start_time',     value: '1990-01-01' },
          { id: 1, type: 'end_time',       value: '2025-01-01' },
          { id: 2, type: 'amount',         value: 1500 },
          { id: 3, type: 'frequency_days', value: 30 },
          { id: 4, type: 'from_key',       value: 'Checking' },
        ],
        updating_events: [],
      },
    ],
  });

  it('net worth is a finite number at every snapshot', async () => {
    const results = await runSimulation(complexPlan, 0, 10 * YEAR);
    for (const r of results) {
      expect(isFinite(r.value)).toBe(true);
      expect(isNaN(r.value)).toBe(false);
    }
  });

  it('simulation is deterministic — two identical runs produce identical results', async () => {
    const r1 = await runSimulation(complexPlan, 0, 5 * YEAR);
    const r2 = await runSimulation(complexPlan, 0, 5 * YEAR);
    expect(r1.map(r => r.value)).toEqual(r2.map(r => r.value));
  });

  it('net worth grows over 10 years with income exceeding rent', async () => {
    const nwStart = await networthAt(complexPlan, 0);
    const nwEnd   = await networthAt(complexPlan, 10 * YEAR);
    expect(nwEnd).toBeGreaterThan(nwStart);
  });

  it('account parts sum equals reported net worth at every snapshot', async () => {
    const results = await runSimulation(complexPlan, 0, 2 * YEAR);
    for (const r of results) {
      const sum = Object.values(r.parts).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - r.value)).toBeLessThan(0.01);
    }
  });
});
