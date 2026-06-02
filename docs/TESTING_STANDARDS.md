# TESTING_STANDARDS.md — Engineering Quality Standards

Living document. All new code must meet these standards before merging. Claude reads this at the start of any T&E task and applies it without being asked.

---

## Philosophy

Tests are not a formality — they are what make "this works" a real claim. A feature is not done until it is tested. A simulator that passes tests is a simulator someone can trust. The standard is:

> **A change is complete when the affected code is tested at the right level, typed correctly, and documented clearly enough that a new contributor could understand it without asking.**

Three rules that override everything else:
1. Never ship a simulator change without a corresponding Vitest test
2. Never ship a UI change without a passing `playwright-cli` visual check
3. Never ship anything with TypeScript errors

---

## Test Layers

The project uses three distinct testing layers. Each catches a different class of bug.

### Layer 1 — Unit tests (Vitest)

**Location:** `lib/**/*.test.ts`
**Runner:** `npm test` (vitest run)
**What they cover:** Pure functions with deterministic inputs and outputs — simulator math, schema validation, financial calculations, bridge/mapper functions.

**Rules:**
- One `describe` block per module or logical group
- Each `it` block tests one specific behavior with one specific assertion
- Use the `approx()` helper for floating-point financial math (tolerance ≤ $1)
- Test the unhappy path: what happens with zero balance, missing account, end_time in the past
- Never mock the simulator internals — test with real `planData` structures

**Required coverage for simulator event handlers:**
Every event handler in `runner.ts` must have tests for:
1. **Start trigger** — the event fires on `start_time` and produces the correct account change
2. **Recurring trigger** — if `is_recurring`, it fires at the correct interval after `start_time`
3. **End condition** — the event stops at `end_time` or when a natural termination occurs (e.g., loan payoff)
4. **Missing account** — when `from_key` or `to_key` doesn't exist, the handler silently no-ops (no crash)

**Template for a new event handler test:**

```typescript
describe('event_type_name', () => {
  const BASE_PLAN = basePlan({
    events: [
      declareAccounts({ Checking: 10000 }),   // set up starting balances
      {
        id: 2, type: 'event_type_name',
        title: 'Test event',
        description: '', is_recurring: true,
        parameters: [
          { id: 0, type: 'start_time',     value: '1990-01-01' },
          { id: 1, type: 'end_time',       value: '1991-01-01' },
          { id: 2, type: 'frequency_days', value: 30 },
          { id: 3, type: 'amount',         value: 500 },
          { id: 4, type: 'from_key',       value: 'Checking' },
        ],
        updating_events: [],
      },
    ],
  });

  it('fires once on start day (not double)', async () => {
    const bal = await finalBalance(BASE_PLAN, 0, 'Checking');
    expect(approx(bal, 9500)).toBe(true);        // deducted exactly once
  });

  it('fires again on second interval', async () => {
    const bal = await finalBalance(BASE_PLAN, 30, 'Checking');
    expect(approx(bal, 9000)).toBe(true);        // two deductions total
  });

  it('does not fire before start_time', async () => {
    const earlyPlan = basePlan({ events: [
      declareAccounts({ Checking: 10000 }),
      { ...event, parameters: [{ ...params, start_time: '1991-01-01' }] }
    ]});
    const bal = await finalBalance(earlyPlan, 0, 'Checking');
    expect(approx(bal, 10000)).toBe(true);       // no effect yet
  });

  it('no-ops when account is missing', async () => {
    const badPlan = basePlan({ events: [
      { ...event, parameters: [{ ...params, from_key: 'DoesNotExist' }] }
    ]});
    // Should not throw, balance unaffected
    await expect(runSimulation(badPlan, 0, 30)).resolves.toBeDefined();
  });
});
```

---

### Layer 2 — Integration tests (Vitest)

**Location:** `lib/simulator/__tests__/integration.test.ts` (to be created)
**What they cover:** Multi-event life plans over decades — verifying that handlers interact correctly and net worth trajectories are coherent.

**Required integration scenarios (to build):**

| Scenario | Events combined | What to assert |
|---|---|---|
| Job + 401k + retirement | get_job, declare_accounts | 401k grows with employee + employer match; paycheck math correct over 10 years |
| Job + mortgage | get_job, buy_house | Net worth grows despite mortgage; mortgage balance reaches 0 at term end |
| Career arc | get_job → get_a_raise → career_break → get_job | Income gaps and resumption at correct salary |
| Freelancer | freelance_income, monthly_budgeting, roth_ira_contribution | Cash flow math over 3 years |
| Net worth invariants | any multi-event plan | Net worth is finite, never NaN/Infinity; account sum equals net worth |

**Invariant tests (property-based assertions):**

```typescript
it('net worth is always a finite number', async () => {
  const results = await runSimulation(anyComplexPlan, 0, 10000);
  for (const r of results) {
    expect(isFinite(r.value)).toBe(true);
    expect(isNaN(r.value)).toBe(false);
  }
});

it('simulation is deterministic — two runs produce identical results', async () => {
  const r1 = await runSimulation(plan, 0, 1000);
  const r2 = await runSimulation(plan, 0, 1000);
  expect(r1.map(r => r.value)).toEqual(r2.map(r => r.value));
});
```

---

### Layer 3 — Visual / E2E tests (Playwright via playwright-cli)

**Location:** Run via `playwright-cli` during development; no stored spec files yet
**What they cover:** UI renders correctly, key flows work end-to-end

**Required checks after any UI change:**
```bash
# Sign in
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"

# Check target page
playwright-cli goto http://localhost:3000/<changed-route>
playwright-cli snapshot          # confirm key elements present
playwright-cli console           # must report 0 errors

playwright-cli close
```

**What "0 errors" means:** no JavaScript exceptions. Font preload warnings are acceptable. Everything else is a bug.

**Required checks for plan page changes:** snapshot must show plan name, all four metric cards, growth projection section, events section (if plan has events).

---

## TypeScript Standards

**Strict mode is on** (`"strict": true` in tsconfig.json). This means:
- No implicit `any`
- No unchecked optional chaining without null guard
- All function return types inferred or explicit where ambiguous

**Rules:**
- Run `npx tsc --noEmit` before every commit. Zero errors required. (Stale `.next/types/validator.ts` errors are acceptable — filter with `grep -v "validator.ts"`)
- Never use `as any` to silence a type error — fix the type instead
- Prefer `unknown` over `any` for truly dynamic data; narrow with guards before use
- API route handler parameters should use Zod schemas, not bare TypeScript types — Zod validates at runtime, TypeScript only at compile time
- DB row types: use `DbPlanRow` from `lib/supabase/mappers.ts`, not raw query results

**When adding simulator types:**
- New event parameter types go in `lib/simulator/types.ts`
- New `PlanData` fields go in `PlanData` interface and must have a clear comment on their purpose
- `SimulationResult` must remain serializable to JSON (no class instances, no functions)

---

## Documentation Standards

### Code comments

Write comments only when the **why** is non-obvious. Never document what — the code says that. Document:
- A constraint imposed by an external system ("Supabase returns ISO strings, not Date objects")
- A subtle invariant ("day 0 fires start_time; recurring fires from day 1 onward via else-if")
- A workaround for a known bug ("mortgage account uses negative balances by convention")
- A performance decision ("yearly MC steps, not daily, to keep 500 iterations under 3s")

Never write:
- Comments restating what the code does: `// increment balance` above `balance++`
- Comments referencing the task or PR: `// added for issue #123`
- Multi-line docstrings for obvious functions

### Function signatures

Every exported function in `lib/simulator/` must have a brief one-line doc comment if its name alone isn't self-explanatory:

```typescript
// Run N Monte Carlo iterations with year-by-year return sampling.
// Returns sorted percentile distribution and success rate.
export async function runMonteCarlo(input: MonteCarloInput): Promise<MonteCarloResults>
```

### Test descriptions

Test descriptions (`describe` and `it`) must be readable as a sentence without context:

```typescript
// ✓ Good
describe('applyOutflow', () => {
  it('deducts amount from source account on start day', ...)
  it('does not deduct before start_time', ...)
  it('stops deducting after end_time', ...)
})

// ✗ Bad
describe('outflow', () => {
  it('works', ...)
  it('test 2', ...)
})
```

### BUGS.md

Every known bug must be in `docs/BUGS.md` with:
- Status: Open / Fixed
- Root cause: one sentence
- Fix: one sentence (or "see commit X")

Never leave a silent known bug in the codebase without a BUGS.md entry.

### SIMULATOR_EVAL.md

Every gap identified in the simulator must be documented in `docs/SIMULATOR_EVAL.md` with a tracking entry. When fixed, update status inline.

---

## Performance Standards

### Simulator benchmarks (targets, not yet measured)

| Operation | Target |
|---|---|
| `runSimulation` — 30-year plan, 10 events | < 100ms |
| `runMonteCarlo` — 500 iterations | < 5s |
| `runMonteCarlo` — 100 iterations (interactive) | < 1s |

**When to measure:** any change to `runner.ts` or `monte-carlo.ts` that touches the main loop.

**How to measure:**
```typescript
it('runs 30-year simulation in under 100ms', async () => {
  const start = performance.now();
  await runSimulation(realisticPlan, 0, 10950);
  expect(performance.now() - start).toBeLessThan(100);
});
```

---

## Pre-commit Checklist

Run this before every commit. Do not skip steps.

```bash
# 1. Type check (zero errors required, filter validator.ts noise)
npx tsc --noEmit 2>&1 | grep -v "validator.ts"

# 2. Unit tests (all must pass)
npm test

# 3. If simulator code changed: confirm no regression in financial math
npm test -- --reporter=verbose lib/simulator

# 4. If UI changed: playwright visual check (0 console errors)
# [run playwright-cli as described in Layer 3 above]

# 5. Secrets check before staging
git diff --staged | grep -iE "(service_role|sbp_|sk_test_|sk_live_|whsec_|phc_)"
# Must return nothing
```

---

## Next Steps — What Needs to Be Built

Ordered by priority. Each item has a clear definition of done.

### 1. Integration test file (Track 3 from SIMULATOR_EVAL.md)
**File:** `lib/simulator/__tests__/integration.test.ts`
**Definition of done:** 5 integration scenarios passing (job+401k, job+mortgage, career arc, net-worth invariants, determinism proof)
**Why now:** Before adding more simulator features — integration tests catch handler interaction bugs that unit tests miss.

### 2. Tests for all new event handlers (GAP-2 from SIMULATOR_EVAL.md)
**Handlers needing tests:** `windfall`, `rent_payment`, `freelance_income`, `roth_ira_contribution`, `invest_money`, `career_break`, `childcare_expense`, `existing_mortgage`
**Definition of done:** Each handler has start/recurring/end/no-op tests per the template above.

### 3. Monte Carlo statistical accuracy test
**File:** `lib/simulator/__tests__/monte-carlo.test.ts`
**Test:** At 7% mean/12% std, p50 of 500 iterations should be within 15% of the deterministic output over the same horizon.
**Why:** Verifies the year-by-year sampling produces the right distribution, not a coding error.

### 4. Performance benchmark suite
**File:** `lib/simulator/__tests__/perf.test.ts`
**Tests:** Simulator <100ms, Monte Carlo 500 iterations <5s
**Run with:** `npm test -- lib/simulator/__tests__/perf.test.ts`

### 5. Schema validation for unhandled event types
**File:** `lib/simulator/schema-checker.ts`
**Change:** Add a warning (not hard error) when a plan event type has no registered handler in `runner.ts`.
**Definition of done:** `validatePlan` returns a warning for `marriage`, `divorce`, `pass_away`, `receive_government_aid` until handlers are added.

### 6. Nominal vs real balance display (design decision needed)
**Options:** (a) show nominal only with clear label, (b) show real (inflation-adjusted) toggle, (c) show both side by side.
**Requires:** Mark to choose direction before implementation.

### 7. ESLint configuration
**Gap:** `eslint` is installed but no rules are configured for simulator/lib code.
**Add:** `no-floating-promises` (catch unawaited async in event handlers), `no-console` for lib code, `@typescript-eslint/no-explicit-any`.
**File:** `eslint.config.js`
