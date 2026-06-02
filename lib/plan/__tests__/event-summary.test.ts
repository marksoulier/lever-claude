// Regression tests for getEventSummary.
// These tests protect against the bugs where:
//   - payment_schedule showed no dollar amount (fell through to default "")
//   - monthly_budgeting showed no amount (read p.amount which doesn't exist)
//   - existing_mortgage showed no amount (same as payment_schedule)
//
// If getEventSummary is changed and these fail, the "Events in this plan"
// panel will silently show blank amounts — a trust regression.

import { describe, it, expect } from 'vitest';
import { getEventSummary, EVENT_LABELS } from '../event-summary';

function param(type: string, value: string | number) {
  return { type, value };
}

// ── Regression: payment_schedule (BUGS.md — previously showed no amount) ──

describe('getEventSummary — payment_schedule regression', () => {
  it('returns monthly payment amount — previously returned empty string', () => {
    const event = {
      type: 'payment_schedule',
      parameters: [
        param('start_time', '1990-01-01'),
        param('payment', 1650),
        param('from_key', 'Checking'),
        param('to_key', 'Mortgage'),
      ],
    };
    expect(getEventSummary(event)).toBe('$1,650 monthly');
  });

  it('formats large payment amounts with commas', () => {
    const event = {
      type: 'payment_schedule',
      parameters: [param('payment', 2500), param('from_key', 'Checking')],
    };
    expect(getEventSummary(event)).toBe('$2,500 monthly');
  });
});

// ── Regression: existing_mortgage (same fix as payment_schedule) ────────────

describe('getEventSummary — existing_mortgage regression', () => {
  it('returns monthly payment — would have returned empty before fix', () => {
    const event = {
      type: 'existing_mortgage',
      parameters: [
        param('start_time', '1990-01-01'),
        param('payment', 2100),
        param('from_key', 'Checking'),
        param('to_key', 'Mortgage'),
      ],
    };
    expect(getEventSummary(event)).toBe('$2,100 monthly');
  });
});

// ── Regression: monthly_budgeting (previously read p.amount which doesn't exist)

describe('getEventSummary — monthly_budgeting regression', () => {
  it('sums all category fields — previously returned empty string', () => {
    const event = {
      type: 'monthly_budgeting',
      parameters: [
        param('start_time', '1990-01-01'),
        param('groceries',     600),
        param('utilities',     200),
        param('rent',         1200),
        param('transportation', 300),
        param('insurance',     250),
        param('healthcare',    100),
        param('dining_out',    200),
        param('entertainment', 100),
        param('personal_care',  75),
        param('miscellaneous', 100),
        param('from_key', 'Checking'),
      ],
    };
    // Total: 600+200+1200+300+250+100+200+100+75+100 = 3,125
    expect(getEventSummary(event)).toBe('$3,125 monthly');
  });

  it('returns empty string when all categories are zero', () => {
    const event = {
      type: 'monthly_budgeting',
      parameters: [param('start_time', '1990-01-01'), param('from_key', 'Checking')],
    };
    expect(getEventSummary(event)).toBe('');
  });

  it('ignores missing categories (partial budget)', () => {
    const event = {
      type: 'monthly_budgeting',
      parameters: [
        param('start_time', '1990-01-01'),
        param('rent', 1400),
        param('groceries', 500),
      ],
    };
    expect(getEventSummary(event)).toBe('$1,900 monthly');
  });
});

// ── Other event types — ensure they still work ─────────────────────────────

describe('getEventSummary — other event types', () => {
  it('get_job returns salary', () => {
    const event = {
      type: 'get_job',
      parameters: [param('salary', 80000), param('to_key', 'Checking')],
    };
    expect(getEventSummary(event)).toBe('$80,000 salary');
  });

  it('outflow returns amount + frequency', () => {
    const event = {
      type: 'outflow',
      parameters: [
        param('amount', 1400),
        param('frequency_days', 30),
        param('from_key', 'Checking'),
      ],
    };
    expect(getEventSummary(event)).toBe('$1,400 monthly');
  });

  it('outflow with unknown frequency shows days', () => {
    const event = {
      type: 'outflow',
      parameters: [
        param('amount', 500),
        param('frequency_days', 45),
        param('from_key', 'Checking'),
      ],
    };
    expect(getEventSummary(event)).toBe('$500 every 45 days');
  });

  it('buy_house shows principal and rate', () => {
    const event = {
      type: 'buy_house',
      parameters: [
        param('principal', 320000),
        param('interest_rate', 0.065),
        param('from_key', 'Checking'),
      ],
    };
    expect(getEventSummary(event)).toBe('$320,000 @ 6.5%');
  });

  it('windfall shows deposit amount', () => {
    const event = {
      type: 'windfall',
      parameters: [param('amount', 50000), param('to_key', 'Checking')],
    };
    expect(getEventSummary(event)).toBe('$50,000');
  });

  it('roth_ira_contribution shows monthly_contribution', () => {
    const event = {
      type: 'roth_ira_contribution',
      parameters: [
        param('monthly_contribution', 583),
        param('from_key', 'Checking'),
        param('to_key', 'Roth IRA'),
      ],
    };
    expect(getEventSummary(event)).toBe('$583 monthly');
  });

  it('unknown event type returns empty string', () => {
    const event = { type: 'some_future_event_type', parameters: [] };
    expect(getEventSummary(event)).toBe('');
  });
});

// ── EVENT_LABELS coverage ──────────────────────────────────────────────────

describe('EVENT_LABELS', () => {
  it('has label for payment_schedule', () => {
    expect(EVENT_LABELS['payment_schedule']).toBe('Debt Repayment');
  });

  it('has label for monthly_budgeting', () => {
    expect(EVENT_LABELS['monthly_budgeting']).toBe('Monthly Budget');
  });

  it('has label for childcare_expense', () => {
    expect(EVENT_LABELS['childcare_expense']).toBe('Childcare');
  });

  it('has label for existing_mortgage', () => {
    expect(EVENT_LABELS['existing_mortgage']).toBe('Existing Mortgage');
  });
});
