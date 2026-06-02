# SIMULATOR_EVAL.md — Financial Simulator Evaluation

Last updated: 2026-06-02. Read-only reference for architecture decisions, known gaps, and the T&E roadmap.

---

## Architecture Overview

The simulator is a **day-by-day deterministic engine** — for each day from start to retirement, it applies account growth, then fires each event that triggers that day, then records a net worth snapshot. Same plan always produces the same output.

```
runSimulation(planData, startDay, endDay)
  → for each day:
      applyGrowth(accounts)          // compound interest, appreciation, depreciation
      applyEventsToDay(day, events)  // fire each event that triggers today
      record(networth, parts)        // snapshot per-account balances
  → SimulationResult[]
```

**Core files:**

| File | Purpose | Lines |
|---|---|---|
| `runner.ts` | Day-by-day loop, all event handlers | 818 |
| `schema.ts` | Schema loading, event type validation | 127 |
| `schema-checker.ts` | Plan validation before simulation | 132 |
| `bridge.ts` | Convert SimulationResult → scalar DB columns | 61 |
| `monte-carlo.ts` | Monte Carlo wrapper (500 iterations) | 110 |
| `event_schema.json` | 41 event type definitions with parameters | — |

---

## What Works Well

**1. True determinism.** Deep-clone before simulation prevents mutation. Same plan always produces same output. This is the foundation for trustworthy what-if comparisons.

**2. Modular event handlers.** Each event type (`applyGetJob`, `applyBuyHouse`, `applyMonthlyBudgeting`, etc.) is a self-contained function. Adding a new event type means writing one new function and adding one `case` to the switch — no other changes required.

**3. Complex financial math is correct.** The mortgage amortization, 401k matching with employer contribution, biweekly/semi-monthly payroll, tax withholding (federal/state/FICA), and car loan amortization are all working with verifiable test assertions.

**4. Account-based architecture.** Everything is an account. This means net worth is always coherent — sum of all non-system accounts. No special-casing for different asset types.

**5. Updating events.** The `updating_events` system (raises, loan refinancing, budget changes) lets plans evolve over time without adding new top-level events. This is the right abstraction.

---

## Known Gaps and Issues

### Critical

**GAP-1: Day-0 double-fire on recurring events**
Every recurring event fires twice on `start_time` — once from the `p.start_time === day` check, and once from the `(day - p.start_time) % frequency_days === 0` check (which is also true when day equals start_time). This means rent, income, and any recurring outflow/inflow deducts/deposits twice on day 1. This is ported from the original `modal-canvas-flow` simulator and is documented in the test comments as "known behavior." **It's wrong.** A user who sets $1,650/month rent will see $3,300 deducted on day 1.

**Fix:** Add `day > p.start_time` to the recurring check guard. Requires updating the affected test expectations.

**GAP-2: Many schema event types have no simulator handler**
The following event types exist in `event_schema.json` and Claude can add them to plans, but they produce **zero simulation effect** because there's no `case` in the dispatch switch:

| Event type | Expected behavior |
|---|---|
| `retirement` | Start retirement income draw-down |
| `have_kid` | One-time birth costs from account |
| `childcare_expense` | Monthly childcare deduction ✓ (maps to `applyOutflow`) |
| `existing_mortgage` | Monthly payment ✓ (maps to `applyPaymentSchedule`) |
| `roth_ira_contribution` | Monthly contribution to Roth account |
| `high_yield_savings_account` | Transfer to high-yield account |
| `invest_money` | Transfer to investment account |
| `windfall` | One-time deposit |
| `freelance_income` | Recurring or one-time income |
| `rent_payment` | Monthly outflow (should use `applyOutflow`) |
| `career_break` | Stop income for a period |
| `moving_costs` | One-time expense |
| `marriage` | Account merging or joint income |
| `divorce` | Asset split |
| `receive_government_aid` | Recurring inflow |
| `buy_groceries` | Monthly outflow |

`childcare_expense` and `existing_mortgage` are handled (added recently). The rest are not. Claude will add them to plans confidently but they will silently have no effect on the simulation.

**Fix:** Either add handlers for each (most are simple `applyOutflow` or `applyInflow` aliases) or block Claude from adding them via schema validation that also checks for handler existence.

### High Priority

**GAP-3: Monte Carlo uses single annual return per iteration**
The current Monte Carlo samples ONE annual return for the ENTIRE simulation horizon per iteration. This misses sequence-of-returns risk — which is the dominant risk factor for retirement. A 30-year simulation using a fixed 2% return is very different from a 30-year simulation where returns are -20% in years 28-30 (just as you start drawing down).

**Fix:** Apply year-by-year random returns. For each year, sample from `N(mean, std)`. This adds a nested loop but is still O(iterations × years) not O(iterations × days).

**GAP-4: Nominal vs real returns**
The simulator compounds at nominal rates (e.g., 7% for retirement accounts). Users see nominal balances. But $2.5M in 30 years is worth roughly $1.2M in today's dollars at 2.5% inflation. The projected balance on the plan page is misleading without this correction.

**Fix (short-term):** Show a "real dollars (inflation-adjusted)" toggle on the plan page.
**Fix (long-term):** Run simulation in real terms, or clearly label the balance as nominal.

### Medium Priority

**GAP-5: No end-to-end life plan test**
Current tests verify individual event handlers in isolation. No test simulates a full realistic life: job → rent → 401k → buy house → kids → retire. These integration scenarios are where subtle handler interaction bugs live (e.g., does 401k contribution correctly reduce taxable income that feeds into federal withholding?).

**GAP-6: Account name resolution is silent**
If an event references `from_key: "Checking"` but the plan has no "Checking" account, the handler silently returns. No error, no log. The user sees a projection that just ignores that event.

**GAP-7: No performance benchmark**
Monte Carlo at 500 iterations × ~14,000 days = ~7M loop iterations. No measured baseline. If this takes >3s in production it needs optimization (batch runs, worker threads, yearly stepping instead of daily for the MC iterations).

---

## Simplicity vs Power: The Design Tension

### The current interface is powerful but opaque.

Users see projected balance and probability. They don't see:
- Which event caused a balance change on a specific date
- What the monthly cash flow looks like (income - expenses at each point)
- Why their balance might go negative at age 47 before recovering

### What "simple for users" means in practice:

**Simple:** User tells Claude "I make $78k and pay $1,400 rent" → events are created automatically → chart updates → user understands the number.

**Powerful:** The simulator handles the amortization math, tax withholding, 401k matching, inflation, and monthly compounding correctly — the user never sees these details unless they ask.

The right design is: **simple interface, powerful engine**. The interface hides complexity; the engine handles it correctly.

### What's missing to achieve this:

1. **Cash flow view** — a month-by-month breakdown of income vs expenses. The `cash-flow-monthly` widget is in STEERING.md as planned. This is the most requested feature class for people who use ProjectionLab.

2. **Event contribution** — when a user asks "why did my balance drop in 2031?", the simulator has all the data (per-account `parts` at each day) but the UI doesn't surface it. A simple "event timeline" that shows when major events fire would help.

3. **What-if diffing** — the comparison chart shows primary vs what-if. But it doesn't show *why* they diverge — which event drove the difference. This would require per-event attribution tracking.

---

## T&E Framework — Current State

### What exists

**46 Vitest tests** covering:
- `declare_accounts` — 1 test
- `outflow` — 2 tests (one-time, recurring)
- `inflow` — 1 test
- `get_job` — 5 tests (net pay, 401k, multi-paycheck, withholding)
- `buy_house` — 5 tests (down payment, asset, mortgage recording, payment cycle, full payoff)
- Growth models — 3 tests (daily compound, yearly compound, None)
- Net worth calculation — 1 test

**What's missing:**
- `buy_car` — 0 tests
- `monthly_budgeting` — 0 tests
- `payment_schedule` — 0 tests
- `applyGetWageJob` — 0 tests
- `applyMonthlyBudgeting` — 0 tests
- Monte Carlo — 0 tests
- Integration (multi-event life plan) — 0 tests
- Edge cases (zero balance, negative input, duplicate events) — 0 tests
- Performance benchmarks — 0 tests

---

## T&E Roadmap — What to Build

### Track 1: Fix the day-0 double-fire (must do first)

This is a correctness bug that affects every recurring event. Fix it, update the 3 affected test expectations, and verify no new failures.

### Track 2: Handler coverage (one sprint)

For each event type in the schema without a handler, add a minimal implementation. Most are simple aliases:

```
rent_payment      → applyOutflow (already exists)
freelance_income  → applyInflow  (already exists)
windfall          → applyInflow  (one-time)
buy_groceries     → applyOutflow (one-time or recurring)
career_break      → set p.end_time on the job event
roth_ira          → applyInflow to Roth account
invest_money      → applyTransferMoney
```

For each handler added, write at minimum 2 tests: trigger fires, amount is correct.

### Track 3: Integration test suite

Write 3 end-to-end life plan simulations that span 20-40 years and assert:
1. Net worth trajectory is monotonically increasing before retirement (no unexpected dips)
2. 401k balance grows with contributions + employer match + compounding over 30 years
3. Mortgage pays off at the right year (balance reaches 0)

These are the tests that catch handler interaction bugs.

### Track 4: Monte Carlo improvements

1. Implement year-by-year return sampling (sequence-of-returns)
2. Add statistical accuracy tests:
   - At 7% mean: p50 of 500 runs should be within 10% of deterministic output
   - Success rate at 7% mean/12% std should be in historical range for the given horizon
3. Add worst-case scenario (p5) to the plan page UI

### Track 5: Performance baseline

Benchmark: `runSimulation` for a 30-year plan with 10 events. Target <100ms.
Benchmark: `runMonteCarlo` at 500 iterations. Target <3s.

If either exceeds target:
- Try yearly stepping for MC iterations (skip non-event days)
- Try Worker threads for parallel MC iterations
- Try caching the deterministic path and only perturbing growth rates

### Track 6: Property-based tests

Use fast-check or similar to generate random-but-valid plans and assert invariants:
- Net worth is always a finite number (no NaN, Infinity)
- Account balances sum to net worth
- Simulation is deterministic (run twice, get same result)

---

## Recommended Next Steps (prioritized)

1. **Fix GAP-1 (day-0 double-fire)** — correctness bug affecting all real users' projections
2. **Add missing event handlers for schema types Claude uses** (GAP-2 subset: `windfall`, `roth_ira_contribution`, `career_break`, `rent_payment`)
3. **Write integration tests** (Track 3 above) before Monte Carlo improvements
4. **Year-by-year Monte Carlo** (GAP-3) — after integration tests prove deterministic base is solid
5. **Cash flow widget** — highest-impact missing UI feature for user understanding
