# Test users & testing procedures

## Active test accounts

| Email | Password | Role | Notes |
|---|---|---|---|
| `demo@lever.dev` | `demo1234` | Standard user | Use for most playwright tests — no admin access |
| `admin@lever.dev` | `admin1234` | Admin | Accesses `/admin`; use for admin panel tests |

These accounts exist in the Supabase database. Do not delete them — they are the only test accounts.

**Phone testing (Expo Go):** always use `demo@lever.dev` / `demo1234`. Google OAuth does not reliably redirect back to Expo Go on iOS. Email + password works. When giving the user tasks that require phone validation, always include these credentials explicitly.

---

## Signing in during tests

Use the dev-only server-side sign-in route. It exchanges credentials server-side, sets auth cookies, and redirects to `/dashboard`. Avoids browser CORS issues with Supabase's auth API in WSL.

```bash
# Standard user
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"
playwright-cli state-save .playwright-cli/auth.json

# Admin user
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=admin%40lever.dev&password=admin1234"
playwright-cli state-save .playwright-cli/auth-admin.json
```

Always verify the redirect worked before testing a protected page:
```bash
playwright-cli eval "window.location.pathname"  # must be /dashboard, not /login or /api/test-auth
```

---

## Testing as a regular user

Signs in as `demo@lever.dev`. Tests the standard product: dashboard, plans, accounts, documents, what-if scenarios. This user has no access to `/admin` — navigating there redirects to `/dashboard`.

```bash
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"
playwright-cli state-save .playwright-cli/auth.json

playwright-cli goto http://localhost:3000/dashboard
playwright-cli eval "window.location.pathname"   # /dashboard
playwright-cli snapshot  # confirms: Home active in sidebar, NO Admin link

# Verify admin route is blocked
playwright-cli goto http://localhost:3000/admin
playwright-cli eval "window.location.pathname"   # must redirect to /dashboard

playwright-cli close
```

---

## Testing as an admin user

Signs in as `admin@lever.dev`. Tests the admin panel: user list, user detail, notification approval workflow. The sidebar shows an amber "Admin" link that is invisible to standard users.

```bash
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=admin%40lever.dev&password=admin1234"
playwright-cli state-save .playwright-cli/auth-admin.json

playwright-cli goto http://localhost:3000/admin
playwright-cli eval "window.location.pathname"   # /admin (not redirected)
playwright-cli snapshot  # confirms: Admin link visible in sidebar (amber), user cards present

# Click into a user's detail
playwright-cli click "getByRole('link', { name: 'View →' }).first()"
playwright-cli eval "window.location.pathname"   # /admin/users/<uuid>
playwright-cli snapshot  # confirms: setup health, plans, accounts, notifications section

playwright-cli close
```

---

## Creating new test users

Always use the Supabase Dashboard: **Authentication → Users → Add user**. Enter email + password and tick "Auto Confirm User". Never create users via raw SQL — it bypasses GoTrue's setup and produces incomplete records.

## Making a user admin
Admin access is controlled by the `ADMIN_EMAILS` environment variable (comma-separated). To grant admin access to an email:
1. Add it to `.env.local`: `ADMIN_EMAILS=marksoulkid@gmail.com,admin@lever.dev,new@example.com`
2. Restart the dev server (`npm run dev`)
3. For production: add `ADMIN_EMAILS` to Vercel Dashboard → Settings → Environment Variables

The admin check happens server-side in `app/(app)/admin/layout.tsx` (page guard) and in each `/api/admin/*` route handler. The sidebar admin link is shown client-side based on the same list loaded from `lib/admin-auth.ts`.

---

## Mobile app testing (Expo web export)

Playwright cannot test the native app directly. Use the Expo web export — the same React Native code compiled to run in a browser.

**When to run this:** any change to files under `mobile/`.

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

**Auth note:** `/api/test-auth` is web-only (`localhost:3000`). The Expo web build uses the Supabase client directly — fill email/password in the UI.

---

## Full web test run — standard sequence

```bash
# ── 0. Setup ─────────────────────────────────────────────────────────────────
playwright-cli open --browser=firefox "http://localhost:3000/api/test-auth?email=demo%40lever.dev&password=demo1234"
playwright-cli state-save .playwright-cli/auth.json

# ── 1. Dashboard ──────────────────────────────────────────────────────────────
playwright-cli console   # Errors: 0
playwright-cli snapshot  # confirm email, "Your plans" heading, plan cards present

# ── 2. Create plan ───────────────────────────────────────────────────────────
playwright-cli click "getByRole('button', { name: '+ New plan' })"
playwright-cli fill "getByLabel('Plan name')" "Smoke Test Plan"
playwright-cli fill "getByLabel('Target retirement age')" "65"
playwright-cli fill "getByLabel('Monthly contribution ($)')" "3000"
playwright-cli click "getByRole('button', { name: 'Create plan' })"
playwright-cli eval "window.location.pathname"   # must start with /plan/

# ── 3. Plan detail ────────────────────────────────────────────────────────────
playwright-cli console   # Errors: 0
playwright-cli snapshot  # confirm heading, Projected balance, Probability of success

# ── 4. Contribution recalculate ───────────────────────────────────────────────
playwright-cli triple-click "getByRole('spinbutton')"
playwright-cli fill "getByRole('spinbutton')" "5000"
playwright-cli click "getByRole('button', { name: 'Recalculate' })"
playwright-cli console   # Errors: 0
playwright-cli snapshot  # confirm Projected balance, Success probability, Monthly income cards

# ── 5. Navigation ─────────────────────────────────────────────────────────────
playwright-cli click "getByRole('link', { name: 'Dashboard' })"
playwright-cli eval "window.location.pathname"   # must be /dashboard

# ── 6. Sign out ───────────────────────────────────────────────────────────────
playwright-cli click "getByRole('button', { name: 'Sign out' })"
playwright-cli eval "window.location.pathname"   # must be /login

# ── 7. Redirect after sign-out ────────────────────────────────────────────────
playwright-cli goto http://localhost:3000/dashboard
playwright-cli eval "window.location.pathname"   # must be /login (redirected)

playwright-cli close
```

## Edge case tests (curl)

```bash
BASE="http://localhost:3000"

curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"x","retirementAge":41,"monthlyContribution":500}' | grep error
# Expect: "retirementAge must be greater than current age (41)"

curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"x","retirementAge":65,"monthlyContribution":-1}' | grep error
# Expect: "monthlyContribution must be positive"

curl -s -X POST $BASE/api/plans -H "Content-Type: application/json" \
  -d '{"name":"   ","retirementAge":65,"monthlyContribution":500}' | grep error
# Expect: "name must not be empty"
```

## Known testing issues

| Issue | Workaround |
|---|---|
| Firefox/WSL CORS blocks Supabase auth API from browser | Use `/api/test-auth` route |
| Saved playwright auth expires after 1 hour | Re-run state-save block |
| Stripe webhook forwarder must be started manually | Run `~/.local/bin/stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| Stripe Checkout requires cardholder name + ZIP | Fill "Demo User" and "10001" when testing checkout |
