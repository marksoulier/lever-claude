# Lever — Build Progress & Decision Log

This document tracks what has been built, why decisions were made, and what comes next. It is the bridge between the vision in `BUSINESSPLAN.md` and the technical reality in `README.md`. Read this before asking "what's the next step."

---

## Current state of the app (as of 2026-05-21)

### What works end-to-end

| Feature | Status | Notes |
|---|---|---|
| Google + email/password auth | ✅ Working | Supabase Auth; Google OAuth redirect fixed for localhost vs prod |
| Claude.ai-style collapsible sidebar | ✅ Working | Teal/zinc brand palette; collapses to icon rail with dot indicators |
| Primary plan + what-if scenario sidebar slots | ✅ Working | Set via ⋯ menu on plan detail; teal dot = primary, grey = what-if |
| Net worth graph | ✅ Working | Recharts area chart; manual snapshots stored in `net_worth_snapshots` table |
| Net worth snapshot logger | ✅ Working | Date + amount form below accounts on dashboard |
| User modal (bottom-left) | ✅ Working | Avatar, email, subscription status (Free/Premium), sign out |
| Plan creation | ✅ Working | Name + retirement age + contribution; context filled later via MCP |
| Plan detail page | ✅ Working | Metrics, allocation, contribution recalculate, what-if panel |
| Plan context (per-plan assumptions) | ✅ Working | JSONB on plans table; drives DOB→age, risk→return, target income→target balance |
| `create_plan` MCP tool | ✅ Working | Claude creates plan + sets context in one call; no web UI needed |
| `update_plan_context` MCP tool | ✅ Working | Claude sets DOB, income, risk tolerance, retirement goal, narrative |
| `show_financial_plan` MCP tool | ✅ Working | Returns plan data + iframe widget resource |
| `run_what_if` MCP tool | ✅ Working | Returns scenario widget resource |
| `update_contribution` MCP tool | ✅ Working | Recomputes and persists new monthly contribution |
| Stripe subscription (premium gating) | ✅ Working | Checkout flow; webhook writes to `subscriptions` table |
| Mobile app (Expo) | ✅ Scaffolded | Auth + plan list working; basic shell only |

### What is hardcoded / not real yet

| Item | Current state | What it needs |
|---|---|---|
| Accounts (Roth IRA, 401k, Mortgage) | ✅ DB-backed | `accounts` table; manual entry form + `add_account` / `update_account_balance` MCP tools; auto-snapshots net worth on balance change |
| What-if scenario deltas | Static per retirement age | DB-backed saved scenarios with real math |
| Growth projection chart | ✅ Live | Recharts ComposedChart; teal/red curve, dashed goal line, today marker, retirement dot, legend |
| Admin panel | Does not exist | Separate route `/admin` with impersonation |
| Background monitor / notifications | Does not exist | Supabase Edge Function or cron |
| Financial document storage | Does not exist | Supabase Storage + AI summaries |
| Monte Carlo simulation | Does not exist | Needs simulation engine |
| Tax / optimization tools | Does not exist | Future |

---

## Architecture decisions

### Per-plan context JSON (not a user profile table)
**Decision:** Each plan stores its own assumptions (`dateOfBirth`, `annualIncome`, `targetMonthlyIncome`, `riskTolerance`, `narrative`) as a JSONB column on the `plans` table instead of a separate `user_profiles` table.

**Why:** A user should be able to model "what if I earned more" or "what if I took less risk" by creating a different plan with different context — not by changing a global profile that would break all other plans. Plans are self-contained experiments.

**Effect:** `currentAge`, `assumedReturn`, and `targetBalance` are all derived from the context JSON at computation time. Changing risk tolerance from medium to high recomputes the entire projection automatically.

### MCP as the primary data-entry surface
**Decision:** The web UI is read-heavy. Claude is write-heavy. Context, narrative, what-if scenarios, and onboarding data are all set via MCP tools in conversation — not via forms.

**Why:** The business plan explicitly says the future is connectors to AI chat interfaces. Forms for things like "what is your risk tolerance" are worse UX than a conversation. Claude can also explain the implications of each answer as it asks.

**Effect:** Plan detail pages show read-only context panels with a "Set up with Claude →" nudge when context is null. Editing is done by telling Claude.

### Route group `(app)/` for the authenticated shell
**Decision:** All protected pages live under `app/(app)/` with a shared `layout.tsx` that renders the sidebar. The route group parentheses make it invisible to URLs.

**Why:** `/dashboard` and `/plan/[id]` both need the same sidebar shell. A route group avoids duplicating the shell in every page without changing the URL structure.

### Sidebar re-fetch via custom DOM event
**Decision:** When `PlanSettingsMenu` sets a plan as primary, it dispatches `window.dispatchEvent(new CustomEvent("plans-updated"))`. The Sidebar listens for this event and re-fetches.

**Why:** `router.refresh()` re-renders server components but doesn't trigger client-side re-fetches. A custom event is the simplest cross-component signal without adding a global state manager.

### Supabase MCP credentials in `~/.claude/mcp.json`
**Decision:** The Supabase MCP Bearer token lives in the user-level Claude config (`~/.claude/mcp.json`), not in the project `.mcp.json` (which is committed).

**Why:** The PAT grants access to all Supabase projects under the account. Committing it would be a security leak. The project `.mcp.json` only holds the local lever MCP server URL (no secrets).

**Fallback:** If `mcp__supabase__*` tools are not in the session, use the Supabase Management REST API directly: `POST https://api.supabase.com/v1/projects/avzhlaxhopzmrjnmregc/database/query` with the PAT from `~/.claude/mcp.json`.

---

## Next steps — priority order toward the vision

These are ordered by what unlocks the most value next. Each builds on the one before.

### ~~1. Manual account entry~~ ✅ Done (2026-05-21)
`accounts` table with RLS; types: cash/investment/real_estate/debt. Dashboard has inline add form with type badge display and click-to-edit balances. `add_account` and `update_account_balance` MCP tools. Any balance change auto-upserts today's net worth snapshot (unique constraint on `user_id, recorded_at`). Type validated in Zod at API boundary (no DB check constraint — avoids quote-escaping issues with Supabase REST API).

### ~~1. Growth projection chart~~ ✅ Done (2026-05-21)
Recharts `ComposedChart` spanning full card width. Year-by-year curve from `projectBalance()`. Teal when on track, red when shortfall. Dashed goal line at `targetBalance`. Teal `ReferenceLine` at today's age, `ReferenceDot` at current balance and retirement endpoint. Summary row above chart shows projected, today, target, surplus/shortfall. Legend below. Chart turns red automatically when projected < target — no extra logic needed, just the color prop.

### ~~1. DB-backed what-if scenarios~~ ✅ Done (2026-05-21)
`create_what_if_plan` MCP tool clones the primary plan with overrides (retirement age, contribution, current balance, risk tolerance, target monthly income, narrative). What-if plans appear in sidebar under WHAT-IF SCENARIOS. Clicking one shows a side-by-side comparison panel: amber metric card vs teal primary metric card, dual-curve `ComparisonChart` (amber solid = what-if, teal dashed = primary), difference callout in amber. 0 errors. Note: the `run_what_if` widget (`/scenario-widget`) still uses hardcoded sliders — wiring it to plan data is in the known issues list.

### ~~1. Onboarding flow~~ ✅ Done (2026-05-21)
Hard-gate blur overlay on the dashboard (`hasPlans === false`). Shows the full app blurred behind — user sees what they're missing. 3-step card: (1) copy personalised MCP URL, (2) copy onboarding prompt to paste into Claude, (3) "I'm done →" polls for plan creation. `get_onboarding_status` MCP tool (tool #8) returns JSON with `completedSteps`, `nextSteps`, `isComplete`, and step-by-step `action` instructions so Claude knows exactly where to resume. Tab toggle between Claude.ai (URL copy) and Claude Desktop (`.mcpb` download from `/api/mcp-extension`). Gate disappears automatically once a plan is created.

**MCP connector distribution options (documented for when ready to scale):**

| Method | Friction | Status |
|---|---|---|
| Claude.ai web — manual URL entry | ~30 seconds | Working now |
| Claude Desktop — `.mcpb` download | Double-click install | Working now (download from `/api/mcp-extension`) |
| Claude.ai connectors directory | One-click "Connect" | Requires Anthropic approval — submit at [anthropic.com/partners/mcp](https://anthropic.com/partners/mcp). Need: public MCP URL, name, description, logo, contact |
| Claude Desktop extension registry | One-click "Install" | Same submission process as directory |

**To submit to the connectors directory when ready:**
1. Deploy to production (`lever-claude.vercel.app`)
2. Prepare: connector name "Lever Financial Planning", description, logo 512×512px, public MCP URL
3. Submit at https://anthropic.com/partners/mcp (contact/partnership form)
4. Once approved, users see "Connect" button at `claude.ai/directory`

### 1. Financial document storage ← **next step**
New users land on the dashboard with no plans and no context. The path to value is unclear.

**Build:**
- After first login, detect `plans.count === 0` and show an onboarding card
- Card: "Set up your plan with Claude" → links to Claude with a pre-written prompt that guides the user through the `update_plan_context` + create-plan flow
- Or: a lightweight 3-step wizard in the dashboard (name, DOB, income → creates a plan with context prefilled) as a fallback for users without Claude access

### 5. Financial document storage
The business plan calls for users to upload tax forms, pay stubs, mortgage documents, etc. that Claude can read for context.

**Build:**
- Supabase Storage bucket `documents` with RLS
- Upload UI in dashboard (drag-and-drop or file picker)
- On upload: trigger a Supabase Edge Function that calls Claude to summarize the document
- Store summary alongside file metadata in a `documents` table
- Pass relevant document summaries as context when calling MCP tools

### 6. Background monitoring + notifications
The core differentiator from a static spreadsheet: lever watches the world for the user.

**Build:**
- Supabase Edge Function on a cron schedule
- Checks for: interest rate changes, new government programs, legislative changes relevant to user's plan
- Generates a plain-text notification via Claude API
- Sends via push notification (mobile) or email
- Admin panel can preview and approve notifications before they go out

---

## Known issues to fix before production

| Issue | Severity | Fix |
|---|---|---|
| RLS dev policies on `plans` table bypass ownership | Medium | Drop dev policies before any real user signs up |
| Stripe Checkout requires cardholder name + ZIP (not documented in test flow) | Low | Always fill "Demo User" and "10001" in playwright tests |
| `run_what_if` widget uses hardcoded sliders, not plan data | Medium | Wire widget to real plan context |
| `show_financial_plan` widget (`/plan-widget`) renders static demo data | Medium | Wire to fetch from Supabase using the plan ID |
| `get_onboarding_status` still referenced "go to dashboard" in action string | Fixed 2026-05-21 | Updated to reference `create_plan` tool |
| Mobile app is a scaffold only | Low | Not blocking web MVP |
| No Jest tests for financial math functions | Medium | Add discrete tests for `projectBalance`, `resolveContextDefaults`, `ageFromDOB` |

---

## Testing discipline

- **After every route or API change:** run the MCP handshake + tools/list + tool call curl sequence
- **After every UI change:** open playwright, sign in via `/api/test-auth`, screenshot, check `console` for 0 errors
- **After every DB migration:** verify the column/table exists with a follow-up query; run `get_advisors`
- **TypeScript:** run `npx tsc --noEmit` before every visual check — catches type errors that won't show up in the browser until runtime
- **Never report a task complete without running all three checks** (MCP if applicable, visual if applicable, TypeScript always)
- **Learnings from past mistakes go into this document** — not just memory, not just comments in code. If a decision was non-obvious or a mistake was made, write it here so it is not repeated in a future session.
