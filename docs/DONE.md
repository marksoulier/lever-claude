# Definition of done

A task is not finished until all checks below pass. Do not report work as complete or ask what to do next until you have run them.

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

## 5. Production database sync — required before any deploy with a schema change

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
