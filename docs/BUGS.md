# BUGS.md

Known bugs and friction points. Sourced from synthetic user evaluation (3 personas: Jordan 24, Maria 34, Derek 52), prior manual testing, and **first real user test (marksoulier0@gmail.com, 2026-05-30)**.

Fix P0 before any real user invite. Fix P1 before public launch.

---

## P0 — Critical / Blocks Trust

| # | Bug | Status | Root cause |
|---|---|---|---|
| B-1 | **Projected balance inconsistency: UI chart vs event simulation** | **Fixed** | `update_plan` handler calls `simulationToScalars` and writes the result to scalar columns (`projected_balance`, `success_probability`, `monthly_income_at_retirement`) on every successful simulation run. Confirmed: Jordan's plan shows $3.4M in both scalar column and simulation output. |
| B-2 | **"Probability of success" label is misleading** | **Fixed (short-term)** | Tooltip text was already in the code but rendered in `text-zinc-300` (near-invisible on white). Changed to `text-zinc-400` — the disclaimer "Estimates how close your projected balance is to your retirement target. Not a Monte Carlo simulation." is now legible below the metric value. Long-term fix: replace formula with real Monte Carlo probability. |

---

## P1 — High / Degrades Core Value

| # | Bug | Status | Root cause |
|---|---|---|---|
| B-3 | **What-if scenario panel shows hardcoded wrong dollar amounts** | **Fixed** | `buildScenarios()` was already dynamic for premium users. Fixed the blurred preview in `UpgradeCTA` (non-premium): was showing hardcoded `+$124K`, `-$89K`, `-$201K`; now passes real `scenarios` from `buildScenarios()` so the locked preview reflects the user's actual plan numbers. |
| B-4 | **Comparison chart shows flat zero line for years before what-if plan's current age** | **Fixed** | Changed `DataPoint` type from `whatif?: number` to `whatif: number \| null` and returned `null` (not `undefined`) for ages before each plan's start. Added explicit `connectNulls={false}` on both `Area` components. Recharts v3 treats `undefined` as 0 but correctly renders `null` as a gap. Verified: primary plan (age 42) path now starts at x≈318 in the SVG rather than x=68 (the left edge). |
| B-5 | **No event type for existing mortgage / ongoing loan** | **Fixed** | Added `existing_mortgage` event to `event_schema.json` (category: Debt). Parameters: First Payment Date, Monthly Payment, From Account, Mortgage/Debt Account. Runner maps it to `applyPaymentSchedule` — simulation auto-terminates when debt balance hits zero. Users must declare their remaining balance as a negative value on the debt account first via `declare_accounts`. |
| B-6 | **What-if scenarios panel empty for retirement ages other than 60 and 65** | **Fixed** | Resolved by B-3: `buildScenarios()` dynamically computes from the plan's actual numbers — works for any retirement age. |
| B-15 | **"Run what if" button on the plan widget does nothing** | **Fixed** | Root cause: button called `callServerTool("run_what_if", ...)` which proxies the call and returns data back to the widget — `_meta.ui.resourceUri` only triggers widget rendering when the LLM calls the tool, not when a widget calls it directly. Fixed in `app/plan-widget/page.tsx`: replaced with `sendMessage({ role: "user", content: [...] })` which injects a user turn into the Claude conversation; Claude then calls `run_what_if` naturally, which triggers the scenario widget to appear. |
| B-16 | **Onboarding system prompt is visible and confusing to new users** | **Fixed** | Simplified `ONBOARDING_PROMPT` in `OnboardingGate.tsx` to a single natural sentence: "Help me set up my Lever financial plan." Updated Step 2 label to "send this" (was "paste this"). Updated the Claude.ai connector path to match actual UI: "left sidebar → Customize → Connectors → + → Add custom". Added explicit labels "Name it **Lever**" and "paste in the **Integration URL** field". Added "Claude will take it from there — no other setup needed." |
| B-17 | **Onboarding AI doesn't explain Lever's value proposition or what it's doing** | **Fixed** | Updated the new-user action in `get_onboarding_status` (`app/api/mcp/route.ts`) to instruct Claude to: (1) welcome the user warmly, (2) explain Lever's value in 2-3 sentences, (3) set time expectations, (4) acknowledge non-standard income upfront. Income type question now precedes the dollar amount question. |
| B-18 | **Onboarding assumes W-2/salaried income; breaks for entrepreneurs and variable earners** | **Fixed** | Resolved as part of B-17 fix. The new action asks income type (salaried / hourly / freelance / mix) before asking for the amount, and explicitly tells Claude "total across all sources this year is fine for variable earners." |

---

## P2 — Medium / Friction / Polish

| # | Bug | Status | Root cause |
|---|---|---|---|
| B-7 | **Mousewheel doesn't scroll plan page naturally** | **Fixed** | `<main>` already had `overflow-y-auto` in the app layout. Standard browser behavior — scroll events target the element under the cursor. No code change needed beyond confirming the layout was already correct. |
| B-8 | **"New plan" UI modal captures no personal context** | **Fixed** | Added a contextual nudge below the form inputs: "This creates a baseline projection. For a personalized plan — income, tax, life events — open Claude and say 'Help me build my financial plan.'" |
| B-9 | **No childcare / family expense events in the event library** | **Fixed** | Added `childcare_expense` event to `event_schema.json` (category: Living Expenses). Parameters: Start Date, End Date, Monthly Cost ($1,800 default), From Account. Supports `update_amount` updating events for cost transitions (infant→toddler, preschool→K-12). Runner maps to `applyOutflow`. |
| B-10 | **Dashboard plans section shows no plan summary** | Open | The main content area says "Select a plan from the sidebar to view its detail." There are no plan cards on the dashboard — just a net worth graph and accounts. First-time users don't know they have to click a sidebar item. Fix: add a "Your plans" section to the dashboard with compact plan cards showing name, projected balance, and success score. |
| B-11 | **Net worth chart shows confusing spikes when accounts are added** | **Fixed** | `NetWorthGraph` now counts distinct dates across snapshots. When fewer than 2 distinct dates exist, the chart is replaced with "Your chart will fill in over time — come back tomorrow to see your first data point." |
| B-19 | **Widget renders with dark background regardless of browser theme** | **Fixed** | Root cause: `globals.css` had a `@media (prefers-color-scheme: dark)` block (Next.js template boilerplate) that set `--background: #0a0a0a`. The app has no dark mode design — no `dark:` Tailwind variants anywhere — so the override only caused harm. Removed the entire dark mode block from `globals.css`. Body background is now consistently white. |
| B-20 | **Onboarding has no progress indicator; users don't know how long setup takes** | **Fixed** | Updated `get_onboarding_status` action in `app/api/mcp/route.ts` to instruct Claude to: (1) announce "8 quick questions" at the start with a 10-minute estimate, (2) prefix each question with its number ("**1 of 8:**", "**2 of 8:**", etc.), (3) acknowledge halfway at question 4 ("Halfway there — you're doing great"), (4) tell users they can pause anytime and come back. |
| B-21 | **UserJot requires account creation to submit feedback** | **Fixed** | Changed feedback links to `lever.userjot.com/b/features` and added "free account required" label. Guest posting enabled in UserJot Dashboard → Settings → Boards (paid plan feature, enabled 2026-06-02). |

---

## Previously tracked (pre-persona-testing)

| # | Bug | Status | Notes |
|---|---|---|---|
| B-12 | What-if plans don't inherit context from primary plan | **Fixed** | `create_what_if_plan` spreads `baseCtx` into `mergedCtx` and passes it as `context`; also inherits `plan_data` from the base plan. |
| B-13 | Metric cards show bare numbers with no explanation | **Fixed** | All four metric cards have subtitles: "at retirement", "in retirement", "vs target balance", "of reaching goal". |
| B-14 | No Jest tests for financial math functions | **Fixed** | Vitest added. 46 tests, all passing. |
