# Lever — Session Startup Checklist

Run this at the start of every session before doing any work. Copy-paste the command block below into a single Bash call.

---

## Quick check (run this first)

```bash
echo "── CLI tools ──────────────────────────────────────"
playwright-cli --version 2>/dev/null && echo "playwright-cli ✓" || echo "playwright-cli ✗ — install: npm install -g @playwright/cli@latest"
node --version 2>/dev/null && echo "node ✓" || echo "node ✗ — install nvm"
npx tsc --version 2>/dev/null && echo "tsc ✓" || echo "tsc ✗ — run: npm install"
curl --version 2>/dev/null | head -1 && echo "curl ✓" || echo "curl ✗"

echo ""
echo "── Dev server ─────────────────────────────────────"
curl -s http://localhost:3000/api/health 2>/dev/null && echo "" || echo "NOT RUNNING — start with: npm run dev"

echo ""
echo "── .mcp.json ──────────────────────────────────────"
[ -f .mcp.json ] && echo ".mcp.json ✓" || echo ".mcp.json ✗ — copy from .mcp.json.example and fill in your tokens"
python3 -c "import json; d=json.load(open('.mcp.json')); [print(f'  {k}: {\"✓\" if v.get(\"url\") else \"✗ missing url\"}') for k,v in d.get('mcpServers',{}).items()]" 2>/dev/null

echo ""
echo "── Supabase REST API ──────────────────────────────"
PAT=$(python3 -c "import json; print(json.load(open('.mcp.json'))['mcpServers']['supabase']['headers']['Authorization'].replace('Bearer ',''))" 2>/dev/null)
REF=$(python3 -c "import json,re; u=json.load(open('.mcp.json'))['mcpServers']['supabase']['url']; print(re.search(r'project_ref=([^&]+)',u).group(1))" 2>/dev/null)
curl -s -o /dev/null -w "%{http_code}" \
  "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $PAT" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT 1"}' | grep -q "^2" && echo "Supabase REST ✓" || echo "Supabase REST ✗ — check PAT in .mcp.json"

echo ""
echo "── Lever MCP tools (11 expected) ──────────────────"
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | grep -o '"name":"[^"]*"' | wc -l | xargs -I{} sh -c '[ {} -eq 11 ] && echo "MCP tools ✓ ({} tools)" || echo "MCP tools ✗ ({} tools — expected 11, dev server may need restart)"'

echo ""
echo "── Git state ──────────────────────────────────────"
git branch --show-current
git status --short | head -5
```

---

## Business health snapshot (run after quick check)

After verifying the environment is healthy, run these checks to understand the current state of the business. Use the results together with `PROGRESS.md` to decide what to work on next.

### User activity — Supabase

```sql
-- Total signed-up users
select count(*) as total_users from auth.users;

-- New signups in the last 7 days
select count(*) as new_users_7d from auth.users
where created_at > now() - interval '7 days';

-- Total plans created
select count(*) as total_plans from plans;

-- Active premium subscriptions
select count(*) as active_subscriptions from subscriptions
where status = 'active';

-- Most recently active users (last login)
select email, last_sign_in_at from auth.users
order by last_sign_in_at desc nulls last limit 10;
```

Run each via `mcp__supabase__execute_sql` or the Supabase REST API fallback.

### Revenue — Stripe MCP

Call these tools and summarise the results:

| Tool | What to check |
|---|---|
| `mcp__stripe__retrieve_balance` | Current available + pending balance |
| `mcp__stripe__list_subscriptions` (status=active) | Count of active paid subscribers |
| `mcp__stripe__list_payment_intents` (limit=10) | Recent payments — amounts and dates |

### User feedback — UserJot MCP

UserJot is connected at `https://api.userjot.com/v1/mcp`. Call whatever list/read tools it exposes to surface:
- Most-requested features
- Bug reports or complaints
- Themes across recent feedback

Note: UserJot currently has placeholder/fake feedback. Treat it as a template — the structure and workflow are valid even before real feedback arrives.

---

## Deciding next steps

After running the business health snapshot, Claude should propose the highest-leverage next task without waiting for the user to choose. Weigh:

1. **User feedback** — what are users asking for or reporting as broken?
2. **Revenue signals** — are subscriptions growing, flat, or churning?
3. **User activity** — are users returning, or dropping off after signup?
4. **PROGRESS.md priority order** — what is the documented next step?

Offer a single recommendation with a one-sentence rationale. Example: _"Based on 3 users being stuck at the onboarding gate and no plans created, the highest-leverage next task is fixing the onboarding experience."_ Then ask for confirmation before starting.

---

## What each check means and what to do if it fails

| Check | Expected | Fix if failing |
|---|---|---|
| `playwright-cli` | v0.1.x | `npm install -g @playwright/cli@latest` |
| `node` | v20+ | Install via nvm: `nvm install --lts` |
| `tsc` | any version | `npm install` in the project root |
| `curl` | any version | Pre-installed on all platforms |
| Dev server | `{"status":"ok"}` | `npm run dev` in a separate terminal |
| `.mcp.json` | File exists, 3 servers present (lever, supabase, userjot) | Copy `.mcp.json.example`, fill in Supabase PAT and project ref. PAT from: [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| Supabase REST | HTTP 200/201 | Check PAT is valid and not expired. Project ref: `avzhlaxhopzmrjnmregc` |
| Lever MCP tools | 11 tools listed | Restart dev server (`npm run dev`). If tools are missing, check `app/api/mcp/route.ts` for compile errors |
| Git branch | `main` or feature branch | Normal — just know what branch you're on before making changes |

---

## MCP tools that must be present (11 total)

If any of these are missing after the server starts, the feature that depends on them is broken:

| Tool | Feature it powers |
|---|---|
| `show_financial_plan` | Claude renders the plan dashboard iframe |
| `run_what_if` | Claude opens the scenario modeler iframe |
| `create_plan` | Onboarding — Claude creates user's first plan |
| `update_plan_context` | Sets DOB, income, risk tolerance, goals on a plan |
| `update_contribution` | Recalculates projection for a new monthly savings amount |
| `add_account` | Onboarding / ongoing — Claude adds financial accounts |
| `update_account_balance` | Claude updates an existing account balance |
| `create_what_if_plan` | Claude clones a plan with changed parameters for comparison |
| `get_document_summaries` | Claude reads stored summaries of all uploaded financial docs for plan context |
| `read_document` | Claude re-reads a specific document in full to answer detailed questions; refreshes expired Anthropic file_id automatically |
| `get_onboarding_status` | Claude checks setup progress; drives the onboarding flow |

---

## Session-level MCP tools (from Claude.ai connectors — available in this conversation context)

These are NOT in the project `.mcp.json`. They come from Claude.ai's connected accounts and are only available when working through the VSCode extension connected to Claude.ai:

| Tool prefix | What it is | Used for |
|---|---|---|
| `mcp__claude_ai_Lever_Business__*` | The Lever MCP server via Claude.ai connector | Testing MCP tools as a user would experience them |
| `mcp__stripe__*` | Stripe MCP | Managing subscriptions, products, payments |
| `mcp__claude_ai_Notion__*` | Notion MCP | Not currently used in this project |
| `mcp__claude_ai_Google_Drive__*` | Google Drive MCP | Not currently used |

**Note:** `mcp__supabase__*` tools are configured in `~/.claude/mcp.json` but **do not load in VSCode extension sessions**. Always use the Supabase REST API fallback for DB work. See memory: `reference-supabase-mcp`.

---

## New device setup (first time only)

```bash
# 1. Clone and install
git clone <repo-url>
cd lever-claude
npm install

# 2. Environment
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#           SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

# 3. MCP config
cp .mcp.json.example .mcp.json
# Fill in: supabase project_ref and Bearer PAT
# project_ref: avzhlaxhopzmrjnmregc
# PAT: from https://supabase.com/dashboard/account/tokens

# 4. Start dev server
npm run dev

# 5. Run startup check
# (run the quick check block above)
```
