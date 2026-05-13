<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Definition of done

A task is not finished until both checks below pass. Do not report work as complete, summarise results, or ask what to do next until you have run them.

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

```
playwright-cli open --browser=firefox http://localhost:3000/<changed-route>
```

Check:
- The page renders without a blank screen or visible error
- Key elements are present (headings, data, buttons)
- No JavaScript errors in the browser console
- Navigate to at least one linked page to catch broken routing

For widget pages (`/plan-widget`, `/scenario-widget`) a visual check is sufficient — the MCP iframe interaction is tested separately via the tool call check above.

If playwright-cli is not installed or Firefox is unavailable, say so explicitly rather than skipping the check.
