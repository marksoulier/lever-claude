# lever

A financial planning tool with an AI-powered Claude integration. Play out financial decisions — retirement timelines, contribution rates, what-if scenarios — before you make them.

This repository contains two apps that share the same Supabase backend:
- **Web** (`/`) — Next.js 16, deployed on Vercel
- **Mobile** (`/mobile/`) — Expo 54 (React Native), deployed via EAS

---

## Quick reference

| | URL |
|---|---|
| **Web app + MCP server (production)** | https://lever-claude.vercel.app |
| **MCP endpoint (production)** | https://lever-claude.vercel.app/api/mcp |
| **Local dev (web)** | http://localhost:3000 |
| **MCP endpoint (local)** | http://localhost:3000/api/mcp |
| **Mobile app** | Expo Go — scan QR from `npx expo start` inside `mobile/` |

---

## Architecture

This is a single Next.js application that serves both the web UI and the MCP server from one deployment.

```
lever-claude/
├── app/
│   ├── (app)/                ← Protected shell (collapsible sidebar layout)
│   │   ├── layout.tsx        ← Sidebar shell — wraps all authenticated pages
│   │   ├── Sidebar.tsx       ← Collapsible left panel: primary plan, what-if scenarios, user button
│   │   ├── UserModal.tsx     ← Profile / subscription / sign-out modal
│   │   ├── dashboard/        ← Net worth overview, accounts, snapshot log
│   │   └── plan/[id]/        ← Plan detail — metrics, allocation, what-if, set-as-primary
│   ├── api/mcp/route.ts      ← MCP server (Next.js route handler)
│   ├── api/net-worth/        ← GET/POST net worth snapshots
│   ├── plan-widget/          ← Interactive plan UI (rendered in Claude iframe)
│   ├── scenario-widget/      ← Interactive scenario modeler (rendered in Claude iframe)
│   └── ...                   ← Public pages (login, connect, auth callback)
├── lib/store.ts              ← Plan type + projection math
├── lib/supabase/mappers.ts   ← snake_case → camelCase translation at the DB boundary
├── baseUrl.ts                ← Resolves public URL from env (Vercel or local)
└── proxy.ts                  ← Global CORS headers (Next.js 16 middleware)
```

The MCP server is a standard Next.js API route — no separate process, no separate deployment. Vercel runs it as a serverless function alongside the web pages.

**Interactive UIs** use the [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview). When Claude calls `show_financial_plan` or `run_what_if`, the route self-fetches the rendered `/plan-widget` or `/scenario-widget` page and serves it as a sandboxed iframe resource. The iframe communicates back to the MCP server bidirectionally through Claude.

---

## Environments

| Environment | URL | MCP endpoint |
|---|---|---|
| **Local dev** | `localhost:3000` | `localhost:3000/api/mcp` |
| **Preview** | Vercel preview URL (per PR) | `<preview-url>/api/mcp` |
| **Production** | `lever-claude.vercel.app` | `lever-claude.vercel.app/api/mcp` |

**Auto-deploy:** Vercel watches `main`. Every `git push` to `main` rebuilds and redeploys both the web app and MCP server automatically within ~60 seconds.

**Preview deployments:** Every pull request gets its own Vercel preview URL with a working MCP endpoint.

---

## Prerequisites

- **Node.js 18+** (v24 recommended — `node --version` to check)
- **npm 9+**
- A GitHub account connected to Vercel

---

## Local development

One terminal is all you need:

```bash
npm install
npm run dev
```

Starts the web app and MCP server together at **http://localhost:3000**.

### Claude Code connector (local)

`.mcp.json` at the repo root points Claude Code to your local MCP server:

```json
{
  "mcpServers": {
    "lever": {
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```

Start `npm run dev` first, then restart Claude Code if it doesn't pick it up automatically. You can then say *"show me my financial plan"* and the tools will call your local server.

### Environment variables

Copy `.env.example` to `.env.local` and fill in your values. `.env.local` is gitignored — never commit it.

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Safe in browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → Publishable key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Management API or Dashboard → Project Settings → API → service_role | **Never** |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (`sk_test_...` for test mode) | **Never** |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen` once and copy the `whsec_...` it prints on startup | **Never** |

**`SUPABASE_SERVICE_ROLE_KEY` is required locally** for the Stripe webhook handler — it writes subscription records server-side using the admin client (bypasses RLS so the webhook can write regardless of who the current user is). For production, set it in Vercel Dashboard → Project → Settings → Environment Variables as a server-only variable (never `NEXT_PUBLIC_`).

**`STRIPE_SECRET_KEY`** — the Stripe CLI stores its session at `~/.config/stripe/config.toml`. The test mode key is readable there if you've run `stripe login`. Never commit it.

**Pre-commit check** — run this before every commit:
```bash
git diff --staged | grep -iE "(service_role|supabase_service|sbp_|eyJhbGci|sk_test_|sk_live_|whsec_)"
```
Any output means a secret is staged. Unstage the file and move the value to the right place:

| Pattern | What it is | Where it belongs |
|---|---|---|
| `sbp_` | Supabase Personal Access Token | `~/.claude/mcp.json` (user-level, never committed) |
| `service_role` / `eyJhbGci` | Supabase service role key | `.env.local` |
| `sk_test_` / `sk_live_` | Stripe secret key | `.env.local` |
| `whsec_` | Stripe webhook signing secret | `.env.local` |

### Stripe webhook forwarding (local dev)

Stripe webhooks can't reach `localhost` without a forwarder. Run this in a second terminal alongside `npm run dev`:

```bash
~/.local/bin/stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` it prints on startup into `.env.local` as `STRIPE_WEBHOOK_SECRET`. Restart the dev server once after adding it — Next.js only reads env vars at startup.

The forwarder must be running for `checkout.session.completed` and `customer.subscription.*` events to reach the app and write subscription records to Supabase.

For local testing of iframe UIs inside Claude (which loads widgets from an HTTPS URL), set a tunnel URL:

```bash
# .env.local
BASE_URL=https://xxxx-xxx-xxx.ngrok-free.app
```

---

## Authentication

The app uses Supabase Auth with Google OAuth. Sessions are stored in cookies (via `@supabase/ssr`) so they are readable by both the browser and server-side code. `proxy.ts` refreshes the session on every request and enforces route protection.

### User experience

- Unauthenticated users visiting any protected route are redirected to `/login`
- `/login` shows a single "Continue with Google" button — no email/password form
- After Google approves, the user lands on `/dashboard` automatically
- The dashboard header shows the user's Google profile photo (or initials fallback), their email, and a sign-out button
- The greeting adapts to time of day and uses the user's first name from their Google profile
- Signing out clears the session and returns to `/login`

### How the session flow works

```
1. User visits /dashboard (protected)
2. proxy.ts: getUser() → no session → 307 redirect to /login
3. User clicks "Continue with Google"
4. supabase.auth.signInWithOAuth() → browser navigates to Google
5. User approves → Google redirects to /auth/callback?code=XXXX
6. /auth/callback: exchangeCodeForSession(code) → sets auth cookies → redirect /dashboard
7. proxy.ts: getUser() → valid session → request passes through
8. Components: user object available via supabase.auth.getUser() on client
              or via (await createServerClient()).auth.getUser() on server
```

### Protected routes

| Route | Access |
|---|---|
| `/` | Public |
| `/login` | Public — redirects to `/dashboard` if already logged in |
| `/auth/callback` | Public — OAuth redirect target |
| `/api/mcp` | Public — used by Claude connectors |
| `/dashboard` | Protected — redirects to `/login` if no session |
| `/plan/[id]` | Protected |
| `/account/[id]` | Protected |
| `/connect` | Protected |

### Setting up Google OAuth — one-time external configuration

This requires steps in two external dashboards. Both must be completed before the login flow works.

#### Step 1 — Google Cloud Console (manual browser steps)

**Service:** Google Cloud Console — [console.cloud.google.com](https://console.cloud.google.com)
**Why:** Google issues the OAuth credentials that Supabase uses to verify a user's Google identity.

1. Create or select a project
2. APIs & Services → **OAuth consent screen** → configure app name and support email
3. APIs & Services → **Credentials** → Create Credentials → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Under **Authorised redirect URIs** add **exactly**:
   ```
   https://avzhlaxhopzmrjnmregc.supabase.co/auth/v1/callback
   ```
6. Click Create → copy the **Client ID** and **Client Secret**

#### Step 2 — Supabase Dashboard (can be done via Management API)

**Service:** Supabase Dashboard — Authentication → Providers → Google
**Why:** Supabase needs the Google credentials to verify tokens on its side.

1. Authentication → Providers → **Google** → toggle enabled
2. Paste **Client ID** and **Client Secret** from Step 1
3. Save

**Service:** Supabase Dashboard — Authentication → URL Configuration
**Why:** Supabase validates redirect URLs against this allowlist — requests with unlisted URLs are rejected.

4. Set **Site URL** to `http://localhost:3000` for local dev (`https://lever-claude.vercel.app` for prod)
5. Add to **Redirect URLs** (add both):
   ```
   http://localhost:3000/auth/callback
   https://lever-claude.vercel.app/auth/callback
   ```
6. Save

#### Step 3 — Verify RLS is clean before going live

Run this query against the production project to confirm no dev bypass policies exist:

```sql
select policyname, cmd from pg_policies where policyname like 'dev:%';
```

Expected result: zero rows. If any rows appear, drop them before real users sign up.

### Login options

The login page (`/login`) offers two methods:

1. **Email and password** — sign in or create an account with any email/password combination
2. **Continue with Google** — one-click OAuth via Google

Both land on `/dashboard` after authentication.

> **Email confirmation is disabled in development.** New accounts are active immediately — no inbox check needed. Enable it in Supabase Dashboard → Auth → Providers → Email → Confirm email before going to production.

### Demo accounts (development only)

| Email | Password | Role | Use for |
|---|---|---|---|
| `demo@lever.dev` | `demo1234` | Standard user | Agent and playwright tests — standard product flow |
| `admin@lever.dev` | `admin1234` | Admin | Admin panel tests (`/admin`) |

### Dev-only sign-in route

`GET /api/test-auth?email=...&password=...` — does the auth exchange server-side and redirects to `/dashboard` with session cookies set. Used by agents and playwright to bypass browser CORS issues. Returns 404 in production.

### Auth files

| File | What it does |
|---|---|
| `proxy.ts` | Next.js 16 middleware — refreshes session on every request, enforces route protection |
| `lib/supabase/client.ts` | Browser client using `createBrowserClient` from `@supabase/ssr` — stores session in cookies |
| `lib/supabase/server.ts` | Server factory using `createServerClient` from `@supabase/ssr` — reads session from cookies |
| `app/auth/callback/route.ts` | OAuth redirect handler — exchanges Google's one-time code for a Supabase session |
| `app/login/page.tsx` | Login page — email/password form + Google OAuth button |
| `app/api/test-auth/route.ts` | Dev-only server-side sign-in for agents and playwright (404 in production) |

---

## Deployment

### Vercel (web app + MCP server)

One deployment covers everything — web pages and the `/api/mcp` endpoint are all part of the same Next.js app.

**Initial setup (one time):**

1. Go to [vercel.com/new](https://vercel.com/new) → import `lever-claude`
2. Vercel auto-detects Next.js — leave all settings as-is:
   - Framework: Next.js
   - Root directory: `./`
   - Build command: `next build`
   - Install command: `npm install --legacy-peer-deps`
3. Click **Deploy**

> **Note:** Pass `--legacy-peer-deps` in the install command. `mcp-handler` pins `@modelcontextprotocol/sdk@1.26.0` but `@modelcontextprotocol/ext-apps` requires `^1.29.0` — both work at runtime, the flag just skips the peer conflict check.

Build takes ~60 seconds. After that, every push to `main` redeploys automatically.

**Build output:**

```
○ /                static  — CDN
○ /dashboard       static  — CDN
○ /connect         static  — CDN
○ /plan-widget     static  — CDN (fetched by MCP route at runtime)
○ /scenario-widget static  — CDN (fetched by MCP route at runtime)
ƒ /plan/[id]       dynamic — serverless function
ƒ /account/[id]    dynamic — serverless function
ƒ /api/mcp         dynamic — serverless function (MCP server)
```

---

### Database environments and production sync

The app currently uses **one Supabase project** for both local development and production. This is fine for MVP, but means dev policies and real user data share the same database. Before real users store private data, split into two projects.

#### Current state (one project)

| Environment | App URL | Supabase project |
|---|---|---|
| Local dev | `localhost:3000` | `avzhlaxhopzmrjnmregc.supabase.co` |
| Production | `lever-claude.vercel.app` | `avzhlaxhopzmrjnmregc.supabase.co` ← same |

#### Target state (two projects)

| Environment | App URL | Supabase project |
|---|---|---|
| Local dev | `localhost:3000` | `lever-dev.supabase.co` — permissive, seed data |
| Production | `lever-claude.vercel.app` | `lever-prod.supabase.co` — strict RLS, real users |

**How to split (one-time setup):**
1. Create a second Supabase project in the dashboard: `lever-prod`
2. Run all migrations against `lever-prod` — **without** the dev policies
3. Set Vercel environment variables to the `lever-prod` URL and anon key
4. Keep the current project as `lever-dev` with dev policies intact
5. Update `.env.local` to point to `lever-dev`

After the split, dev policies never touch production. Schema changes are applied to `lever-dev` first, tested, then applied to `lever-prod` before deploying.

#### Keeping production schema in sync with development

Every schema change starts as a migration on the dev project and must be applied to production before or alongside the code deploy that depends on it. Deploying code that expects a column before the column exists causes runtime errors.

**The rule:** schema changes go to production before code changes. Never after.

**Migration sync checklist — run before every deploy to production:**

1. **List migrations applied to dev:**
   ```
   mcp__supabase__list_migrations  (connected to lever-dev)
   ```

2. **Compare against production:**
   Connect to `lever-prod` and run the same command. Any migration that exists on dev but not prod must be applied before deploying.

3. **Apply missing migrations to production:**
   Connect to `lever-prod` and run `apply_migration` for each outstanding migration in order. Migration names are timestamped — apply oldest first.

4. **Audit for dev policies:**
   ```sql
   select policyname from pg_policies
   where tablename = 'plans'
     and policyname like 'dev:%';
   ```
   If this returns any rows, stop. A dev policy is active in production. Drop it before proceeding.

5. **Verify schema matches expectations:**
   ```
   mcp__supabase__list_tables  schemas=["public"]  verbose=true
   ```
   Confirm all columns the new code depends on are present.

#### Row-level security — current state

All tables have RLS enabled with ownership-scoped policies. Verified clean as of 2026-05-21 — no dev bypass policies exist.

| Table | Policy scope |
|---|---|
| `plans` | SELECT / INSERT / UPDATE / DELETE — `user_id = auth.uid()` |
| `accounts` | ALL — `auth.uid() = user_id` |
| `documents` | SELECT / INSERT / DELETE — `auth.uid() = user_id` |
| `net_worth_snapshots` | ALL — `auth.uid() = user_id` |
| `profiles` | SELECT — `auth.uid() = id` |
| `subscriptions` | SELECT only — writes go through service role via Stripe webhook |
| `notifications` | RLS enabled, no user-facing policies — admin-only via service role |

The admin panel (`/admin`) and MCP admin tools use the service role client, which bypasses RLS by design. This is intentional — admin access is gated by email check in code, not by RLS.

After this, only `"users can manage their own plans"` remains and users can only see and modify their own rows.

---

### Connecting to Claude

The web app has a `/connect` page with step-by-step instructions. From the dashboard, click **Set up connector**.

**Short version (Pro/Max personal plan):**

1. Open Claude → **Customize → Connectors**
2. Click **+** → **Add custom connector**
3. Paste `https://lever-claude.vercel.app/api/mcp`
4. Click **Add**
5. To activate in a chat: click **+** in the chat input → **Connectors** → toggle lever on

**Team/Enterprise:** Admin goes to **Organization settings → Connectors → Add → Custom → Web**, pastes the URL. Members then connect via **Customize → Connectors**.

> Custom connectors require a paid Claude plan (Pro, Max, Team, or Enterprise).

---

## Routes

| URL | Page | Auth | Render |
|---|---|---|---|
| `/` | Homepage / landing | Public | Static |
| `/login` | Google sign-in | Public | Static |
| `/auth/callback` | OAuth redirect handler | Public | Dynamic |
| `/dashboard` | Net worth graph, accounts, snapshot logger | Protected | Static |
| `/connect` | Claude connector setup guide | Protected | Static |
| `/plan/[id]` | Plan detail — metrics, allocation, scenarios, set-as-primary | Protected | Dynamic |
| `/account/[id]` | Account detail — balance, stats, transactions | Protected | Dynamic |
| `/plan-widget` | Plan dashboard iframe UI (for Claude) | Public | Static |
| `/scenario-widget` | Scenario modeler iframe UI (for Claude) | Public | Static |
| `/api/mcp` | MCP server endpoint | Public | Dynamic |
| `/api/plans` | Returns all plans as JSON | Public | Dynamic |
| `/api/plans/[id]` | Recalculate contribution or set plan as primary | Protected | Dynamic |
| `/api/net-worth` | GET all snapshots / POST a new net worth snapshot | Protected | Dynamic |
| `/api/stripe/checkout` | Create a Stripe Checkout session, return redirect URL | Protected | Dynamic |
| `/api/stripe/webhook` | Receive Stripe events, write subscription to Supabase | Public (Stripe sig) | Dynamic |
| `/api/test-auth` | Dev-only server-side sign-in for agents and playwright | Dev only | Dynamic |
| `/api/health` | Health check — returns `{status:"ok", timestamp}` | Public | Dynamic |

---

## MCP server

### Tools

| Tool | Response type | What Claude does |
|---|---|---|
| `show_financial_plan` | Interactive UI | Renders the plan dashboard as an iframe in the chat |
| `run_what_if` | Interactive UI | Opens the scenario modeler with sliders in the chat |
| `update_contribution` | Plain text | Computes a new projected balance and persists the updated contribution to Supabase |

### Authentication — token in URL

The MCP endpoint is public but user-scoped via a token in the connector URL:

```
https://lever-claude.vercel.app/api/mcp?token=<api_token>
```

Each user has a unique `api_token` UUID stored in the `profiles` table. The MCP route reads the token from the query string, looks up the user via the service role client (bypasses RLS), then fetches only that user's plans. The `/connect` page shows each signed-in user their personal URL.

**Token security:** treat the connector URL like a password — anyone with it can read and update your plan. If compromised, regenerate the token in the `profiles` table.

### Interactive UI pattern

`show_financial_plan` and `run_what_if` use the [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview). Each tool declares a `_meta.ui.resourceUri` pointing to a `ui://` resource. When Claude calls the tool, it fetches that resource — the MCP route self-fetches the rendered Next.js page at `/plan-widget` or `/scenario-widget` and returns it as the iframe HTML. The iframe uses `@modelcontextprotocol/ext-apps` client-side to receive the tool result and call tools back through Claude bidirectionally.

This pattern is currently supported by Claude only. Other MCP clients (Cursor, Copilot) will call the tools but won't render the iframe.

### Live data design

All three tools read from and write to the user's real Supabase plan rows. The `plan_id` parameter on all tools is optional — omitting it selects the user's most recently created plan, so Claude can answer "update my contribution to $4,000" without needing to know the plan UUID.

### Stack

- `mcp-handler` — Vercel's Next.js MCP adapter (`createMcpHandler`)
- `@modelcontextprotocol/sdk` — MCP protocol types and transport
- `@modelcontextprotocol/ext-apps` — interactive iframe tool/resource registration
- `zod` — tool input schema validation

---

## Web app stack

- **Next.js 16** App Router
- **React 19**
- **Tailwind CSS v4** — brand color tokens defined in `app/globals.css`
- **TypeScript 5**
- **Supabase** — Postgres database, Auth (Google OAuth), Row Level Security
- **`@supabase/supabase-js`** — Supabase client library
- **`@supabase/ssr`** — cookie-based session management for Next.js SSR
- **Stripe** — subscription billing via Stripe Checkout and webhooks (`stripe` npm SDK v22)

### Useful commands

```bash
npm run dev     # start dev server (web + MCP)
npm run build   # type-check + production build
npm run start   # serve the production build locally
npm run lint    # run ESLint
```

---

## Developer tools

### playwright-cli

Installed as a Claude Code skill at `.claude/skills/playwright-cli/`. Lets Claude Code open a real browser, navigate pages, and assert on UI state without writing test files.

**Firefox only** — Chromium requires system libraries that need `sudo` to install in WSL. Firefox was installed once during project setup:

```bash
playwright-cli install-browser firefox
```

**Verify all routes:**

```bash
playwright-cli open --browser=firefox http://localhost:3000/
playwright-cli goto http://localhost:3000/dashboard
playwright-cli goto http://localhost:3000/connect
playwright-cli goto http://localhost:3000/plan/retire-65
playwright-cli goto http://localhost:3000/account/roth-ira
playwright-cli goto http://localhost:3000/account/fake-id   # should 404
playwright-cli close
```

### Testing the mobile app with playwright-cli

Playwright tests browsers, not native apps. The Expo web export runs the same React Native component tree compiled for the browser — Playwright can test that.

**When this covers:** auth flows, Supabase data loading, navigation state, component rendering, sign-in/sign-out. Anything that is pure JS logic works identically on web and native.

**What it misses:** native gestures, platform-specific UI, native modules (camera, push notifications). For those, see the Maestro section below.

#### Run the test sequence

```bash
# Step 1 — build the Expo web export (run from mobile/)
cd mobile && npx expo export --platform web

# Step 2 — serve it (run from mobile/)
npx serve dist --listen 8081

# Step 3 — test with playwright-cli (in a Claude Code session)
playwright-cli open --browser=firefox http://localhost:8081/

# Verify login screen
playwright-cli console           # must be 0 errors
playwright-cli snapshot          # expect: logo, Email field, Password field, Sign in button

# Sign in
playwright-cli fill "getByRole('textbox', { name: 'Email' })" "demo@lever.dev"
playwright-cli fill "getByRole('textbox', { name: 'Password' })" "demo1234"
playwright-cli click "getByText('Sign in')"
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"

# Verify plans screen
playwright-cli console           # must be 0 errors
playwright-cli snapshot          # expect: logo, Sign out, plan cards with name/probability/balance

# Sign out
playwright-cli click "getByText('Sign out')"
playwright-cli run-code "async page => { await page.waitForTimeout(1500); }"
playwright-cli snapshot          # expect: login screen back

playwright-cli close
```

#### What was confirmed working (verified 2026-05-18)

| Check | Result |
|---|---|
| Login screen renders — logo, fields, button | ✓ |
| Console errors | 0 |
| Sign in with Supabase email/password | ✓ |
| Plans screen shows real DB data | ✓ |
| Sign out returns to login | ✓ |

#### Rebuild after code changes

The web export is a static snapshot. After any change to `mobile/` files, rebuild before retesting:

```bash
cd mobile && npx expo export --platform web
```

The `serve` process can stay running — just rebuild the `dist/` it's serving.

#### Differences from the native app to be aware of

- `KeyboardAvoidingView` is a no-op on web — keyboard behaviour won't be tested
- Pull-to-refresh (`RefreshControl`) renders but the pull gesture can't be triggered by Playwright
- `Platform.OS` returns `"web"` — any `Platform.select` or `Platform.OS === "ios"` branches won't be exercised
- Font rendering and shadow styles differ slightly from native

---

### Native mobile testing — Maestro (future)

[Maestro](https://maestro.mobile.dev) is the right tool for testing the native app on a real device or emulator. It ships a built-in MCP server (launched Feb 2026) that Claude Code can drive directly:

```bash
# One-time setup
curl -fsSL "https://get.maestro.mobile.dev" | bash
claude mcp add maestro -- maestro mcp
```

Once connected, Claude Code gains tools to boot a simulator, install the app, tap elements, inspect the view hierarchy, and run YAML flow files — no human touching the device.

**Why it's not set up yet:** Maestro cannot talk to Android emulators from WSL2 (tracked P1 bug, no fix as of May 2026). iOS simulators require macOS. The Maestro Cloud option (runs flows on hosted devices) would work from WSL2 and is the path to pursue when native testing is needed.

**When to come back to this:**
- You have macOS available, or
- You're ready to set up a Maestro Cloud account for cloud-hosted device runs

**Flows to write when Maestro is set up:**
- Login → plans list → plan detail
- Sign out → redirect back to login
- Pull-to-refresh on plans list
- Error state when Supabase is unreachable

---

### Supabase agent skills

Installed locally via `npx` — not committed to the repo (gitignored at `.agents/`). Each developer installs them once:

```bash
npx skills add supabase/agent-skills
```

This writes two skill packs to `.agents/skills/`:

| Skill | What it does |
|---|---|
| `supabase` | Core guidance for using the Supabase MCP tools — migrations, RLS, schema inspection, type generation |
| `supabase-postgres-best-practices` | Reference docs for indexes, connection pooling, RLS performance, JSONB, and more |

Once installed, Claude Code loads these automatically and applies the guidance when you work with the database.

**MCP server setup (also required):** the skills guide Claude Code on *how* to use the Supabase MCP tools, but the tools themselves are registered in your **user-level** Claude config — `~/.claude/mcp.json`. This file is never committed.

> **Do not add the Supabase entry to the project `.mcp.json`.** That file is committed to git. A PAT in `.mcp.json` will be blocked by GitHub push protection and the token must be rotated immediately.

Create or edit `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=avzhlaxhopzmrjnmregc",
      "headers": { "Authorization": "Bearer <your-supabase-pat>" }
    }
  }
}
```

- **`your-supabase-pat`** — Supabase Dashboard → Account → Access Tokens → Generate new token. The token is shown once — copy it immediately.

The project `.mcp.json` only contains the lever entry and is safe to commit:

```json
{
  "mcpServers": {
    "lever": { "url": "http://localhost:3000/api/mcp" }
  }
}
```

Restart Claude Code after editing `~/.claude/mcp.json`.

---

## Project structure

```
lever-claude/
│
│  ── App (Vercel) ──────────────────────────────────────────────
├── app/
│   ├── layout.tsx                  Root layout — fonts, metadata
│   ├── globals.css                 Tailwind import + brand color tokens
│   ├── page.tsx                    /  homepage
│   ├── login/page.tsx              /login  Google sign-in page
│   ├── auth/callback/route.ts      /auth/callback  OAuth redirect handler
│   ├── dashboard/
│   │   ├── page.tsx                /dashboard
│   │   ├── CreatePlanForm.tsx      Inline create-plan form component
│   │   └── UserMenu.tsx            Avatar + email + sign-out button
│   ├── connect/page.tsx            /connect  Claude connector setup guide
│   ├── plan/[id]/
│   │   ├── page.tsx                /plan/:id  (dynamic, checks subscription + fetches plan)
│   │   ├── ContributionForm.tsx    Recalculate + persist contribution (free feature)
│   │   └── WhatIfPanel.tsx         What-if scenarios — unlocked for premium, upgrade CTA for free
│   ├── account/[id]/page.tsx       /account/:id  (dynamic)
│   ├── plan-widget/page.tsx        /plan-widget  iframe UI for Claude
│   ├── scenario-widget/page.tsx    /scenario-widget  iframe UI for Claude
│   └── api/
│       ├── mcp/route.ts            /api/mcp  MCP server endpoint
│       ├── plans/route.ts          /api/plans  GET all plans, POST create plan
│       ├── plans/[id]/route.ts     /api/plans/:id  PATCH contribution + persist
│       ├── stripe/
│       │   ├── checkout/route.ts   /api/stripe/checkout  create Checkout session
│       │   └── webhook/route.ts    /api/stripe/webhook  handle subscription events
│       ├── test-auth/route.ts      /api/test-auth  dev-only server-side sign-in
│       └── health/route.ts         /api/health  health check
│
├── lib/
│   ├── store.ts                    Projection math (projectBalance)
│   ├── stripe.ts                   Stripe SDK client (server-only, uses STRIPE_SECRET_KEY)
│   └── supabase/
│       ├── client.ts               Browser Supabase client (createBrowserClient)
│       ├── server.ts               Server Supabase client factory (createServerClient)
│       ├── admin.ts                Service role client — bypasses RLS (MCP route, Stripe webhook)
│       ├── mappers.ts              planFromRow() — snake_case DB → camelCase app
│       └── subscription.ts         isPremium() / getActiveSubscription() — server-side helpers
│
│  ── Config ────────────────────────────────────────────────────
├── proxy.ts                        Next.js 16 middleware — CORS + session refresh
├── baseUrl.ts                      Resolves public URL from Vercel env vars
├── next.config.ts                  assetPrefix for iframe asset loading
├── .env.example                    Template for .env.local — never commit real values
├── tsconfig.json
├── package.json
│
│  ── Tooling ───────────────────────────────────────────────────
├── .claude/skills/playwright-cli/  Browser automation skill
├── .claude/skills/synthetic-users/ Persona-based product testing skill
├── .mcp.json                       Claude Code connector → localhost:3000/api/mcp
├── .gitignore
│
│  ── Mobile app (Expo) ─────────────────────────────────────────
└── mobile/
    ├── App.tsx                     Root component — auth gate
    ├── app.json                    Expo config (name, bundle IDs, splash)
    ├── eas.json                    EAS Build profiles (dev / preview / production)
    ├── context/AuthContext.tsx     Supabase session state
    ├── lib/supabase.ts             Supabase client (AsyncStorage session)
    ├── screens/
    │   ├── LoginScreen.tsx         Email/password sign-in
    │   └── PlansScreen.tsx         Plans list (reads Supabase directly)
    └── .env.example                Template — copy to .env.local
```

---

## Mobile app (Expo)

The mobile app lives in `mobile/` and is a separate npm package. It shares the same Supabase project as the web app — same database, same auth, same RLS policies.

### Structure

```
mobile/
├── App.tsx                 Root component — auth gate (LoginScreen or PlansScreen)
├── app.json                Expo config — name, bundle IDs, splash, icons
├── eas.json                EAS Build config — development / preview / production profiles
├── context/
│   └── AuthContext.tsx     Session state via Supabase auth listener
├── lib/
│   └── supabase.ts         Supabase client (AsyncStorage for session persistence)
├── screens/
│   ├── LoginScreen.tsx     Email + password sign-in
│   └── PlansScreen.tsx     Authenticated plans list (reads from Supabase directly)
└── .env.example            Env var template (copy to .env.local)
```

### Local development

**Prerequisites:**
- Install the **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Phone and dev machine must be on the same Wi-Fi network
- Node 18+, npm 9+

**Setup:**
```bash
cd mobile
cp .env.example .env.local   # fill in Supabase values
npm install
npx expo start
```

Expo prints a QR code. Scan it with the Expo Go app (Android) or the Camera app (iOS). The app loads on your device with hot reload — save a file and it updates instantly.

**If your phone can't reach the dev server:** Expo Go needs to reach your machine's IP on the local network. If you're on WSL, use the WSL IP (check `ip addr show eth0`) or use tunnel mode:
```bash
npx expo start --tunnel
```
Tunnel mode routes traffic through Expo's servers so any network works — slower but always connects.

### Environment variables

Mobile env vars use the `EXPO_PUBLIC_` prefix. They are **inlined into the JS bundle at build time** — treat them like client-side browser variables.

| Variable | Value | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Same as `NEXT_PUBLIC_SUPABASE_URL` in the web app |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `EXPO_PUBLIC_API_URL` | `https://lever-claude.vercel.app` | Base URL for Lever API calls; change to your machine IP for local web dev |

**Never put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, or any server-side secret in `EXPO_PUBLIC_` variables.** They will be visible to anyone who unpacks the app bundle.

### Calling the Lever web API from the mobile app

The mobile app reads plans directly from Supabase (same DB, RLS-protected). If it needs to call a Next.js API route (e.g., trigger a recalculation), it hits the production URL at `EXPO_PUBLIC_API_URL`.

`localhost:3000` does NOT work from a phone. Use either:
- The production URL (`https://lever-claude.vercel.app`) — always works
- Your machine's LAN IP (`http://192.168.x.x:3000`) — works when on same Wi-Fi

### How Expo Go development works

```
npx expo start
    │
    ▼
Metro bundler compiles JS bundle
    │
    ▼
Expo Go app on device fetches bundle over Wi-Fi
    │
    ▼
JS runs in Expo Go's React Native runtime
    │
    ▼
Save a file → Metro sends update → app hot-reloads in ~1 second
```

Expo Go contains a pre-built native runtime. You never compile native code during development — everything is JavaScript. This means:
- No Xcode or Android Studio needed during development
- Any changes to JS/TSX files hot-reload instantly
- **Exception:** if you add a package with native code (C++/Swift/Kotlin), you need a native build (see EAS Build below)

### Deployment with EAS

EAS (Expo Application Services) is Expo's cloud build and store submission platform. The same Expo account is used for both `expo.dev` login and `eas login` — one account, one credential.

**Project details:**
- Expo account: `marksoulier` (`marksoulkid@gmail.com`)
- EAS project: `@marksoulier/lever`
- EAS project ID: `125e292a-5534-4a3a-9fcb-9b208cb292cb`
- Dashboard: https://expo.dev/accounts/marksoulier/projects/lever

---

#### One-time setup (already done)

```bash
npm install -g eas-cli        # install EAS CLI globally
cd mobile
eas login                     # same credentials as expo.dev
eas init --force              # creates @marksoulier/lever on expo.dev,
                              # writes projectId + owner into app.json
```

`eas init` modifies `app.json` in-place — the `extra.eas.projectId` and `owner` fields it writes are committed to the repo so any developer can build without re-initialising.

---

#### Build profiles

Three profiles are defined in `eas.json`. Each inlines the `EXPO_PUBLIC_` env vars that get baked into the JS bundle at build time.

| Profile | Use case | Distribution | Notes |
|---|---|---|---|
| `development` | Local dev with dev menu + fast refresh | Internal (link) | Requires `expo-dev-client` installed on device |
| `preview` | QA / internal testing, no dev menu | Internal (link) | Use this to share a real APK/IPA without app store |
| `production` | App Store / Play Store submission | Store | Triggers store review |

---

#### Environment variables in EAS builds

`EXPO_PUBLIC_` variables are baked into the JS bundle at build time — they must be set in `eas.json` (or in the EAS dashboard for sensitive values). The Supabase anon key is publishable by design, so it lives in `eas.json`. If you add a truly secret value in the future, set it in the EAS dashboard instead:

> expo.dev → Project → Environment Variables → Add variable → mark as "Secret"

Secret variables are injected at build time without appearing in the repo or build logs.

---

#### Preview build — Android (internal distribution)

No Google Play account needed. EAS generates a signed APK and gives you a QR-code link to share directly.

```bash
cd mobile
eas build --platform android --profile preview
```

EAS queues the build on Expo's cloud servers (no local Android SDK or emulator needed). When it finishes, the CLI prints a URL like:

```
Build details: https://expo.dev/accounts/marksoulier/projects/lever/builds/<build-id>
```

Visit that URL, download the APK, or scan the QR code on your Android device. First install may require enabling "Install from unknown sources" in Android settings.

Build time: ~5–10 minutes in the queue.

---

#### Preview build — iOS (internal distribution)

Requires an Apple Developer account ($99/year). EAS handles signing certificates and provisioning profiles — you never touch Xcode.

```bash
cd mobile
eas build --platform ios --profile preview
```

On first run, EAS will ask to create or reuse an Apple distribution certificate and provisioning profile. Choose "Let EAS manage" for the simplest path — it stores credentials in your EAS account.

The output is an `.ipa` file. Share it via the EAS dashboard link, or register testers' device UDIDs first (required for ad-hoc distribution outside TestFlight).

For broader iOS testing without registering UDIDs, use TestFlight:
1. Build with `--profile production` (production certificate required)
2. Run `eas submit --platform ios` to upload to App Store Connect
3. Add testers in App Store Connect → TestFlight

---

#### Production build — both platforms

```bash
cd mobile
eas build --platform all --profile production
```

This produces a release-signed AAB (Android) and IPA (iOS) ready for store submission.

---

#### Submitting to stores

**Google Play:**

Prerequisites:
1. Google Play Console account (one-time $25 fee at play.google.com/console)
2. Create the app in Play Console first (app must exist before first upload)
3. Generate a service account JSON key: Play Console → Setup → API access → Create service account → download JSON

```bash
eas submit --platform android
# EAS prompts for the service account JSON path on first run, then stores it
```

EAS uploads the AAB to the internal testing track by default. Promote to production in the Play Console when ready.

**Apple App Store:**

Prerequisites:
1. Apple Developer account ($99/year at developer.apple.com)
2. App record created in App Store Connect (appstoreconnect.apple.com)
3. App Store Connect API key: Users & Access → Integrations → App Store Connect API → Generate key → download `.p8` file

```bash
eas submit --platform ios
# EAS prompts for the API key ID, issuer ID, and .p8 file path on first run
```

After upload, the build appears in App Store Connect → TestFlight. Submit for review from there.

---

#### Over-the-air (OTA) updates

For JS-only changes — screens, logic, styles, anything that doesn't add a native library — you can push updates directly to installed apps without going through the store review process:

```bash
eas update --branch production --message "Fix plan card layout"
```

Users receive the update silently on next app launch (or within the configured background fetch interval). This is the fastest path for bug fixes and UI changes.

**OTA does NOT work for:**
- Adding packages with native code (must do a full EAS build + store submission)
- Changing `app.json` fields like permissions, icons, or splash screen
- Incrementing the native version number

**Branch convention:**
- `production` branch → live users
- `preview` branch → internal testers

```bash
eas update --branch preview --message "Test new plans screen"
eas update --branch production --message "Ship plans screen"
```

---

#### iOS builds from Linux/WSL (no Mac needed)

EAS builds iOS on Expo's cloud Mac fleet. You never need Xcode locally:

```bash
# Works from WSL — EAS handles the Mac build environment
eas build --platform ios --profile production
eas submit --platform ios
```

The only Mac-specific step is creating an Apple Developer account, which is done in a browser.

---

#### EAS build rules — hard-learned

These tripped up the first builds. Read before troubleshooting.

**Always `cd mobile` before running `eas` commands.** EAS reads `app.json` and `eas.json` from the current directory. Running from the repo root finds neither — it creates stray `app.json`/`eas.json` files at the root and fails.

```bash
# Wrong — runs from repo root, creates stray files
eas build --platform android

# Correct
cd mobile && eas build --platform android --profile preview
```

**EAS builds from git, not from your working directory.** Commit all changes before triggering a build. If `mobile/` files aren't committed, EAS archives the previous commit and builds the old version.

**`--clear-cache` clears Gradle/npm caches, not the fingerprint.** If EAS says "computed fingerprint" but doesn't pick up your new file, confirm the file is committed and the commit hash changed.

**Supabase + Hermes: dynamic import() fix.** `@supabase/supabase-js` v2+ uses `import(/* webpackIgnore: true */ '@opentelemetry/api')` internally. Hermes (React Native's production JS engine) rejects this syntax. Fixed in this project via:
- `babel.config.js` — `babel-plugin-transform-dynamic-import` converts `import()` to `require()` at build time
- `metro.config.js` — `resolveRequest` stubs `@opentelemetry/*` to an empty module

Do not remove these without testing a production EAS build — the error (`Invalid expression encountered`) only appears in release/Hermes builds, not in Expo Go or dev builds.

**Always run `npx expo install --check` after adding packages.** EAS uses the Expo SDK version from `app.json` to validate compatibility. Version mismatches (like `@react-native-async-storage/async-storage` v3 with Expo 54) compile locally but fail on EAS with generic Gradle errors.

```bash
cd mobile && npx expo install --check
# Must print: "Dependencies are up to date"
```

---

## Stripe billing

### Overview

Lever uses Stripe Checkout for subscription billing. Free users see a paywall on the what-if scenarios panel; premium users ($19.99/month) see scenarios unlocked.

**Stripe account:** `acct_1P243k090vGdQrrL` (Lever AI)
**Test mode product:** `prod_UXbkGT8aePTjNv` — Lever Premium
**Test mode price:** `price_1TYWWc090vGdQrrLvppkGoIv` — $19.99/month recurring

### How subscriptions are tracked

1. User clicks "Upgrade — $19.99/mo" on the plan page
2. `POST /api/stripe/checkout` creates a Stripe Checkout Session with `client_reference_id = user.id`
3. User completes payment on `checkout.stripe.com`
4. Stripe sends `checkout.session.completed` to `/api/stripe/webhook`
5. Webhook retrieves the full subscription, writes a row to `subscriptions` table
6. On next plan page load, `isPremium()` queries the `subscriptions` table and returns `true`
7. `WhatIfPanel` receives `isPremium={true}` and renders the unlocked scenarios

### Subscription lifecycle events handled

| Event | What the webhook does |
|---|---|
| `checkout.session.completed` | Creates subscription row (uses `client_reference_id` for user_id) |
| `customer.subscription.created` | Upserts row (uses subscription metadata `user_id`) |
| `customer.subscription.updated` | Updates status and period_end |
| `customer.subscription.deleted` | Updates status to `canceled` |

### Stripe CLI (local dev)

The Stripe CLI is installed at `~/.local/bin/stripe` (v1.40.9). It requires `stripe login` once to authenticate. The session is stored at `~/.config/stripe/config.toml`.

Useful commands:
```bash
# Forward webhooks to local dev server (must run alongside npm run dev)
~/.local/bin/stripe listen --forward-to localhost:3000/api/stripe/webhook

# Replay a specific event by ID (useful when webhook 500s and needs retry)
~/.local/bin/stripe events resend <evt_...>

# Check account and auth status
~/.local/bin/stripe whoami

# Trigger test events
~/.local/bin/stripe trigger checkout.session.completed
~/.local/bin/stripe trigger customer.subscription.deleted
```

### Stripe API version gotcha

The Stripe Node SDK v22 uses API version `2026-04-22.dahlia`. The Stripe CLI uses an older version (`2023-10-16`). Webhook events are sent in the CLI's version, but the SDK constructs them in the app's version when you call `stripe.subscriptions.retrieve()`.

**Known quirk:** `current_period_end` in the dahlia API lives on `subscription.items.data[0].current_period_end` as well as `subscription.current_period_end`. The webhook handler reads from both with a fallback:
```ts
const periodEnd = (item as any).current_period_end ?? (sub as any).current_period_end;
```

If Stripe removes the top-level field in a future version, the item-level field is the canonical source.

### Test card

Use `4242 4242 4242 4242` with any future expiry, any CVC, and any ZIP code to complete test payments. Cardholder name is also required in the current Stripe Checkout configuration.

### Stripe skills installed

Three official Stripe agent skills are installed at `.agents/skills/`:

| Skill | Purpose |
|---|---|
| `stripe-best-practices` | API selection, Connect, billing, security guidance |
| `stripe-projects` | Provisioning via projects.dev |
| `upgrade-stripe` | Guide for Stripe API version upgrades |

A local `stripe-cli` skill is at `~/.claude/skills/stripe-cli/` — this is user-level (not committed) and teaches Claude how to run `stripe` CLI commands with the correct binary path and flags.

---

## Known limitations

| Limitation | Impact | Fix when |
|---|---|---|
| `CURRENT_AGE` hardcoded at 41 in POST /api/plans | Projection math is wrong for users of any other age | Replace with user record when profiles are added |
| Dashboard metrics cards are hardcoded | Portfolio value, target, savings shown are static strings, not live DB values | Derive from user's first plan once auth identifies the user |
| Nav header duplicated across 4 pages | Update in 4 files instead of 1 | Add `app/dashboard/layout.tsx` |
| MCP interactive UI is Claude-only | Other MCP clients get text responses, no iframe | MCP Apps spec matures across clients |
| What-if scenarios are hardcoded by retirement age | Only ages 60 and 65 have scenario data; other ages show the unlocked panel but no scenarios | Replace static `scenariosByRetirementAge` with a DB-backed scenarios table |
| No post-upgrade banner on dashboard | `?upgraded=true` query param is set on redirect but not consumed anywhere | Add a success toast or banner on the dashboard for first-time premium users |
| Stripe webhook forwarder must be started manually | Developers forget to run `stripe listen`, checkout works but subscription never gets written | Add a note to the dev startup docs; long-term, use a tunnel (ngrok) or Stripe sandbox URL |
| Dev RLS policies on `plans` visible to all users | Any authenticated user can read all plans | Drop dev policies before onboarding real users (see Deployment → Database environments) |
