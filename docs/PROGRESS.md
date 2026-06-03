# Lever — Build Progress & Decision Log

This document tracks what has been built, why decisions were made, and what comes next. It is the bridge between the vision in `BUSINESSPLAN.md` and the technical reality in `README.md`. Read this before asking "what's the next step."

---

## Manual recommendation workflow

This is the current process for generating and sending user recommendations. Background monitoring will automate this later — for now it runs manually through Claude Code.

### Step 1 — Pull user context

In this conversation, call:
```
get_user_context  email: "user@example.com"
```

### Step 2 — Run the opportunity scan

After the context is returned, paste this prompt:

```
Using the financial context above and web search, find 2–4 specific opportunities
this person should look into right now. Focus on changes from the last 6 months.

Search across:
- IRS contribution limit or rule changes this tax year (401k, IRA, Roth IRA, HSA, catch-up)
- New or expiring federal programs matching their income bracket and age
- Interest rate environment — does it affect their debt accounts or conservative allocation?
- Tax law changes relevant to their income level or retirement timeline
- Roth conversion windows — does their income this year create a favorable opportunity?
- State-specific programs if their location is known from context

Relevance test before including anything: does this apply to their specific income,
age, account types, and gap vs target? Skip anything that would apply to anyone
regardless of their situation.

For each opportunity: what it is, why it applies to them specifically (cite their
actual numbers), and what they should do. 2–3 sentences each.

Then write a notification message — 2–4 sentences, second person, plain language,
no disclaimers or jargon. Should feel like a heads-up from a knowledgeable friend.
Call queue_recommendation with that message.
```

### Step 3 — Review in the admin panel

Open `/admin/users/[id]` in the browser. The queued draft appears in the Notifications section. Read it — if it's accurate and useful, hit **Approve**. If it needs editing, discard it and re-run with a refined prompt.

### What makes a good notification

- Cites their actual numbers (e.g. "your $3,000/month contribution puts you in the phase-out range for...")
- One clear action they can take
- No financial advisor language ("this is not advice", "consult a professional")
- Short enough to read in 30 seconds

### Future automation

When this workflow is consistent and the output quality is reliable, it gets replaced by a Vercel Cron job that runs the same prompt on a schedule and queues drafts automatically. The admin approval step stays — you review before anything sends.

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
`create_what_if_plan` MCP tool clones the primary plan with overrides (retirement age, contribution, current balance, risk tolerance, target monthly income, narrative). What-if plans appear in sidebar under WHAT-IF SCENARIOS. Clicking one shows a side-by-side comparison panel: amber metric card vs teal primary metric card, dual-curve `ComparisonChart` (amber solid = what-if, teal dashed = primary), difference callout in amber. 0 errors. The `run_what_if` widget (`/scenario-widget`) initializes sliders from real plan data via `ontoolresult`; slider range extended to 50–80 to cover all valid retirement ages.

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

---

## Document pipeline — how it works

### Upload path (only supported path)

Documents must be uploaded through the **Lever dashboard → Documents page**. Claude (in a conversation) should never attempt to accept files directly or offer to receive them — always redirect the user to the dashboard.

```
User selects file on /documents page
        │
        ▼
POST /api/documents  (multipart/form-data)
        │
        ├─→ Supabase Storage bucket "documents"
        │     path: {userId}/{uuid}.{ext}
        │     permanent — the source of truth
        │
        ├─→ Anthropic Files API  (beta, files-api-2025-04-14)
        │     returns anthropic_file_id
        │     expires after 30 days on Anthropic's servers
        │     (auto-refreshed by read_document tool when needed)
        │
        └─→ Claude Haiku (claude-haiku-4-5-20251001)
              called once at upload time with the file_id
              returns financial summary text
              stored in documents.summary  ← permanent in DB
```

If `ANTHROPIC_API_KEY` is missing or the Haiku call fails, the upload still completes — the document is saved with `summary: null`. The file is always safe in Supabase Storage.

### How Claude accesses documents

| Situation | Tool to call | Cost |
|---|---|---|
| Need financial context for a plan | `get_document_summaries` | Free — reads from DB only |
| User asks a specific question about one doc | `read_document` | Haiku API call |
| User wants to upload a new document | Direct to dashboard | No tool — tell user to go to `/documents` |

### Why uploads happen in the dashboard, not via MCP

When a user uploads a file to Claude.ai, Claude processes the content but the raw binary is never exposed to MCP tools — only text Claude extracted is accessible. Sending via MCP would mean:
- No original file stored in Supabase (no source of truth)
- No ability to re-read the original later
- Claude would need to pass extracted text, not the real file — losing formatting, tables, structure

The dashboard upload pipeline stores the original binary in Supabase Storage permanently, runs the full Claude summarisation, and makes the result available to all future Claude conversations via `get_document_summaries`. This is always the right path.

### `read_document` — auto file_id refresh

Anthropic's Files API files expire after ~30 days. The `read_document` tool handles this automatically:
- File `created_at` < 25 days ago → uses the stored `anthropic_file_id` directly
- File older than 25 days → downloads the binary from Supabase Storage, re-uploads to Anthropic Files API, gets a fresh `file_id`, saves it back to `documents.anthropic_file_id`

This means `read_document` works indefinitely as long as the file is in Supabase Storage.

---

### ~~1. Financial document storage~~ ✅ Done (2026-05-21)
`documents` table + Supabase Storage bucket `documents` with RLS. `/documents` page with drag-and-drop upload zone and document list. On upload: file stored in Supabase Storage + uploaded to Anthropic Files API + Claude Haiku summarizes it server-side; summary stored in DB. `get_document_summaries` MCP tool (tool #9) lets Claude pull all summaries into a plan conversation. Dashboard shows a clickable teaser card with upload count. Sidebar: `Home` nav item with home icon (was "Dashboard"), `Documents` nav item above "New plan". `ANTHROPIC_API_KEY` env var required in `.env.local` — see `.env.example`.

**Decision log:**
- Chose Anthropic Files API (Claude native) over Unstructured.io / Reducto — no extra service, same cost, Claude handles PDF/image/text natively. Can add Reducto later for complex table extraction if needed.
- Summarization is best-effort: if Anthropic API key is missing or call fails, document still saves with `summary: null`. No upload is blocked.
- Files API beta types not in stable SDK — used `as unknown as` cast; documented with inline comment.

### ~~Admin panel~~ ✅ Done (2026-05-21)
`/admin` route gated server-side to `ADMIN_EMAILS` (env var, defaults to `marksoulkid@gmail.com,admin@lever.dev`). User card grid with stats bar, setup health dots, primary plan snippet. `/admin/users/[userId]` detail page: health summary with gap callout, plans, accounts, documents (with summaries), notification queue with Approve/Discard buttons. Sidebar Admin link shown only to admin users (amber style). MCP tools: `list_users`, `get_user_context`, `queue_recommendation` — all admin-gated. `notifications` table with draft/approved/sent/discarded states.

**Workaround documented:** Supabase GoTrue `auth.admin.listUsers()` returns "Database error finding users" in the Next.js runtime on this project. Fixed by creating a `security definer` SQL function `public.admin_list_users()` that queries `auth.users` directly — callable via `admin.rpc("admin_list_users")`.

**Admin test user:** `admin@lever.dev` / `admin1234` — created via raw SQL + identity record (GoTrue Admin API returned 500 during creation; SQL insert works).

**The workflow:**
1. Open `/admin` to see all users
2. In this Claude Code conversation, call `list_users` to get an overview
3. Call `get_user_context` with a user's email to get their full financial picture
4. Claude generates a recommendation, call `queue_recommendation` to save as draft
5. Back in `/admin/users/[id]`, review the draft and approve or discard

### ~~6. Push notification delivery~~ ✅ Done (2026-05-26, end-to-end verified)

Admin approves a notification → it fires as a push to the user's phone immediately. No cron needed yet — the manual workflow drives it.

**What was built:**
- `push_tokens` table (user_id PK, token, updated_at) with RLS
- `POST /api/push-tokens` — mobile registers its Expo push token with a Bearer JWT; upserts on re-login
- `PATCH /api/admin/notifications/[id]` updated: on `approved`, looks up the user's push token, calls Expo Push API (`https://exp.host/--/api/v2/push/send`), marks notification `sent` if push delivered or `approved` if no token registered yet
- Mobile: `expo-notifications` installed; `registerPushToken()` called once per session on login; foreground handler shows banners while app is open

**End-to-end verified (2026-05-26):** Token registers on app open → admin sends from compose box → push arrives on phone in ~1s → DB shows status `sent`.

**Deployment note:** `EXPO_PUBLIC_API_URL` in `mobile/.env.local` points to `https://lever-claude.vercel.app`. The `/api/push-tokens` endpoint must be deployed to Vercel before tokens can register. All routes are now live.

**Known limitation — Expo Go vs development build:**
`expo-notifications` remote push for Android was removed from Expo Go in SDK 53. iOS push still works in Expo Go via Expo's APNs proxy. Android users need a development build for push delivery.

---

### How to test push notifications end-to-end

#### Option A — Development build (full test, required for real pushes)

1. Install EAS CLI: `npm install -g eas-cli`
2. From `mobile/`: `eas build --profile development --platform ios` (or `android`)
3. Install the resulting `.ipa` / `.apk` on your device
4. In the dev build, sign in — the permission dialog fires and a real Expo token is registered
5. In Claude Code, call `get_user_context` for your account email, generate a recommendation, call `queue_recommendation`
6. Open [http://localhost:3000/admin/users/\<your-user-id\>](http://localhost:3000/admin)
7. Find the draft notification and click **Approve**
8. The push arrives on your phone within 1–2 seconds; the notification status badge flips to **sent**

#### Option B — Expo Go (verifies app loads, Google sign-in, plans — no push delivery)

**One-time Supabase config (required before Google sign-in works on mobile):**

```
Service: Supabase Dashboard
What: Add mobile redirect URLs to the OAuth allow-list
Where: Authentication → URL Configuration → Additional Redirect URLs
Values to add (one per line):
  lever://**
  exp://**
Why: The mobile app deep-links back to these schemes after Google OAuth
```

1. Open [Supabase Dashboard → Auth → URL Configuration](https://supabase.com/dashboard/project/avzhlaxhopzmrjnmregc/auth/url-configuration)
2. Under **Additional Redirect URLs**, add:
   ```
   lever://**
   exp://**
   ```
3. Save

**Prerequisites:**
- Install [Expo Go](https://expo.dev/go) on your phone (iOS or Android)
- Phone and dev machine must have internet access (tunnel used because WSL2 can't expose a LAN port)

**Start the dev server (run once per session from `mobile/`):**
```bash
cd mobile && npx expo start --tunnel
```

**Get the current tunnel URL (changes each session):**
```bash
curl -s http://localhost:4040/api/tunnels | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])"
```
This gives you something like `https://rn1aos8-marksoulier-8081.exp.direct`.

**Connect your phone:**
Open Expo Go → scan the QR code shown in the terminal, or tap **Enter URL manually** and paste:
```
exp://rn1aos8-marksoulier-8081.exp.direct
```
(Use your actual tunnel hostname from the curl above — it changes each session.)

**What to validate in Expo Go:**

| Step | Expected |
|---|---|
| App loads | Login screen: "lever" logo, "Continue with Google" button, email/password fields |
| Tap "Continue with Google" | Browser opens → Google account picker → select `marksoulkid@gmail.com` |
| After Google approval | Browser closes, app shows plans screen automatically |
| Notification permission | iOS/Android permission dialog appears (tap Allow) |
| Plans screen | Your real plans load with name, projected balance, success % |
| Sign out | Returns to login screen |

**What you CANNOT verify in Expo Go:**
- Actual push delivery (token is a mock in Expo Go SDK 53+)
- Notification banners arriving from the server

**To fully validate push delivery:** use a development build (Option A above).

---

---

## First real user test — 2026-05-30

User: marksoulier0@gmail.com (first external tester). Completed onboarding end-to-end and submitted detailed feedback via UserJot. Key findings (full raw feedback in UserJot request `cmprm344u14xe0ipjcluo5lpx`):

### What worked
- Got through onboarding and created a plan
- Simulator ran and produced numbers quickly ("really fast though")
- Allocation breakdown was visible and somewhat interesting

### Critical issues (new bugs filed)
| New bug | One-line summary |
|---|---|
| B-15 | "Run what if" button on plan widget does nothing |
| B-16 | Onboarding system prompt is visible and confusing; connector name not given upfront |
| B-17 | AI doesn't explain Lever's value or what it's doing during onboarding |
| B-18 | Onboarding assumes salaried income; entrepreneur/variable income badly handled |
| B-19 | Widget renders dark regardless of browser theme |
| B-20 | No progress indicator during onboarding; user got bored halfway |
| B-21 | UserJot requires account to leave feedback — real friction in the feedback loop |

### Confirmed existing bugs
- B-13: Metric cards bare numbers with no context ("not sure how I trust it")
- B-8: Plan is unnamed / auto-named poorly ("it should take my name and name my plan")

### Themes from this session
1. **Connector discovery is too hard.** User named it "finance tool" first. The path (Customize → Connectors → + → Add custom) is buried and not explained.
2. **The AI doesn't feel smarter with Lever.** User expected proactive guidance ("it should be telling me what the optimal decisions are, not asking me"). The value proposition of the MCP connection isn't obvious in the conversation.
3. **Non-standard income is a real use case.** Entrepreneur with variable/stipend income — the model forced a single salary figure and the simulation produced a confusing warning. This demographic is likely a core ICP.
4. **Trust gap in the numbers.** "I thought AI was bad at math and it literally just texted out the numbers." Users need a brief explanation of how the math works or a visible citation.
5. **Claude tool permission prompts are friction.** "It has me allow every time." This is Claude.ai UX, not Lever's — but worth noting as a blocker for less technical users.

### Decision: highest-leverage next fix
B-15 ("Run what if" button does nothing) + B-16 (system prompt UX) are the P1 items to fix next. B-15 is a broken core feature. B-16 is the biggest onboarding friction point confirmed by a real user.

---

## Business health snapshot — 2026-06-02

| Metric | Value | Signal |
|---|---|---|
| Total users | 6 | Mostly test accounts |
| New signups (7 days) | 0 | No organic growth |
| Active subscriptions | 1 | Likely internal |
| Total plans created | 16 | Mostly test/synthetic |
| Real external users | 1 (marksoulier0@gmail.com) | Only real signal we have |
| Last external activity | 2026-05-29 | 4 days ago |

**Verdict:** Pre-growth. Infrastructure works. Product doesn't yet deliver on its core promise.

---

## Strategic direction — 2026-06-02

Full analysis in `docs/STEERING.md` → Business direction. Summary:

**The core problem isn't bugs or polish — it's that the AI doesn't feel smarter with Lever.** The first real user said it plainly: "It should be telling me what the optimal decisions are, not asking me." Right now Claude becomes a form. The product must make Claude into an expert who proactively surfaces findings tied to the user's actual numbers.

### Priority order going forward

**1. Proactive post-onboarding intelligence** ← working on this now
After setup completes, Claude must immediately deliver 2-3 specific findings without being asked. Not "here's your plan." Instead: "Here's what I noticed about your plan that you should know." This is the difference between a calculator and an advisor. Implement as an enriched `get_onboarding_status` completion response that triggers an opportunity scan inline.

**2. Anthropic MCP connector directory submission**
One-click "Connect" removes the 6-step manual connector setup. Long approval lead time — submit now in parallel with code work. Requirements: public MCP URL (live at lever-claude.vercel.app), name, logo, description, contact. Submit at anthropic.com/partners/mcp.

**3. Concierge onboarding for 10 real users**
With 1 external user, patterns aren't visible. Get 10 people from the target demographic (22-40, DIY-minded, has some financial anxiety) through onboarding personally. Be present for each session. The insight density from live observation is 10× higher than post-hoc feedback.

**4. Polish backlog (do alongside #3, not instead of)**
- B-13: Metric card context ("Monthly Income at retirement" not "Monthly Income")
- B-10: Dashboard plan cards so new users see their plan without clicking the sidebar

**Parked until #1-3 are proven:**
- Background monitoring cron
- Monte Carlo simulation
- Additional event types
- Mobile app features beyond current shell

### What Phase 1 completion looks like
- 10+ non-test users have completed onboarding
- 5+ have received a proactive insight they described as genuinely useful
- 3+ have returned without being prompted
- 1+ has paid for premium who isn't the founder

We are not there yet.

---

## Next priorities — active queue

### ~~8. Proactive post-onboarding intelligence~~ ✅ Done (2026-06-02)

When `get_onboarding_status` returns `isComplete: true`, Claude currently just says "you're done." It should instead immediately run an opportunity scan against the user's plan data and deliver 2-3 specific, numbered findings inline — without the user having to ask.

**What to build:**
- Enrich the `get_onboarding_status` completion action to instruct Claude to run the web-search-based opportunity scan automatically
- The scan uses the same prompt as the manual admin recommendation workflow, but delivered inline during onboarding
- Output: 2-3 findings formatted as "Finding 1: [what it is]. [Why it applies to your numbers specifically]. [What to do.]"

**What was built:** Updated the `isComplete` action in `get_onboarding_status` (`app/api/mcp/route.ts`). When all three setup steps are done, Claude now receives explicit instructions to: (1) call `get_plan_data`, (2) run a web search for opportunities relevant to the user's income/age/accounts, (3) deliver 2-3 numbered findings with specific next actions. The summary line was also changed from "Ready to explore" to "Deliver proactive insights now — do not wait for the user to ask." Needs deployment to take effect for real Claude.ai connector users.

---

## Business health snapshot — 2026-06-03

| Metric | Value | Signal |
|---|---|---|
| Total users | 6 | Flat |
| New signups (7 days) | 1 | marksoulier0@gmail.com returned — signed in and created new plan today |
| Active subscriptions | 1 | Unchanged |
| Total plans | 13 | marksoulier0 created "Retire at 55" today |
| External user activity | marksoulier0@gmail.com active 01:04–01:23 UTC today | **Return visit — this is the signal we want** |

**Key finding:** B-25 discovered and fixed this session. When creating the new plan, Claude passed current_balance=8000000 instead of 80000 (misparse of "$80,000"). This would have shown the user a $132M projected balance and $443K/month retirement income — wildly unrealistic and trust-destroying. Corrected in DB and added tool-level sanity check.

---

### 9. Anthropic connector directory submission

Submit Lever to the Anthropic MCP connector directory. No code required — this is a form submission. Long approval lead time so it should happen in parallel with code work.

Requirements:
- Public MCP URL: `https://lever-claude.vercel.app/api/mcp` ✓
- Name: "Lever Financial Planning"
- Description: 1-2 sentences
- Logo: 512×512px
- Contact: founder email
- Submit at: https://anthropic.com/partners/mcp

---

## Known issues to fix before production

| Issue | Severity | Fix |
|---|---|---|
| Stripe Checkout requires cardholder name + ZIP (not documented in test flow) | Low | Always fill "Demo User" and "10001" in playwright tests |
| Scenario widget slider range was capped at 72 — retirement ages up to 80 now supported | Fixed 2026-05-26 | Extended `min=50` `max=80` in SliderRow; `ontoolresult` wires sliders to real plan data |
| `get_onboarding_status` still referenced "go to dashboard" in action string | Fixed 2026-05-21 | Updated to reference `create_plan` tool |
| Google OAuth redirect doesn't reliably return to Expo Go on iOS — Safari opens instead of handing back to the app | Low | Use email/password login for Expo Go testing; full OAuth works in a dev build |
| No Jest tests for financial math functions | Medium | Add discrete tests for `projectBalance`, `resolveContextDefaults`, `ageFromDOB` |

---

## Testing discipline

- **After every route or API change:** run the MCP handshake + tools/list + tool call curl sequence
- **After every UI change:** open playwright, sign in via `/api/test-auth`, screenshot, check `console` for 0 errors
- **After every DB migration:** verify the column/table exists with a follow-up query; run `get_advisors`
- **TypeScript:** run `npx tsc --noEmit` before every visual check — catches type errors that won't show up in the browser until runtime
- **Never report a task complete without running all three checks** (MCP if applicable, visual if applicable, TypeScript always)
- **Learnings from past mistakes go into this document** — not just memory, not just comments in code. If a decision was non-obvious or a mistake was made, write it here so it is not repeated in a future session.
