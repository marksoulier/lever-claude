// Track 1 — regression tests for the event schema helpers.
// These guard against accidental changes to the schema API surface.

import { describe, it, expect } from 'vitest';
import {
  getEventList,
  getEventSchema,
  isValidEventType,
  nextEventId,
} from '../schema';

describe('getEventList', () => {
  it('returns a non-empty array', () => {
    const list = getEventList();
    expect(list.length).toBeGreaterThan(0);
  });

  it('every item has required fields', () => {
    for (const item of getEventList()) {
      expect(typeof item.type).toBe('string');
      expect(item.type.length).toBeGreaterThan(0);
      expect(typeof item.display_name).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.category).toBe('string');
      expect(typeof item.can_be_reoccurring).toBe('boolean');
    }
  });

  it('includes core user-facing event types', () => {
    // outflow and inflow have display_event: false — they are simulator primitives,
    // not shown in the event library UI. Higher-level events (get_job, buy_house)
    // are user-facing and must always appear.
    const types = new Set(getEventList().map((e) => e.type));
    for (const expected of ['get_job', 'buy_house', 'get_wage_job']) {
      expect(types.has(expected), `Expected "${expected}" in event list`).toBe(true);
    }
    // Confirm primitives are intentionally excluded
    expect(types.has('outflow')).toBe(false);
    expect(types.has('inflow')).toBe(false);
  });

  it('groups events into known categories', () => {
    const categories = new Set(getEventList().map((e) => e.category));
    expect(categories.size).toBeGreaterThan(0);
  });
});

describe('getEventSchema', () => {
  it('returns null for unknown event types', () => {
    expect(getEventSchema('not_a_real_event')).toBeNull();
  });

  it('returns full schema for get_job', () => {
    const schema = getEventSchema('get_job');
    expect(schema).not.toBeNull();
    expect(schema!.type).toBe('get_job');
    expect(Array.isArray(schema!.parameters)).toBe(true);
    expect(schema!.parameters.length).toBeGreaterThan(0);
  });

  it('get_job schema includes required financial parameters', () => {
    const schema = getEventSchema('get_job')!;
    const paramTypes = new Set(schema.parameters.map((p) => p.type));
    for (const required of ['start_time', 'salary', 'pay_period', 'federal_income_tax']) {
      expect(paramTypes.has(required), `get_job should have parameter "${required}"`).toBe(true);
    }
  });

  it('returns schema for buy_house with updating events', () => {
    const schema = getEventSchema('buy_house');
    expect(schema).not.toBeNull();
    expect(Array.isArray(schema!.updating_events)).toBe(true);
    expect(schema!.updating_events.length).toBeGreaterThan(0);
  });

  it('parameters include parameter_units metadata', () => {
    const schema = getEventSchema('outflow')!;
    for (const p of schema.parameters) {
      expect(typeof p.parameter_units).toBe('string');
    }
  });
});

describe('isValidEventType', () => {
  it('returns true for valid types', () => {
    expect(isValidEventType('get_job')).toBe(true);
    expect(isValidEventType('outflow')).toBe(true);
    expect(isValidEventType('buy_house')).toBe(true);
    expect(isValidEventType('inflow')).toBe(true);
  });

  it('returns false for invalid types', () => {
    expect(isValidEventType('fake_event')).toBe(false);
    expect(isValidEventType('')).toBe(false);
    expect(isValidEventType('GET_JOB')).toBe(false); // case-sensitive
  });
});

describe('nextEventId', () => {
  it('returns 1 for empty array', () => {
    expect(nextEventId([])).toBe(1);
  });

  it('returns max id + 1', () => {
    expect(nextEventId([{ id: 1 }, { id: 5 }, { id: 3 }])).toBe(6);
  });

  it('works with a single event', () => {
    expect(nextEventId([{ id: 42 }])).toBe(43);
  });
});
