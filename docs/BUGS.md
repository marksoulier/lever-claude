# BUGS.md

Known bugs and friction points. Sourced from synthetic user evaluation (3 personas: Jordan 24, Maria 34, Derek 52), prior manual testing, and **first real user test (marksoulier0@gmail.com, 2026-05-30)**.

Fix P0 before any real user invite. Fix P1 before public launch.

---

## Bug Fix Standard

Every fixed bug must have a regression test before being marked **Fixed**. See `TESTING_STANDARDS.md → Bug Fix Regression Testing` for the workflow. The table below includes a "Regression test" column — if it's blank on a fixed bug, the fix is incomplete.

---

## P0 — Critical / Blocks Trust

| # | Bug | Status | Root cause | Regression test |
|---|---|---|---|---|
| B-1 | **Projected balance inconsistency: UI chart vs event simulation** | **Fixed** | `update_plan` handler calls `simulationToScalars` and writes the result to scalar columns. Plan page now derives metrics from `simulation_results` when available, so `update_contribution` cannot overwrite event-based values. | Needs test: assert that projected_balance from simulation_results survives a contribution update |
| B-2 | **"Probability of success" label is misleading** | **Fixed (short-term)** | Tooltip now legible; short-term fix. Long-term: replaced with real Monte Carlo result when available. | `monte-carlo.test.ts` — success_rate within 0–100, p10 < p50 < p90 |
| B-26 | **MCP URL shows "Could not load — refresh the page" in Claude.ai when user pastes it** | **Fixed** | `mcp-handler` returns 405 on plain GET. Intercepted GET requests without `Accept: text/event-stream` before reaching the handler and return `200 {"name":"Lever","version":"1.0","protocol":"mcp"}`. SSE and POST paths unchanged. | `curl GET /api/mcp` → HTTP 200 |

---

## P1 — High / Degrades Core Value

| # | Bug | Status | Root cause | Regression test |
|---|---|---|---|---|
| B-27 | **Onboarding is "too managerial" — feels like a form, not a conversation** | **Fixed** | Rewrote `get_onboarding_status` new-user action. Claude now leads with open curiosity ("Tell me about where you're at right now"), listens to the person's full situation, and derives the required data naturally — no numbered questions, no form structure. | Manual: onboarding session should feel like a conversation, not an intake form |
| B-28 | **Claude says "Lever connects your real financial data" — misleading copy** | **Fixed** | Removed "real financial data" and bank-connection language from both the new-user and set-context action strings. Lever is now described accurately as a planning sandbox that works from what the user tells Claude. | `get_onboarding_status` action text no longer contains "real financial data" |
| B-3 | **What-if scenario panel shows hardcoded wrong dollar amounts** | **Fixed** | `buildScenarios()` now dynamic — passes real plan numbers to the locked preview. | Needs test: snapshot test asserting scenario deltas change when contribution changes |
| B-4 | **Comparison chart flat zero line before what-if plan's current age** | **Fixed** | Changed `whatif?: number` to `whatif: number \| null`; `connectNulls={false}`. | Needs test: assert null values produce gaps not zeros in chart data |
| B-5 | **No event type for existing mortgage** | **Fixed** | Added `existing_mortgage` handler → `applyPaymentSchedule`. | `integration.test.ts` — mortgage reaches zero by year 30 |
| B-6 | **What-if scenarios empty for non-60/65 retirement ages** | **Fixed** | Resolved by B-3: `buildScenarios()` dynamic for any age. | Covered by B-3 regression test |
| B-15 | **"Run what if" widget button does nothing** | **Fixed** | Replaced `callServerTool` with `sendMessage` so Claude calls the tool naturally. | Needs test: playwright-cli widget interaction test |
| B-16 | **Onboarding prompt visible and confusing** | **Fixed** | Simplified to single-sentence prompt with connector instructions. | Needs test: assert `get_onboarding_status` returns correct next_step for new users |
| B-17 | **Onboarding AI doesn't explain value proposition** | **Fixed** | New-user action string updated — welcomes, explains, sets expectations, numbered questions. | Same as B-16: `get_onboarding_status` action string content assertion |
| B-18 | **Onboarding assumes salaried income** | **Fixed** | Income type question now precedes income amount. | Same as B-16 |

---

## P2 — Medium / Friction / Polish

| # | Bug | Status | Root cause | Regression test |
|---|---|---|---|---|
| B-29 | **Logo "lever×Claude" looks weird** | **Fixed** | Removed `×Claude` suffix from `OnboardingGate.tsx` header — now renders just `lever`. | Visual — playwright snapshot check |
| B-30 | **Feedback page 404s when trying to submit feedback** | **Fixed** | Both `OnboardingGate.tsx` and `Sidebar.tsx` feedback links were pointing to `lever.userjot.com/b/features` (404). Changed to `lever.userjot.com` (root, works). | Navigate to feedback link — must not 404 |
| B-31 | **"(free account required)" label shown on feedback even when it isn't** | **Fixed** | Removed `(free account required)` span and title suffix from `Sidebar.tsx` feedback link. Guest posting is enabled; the label was stale and incorrect. | Feedback link must not show "free account required" if guest posting is on |
| B-7 | **Mousewheel doesn't scroll naturally** | **Fixed** | `<main>` already had `overflow-y-auto`; confirmed correct. | N/A — layout-only, no regression risk |
| B-8 | **New plan modal captures no context** | **Fixed** | Nudge text added pointing to Claude personalization. | Needs test: assert nudge text present in CreatePlanForm snapshot |
| B-9 | **No childcare events in event library** | **Fixed** | Added `childcare_expense` → `applyOutflow`. | `integration.test.ts > childcare_expense handler` |
| B-10 | **Dashboard shows no plan summary** | **Fixed** | "Your plans" section with plan cards added to dashboard. | Needs test: playwright assert "Your plans" heading + cards on dashboard |
| B-11 | **Net worth chart spikes when accounts added** | **Fixed** | Chart hidden until ≥ 2 distinct dates; friendly notice shown. | Needs test: assert single-date snapshots render notice not chart |
| B-19 | **Widget renders with dark background regardless of browser theme** | **Fixed** | Root cause: `globals.css` had a `@media (prefers-color-scheme: dark)` block (Next.js template boilerplate) that set `--background: #0a0a0a`. The app has no dark mode design — no `dark:` Tailwind variants anywhere — so the override only caused harm. Removed the entire dark mode block from `globals.css`. Body background is now consistently white. |
| B-20 | **Onboarding has no progress indicator; users don't know how long setup takes** | **Fixed** | Updated `get_onboarding_status` action in `app/api/mcp/route.ts` to instruct Claude to: (1) announce "8 quick questions" at the start with a 10-minute estimate, (2) prefix each question with its number ("**1 of 8:**", "**2 of 8:**", etc.), (3) acknowledge halfway at question 4 ("Halfway there — you're doing great"), (4) tell users they can pause anytime and come back. |
| B-21 | **UserJot requires account creation to submit feedback** | **Fixed** | Changed feedback links to `lever.userjot.com/b/features` and added "free account required" label. Guest posting enabled in UserJot Dashboard → Settings → Boards (paid plan feature, enabled 2026-06-02). |
| B-22 | **Events section shows blank amounts for rent_payment, payment_schedule with real DB parameter names** | **Fixed** | `event-summary.ts` now reads `monthly_rent` for rent_payment, `payment_amount ?? payment` for payment_schedule, and includes `other` in the monthly_budgeting sum. 3 regression tests added. |
| B-23 | **Onboarding gate "I'm done →" button never dismisses the gate** | **Fixed** | `router.refresh()` doesn't re-run the parent's `useEffect`, so `hasPlans` stayed false. Fixed by passing `onComplete` callback from `DashboardPage` to `OnboardingGate`; gate calls `onComplete()` immediately when plans are found so `hasPlans` flips to `true` directly. |
| B-24 | **Google OAuth signup crashes: "Database error saving new user"** | **Fixed** | Leftover Supabase template trigger `on_auth_user_created` → `create_profile_for_user()` ran `insert into profiles` without schema prefix. GoTrue executes triggers with `search_path=''` so the unqualified table name fails. Trigger and function dropped via migration `drop_orphaned_profiles_trigger`. Profile rows now created on-demand in `/api/mcp-url` and `/api/mcp-extension` via upsert. See DATABASE.md. |

---

| B-25 | **LLM parses dollar amounts incorrectly during create_plan: "$80,000" passed as 8000000** | **Fixed** | `create_plan` MCP tool now returns an error when `current_balance > annual_income × 50`, forcing Claude to confirm before proceeding. Onboarding prompt updated to instruct Claude to: (a) specify "no commas or letters" in Q8, (b) read back all key numbers for user confirmation before calling create_plan. Affected plan for marksoulier0@gmail.com corrected in DB. | Needs test: create_plan with current_balance=8000000, annual_income=40000 — expect error response |

---

## Previously tracked (pre-persona-testing)

| # | Bug | Status | Notes | Regression test |
|---|---|---|---|---|
| B-12 | What-if plans don't inherit context | **Fixed** | `create_what_if_plan` spreads `baseCtx` into context; inherits `plan_data`. | Needs test: create what-if, assert context matches primary |
| B-13 | Metric cards bare numbers | **Fixed** | All four cards have subtitles. | N/A — visual, confirmed via playwright |
| B-14 | No Vitest tests | **Fixed** | 77 tests now passing across 7 test files. | Tests are the regression test |

## Simulator gaps fixed (from SIMULATOR_EVAL.md)

| # | Gap | Status | Fix | Regression test |
|---|---|---|---|---|
| GAP-1 | Day-0 double-fire on recurring events | **Fixed** | Added `else-if` guard to recurring check in `applyInflow`, `applyOutflow`, `applyTransferMoney`. | `runner.test.ts` — outflow 330-day: expects 12 deductions not 13; inflow 150-day: expects 6 deposits not 7 |
| GAP-2 | Missing event handlers | **Fixed (core set)** | Added: `windfall`, `rent_payment`, `freelance_income`, `roth_ira_contribution`, `invest_money`, `career_break`. | `integration.test.ts` — each handler has start/recurring/growth assertion |
| GAP-3 | Single annual return in Monte Carlo | **Fixed** | Year-by-year return sampling via `yearlyReturns[]` passed to `runSimulation`. | `monte-carlo.test.ts` — higher std_dev → wider spread; convergence within 20% of deterministic |
