# Test credentials

| Email | Password | Role | Notes |
|---|---|---|---|
| `demo@lever.dev` | `demo1234` | Standard user | Use for most playwright tests — no admin access |
| `admin@lever.dev` | `admin1234` | Admin | Accesses `/admin`; use for admin panel tests |

Sign in via: `GET /api/test-auth?email=<email>&password=<password>` — sets auth cookies server-side and redirects to `/dashboard`.

---

# Session direction

At the start of every session, after running the startup checklist, run the business health snapshot from `STARTUP.md` — user activity (Supabase), revenue (Stripe MCP), and user feedback (UserJot MCP). Then read `PROGRESS.md` for the documented priority order.

Based on those inputs, **propose the single highest-leverage next task** with a one-sentence rationale. Do not wait for the user to direct you. If the user says "startup" or "let's get started", this is the expected workflow.

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Definition of done

A task is not finished until all three checks below pass. Do not report work as complete, summarise results, or ask what to do next until you have run them.

## 1. MCP tools — required after any change to `app/api/mcp/route.ts` or `lib/store.ts`

Start the dev server if it isn't running (`npm run dev`), then verify every tool that was added or changed responds correctly. Use the MCP streamable HTTP transport — the `Accept` header must include both `application/json` and `text/event-stream` or the server rejects the request.

**Handshake (always run first):**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
```
Expected: SSE event containing `"protocolVersion"` and `"capabilities"`.

**Tool list (confirm all tools are registered):**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```
Expected: every tool you added or changed appears by name in the `tools` array.

**Tool call (call each changed tool with representative input):**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"<tool_name>","arguments":{<args>}}}'
```
Expected: a `data:` line containing `"result"` with non-empty `content`.

A build that compiles is not sufficient — tools must respond correctly at runtime.

## 2. Visual UI — required after any change to a page, component, or global style

Use the `playwright-cli` skill to open the affected pages in a real browser and confirm the golden path renders correctly. Always check for console errors too.

`playwright-cli` is installed globally. Firefox and Chromium are both available. Default to Firefox; fall back to Chromium if Firefox fails.

```bash
playwright-cli open --browser=firefox http://localhost:3000/<changed-route>
playwright-cli snapshot        # read the page structure
playwright-cli console         # check for JS errors — must be 0 errors
playwright-cli close
```

Check:
- The page renders without a blank screen or visible error
- Key elements are present (headings, data, buttons)
- `console` reports **0 errors** (warnings are acceptable)
- Navigate to at least one linked page to catch broken routing

For widget pages (`/plan-widget`, `/scenario-widget`) a visual check is sufficient — the MCP iframe interaction is tested separately via the tool call check above.

Do not skip this check. Do not report the task complete without running it.

### Testing the mobile app (Expo web export)

Playwright cannot test the native app directly. Use the Expo web export — the same React Native code compiled to run in a browser.

**When to run this:** any change to files under `mobile/`.

**What it covers:** auth, Supabase data loading, navigation state, component rendering. It does NOT cover native gestures, `Platform.OS === "ios"` branches, or native modules.

**Step 1 — build** (run once per code change, from `mobile/`):
```bash
cd /home/yocto/work/lever-claude/mobile && npx expo export --platform web
```

**Step 2 — serve** (keep running across test runs):
```bash
npx serve /home/yocto/work/lever-claude/mobile/dist --listen 8081 > /tmp/expo-web.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/   # must return 200
```

**Step 3 — test sequence:**
```bash
playwright-cli open --browser=firefox http://localhost:8081/
playwright-cli console   # Errors: 0
playwright-cli snapshot  # expect: logo "lever", Email textbox, Password textbox, Sign in button

# Sign in — note: use fill directly, NOT the /api/test-auth route (that's web-only)
playwright-cli fill "getByRole('textbox', { name: 'Email' })" "demo@lever.dev"
playwright-cli fill "getByRole('textbox', { name: 'Password' })" "demo1234"
playwright-cli click "getByText('Sign in')"
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"

playwright-cli console   # Errors: 0
playwright-cli snapshot  # expect: logo, "Sign out" button, plan cards

playwright-cli click "getByText('Sign out')"
playwright-cli run-code "async page => { await page.waitForTimeout(1500); }"
playwright-cli snapshot  # expect: login screen returned

playwright-cli close
```

**Auth note:** the `/api/test-auth` server-side sign-in route is web-only (`localhost:3000`). The Expo web build uses the Supabase client directly — fill email/password in the UI as shown above.

**Maestro (native testing) — future:** Maestro has an MCP server (`claude mcp add maestro -- maestro mcp`) and would give direct native device control. Blocked on WSL2 for now — see README → Developer tools → Maestro for the full picture.

### Logging in during playwright tests

The app requires authentication. Use the dev-only sign-in route to bypass the browser auth flow — it does the exchange server-side, avoiding Firefox/WSL CORS issues with Supabase's auth API.

**Demo credentials (local dev only):**

| Email | Password | Notes |
|---|---|---|
| `demo@lever.dev` | `demo1234` | Standard demo user — use for most tests |

**Sign in and save state (run once per session):**

```bash
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"
# The route exchanges credentials server-side, sets auth cookies, and redirects to /dashboard.
playwright-cli state-save .playwright-cli/auth.json
playwright-cli close
```

**Reuse saved state (all subsequent tests in the session):**

```bash
playwright-cli open --browser=firefox http://localhost:3000
playwright-cli state-load .playwright-cli/auth.json
playwright-cli goto http://localhost:3000/dashboard
# Now authenticated — no login prompt
```

**Verify you are authenticated before testing a protected page:**

```bash
playwright-cli eval "window.location.pathname"  # must return "/dashboard", not "/login"
```

**Notes:**
- `.playwright-cli/auth.json` is gitignored — each developer creates it locally
- The saved state expires when the Supabase session expires (default 1 hour). Re-run the state-save block if you get redirected to `/login`
- `GET /api/test-auth` returns 404 in production — it only exists in `NODE_ENV=development`
- Never use real user credentials in test flows — always use the demo account
- After signing out in a test, `auth.json` is stale — always re-run the state-save block before the next test run

### Full test run — standard sequence

Run this sequence to verify the full app after any significant change. Each step is a discrete check.

```bash
# ── 0. Setup ────────────────────────────────────────────────────────────────
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"
playwright-cli state-save .playwright-cli/auth.json

# ── 1. Dashboard ─────────────────────────────────────────────────────────────
# Expect: user email in header, sign-out button, plans list, 0 console errors
playwright-cli console   # Errors: 0
playwright-cli snapshot  # confirm email, "Your plans" heading, plan cards present

# ── 2. Create plan — happy path ──────────────────────────────────────────────
playwright-cli click "getByRole('button', { name: '+ New plan' })"
playwright-cli fill "getByLabel('Plan name')" "Smoke Test Plan"
playwright-cli fill "getByLabel('Target retirement age')" "65"
playwright-cli fill "getByLabel('Monthly contribution ($)')" "3000"
playwright-cli click "getByRole('button', { name: 'Create plan' })"
# Expect: navigates to /plan/<uuid>
playwright-cli eval "window.location.pathname"   # must start with /plan/

# ── 3. Plan detail ───────────────────────────────────────────────────────────
# Expect: plan name, metrics cards, allocation bars, 0 errors
playwright-cli console   # Errors: 0
playwright-cli snapshot  # confirm heading, Projected balance, Probability of success

# ── 4. Contribution recalculate ──────────────────────────────────────────────
playwright-cli triple-click "getByRole('spinbutton')"
playwright-cli fill "getByRole('spinbutton')" "5000"
playwright-cli click "getByRole('button', { name: 'Recalculate' })"
# Expect: result cards appear with updated values, 0 errors
playwright-cli console   # Errors: 0
playwright-cli snapshot  # confirm Projected balance, Success probability, Monthly income cards

# ── 5. Navigation ────────────────────────────────────────────────────────────
playwright-cli click "getByRole('link', { name: 'Dashboard' })"
playwright-cli eval "window.location.pathname"   # must be /dashboard

# ── 6. Sign out ──────────────────────────────────────────────────────────────
playwright-cli click "getByRole('button', { name: 'Sign out' })"
playwright-cli eval "window.location.pathname"   # must be /login

# ── 7. Redirect after sign-out ───────────────────────────────────────────────
playwright-cli goto http://localhost:3000/dashboard
playwright-cli eval "window.location.pathname"   # must be /login (redirected)

playwright-cli close
```

### Edge case tests — run via curl (server validation, no browser needed)

These test server-side Zod validation directly, bypassing browser HTML constraints.

```bash
BASE="http://localhost:3000"

# Age at boundary: must be > 41, so 41 must fail
curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"x","retirementAge":41,"monthlyContribution":500}' | grep error
# Expect: "retirementAge must be greater than current age (41)"

# Negative contribution
curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"x","retirementAge":65,"monthlyContribution":-1}' | grep error
# Expect: "monthlyContribution must be positive"

# Whitespace-only name
curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"   ","retirementAge":65,"monthlyContribution":500}' | grep error
# Expect: "name must not be empty"

# Malformed JSON
curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d 'not json' | grep error
# Expect: "Request body must be JSON"

# Missing field
curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"x"}' | grep error
# Expect: "retirementAge must be a number"

# PATCH without auth
curl -s -X PATCH "$BASE/api/plans/00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{"monthlyContribution":500}' | grep error
# Expect: "Unauthorized"
```

### Database verification — confirm UI matches DB after tests

After running the full test run, verify the created plan persisted correctly:

```
mcp__supabase__execute_sql
query: "select name, monthly_contribution, projected_balance, success_probability from plans where name = 'Smoke Test Plan'"
```

Confirm:
- Row exists with the correct `name`
- `monthly_contribution` matches the recalculated value (e.g., 5000 if you changed it)
- `projected_balance` and `success_probability` match what the UI showed after recalculate

### Known issues found in testing

| Issue | Observed | Severity |
|---|---|---|
| Dashboard metrics cards are hardcoded | "Portfolio value: $487,200" never updates | Low — cosmetic until auth wires user-specific data |
| Plans from other users visible | Dev RLS read policy shows all plans regardless of owner | Medium — drop dev policies before production |
| Saved playwright auth expires after 1 hour | state-load brings back stale cookies after session expiry | Expected — re-run state-save |
| Firefox/WSL can't call Supabase auth API from browser | CORS blocks email/password in Firefox on WSL | Workaround: use /api/test-auth route |
| Stripe webhook forwarder must be started manually | Without `stripe listen`, `checkout.session.completed` never reaches the app; subscription row never written; what-if panel stays locked forever | Run `~/.local/bin/stripe listen --forward-to localhost:3000/api/stripe/webhook` in a second terminal before testing checkout |
| Stripe CLI API version mismatch | CLI sends events at `2023-10-16`; SDK retrieves objects at `2026-04-22.dahlia`; `current_period_end` field location differs across versions | Handled in webhook via `(item as any).current_period_end ?? (sub as any).current_period_end` fallback |
| What-if scenarios absent for non-standard retirement ages | `scenariosByRetirementAge` only has entries for 60 and 65; premium users with other ages see unlocked panel but no content | Add age to the static record, or migrate to a DB-backed scenarios table |
| Stripe Checkout requires cardholder name and ZIP | Not documented in old test flow — `4242...` card alone is insufficient; submit will stay on checkout page silently | Always fill name ("Demo User") and ZIP ("10001") when testing checkout with Playwright |

## 3. Documentation — required after any change that affects how the app works

Update `README.md` to reflect what changed. Do this before the final commit, not as an afterthought.

**Update the README when you:**
- Add, rename, or remove a route → update the Routes table
- Add, rename, or remove an API endpoint → update the Routes table and any relevant section
- Add, change, or remove an MCP tool → update the MCP tools table and the tool descriptions
- Change how the app is deployed, configured, or run locally → update the relevant Deployment or Local development section
- Add a new dependency or remove one → update the stack list if it appears there
- Change the project file structure meaningfully → update the Project structure tree
- Fix a known limitation → remove it from the Known limitations table
- Introduce a new known limitation → add it

**Do not update the README when you:**
- Refactor internals with no user-visible effect
- Fix a bug that doesn't change any documented behaviour
- Change test or tooling config that isn't referenced in the README

**What good documentation looks like:**
- Accurate: matches what the code actually does right now, not what it did before
- Specific: route tables have real paths, stack lists have real package names
- Honest: known limitations are listed, not hidden

Do not invent placeholder text ("coming soon", "TODO"). If something isn't built yet, either omit it or list it in Known limitations.

## 4. Off-codebase configuration — required after any change that touches an external service

This project depends on services configured outside the codebase: Supabase Dashboard, Google Cloud Console, Vercel. Configuration that lives only in a browser dashboard is invisible to anyone joining later — it is the hardest knowledge to rediscover and the most common source of "it works on my machine" failures.

**Document external configuration whenever you:**
- Enable, disable, or configure an auth provider (Google, GitHub, etc.)
- Add or change redirect URLs or Site URL in Supabase Auth settings
- Add, rotate, or scope an API key or secret
- Change a Vercel environment variable
- Create or modify a Google Cloud OAuth app, service account, or IAM role
- Enable a Supabase extension or change a database setting
- Set up a webhook, cron job, or edge function with external dependencies

**What the documentation must include for each external service:**

```
Service: [Google Cloud Console / Supabase Dashboard / Vercel / etc.]
What was configured: [specific setting — be exact, not vague]
Where to find it: [Dashboard → Section → Subsection]
Value or format: [the exact value, or the format if it's a secret]
Why it's needed: [one sentence — what breaks without it]
Linked to: [the code file that consumes this config]
```

**Where it goes:** add it to the relevant section in `README.md`. If no section exists, create one. Never leave external configuration documented only in chat, a ticket, or memory.

**If you cannot complete the external configuration yourself** (e.g. requires browser login to a third-party dashboard), document exactly what steps the developer must take manually — with the exact navigation path, the exact values to enter, and which step to do first. Do not leave the developer to infer it from the code.

**Example — correct:**
> Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → Authorised redirect URIs → add `https://[project-ref].supabase.co/auth/v1/callback`

**Example — not acceptable:**
> "Configure Google OAuth in the usual way."

## 5. Production database sync — required before any deploy that includes a schema change

Code and schema must move to production together. Deploying code that references a column, table, or policy that does not yet exist in the production database causes runtime errors that are invisible in development.

**Run this checklist before every deploy that includes a migration:**

### Step 1 — audit for dev policies

Dev policies bypass row-level ownership and must never exist in production. Run this query against the production Supabase project:

```sql
select policyname, cmd from pg_policies
where tablename = 'plans'
  and policyname like 'dev:%';
```

**If this returns any rows: stop. Do not deploy.** Drop the dev policies first:

```sql
drop policy "dev: allow anonymous reads" on plans;
drop policy "dev: allow inserts" on plans;
drop policy "dev: allow updates" on plans;
```

### Step 2 — compare migration history

List migrations applied to the dev project:
```
mcp__supabase__list_migrations
```

Then connect to the production project and run the same command. Any migration present on dev but absent from production must be applied before the code deploy.

Apply them in chronological order (oldest first — migration names are timestamped):
```
mcp__supabase__apply_migration  name="<migration_name>"  query="<sql>"
```

### Step 3 — verify production schema

After applying migrations, confirm the tables and columns the new code depends on actually exist in production:
```
mcp__supabase__list_tables  schemas=["public"]  verbose=true
```

Check that every column referenced in the new code is present. If a column is missing, the migration was not applied or failed silently.

### Step 4 — run get_advisors on production

```
mcp__supabase__get_advisors
```

This flags missing RLS, policy gaps, and missing indexes that appeared as a result of the new migration. Fix any critical advisories before the deploy lands.

### The two-project model

Currently the app uses one Supabase project for both development and production. See README → Deployment → Database environments for the plan to split into `lever-dev` and `lever-prod`. Until that split happens:

- All migrations run against the same project — apply them carefully
- Dev policies exist on the same database real users query — drop them before any user other than yourself signs up
- The production deploy checklist above applies on every push to main that includes a migration

---

# Environment variables — safety rules

**Before every commit and before every deployment, verify these rules are met. No exceptions.**

## What is safe vs. what is not

| Variable | Safe to commit? | Safe in `NEXT_PUBLIC_`? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No — use `.env.example` as template | Yes | Project address, not a secret, but keep out of git |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No — use `.env.example` as template | Yes | Publishable by design — RLS controls access, not key secrecy |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | **Never** | Bypasses RLS entirely — required by Stripe webhook handler locally and on Vercel |
| `STRIPE_SECRET_KEY` | **Never** | **Never** | Server-only Stripe API key (`sk_test_...` locally, `sk_live_...` on Vercel) |
| `STRIPE_WEBHOOK_SECRET` | **Never** | **Never** | Signing secret from `stripe listen` (local) or Stripe Dashboard webhook settings (prod) |

## Pre-commit checklist

Before `git commit`, run:

```bash
git diff --staged | grep -iE "(service_role|supabase_service|sbp_|eyJhbGci|sk_test_|sk_live_|whsec_)"
```

If that returns any output, stop — you are about to commit a secret. Unstage the file and move the value to `.env.local`.

## Rules

- **`.env.local` is the only place real values live.** It is gitignored by the `.env*` rule in `.gitignore`. Never rename it to `.env` or `.env.development` — those are not gitignored.
- **`.env.example` is the committed template.** It contains placeholder values only — no real keys, no real URLs. Keep it up to date when new variables are added.
- **Never add `SUPABASE_SERVICE_ROLE_KEY` to any `NEXT_PUBLIC_` variable.** `NEXT_PUBLIC_` values are inlined into the browser bundle at build time. The service role key in the browser means any user can bypass RLS and read or delete any row in your database.
- **Set secrets in Vercel, not in code.** Vercel Dashboard → Project → Settings → Environment Variables. Mark them as server-only (do not tick "Browser"). They are injected at runtime and never appear in the client bundle.
- **If a secret is accidentally committed**, rotate it immediately — assume it is compromised. Generate a new key in Supabase Dashboard → Project Settings → API → Rotate. A git history rewrite does not help; the key was already exposed the moment it was pushed.

---

# Supabase — database operations

Claude Code connects to Supabase through an MCP server declared in `.mcp.json`. When the server is active, a set of `mcp__supabase__*` tools are available directly in the conversation — no separate CLI, no manual SQL client.

**Do not run bare SQL in a `bash` block against Supabase.** Use the tools below. They go through the MCP server, respect your project ref, and are auditable in the migration history.

## Which tool to use for which job

| Task | Tool | Notes |
|---|---|---|
| Create or alter a table, index, trigger, function | `mcp__supabase__apply_migration` | DDL only — recorded in migration history |
| Query data, insert/update/delete rows, inspect policies | `mcp__supabase__execute_sql` | Ad-hoc SQL — not recorded as a migration |
| See all tables and columns | `mcp__supabase__list_tables` | Pass `verbose: true` for column detail |
| See migration history | `mcp__supabase__list_migrations` | Shows every applied migration by name and date |
| Check security advisors and perf warnings | `mcp__supabase__get_advisors` | Run this after any schema change |
| Pull runtime logs | `mcp__supabase__get_logs` | Pass a service name (`api`, `postgres`, `edge`) |
| Generate TypeScript types from current schema | `mcp__supabase__generate_typescript_types` | Run after any schema change that affects the app |
| Get the project's public URL | `mcp__supabase__get_project_url` | Use when wiring up the Supabase client |
| Get the anon/publishable API key | `mcp__supabase__get_publishable_keys` | Use when wiring up the Supabase client |
| List installed Postgres extensions | `mcp__supabase__list_extensions` | |
| Search Supabase docs | `mcp__supabase__search_docs` | Useful when you're unsure of an API or feature |

## snake_case ↔ camelCase convention

Postgres uses snake_case column names. JavaScript uses camelCase. These must never mix inside the app.

**The rule:** translate at the boundary, once, using `planFromRow()` in `lib/supabase/mappers.ts`. Everything inside the app uses camelCase. Nothing outside the mapper ever reads a snake_case field.

```
Supabase row          │  planFromRow()           │  App (components, API responses)
─────────────────────────────────────────────────────────────────────────────────
target_balance        │  →  targetBalance        │
success_probability   │  →  successProbability   │
monthly_contribution  │  →  monthlyContribution  │
```

**Where to call the mapper:**
- API route GET handlers — map before `Response.json()`
- Server Components that fetch plans — map before passing to JSX
- Never in Client Components — they receive already-mapped data via props or API responses

**When you add a column to the `plans` table:**
1. Add it to `DbPlanRow` in `lib/supabase/mappers.ts`
2. Add the mapping line in `planFromRow()`
3. Add it to the `Plan` type in `lib/store.ts` if the app needs it

**When generated types are ready:**
Replace the hand-written `DbPlanRow` in `lib/supabase/mappers.ts` with the generated `Database["public"]["Tables"]["plans"]["Row"]` type. The `planFromRow()` function body stays the same.

## Common tasks

**Inspect the schema:**
```
mcp__supabase__list_tables  schemas=["public"]  verbose=true
```

**Read data or check a query before committing it:**
```
mcp__supabase__execute_sql  query="select * from plans limit 5"
```

**Check RLS policies on a table:**
```
mcp__supabase__execute_sql  query="select * from pg_policies where tablename = 'plans'"
```

**List all users (from auth schema):**
```
mcp__supabase__execute_sql  query="select id, email, created_at from auth.users limit 20"
```

**Apply a schema change (DDL):**
```
mcp__supabase__apply_migration  name="add_notes_to_plans"  query="alter table plans add column notes text"
```
Always use `apply_migration` for DDL — never `execute_sql`. Migration names must be snake_case and descriptive; they become the permanent record of what changed and when.

**Regenerate TypeScript types after a schema change:**
```
mcp__supabase__generate_typescript_types
```
Copy the output into `lib/database.types.ts` (create it if it doesn't exist). Import from there in any file that queries Supabase.

**Check for security or performance issues:**
```
mcp__supabase__get_advisors
```
Run this after every migration. It will flag missing RLS, unused indexes, and other common problems.

## How the connection is configured

The connection is declared in `.mcp.json` at the repo root:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=<your-project-ref>",
      "headers": { "Authorization": "Bearer <your-pat>" }
    }
  }
}
```

- **`project_ref`** — found in Supabase Dashboard → Project Settings → General. Tells the MCP server which database to target.
- **`Authorization` Bearer token** — a Personal Access Token from Supabase Dashboard → Account → Access Tokens. Proves ownership of the account.

**Security:** the Bearer token grants access to all Supabase projects under your account. Never commit it to git. Keep the `supabase` entry in your user-level Claude config (`~/.claude/mcp.json`) rather than in the project `.mcp.json`, which is committed.

---

# MCP server testing

The Lever MCP server exposes three tools to Claude: `show_financial_plan`, `run_what_if`, and `update_contribution`. There are three levels of testing, each catching a different class of bug.

## Level 1 — Protocol test (is the server alive?)

Tests the HTTP layer only. No LLM involved. Run after any change to `app/api/mcp/route.ts`.

**What to ask Claude Code:**
> "Run the MCP handshake and tools list against local" — or — "against prod"

Claude will run:

```bash
# 1. Handshake — confirms the server speaks MCP
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'

# 2. Tool list — confirms all tools are registered
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

For prod, swap `http://localhost:3000` with `https://lever-claude.vercel.app`.

**What to check:** `initialize` response contains `"protocolVersion"`. Tool list contains `show_financial_plan`, `run_what_if`, and `update_contribution` by name.

## Level 2 — Tool execution test (do the tools return real data?)

Claude Code has direct access to the Lever MCP tools via `.mcp.json`. It can call them the same way Claude.ai would, and inspect the raw result. This is the most useful level for day-to-day development.

**What to ask Claude Code:**
> "Call all three Lever MCP tools and verify the output"

Or target a specific tool:
> "Call `show_financial_plan` and show me what it returns"
> "Call `update_contribution` with monthlyContribution 4500 and check the result"
> "Call `run_what_if` and tell me if the response looks correct"

**What Claude checks for each tool:**
- Returns a non-empty result (not `null`, not `{}`, not an error object)
- Data matches what is in Supabase — not stale hardcoded values from `lib/store.ts`
- Numeric fields are numbers, not strings
- The `show_financial_plan` and `run_what_if` tools return a `_meta.ui.resourceUri` for the iframe widget

**Tools available to Claude Code (from `.mcp.json`):**
```
mcp__claude_ai_Lever_Business__show_financial_plan
mcp__claude_ai_Lever_Business__run_what_if
mcp__claude_ai_Lever_Business__update_contribution
```

## Level 3 — Conversational flow test (does the LLM call the right tool?)

This is the full end-to-end: a user says something → the LLM decides which tool to call → the tool runs → the LLM responds with the result. Claude Code cannot simulate this itself — it is the LLM.

**Option A — Manual (test in Claude.ai):**
Add the connector, then say:
```
"Show me my financial plan"              → expect: show_financial_plan called
"Run a what-if scenario"                 → expect: run_what_if called
"Update my monthly contribution to 4500" → expect: update_contribution called
```

**Option B — Automated (Claude API test script):**
> "Build a Claude API test script that sends 'show me my financial plan' and asserts that show_financial_plan was called"

Claude will use the `claude-api` skill to build a script that sends the prompt via the Anthropic SDK with the MCP tools declared, then checks that the correct tool was invoked with valid arguments.

## User persona simulation

To test the workflow as a real user would experience it — not as a developer — ask Claude Code to roleplay a persona while using playwright-cli and the MCP tools together.

**What to ask:**
> "Act as a first-time user who just signed up. Walk through creating a plan, exploring the detail page, and running a what-if scenario. Tell me where you got confused or where the UI broke."

> "Act as a user who contributed $500/month less than planned. Use the contribution form and MCP tools to understand the impact."

Claude will use playwright-cli to navigate the UI, call MCP tools to interact with the data layer, and report observations as the persona — surfacing gaps between what the UI promises and what actually happens.

**Modern tools for this (beyond Claude Code):**

| Tool | What it does | Best for |
|---|---|---|
| [Stagehand](https://github.com/browserbase/stagehand) | LLM-controlled browser — give it a goal in plain English, it figures out the clicks | AI-driven exploratory testing |
| [browser-use](https://github.com/browser-use/browser-use) | Open-source Python library — LLM agents that control a real browser | Scripted persona workflows |
| [Shortest](https://github.com/anti-work/shortest) | AI end-to-end testing — write tests in plain English, runs them in a browser | Regression testing without writing selectors |
| [Magnitude](https://magnitude.run) | AI-first E2E test platform — natural language test cases, visual diffing | Teams wanting a hosted AI test runner |
| playwright-cli + Claude Code | What this project uses — browser automation with AI interpretation | Right now, no extra setup |

For this project at MVP stage, playwright-cli + Claude Code persona prompts is the right tool — no extra infrastructure, no new accounts. Graduate to Stagehand or Shortest when you want tests that run automatically in CI without Claude Code being in the loop.

---

# Data fetching rules

Apply these rules to every `fetch` call and every `useEffect` that loads data. Do not skip any of them to keep code shorter — each one prevents a real class of bug.

## fetch — all four failure modes must be handled

```ts
// Required pattern for every fetch call
async function load() {
  try {
    const response = await fetch("/api/something");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);   // bad status — fetch does NOT throw for 4xx/5xx
    }

    const data = await response.json();             // can throw if body isn't valid JSON
    return data;
  } catch (err) {
    // surface the error visibly — never silently swallow it
    throw err;
  }
}
```

The four cases and why each must be covered:

| Case | What happens without handling | Required handling |
|---|---|---|
| Network failure | Unhandled rejection crashes the component | `try/catch` around the whole block |
| Bad status (4xx/5xx) | `fetch` fulfills — the bug is invisible | Check `response.ok` and throw |
| Malformed JSON | `response.json()` throws — same `try/catch` catches it | Already covered by outer `try/catch` |
| Component unmounts | State update on dead component causes stale data bugs | See cleanup rule below |

## Loading state — always account for the gap

When data comes from outside the component there is always a gap between mount and arrival. During that gap the data is not there yet. Never assume it will be instant.

Every section that fetches must handle all three moments explicitly:

| Moment | State | What to render |
|---|---|---|
| Request in flight | `loading: true` | Skeleton that matches the shape of the real content |
| Request failed | `error: string` | Visible error box — not a console log, not empty space |
| Data arrived | `loading: false, error: null` | The real content |

**Skeleton rules:**
- Match the height and layout of the real content so the page does not jump when data arrives
- Use `bg-zinc-100` placeholder blocks sized to the text/elements they replace
- Two skeleton rows for a list, one block per card, matching padding of the real cards
- Do not use a spinner for list content — spinners give no sense of how much space the result will take

```tsx
// skeleton for a list of cards
{plansLoading && !plansError && (
  <div className="flex flex-col gap-3">
    {[0, 1].map((i) => (
      <div key={i} className="rounded-2xl border border-zinc-100 px-6 py-5 shadow-sm flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-36 rounded bg-zinc-100" />
          <div className="h-3 w-48 rounded bg-zinc-100" />
        </div>
        <div className="h-3 w-24 rounded bg-zinc-100" />
      </div>
    ))}
  </div>
)}
```

**Never do this:**
- Render nothing while loading — blank space looks broken
- Render `null` for the section — layout shifts when data arrives
- Use loading state to guard the whole page return — only the fetched section should show a skeleton, the rest of the page renders immediately

## Visible errors — never use console.log as the only signal

Errors must be visible in the UI during development, not just in the console. Use an `error` state and render it on screen:

```ts
const [data, setData] = useState(null);
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

// In the render:
if (error) return <p style={{ color: "red" }}>Error: {error}</p>;
if (loading) return <p>Loading…</p>;
```

A `console.error` is acceptable in addition to a visible error state, never instead of one.

## useEffect — check every dependency array for infinite loop risk

Every `useEffect` that fetches data must have an explicit dependency array. Missing or wrong dependencies cause infinite fetch loops.

```ts
// ✓ runs once on mount
useEffect(() => { load(); }, []);

// ✓ runs when planId changes
useEffect(() => { load(planId); }, [planId]);

// ✗ no dependency array — runs after every render, causes infinite loop
useEffect(() => { load(); });
```

Before writing any `useEffect`, answer: "what value changing should re-trigger this?" If the answer is "nothing — just run once", the array is `[]`. If it depends on a prop or state variable, that variable goes in the array. If you find yourself putting a function or object in the array, memoize it first with `useCallback`/`useMemo` or the effect will still re-run every render.

## useEffect — cancel stale requests on unmount

When a component unmounts before a fetch finishes, the callback will try to call `setState` on a dead component. Use a cancelled flag to guard it:

```ts
useEffect(() => {
  let cancelled = false;

  async function load() {
    try {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!cancelled) setData(data);       // only update if still mounted
    } catch (err) {
      if (!cancelled) setError((err as Error).message);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  load();
  return () => { cancelled = true; };     // cleanup: flip the flag on unmount
}, []);
