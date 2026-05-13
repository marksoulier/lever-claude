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
