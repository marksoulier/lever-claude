# MCP server testing

Three levels of testing for the Lever MCP server (`app/api/mcp/route.ts`).

## Level 1 — Protocol (is the server alive?)

```bash
# Handshake
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'

# Tool list
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

For prod: swap `http://localhost:3000` with `https://lever-claude.vercel.app`.

## Level 2 — Tool execution (do tools return real data?)

Claude Code has direct access via `.mcp.json`. Ask:
> "Call all Lever MCP tools and verify the output"
> "Call `show_financial_plan` and show me what it returns"

Check: non-empty result, data matches Supabase, numeric fields are numbers, widget tools return `_meta.ui.resourceUri`.

Available in this session:
```
mcp__claude_ai_Lever_Business__show_financial_plan
mcp__claude_ai_Lever_Business__run_what_if
mcp__claude_ai_Lever_Business__update_contribution
```

## Level 3 — Conversational flow (does the LLM call the right tool?)

Test in Claude.ai manually:
```
"Show me my financial plan"              → expect: show_financial_plan called
"Run a what-if scenario"                 → expect: run_what_if called
"Update my monthly contribution to 4500" → expect: update_contribution called
```

Or build an automated test:
> "Build a Claude API test script that sends 'show me my financial plan' and asserts that show_financial_plan was called"

## Persona simulation

Ask Claude Code to roleplay a user:
> "Act as a first-time user who just signed up. Walk through creating a plan, exploring the detail page, and running a what-if scenario. Tell me where you got confused."
