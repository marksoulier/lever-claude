# Definition of done

A task is not finished until all checks below pass. Do not report work as complete or ask what to do next until you have run them.

**Test efficiency rule:** Only run the Vitest/Jest test files that cover the code you changed. Do not run the full suite (`npm test`) unless explicitly asked. Example: changed `lib/simulator/runner.ts` → run `npx vitest run tests/runner.test.ts` only. Changed a UI component with no test file → skip Vitest entirely and do the visual check only.

---

## 1. MCP tools — required after any change to `app/api/mcp/route.ts` or `lib/store.ts`

**Handshake:**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
```
Expected: SSE event containing `"protocolVersion"` and `"capabilities"`.

**Tool list:**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```
Expected: every tool you added or changed appears by name.

**Tool call:**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"<tool_name>","arguments":{<args>}}}'
```
Expected: `data:` line containing `"result"` with non-empty `content`.

A build that compiles is not sufficient — tools must respond correctly at runtime.

---

## 2. Visual UI — required after any change to a page, component, or global style

```bash
playwright-cli open --browser=firefox http://localhost:3000/<changed-route>
playwright-cli snapshot
playwright-cli console   # must be 0 errors
playwright-cli close
```

Check: page renders, key elements present, 0 console errors, at least one linked page navigates correctly.

Do not skip. Do not report complete without running it.

---

## 3. Documentation — required after any change that affects how the app works

Update `README.md` when you:
- Add, rename, or remove a route or API endpoint
- Add, change, or remove an MCP tool
- Change how the app is deployed, configured, or run locally
- Add or remove a dependency listed in the README
- Fix a known limitation or introduce a new one

Do not update for refactors with no user-visible effect or bug fixes that don't change documented behaviour.

---

## 4. Off-codebase configuration — required after any change touching an external service

Document external configuration in `README.md` using this format:
```
Service: [Google Cloud Console / Supabase Dashboard / Vercel / etc.]
What was configured: [specific setting]
Where to find it: [Dashboard → Section → Subsection]
Value or format: [exact value or format]
Why it's needed: [one sentence]
Linked to: [the code file that consumes this config]
```

Never leave external configuration documented only in chat.

---

## 5. Fresh signup smoke test — required before every deploy

This test catches GoTrue trigger failures, profile-creation bugs, and anything that breaks the new-user path. `/api/test-auth` bypasses OAuth entirely — it does not catch these. Run this every time.

```bash
ANON=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
TS=$(date +%s)
curl -s -X POST "https://avzhlaxhopzmrjnmregc.supabase.co/auth/v1/signup" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON" \
  -d "{\"email\":\"smoke-$TS@lever.dev\",\"password\":\"Smoke123!\"}" \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
uid = (d.get('user') or {}).get('id') or d.get('id')
if uid:
    print('PASS — user created:', uid)
else:
    print('FAIL —', d.get('msg') or d.get('error_description') or d)
    sys.exit(1)
"
```

Expected: `PASS — user created: <uuid>`. Any FAIL is a P0 — do not deploy until resolved.

After confirming PASS, delete the smoke-test user:
```
mcp__supabase__execute_sql
  query: "delete from auth.users where email like 'smoke-%@lever.dev'"
```

**What this catches:** broken triggers on `auth.users` (B-24), missing tables referenced by trigger functions, profile-creation failures, GoTrue schema errors.

**Critical note:** `/api/test-auth` is a dev-only shortcut that signs in an existing user via server-side exchange. It never touches the signup code path. Never use it as a substitute for this test.

---

## 6. Post-deploy production check — required after every deploy to Vercel

Run within 2 minutes of the Vercel build going green. If anything fails, the deploy is broken.

```bash
PROD="https://lever-claude.vercel.app"

# Health endpoint
curl -s "$PROD/api/health" | python3 -c "import json,sys; d=json.load(sys.stdin); print('health OK' if d.get('status')=='ok' else 'FAIL:', d)"

# MCP tool count
curl -s -X POST "$PROD/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | grep -o '"name":"[^"]*"' | wc -l \
  | xargs -I{} sh -c 'echo "MCP tools: {} (expected 19)"'
```

Then check auth logs for any errors in the `/callback` path:
```
mcp__supabase__get_logs  service=auth
```
Scan output for `"level":"error"` and `"path":"/callback"`. Any 500 errors mean signup is broken — roll back or hotfix before sharing the URL.

---

## 7. Production database sync — required before any deploy with a schema change

**Step 1 — audit for dev policies:**
```sql
select policyname, cmd from pg_policies
where tablename = 'plans' and policyname like 'dev:%';
```
If any rows: stop. Drop them before deploying.

**Step 2 — compare migration history:**
```
mcp__supabase__list_migrations
```
Apply any migrations present on dev but absent from production, oldest first.

**Step 3 — verify production schema:**
```
mcp__supabase__list_tables  schemas=["public"]  verbose=true
```

**Step 4 — run advisors:**
```
mcp__supabase__get_advisors
```
Fix any critical advisories before deploying.

**Step 5 — audit auth triggers:**
```sql
select t.tgname, p.proname, p.prosrc
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'auth' and c.relname = 'users'
  and t.tgname not like 'RI_ConstraintTrigger%';
```
Any row here is a custom trigger on `auth.users`. Verify it uses fully-qualified table names (`public.profiles`, not `profiles`) — GoTrue runs triggers with `search_path=''` so unqualified names fail silently with "Database error saving new user" (B-24). If in doubt, drop it.
