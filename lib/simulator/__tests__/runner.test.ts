// Track 1 — regression tests for the day-by-day simulator.
// These are the tests that make "deterministic" a real claim.
// Each test uses known inputs and asserts known financial outputs.
// If any of these fail after a code change, the simulator math has regressed.

import { describe, it, expect } from 'vitest';
import { runSimulation } from '../runner';
import type { PlanData } from '../types';

// Tolerance for floating-point comparisons (~1 cent on dollar amounts)
const CENT = 0.01;
const approx = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

// ── Helpers ────────────────────────────────────────────────────────────────

function basePlan(overrides: Partial<PlanData> = {}): PlanData {
  return {
    birth_date: '1990-01-01',
    inflation_rate: 0.03,
    adjust_for_inflation: false,
    accounts: [
      { name: 'Checking',           category: 'Cash',       growth: 'None',            rate: 0,    account_type: 'regular' },
      { name: 'Savings',            category: 'Cash',       growth: 'Daily Compound',  rate: 0.05, account_type: 'regular' },
      { name: '401k',               category: 'Retirement', growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' },
      { name: 'Federal Withholdings', category: 'Tax',      growth: 'None',            rate: 0,    account_type: 'system-controlled' },
      { name: 'State Withholdings',   category: 'Tax',      growth: 'None',            rate: 0,    account_type: 'system-controlled' },
      { name: 'Local Withholdings',   category: 'Tax',      growth: 'None',            rate: 0,    account_type: 'system-controlled' },
      { name: 'Taxable Income',       category: 'Tax',      growth: 'None',            rate: 0,    account_type: 'non-networth-account' },
      { name: 'Home',               category: 'Assets',     growth: 'Appreciation',    rate: 0.03, account_type: 'regular' },
      { name: 'Mortgage',           category: 'Debt',       growth: 'None',            rate: 0,    account_type: 'regular' },
      { name: 'Car',                category: 'Assets',     growth: 'Depreciation',    rate: 0.15, account_type: 'regular' },
      { name: 'Car Loan',           category: 'Debt',       growth: 'None',            rate: 0,    account_type: 'regular' },
    ],
    events: [],
    ...overrides,
  };
}

// Run simulation from day 0 to day N and return the final day result
async function runToDay(plan: PlanData, days: number) {
  const results = await runSimulation(plan, 0, days);
  return results[results.length - 1];
}

// Get a specific account balance from the last result
async function finalBalance(plan: PlanData, days: number, account: string) {
  const result = await runToDay(plan, days);
  return result.parts[account] ?? result.nonNetworthParts?.[account] ?? 0;
}

// ── declare_accounts ───────────────────────────────────────────────────────

describe('declare_accounts', () => {
  it('sets account balances on start day', async () => {
    const plan = basePlan({
      events: [{
        id: 1, type: 'declare_accounts', title: 'Opening balances',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1990-01-01' },
          { id: 1, type: 'account1',   value: 'Checking' },
          { id: 2, type: 'amount1',    value: 10000 },
        ],
        updating_events: [],
      }],
    });

    const bal = await finalBalance(plan, 1, 'Checking');
    expect(approx(bal, 10000)).toBe(true);
  });
});

// ── outflow ────────────────────────────────────────────────────────────────

describe('outflow', () => {
  it('deducts a one-time amount on start day', async () => {
    const plan = basePlan({
      events: [
        {
          id: 1, type: 'declare_accounts', title: 'Open',
          description: '', is_recurring: false,
          parameters: [
            { id: 0, type: 'start_time', value: '1990-01-01' },
            { id: 1, type: 'account1',   value: 'Checking' },
            { id: 2, type: 'amount1',    value: 5000 },
          ],
          updating_events: [],
        },
        {
          id: 2, type: 'outflow', title: 'One-time expense',
          description: '', is_recurring: false,
          parameters: [
            { id: 0, type: 'start_time', value: '1990-01-01' },
            { id: 1, type: 'amount',     value: 1000 },
            { id: 2, type: 'from_key',   value: 'Checking' },
          ],
          updating_events: [],
        },
      ],
    });

    const bal = await finalBalance(plan, 1, 'Checking');
    expect(approx(bal, 4000)).toBe(true);
  });

  it('deducts correct total for recurring monthly payments of $750 over 330 days', async () => {
    // Day 0: start_time fires once. Recurring check uses else-if so it does NOT fire.
    // Days 30, 60, 90, ..., 330: recurring fires. That is 11 more deductions.
    // Total: 12 deductions.
    const plan = basePlan({
      events: [
        {
          id: 1, type: 'declare_accounts', title: 'Open',
          description: '', is_recurring: false,
          parameters: [
            { id: 0, type: 'start_time', value: '1990-01-01' },
            { id: 1, type: 'account1',   value: 'Checking' },
            { id: 2, type: 'amount1',    value: 20000 },
          ],
          updating_events: [],
        },
        {
          id: 2, type: 'outflow', title: 'Rent',
          description: '', is_recurring: true,
          parameters: [
            { id: 0, type: 'start_time',    value: '1990-01-01' },
            { id: 1, type: 'end_time',      value: '1991-01-01' },
            { id: 2, type: 'amount',        value: 750 },
            { id: 3, type: 'frequency_days', value: 30 },
            { id: 4, type: 'from_key',      value: 'Checking' },
          ],
          updating_events: [],
        },
      ],
    });

    // 12 deductions: 1 on day 0 (start) + 11 recurring (days 30, 60 ... 330)
    const bal = await finalBalance(plan, 330, 'Checking');
    expect(approx(bal, 20000 - 750 * 12, 5)).toBe(true);
  });
});

// ── inflow ─────────────────────────────────────────────────────────────────

describe('inflow', () => {
  it('deposits a recurring amount correctly over 6 months', async () => {
    // Day 0 fires once (start). Days 30, 60, 90, 120, 150 = 5 more. Total: 6 deposits.
    const plan = basePlan({
      events: [{
        id: 1, type: 'inflow', title: 'Rental income',
        description: '', is_recurring: true,
        parameters: [
          { id: 0, type: 'start_time',     value: '1990-01-01' },
          { id: 1, type: 'end_time',       value: '1991-01-01' },
          { id: 2, type: 'amount',         value: 2000 },
          { id: 3, type: 'frequency_days', value: 30 },
          { id: 4, type: 'to_key',         value: 'Checking' },
        ],
        updating_events: [],
      }],
    });

    const bal = await finalBalance(plan, 150, 'Checking');
    expect(approx(bal, 12000, 5)).toBe(true); // 6 deposits × $2,000
  });
});

// ── get_job ────────────────────────────────────────────────────────────────

describe('get_job', () => {
  // Biweekly salary math (the most common payroll setup):
  // Salary = $52,000/year, pay_period = 26 (biweekly)
  // payPeriodDays = round(365/26) = 14
  // gross per paycheck = 52000/26 = $2000
  // 401k employee = 2000 * 0.06 = $120
  // 401k employer match = 2000 * 0.03 = $60
  // taxable income = 2000 - 120 = $1880
  // federal = 1880 * 0.22 = $413.60
  // state = 1880 * 0.05 = $94.00
  // social = 2000 * 0.062 = $124.00
  // medicare = 2000 * 0.0145 = $29.00
  // total withheld = 413.60 + 94 + 124 + 29 = $660.60
  // net pay = 2000 - 120 - 660.60 = $1219.40

  const JOB_EVENT = {
    id: 1, type: 'get_job', title: 'Software Engineer',
    description: '', is_recurring: false,
    parameters: [
      { id: 0,  type: 'start_time',             value: '1990-01-01' },
      { id: 1,  type: 'end_time',               value: '2055-01-01' },
      { id: 2,  type: 'salary',                 value: 52000 },
      { id: 3,  type: 'pay_period',             value: 26 },
      { id: 4,  type: 'federal_income_tax',     value: 0.22 },
      { id: 5,  type: 'state_income_tax',       value: 0.05 },
      { id: 6,  type: 'local_income_tax',       value: 0 },
      { id: 7,  type: 'social_security_tax',    value: 0.062 },
      { id: 8,  type: 'medicare_tax',           value: 0.0145 },
      { id: 9,  type: 'p_401k_contribution',    value: 0.06 },
      { id: 10, type: 'p_401k_match',           value: 0.03 },
      { id: 11, type: 'to_key',                 value: 'Checking' },
      { id: 12, type: 'p_401k_key',             value: '401k' },
      { id: 13, type: 'taxable_income_key',     value: 'Taxable Income' },
      { id: 14, type: 'federal_withholdings_key', value: 'Federal Withholdings' },
      { id: 15, type: 'state_withholdings_key',   value: 'State Withholdings' },
      { id: 16, type: 'local_withholdings_key',   value: 'Local Withholdings' },
    ],
    updating_events: [],
  };

  it('deposits correct net pay on first paycheck (day 0)', async () => {
    const plan = basePlan({ events: [JOB_EVENT] });
    // Run exactly 1 day — day 0 fires the first paycheck
    const bal = await finalBalance(plan, 0, 'Checking');
    expect(approx(bal, 1219.40, 0.5)).toBe(true);
  });

  it('deposits correct 401k (employee + employer match) on first paycheck', async () => {
    const plan = basePlan({ events: [JOB_EVENT] });
    const bal = await finalBalance(plan, 0, '401k');
    // employee: $120, employer: $60 = $180
    expect(approx(bal, 180, 0.5)).toBe(true);
  });

  it('accumulates two paychecks after 14 days', async () => {
    const plan = basePlan({ events: [JOB_EVENT] });
    // Day 0 = first paycheck, day 14 = second paycheck
    const bal = await finalBalance(plan, 14, 'Checking');
    expect(approx(bal, 1219.40 * 2, 1)).toBe(true);
  });

  it('records federal + FICA withholdings correctly', async () => {
    const plan = basePlan({ events: [JOB_EVENT] });
    const fedBal = await finalBalance(plan, 0, 'Federal Withholdings');
    // federal + social + medicare = 413.60 + 124 + 29 = 566.60
    expect(approx(fedBal, 566.60, 0.5)).toBe(true);
  });

  it('records state withholding correctly', async () => {
    const plan = basePlan({ events: [JOB_EVENT] });
    const stateBal = await finalBalance(plan, 0, 'State Withholdings');
    expect(approx(stateBal, 94.00, 0.5)).toBe(true);
  });
});

// ── buy_house (mortgage) ───────────────────────────────────────────────────

describe('buy_house', () => {
  // Home value: $300,000, down payment: $60,000 (20%)
  // Principal: $240,000, rate: 6% annual (growth rate on Mortgage account), 30-year term
  // Monthly payment: (240000 * 0.005) / (1 - 1.005^-360) ≈ $1438.92
  // On purchase day:
  //   Checking -= $60,000 (down payment)
  //   Home += $300,000 (asset)
  //   Mortgage -= $240,000 (debt, negative balance)

  const HOUSE_PLAN = basePlan({
    accounts: [
      { name: 'Checking', category: 'Cash',   growth: 'None', rate: 0, account_type: 'regular' },
      { name: 'Home',     category: 'Assets', growth: 'None', rate: 0, account_type: 'regular' },
      { name: 'Mortgage', category: 'Debt',   growth: 'None', rate: 0.06, account_type: 'regular' },
    ],
    events: [
      {
        id: 1, type: 'declare_accounts', title: 'Open',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1990-01-01' },
          { id: 1, type: 'account1',   value: 'Checking' },
          { id: 2, type: 'amount1',    value: 100000 },
        ],
        updating_events: [],
      },
      {
        id: 2, type: 'buy_house', title: 'Buy home',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time',      value: '1990-01-01' },
          { id: 1, type: 'home_value',      value: 300000 },
          { id: 2, type: 'downpayment',     value: 60000 },
          { id: 3, type: 'loan_term_years', value: 30 },
          { id: 4, type: 'property_tax_rate', value: 0.012 },
          { id: 5, type: 'from_key',        value: 'Checking' },
          { id: 6, type: 'to_key',          value: 'Home' },
          { id: 7, type: 'mortgage_account', value: 'Mortgage' },
        ],
        event_functions: [
          { type: 'downpayment',     title: 'Down Payment',     enabled: true },
          { type: 'home_asset',      title: 'Home Asset',       enabled: true },
          { type: 'morgage_loan',    title: 'Mortgage Loan',    enabled: true },
          { type: 'mortgage_payment', title: 'Monthly Payment', enabled: true },
          { type: 'property_tax',    title: 'Property Tax',     enabled: false },
          { type: 'final_home_payment_correction', title: 'Final Correction', enabled: true },
        ],
        updating_events: [],
      },
    ],
  });

  it('deducts down payment from Checking on purchase day', async () => {
    const bal = await finalBalance(HOUSE_PLAN, 0, 'Checking');
    expect(approx(bal, 40000, 1)).toBe(true); // 100000 - 60000
  });

  it('adds home value to Home asset on purchase day', async () => {
    const bal = await finalBalance(HOUSE_PLAN, 0, 'Home');
    expect(approx(bal, 300000, 1)).toBe(true);
  });

  it('records mortgage principal as negative balance on purchase day', async () => {
    const bal = await finalBalance(HOUSE_PLAN, 0, 'Mortgage');
    expect(approx(bal, -240000, 1)).toBe(true);
  });

  it('monthly payment reduces mortgage balance after one payment cycle', async () => {
    // First payment fires ~30 days in (365/12 ≈ 30.4 days)
    const bal30 = await finalBalance(HOUSE_PLAN, 31, 'Mortgage');
    // After one payment, mortgage balance should be less negative than -240000
    expect(bal30).toBeGreaterThan(-240000);
    expect(bal30).toBeLessThan(-238000); // should have paid at least $1000 off principal
  });

  it('mortgage is fully paid off after 30 years (360 payments)', async () => {
    // Run full term: 30 years = ~10950 days
    const results = await runSimulation(HOUSE_PLAN, 0, 10950);
    const final = results[results.length - 1];
    const mortgageBal = final.parts['Mortgage'] ?? 0;
    // Mortgage should be paid off (balance ≥ 0 means no remaining debt)
    expect(mortgageBal).toBeGreaterThanOrEqual(-100); // within $100 of zero
  });
});

// ── Growth models ──────────────────────────────────────────────────────────

describe('growth models', () => {
  it('Daily Compound grows correctly over 365 days at 5% APR', async () => {
    // $10,000 at 5% daily compound for 365 days
    // Expected: 10000 * (1 + 0.05/365)^365 ≈ 10000 * e^0.05 ≈ $10,512.67
    const plan = basePlan({
      accounts: [{ name: 'Savings', category: 'Cash', growth: 'Daily Compound', rate: 0.05, account_type: 'regular' }],
      events: [{
        id: 1, type: 'declare_accounts', title: 'Open',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1990-01-01' },
          { id: 1, type: 'account1',   value: 'Savings' },
          { id: 2, type: 'amount1',    value: 10000 },
        ],
        updating_events: [],
      }],
    });

    const results = await runSimulation(plan, 0, 365);
    const finalBal = results[results.length - 1].parts['Savings'];
    // Should be close to 10000 * (1 + 0.05/365)^365 ≈ 10512.67
    expect(finalBal).toBeGreaterThan(10500);
    expect(finalBal).toBeLessThan(10530);
  });

  it('Yearly Compound only applies on year boundaries', async () => {
    // _days_elapsed increments at the start of applyGrowth each day.
    // Compound fires when _days_elapsed % 365 === 0.
    // Day 0 → elapsed=1, Day 363 → elapsed=364: no compound.
    // Day 364 → elapsed=365 → compound fires (10000 * 1.07 = 10700).
    const plan = basePlan({
      accounts: [{ name: 'Savings', category: 'Cash', growth: 'Yearly Compound', rate: 0.07, account_type: 'regular' }],
      events: [{
        id: 1, type: 'declare_accounts', title: 'Open',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1990-01-01' },
          { id: 1, type: 'account1',   value: 'Savings' },
          { id: 2, type: 'amount1',    value: 10000 },
        ],
        updating_events: [],
      }],
    });

    // After 363 days — no yearly compound yet (_days_elapsed = 364)
    const resultsMid = await runSimulation(plan, 0, 363);
    expect(approx(resultsMid[resultsMid.length - 1].parts['Savings'], 10000, 1)).toBe(true);

    // After 364 days — compound fires (_days_elapsed = 365): 10000 * 1.07 = 10700
    const resultsFull = await runSimulation(plan, 0, 364);
    expect(approx(resultsFull[resultsFull.length - 1].parts['Savings'], 10700, 1)).toBe(true);
  });

  it('None growth type leaves balance unchanged', async () => {
    const plan = basePlan({
      accounts: [{ name: 'Checking', category: 'Cash', growth: 'None', rate: 0, account_type: 'regular' }],
      events: [{
        id: 1, type: 'declare_accounts', title: 'Open',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1990-01-01' },
          { id: 1, type: 'account1',   value: 'Checking' },
          { id: 2, type: 'amount1',    value: 5000 },
        ],
        updating_events: [],
      }],
    });

    const results = await runSimulation(plan, 0, 365);
    const final = results[results.length - 1].parts['Checking'];
    expect(approx(final, 5000, CENT)).toBe(true);
  });
});

// ── Non-networth accounts ──────────────────────────────────────────────────

describe('net worth calculation', () => {
  it('excludes non-networth-account balances from total', async () => {
    const plan = basePlan({
      events: [{
        id: 1, type: 'declare_accounts', title: 'Open',
        description: '', is_recurring: false,
        parameters: [
          { id: 0, type: 'start_time', value: '1990-01-01' },
          { id: 1, type: 'account1',   value: 'Checking' },
          { id: 2, type: 'amount1',    value: 5000 },
          { id: 3, type: 'account2',   value: 'Taxable Income' },
          { id: 4, type: 'amount2',    value: 999999 }, // should NOT count toward net worth
        ],
        updating_events: [],
      }],
    });

    const result = await runToDay(plan, 0);
    // Net worth should only include Checking, not Taxable Income
    expect(approx(result.value, 5000, 1)).toBe(true);
    expect(result.nonNetworthParts?.['Taxable Income']).toBe(999999);
  });
});
