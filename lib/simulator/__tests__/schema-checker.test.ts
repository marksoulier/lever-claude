// Track 1 — regression tests for plan validation.
// Ensures structural errors in plan_data are caught before reaching the simulator.

import { describe, it, expect } from 'vitest';
import { validatePlan, getHardErrors } from '../schema-checker';
import type { PlanData } from '../types';

const BASE_PLAN: PlanData = {
  birth_date: '1990-01-01',
  inflation_rate: 0.03,
  adjust_for_inflation: true,
  accounts: [
    { name: 'Checking', category: 'Cash', growth: 'None', rate: 0, account_type: 'regular' },
    { name: 'Savings',  category: 'Cash', growth: 'Daily Compound', rate: 0.045, account_type: 'regular' },
  ],
  events: [],
};

describe('validatePlan', () => {
  it('passes for an empty events plan', () => {
    const errors = getHardErrors(BASE_PLAN);
    expect(errors).toHaveLength(0);
  });

  it('catches unknown event types', () => {
    const plan: PlanData = {
      ...BASE_PLAN,
      events: [{
        id: 1,
        type: 'totally_fake_event',
        title: 'Bad event',
        description: '',
        is_recurring: false,
        parameters: [],
        updating_events: [],
      }],
    };
    const errors = getHardErrors(plan);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('totally_fake_event');
  });

  it('catches duplicate event IDs', () => {
    const plan: PlanData = {
      ...BASE_PLAN,
      events: [
        { id: 1, type: 'outflow', title: 'Rent', description: '', is_recurring: true, parameters: [], updating_events: [] },
        { id: 1, type: 'outflow', title: 'Food', description: '', is_recurring: true, parameters: [], updating_events: [] },
      ],
    };
    const errors = getHardErrors(plan);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.toLowerCase().includes('duplicate'))).toBe(true);
  });

  it('skips hidden events', () => {
    const plan: PlanData = {
      ...BASE_PLAN,
      events: [{
        id: 1,
        type: 'totally_fake_event',
        title: 'Hidden bad event',
        description: '',
        is_recurring: false,
        hide: true,
        parameters: [],
        updating_events: [],
      }],
    };
    // Hidden events should not produce type errors
    const errors = getHardErrors(plan);
    expect(errors).toHaveLength(0);
  });

  it('issues warning (not hard error) for invalid account references', () => {
    const plan: PlanData = {
      ...BASE_PLAN,
      events: [{
        id: 1,
        type: 'outflow',
        title: 'Rent',
        description: '',
        is_recurring: true,
        parameters: [
          { id: 0, type: 'start_time', value: '2025-01-01' },
          { id: 1, type: 'from_key',   value: 'NonExistentAccount' },
        ],
        updating_events: [],
      }],
    };
    const hardErrors = getHardErrors(plan);
    const allIssues = validatePlan(plan);
    // Hard errors should be empty; warning should be present
    expect(hardErrors).toHaveLength(0);
    expect(allIssues.some((e) => e.severity === 'warning' && e.message.includes('NonExistentAccount'))).toBe(true);
  });

  it('passes a valid outflow event', () => {
    const plan: PlanData = {
      ...BASE_PLAN,
      events: [{
        id: 1,
        type: 'outflow',
        title: 'Rent',
        description: '',
        is_recurring: true,
        parameters: [
          { id: 0, type: 'start_time',     value: '2025-01-01' },
          { id: 1, type: 'end_time',        value: '2030-01-01' },
          { id: 2, type: 'amount',          value: 1200 },
          { id: 3, type: 'frequency_days',  value: 30 },
          { id: 4, type: 'from_key',        value: 'Checking' },
        ],
        updating_events: [],
      }],
    };
    const errors = getHardErrors(plan);
    expect(errors).toHaveLength(0);
  });
});
