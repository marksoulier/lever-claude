# BUGS.md

Known bugs and friction points. Sourced from synthetic user evaluation (3 personas: Jordan 24, Maria 34, Derek 52) and prior manual testing.

Fix P0 before any real user invite. Fix P1 before public launch.

---

## P0 — Critical / Blocks Trust

| # | Bug | Status | Root cause |
|---|---|---|---|
| B-1 | **Projected balance inconsistency: UI chart vs event simulation** | Open | `GrowthProjectionChart` and the "Projected balance" metric card both read `plans.projected_balance`, which is written by `create_plan` / `update_contribution` using a simple compound interest formula. `update_plan` (event-based simulator) writes its result into `plan_data.simulation_results` but does NOT update the `projected_balance` scalar column. Result: Jordan's UI shows $1.4M while his event-based simulation shows $3.4M (2.4× gap). Fix: in `update_plan`'s handler, after calling `simulationToScalars`, write the result to the scalar columns just like the existing tools do — the code already calls `simulationToScalars` and has the `scalars` variable, but only conditionally writes it. Confirm it is always written. |
| B-2 | **"Probability of success" label is misleading** | Open | The value is `min(99, max(10, round(50 + (projected/target) * 40)))` — a linear ratio, not a statistical probability. Derek (52, market volatility concern) sees "82%" and interprets it as a real risk measure. Fix short-term: add a tooltip on the metric card explaining "This score estimates how close your projected balance is to your target. It is not a Monte Carlo simulation." Fix long-term: replace with real probability via Monte Carlo. |

---

## P1 — High / Degrades Core Value

| # | Bug | Status | Root cause |
|---|---|---|---|
| B-3 | **What-if scenario panel shows hardcoded wrong dollar amounts** | Open | `scenariosByRetirementAge` in the plan detail page is a static lookup table. Every user sees "From $3,200 to $3,700/mo" regardless of their actual `monthlyContribution`. Jordan ($500/mo), Maria ($2,500/mo), and Derek ($3,000/mo) all see the same number. Fix: replace static table with dynamic computation using the plan's `monthlyContribution` and `projectedBalance`. |
| B-4 | **Comparison chart shows flat zero line for years before what-if plan's current age** | Open | `ComparisonChart` uses `min(primaryAge, whatIfAge)` as the domain start. When the what-if plan's `currentAge` is higher than the primary plan's, all earlier years render at 0 instead of being absent. Derek's what-if (age 52) vs. demo primary plan (age ~42) shows 10 years of flatline-zero then a jump. Fix: start the what-if series at `whatIfPlan.currentAge`, not the domain start; don't render it at 0 before that age. |
| B-5 | **No event type for existing mortgage / ongoing loan** | Open | Homeowners like Maria cannot enter "I already have a mortgage of $1,650/month." `buy_house` models a future purchase (downpayment + principal). `payment_schedule` ("Debt Repayment") is the workaround but requires non-obvious parameter names and doesn't model amortization. Fix: add a `loan_amortization` or `existing_mortgage` event type to the event schema, or document `payment_schedule` more prominently in `get_event_schema` descriptions. |
| B-6 | **What-if scenarios panel empty for retirement ages other than 60 and 65** | **Fixed** | Resolved by B-3: `buildScenarios()` dynamically computes from the plan's actual numbers — works for any retirement age. |

---

## P2 — Medium / Friction / Polish

| # | Bug | Status | Root cause |
|---|---|---|---|
| B-7 | **Mousewheel doesn't scroll plan page naturally** | Open | The scrollable element is `<main>`, not the document. Scroll events go to `document.documentElement` (height = viewport = 720px). Users must click inside the content area before scrolling works. Fix: add `overflow-y: auto` to the outer wrapper or ensure the main element captures scroll events. |
| B-8 | **"New plan" UI modal captures no personal context** | Open | The 4-field inline form (name, retirement age, contribution, current balance) creates a plan with no DOB, income, or risk tolerance. This bypasses the context that drives projections. Fix: either add those fields to the form, or add a post-creation prompt: "To personalize your plan, open Claude and start a conversation." |
| B-9 | **No childcare / family expense events in the event library** | Open | Major cash flows for the 30–45 demographic (daycare, K-12 tuition, dependent care) are absent. Maria had to model $1,800/month childcare inside `monthly_budgeting → other`. Fix: add `childcare_expense` or expand `monthly_budgeting` to include a `childcare` field. |
| B-10 | **Dashboard plans section shows no plan summary** | Open | The main content area says "Select a plan from the sidebar to view its detail." There are no plan cards on the dashboard — just a net worth graph and accounts. First-time users don't know they have to click a sidebar item. Fix: add a "Your plans" section to the dashboard with compact plan cards showing name, projected balance, and success score. |
| B-11 | **Net worth chart shows confusing spikes when accounts are added** | Open | Adding accounts via `add_account` triggers `upsertNetWorthSnapshot` which creates today's snapshot. If a user adds 3 accounts in one session, the net worth chart shows sudden vertical jumps that look like real wealth changes. Fix: suppress chart display until at least 2 distinct dates have snapshots, or show a notice "Your chart will fill in as you add and update accounts over time." |

---

## Previously tracked (pre-persona-testing)

| # | Bug | Status | Notes |
|---|---|---|---|
| B-12 | What-if plans don't inherit context from primary plan | Open | `create_what_if_plan` leaves `context` null. Fix: copy `context` from source plan. |
| B-13 | Metric cards show bare numbers with no explanation | Open | "Monthly Income" has no subtitle. Users don't know if it's current or at retirement. Partially overlaps B-2. |
| B-14 | No Jest tests for financial math functions | **Fixed** | Vitest added. 46 tests, all passing. |
