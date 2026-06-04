# HARNESS.md — Claude AI Readiness Checklist

Everything Claude needs to be fully equipped before working on Lever. If any item in this harness is missing or broken, fix it before proceeding — a misconfigured tool produces unreliable work.

---

## Quick harness check (run at session start)

```bash
export PATH="/Users/mark/.hermes/node/bin:$PATH"  # hermes npm globals (playwright-cli)

echo "── CLI tools ──────────────────────────────────────────────────"
playwright-cli --version 2>/dev/null && echo "playwright-cli ✓" || echo "playwright-cli ✗  →  npm install -g @playwright/cli@latest"
node --version 2>/dev/null && echo "node ✓" || echo "node ✗  →  nvm install --lts"
npx tsc --version 2>/dev/null && echo "tsc ✓" || echo "tsc ✗  →  npm install"
supabase --version 2>/dev/null && echo "supabase CLI ✓" || echo "supabase CLI ✗  →  see install instructions in HARNESS.md"
vercel --version 2>/dev/null && echo "vercel CLI ✓" || echo "vercel CLI ✗  →  npm install -g vercel  (needed for prod logs)"

echo ""
echo "── Supabase CLI — linked & authenticated ──────────────────────"
supabase projects list 2>&1 | grep -q "avzhlaxhopzmrjnmregc" \
  && echo "supabase ✓ linked to avzhlaxhopzmrjnmregc" \
  || echo "supabase ✗  →  run: supabase login  then: supabase link --project-ref avzhlaxhopzmrjnmregc"

echo ""
echo "── Dev server ─────────────────────────────────────────────────"
curl -s http://localhost:3000/api/health 2>/dev/null \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('dev server ✓') if d.get('status')=='ok' else print('dev server ✗')" \
  2>/dev/null || echo "dev server ✗  →  npm run dev"

echo ""
echo "── .env.local keys ────────────────────────────────────────────"
for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
           STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET ANTHROPIC_API_KEY \
           USERJOT_TOKEN NEXT_PUBLIC_POSTHOG_KEY; do
  grep -q "^$key=" .env.local 2>/dev/null && echo "  $key ✓" || echo "  $key ✗  →  add to .env.local"
done

echo ""
echo "── .mcp.json servers ──────────────────────────────────────────"
[ -f .mcp.json ] && python3 -c "
import json
d = json.load(open('.mcp.json'))
for name, cfg in d.get('mcpServers', {}).items():
    has_url = bool(cfg.get('url'))
    auth = cfg.get('headers', {}).get('Authorization', '')
    has_token = not auth or 'YOUR_' not in auth
    status = '✓' if has_url and has_token else '✗  →  fill in token'
    print(f'  {name}: {status}')
" || echo "  .mcp.json ✗  →  cp .mcp.json.example .mcp.json and fill tokens (see below)"

echo ""
echo "── Lever MCP (19 tools) ───────────────────────────────────────"
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | grep -o '"name":"[^"]*"' | wc -l \
  | xargs -I{} sh -c '[ {} -eq 19 ] && echo "Lever MCP ✓ ({} tools)" || echo "Lever MCP ✗ ({} / 19)  →  restart dev server"'

echo ""
echo "── Stripe REST ────────────────────────────────────────────────"
STRIPE_KEY=$(grep "^STRIPE_SECRET_KEY=" .env.local 2>/dev/null | cut -d= -f2)
CODE=$(curl -s "https://api.stripe.com/v1/balance" -u "$STRIPE_KEY:" -o /dev/null -w "%{http_code}" 2>/dev/null)
[ "$CODE" = "200" ] && echo "Stripe ✓" || echo "Stripe ✗ (HTTP $CODE)  →  check STRIPE_SECRET_KEY"

echo ""
echo "── UserJot REST ───────────────────────────────────────────────"
UJ_TOKEN=$(grep "^USERJOT_TOKEN=" .env.local 2>/dev/null | cut -d= -f2)
CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://api.userjot.com/v1/boards" \
  -H "Authorization: Bearer $UJ_TOKEN" 2>/dev/null)
[ "$CODE" -ge 200 ] && [ "$CODE" -lt 300 ] \
  && echo "UserJot ✓ (HTTP $CODE)" || echo "UserJot ✗ (HTTP $CODE)  →  check USERJOT_TOKEN"
```

---

## Services — how each one is attached

### 1. Supabase (database, auth, storage)

**Primary access: Supabase CLI + `supabase:supabase` skill.**

| Item | Value |
|---|---|
| Project ref | `avzhlaxhopzmrjnmregc` |
| CLI binary | `~/.local/bin/supabase` (v2.104.0) |
| Skill | `supabase:supabase` — invoke for any DB, auth, RLS, migration, or storage task |
| App credentials | `.env.local` — see keys below |

**Install (macOS, no Homebrew):**
```bash
# Download latest arm64 binary to ~/.local/bin (already on PATH)
LATEST=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])")
curl -sL "https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz" \
  -o /tmp/supabase_cli.tar.gz
tar -xzf /tmp/supabase_cli.tar.gz -C /tmp
mv /tmp/supabase ~/.local/bin/supabase
supabase --version
```

**Login and link (one-time per machine):**
```bash
supabase login                                                  # opens browser OAuth
supabase link --project-ref avzhlaxhopzmrjnmregc               # link to Lever project
supabase projects list                                          # verify — should show avzhlaxhopzmrjnmregc
```

If you prefer a non-interactive login (CI or no browser), set the env var instead:
```bash
export SUPABASE_ACCESS_TOKEN=<your-pat>   # PAT from supabase.com/dashboard/account/tokens
# Add to .env.local if you want it persistent (it's gitignored)
```

**Common CLI operations:**
```bash
supabase db query "select count(*) from auth.users"   # query the remote DB
supabase db pull --local --yes                         # generate migration from current diff
supabase migration list                                # show migration history
supabase db advisors                                   # security + perf warnings (v2.81.3+)
supabase logs --project-ref avzhlaxhopzmrjnmregc      # tail live logs
```

**App credentials in `.env.local`:**

| Key | How to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page — "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — "service_role" key — **server-only, never expose client-side** |

**Verify:**
```bash
supabase --version && supabase projects list 2>&1 | grep avzhlaxhopzmrjnmregc && echo "✓"
```

---

### 2. Stripe (payments, subscriptions)

| Item | Value |
|---|---|
| Access method | REST API via curl — no MCP in this environment |
| REST base URL | `https://api.stripe.com/v1` |

**Tokens needed:**

| Key | Where it lives | How to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | `.env.local` | [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` | Dashboard → Developers → Webhooks → your endpoint → Signing secret |

**Verify:**
```bash
STRIPE_KEY=$(grep "^STRIPE_SECRET_KEY=" .env.local | cut -d= -f2)
curl -s "https://api.stripe.com/v1/balance" -u "$STRIPE_KEY:" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('Stripe ✓ — available:', d.get('available'))"
```

**Common operations:**
```bash
STRIPE_KEY=$(grep "^STRIPE_SECRET_KEY=" .env.local | cut -d= -f2)
curl -s "https://api.stripe.com/v1/subscriptions?status=active" -u "$STRIPE_KEY:"
curl -s "https://api.stripe.com/v1/payment_intents?limit=10" -u "$STRIPE_KEY:"
curl -s "https://api.stripe.com/v1/balance" -u "$STRIPE_KEY:"
```

---

### 3. UserJot (user feedback)

| Item | Value |
|---|---|
| Dashboard | `lever.userjot.com` |
| MCP connection | `.mcp.json` → `mcpServers.userjot` (HTTP MCP at `https://api.userjot.com/v1/mcp`) |
| REST base URL | `https://api.userjot.com/v1` |

**Tokens needed:**

| Key | Where it lives | How to get it |
|---|---|---|
| `USERJOT_TOKEN` | `.env.local` | [UserJot Dashboard → Settings → API](https://lever.userjot.com/settings) |
| Bearer token | `.mcp.json` → `mcpServers.userjot.headers.Authorization` | Same token — format: `Bearer uj_live_...` |

**Verify:**
```bash
UJ_TOKEN=$(grep "^USERJOT_TOKEN=" .env.local | cut -d= -f2)
curl -s -o /dev/null -w "%{http_code}" "https://api.userjot.com/v1/boards" \
  -H "Authorization: Bearer $UJ_TOKEN"
# Expect: 200
```

**Pull recent feedback:**
```bash
UJ_TOKEN=$(grep "^USERJOT_TOKEN=" .env.local | cut -d= -f2)
curl -s "https://api.userjot.com/v1/posts?limit=20&sort=newest" \
  -H "Authorization: Bearer $UJ_TOKEN" | python3 -c "
import json, sys
posts = json.load(sys.stdin).get('data', [])
for p in posts:
    print(f'[{p[\"status\"]}] {p[\"title\"]} — {p.get(\"votes\",0)} votes')
"
```

---

### 4. Anthropic API (document processing, Claude Haiku summarization)

| Item | Value |
|---|---|
| Used for | Document upload → Haiku summarization; Files API for `read_document` tool |
| Models | `claude-haiku-4-5-20251001` for summaries; `claude-sonnet-4-6` for main work |

**Tokens needed:**

| Key | Where it lives | How to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | `.env.local` | [Anthropic Console → API Keys](https://console.anthropic.com/settings/keys) |

**Verify:**
```bash
ANTH_KEY=$(grep "^ANTHROPIC_API_KEY=" .env.local | cut -d= -f2)
curl -s "https://api.anthropic.com/v1/models" \
  -H "x-api-key: $ANTH_KEY" -H "anthropic-version: 2023-06-01" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('Anthropic ✓ —', len(d.get('data',[])), 'models')"
```

---

### 5. Vercel (deployment, function logs)

**Why this is needed:** Diagnosing production-only bugs (e.g. a tool that works locally but not on Vercel) requires reading serverless function logs. Without the CLI, there's no way to see `console.error` output from production handlers — the only option is blind workarounds.

| Item | Value |
|---|---|
| Install | `npm install -g vercel` |
| Dashboard | `https://vercel.com/mark-souliers-projects/lever-claude` |
| CLI docs | `vercel --help` |

**Install and link:**
```bash
npm install -g vercel
vercel login                              # opens browser OAuth — use GitHub
vercel link                               # link to lever-claude project (prompts for org/project)
vercel whoami                             # verify: should print your username
```

**Common operations:**
```bash
# Tail live function logs (most important for debugging)
vercel logs lever-claude.vercel.app --follow

# Read recent logs without streaming
vercel logs lever-claude.vercel.app

# List recent deployments
vercel ls lever-claude

# Inspect a specific deployment
vercel inspect <deployment-url>

# Show current env vars (redacted)
vercel env ls
```

**What I can diagnose with this:**
- `[MCP] run_monte_carlo registration failed: <error>` — the exact error causing the tool to be missing from production
- Any `console.error` from serverless handlers
- Cold-start failures, module import errors, initialization timeouts

**Verify:**
```bash
vercel whoami && vercel ls lever-claude --limit 3 && echo "Vercel CLI ✓"
```

---

### 6. PostHog (product analytics)

| Item | Value |
|---|---|
| Dashboard | `https://us.posthog.com` |
| Used for | Page views, feature usage, funnel analysis |
| MCP | `mcp__posthog__*` tools available in Claude.ai sessions |

**Tokens needed:**

| Key | Where it lives | How to get it |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | `.env.local` | PostHog Dashboard → Project → Settings → Project API Key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `.env.local` | `https://us.i.posthog.com` (already set) |

---

### 6. Lever MCP server (product tools for Claude users)

| Item | Value |
|---|---|
| Dev URL | `http://localhost:3000/api/mcp` |
| Prod URL | `https://lever-claude.vercel.app/api/mcp` |
| Claude.ai connector | `mcp__claude_ai_Lever_Business__*` (19 tools) |
| Auth | None — localhost only for dev; prod uses user's Supabase session cookie |
| Tools | 19 total — see STARTUP.md for the full list |

**No token needed.** The dev server must be running (`npm run dev`).

**Verify:**
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | grep -o '"name":"[^"]*"' | wc -l
# Expect: 19
```

---

## `.mcp.json` setup (project-level, never committed)

```bash
cp .mcp.json.example .mcp.json
```

Edit `.mcp.json` — only two entries needed:

```json
{
  "mcpServers": {
    "lever": {
      "url": "http://localhost:3000/api/mcp"
    },
    "userjot": {
      "type": "http",
      "url": "https://api.userjot.com/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_USERJOT_TOKEN>"
      }
    }
  }
}
```

Supabase is **not** in `.mcp.json` — it's accessed via the CLI and the `supabase:supabase` skill.

---

## Claude Code skills

These are slash-command skills available in every Claude Code session. Invoke via the `Skill` tool.

| Skill | When to use | What it does |
|---|---|---|
| `supabase:supabase` | **Any Supabase task** | Full Supabase CLI workflow — schema changes, migrations, auth, RLS, storage. This is the primary DB tool. |
| `supabase:supabase-postgres-best-practices` | Query/schema review | Postgres performance and design guidance |
| `playwright-cli` | Any UI change | Automates browser for visual verification — required for every UI change |
| `verify` | "verify this works" | Runs the app and observes behavior before marking a task done |
| `code-review` | `/code-review` | Reviews current diff for bugs and simplification |
| `simplify` | `/simplify` | Reviews changed code for cleanup and efficiency |
| `run` | "run the app" | Launches dev server and screenshots the app |
| `security-review` | `/security-review` | Full security audit of pending changes |
| `schedule` | "schedule this task" | Creates recurring remote agents on a cron schedule |
| `update-config` | "from now on do X" | Modifies `settings.json` for hooks, permissions, env vars |
| `claude-api` | Anthropic SDK code | Claude API dev, prompt caching, model migrations |
| `synthetic-users` | "test with real users" | Simulates customer personas walking through the product |
| `loop` | `/loop` | Runs a prompt or command on a recurring interval |

---

## Session-level MCP tools (from Claude.ai connectors)

Loaded automatically via the VSCode extension connected to Claude.ai. No local config needed.

| Tool prefix | Service | Status | What it does |
|---|---|---|---|
| `mcp__claude_ai_Lever_Business__*` | Lever MCP server | ✓ Always available | All 19 Lever product tools — same tools users call |
| `mcp__claude_ai_Era_Context__*` | Era Context | ✓ Always available | Personal finance MCP (not used in Lever work) |
| `mcp__claude_ai_Google_Drive__*` | Google Drive | ✓ Always available | File access (not currently used in Lever work) |
| `mcp__claude_ai_Notion__*` | Notion | ✓ Always available | Notion pages (not currently used in Lever work) |
| `mcp__posthog__*` | PostHog | ✓ Loads on demand | Analytics queries |
| `mcp__stripe__*` | Stripe | ✗ Not in session | Use REST API fallback (see Stripe section above) |

---

## `.env.local` — full key reference

All keys that must be present. None are committed. Template is in `.env.example`.

| Key | Required | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase client (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase client (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Supabase admin client (server-only) — bypasses RLS |
| `STRIPE_SECRET_KEY` | ✓ | Stripe API (server-only) |
| `STRIPE_WEBHOOK_SECRET` | ✓ | Stripe webhook signature verification |
| `ANTHROPIC_API_KEY` | ✓ | Document summarization, Files API |
| `USERJOT_TOKEN` | ✓ | UserJot feedback API |
| `NEXT_PUBLIC_POSTHOG_KEY` | ✓ | PostHog analytics (browser) |
| `NEXT_PUBLIC_POSTHOG_HOST` | ✓ | PostHog host URL |
| `ADMIN_EMAILS` | optional | Comma-separated admin emails (defaults to `marksoulkid@gmail.com,admin@lever.dev`) |

---

## New machine setup — getting fully equipped

Run in order. Verify each step before moving on.

```bash
# 1. Clone and install
git clone <repo-url> lever-claude && cd lever-claude
npm install

# 2. Create .env.local — ask the founder for real values
cp .env.example .env.local
# Fill in all keys from the table above

# 3. Create .mcp.json — only needs UserJot token
cp .mcp.json.example .mcp.json
# Set userjot → Bearer <USERJOT_TOKEN>  (from lever.userjot.com/settings → API)
# Remove the supabase entry — not needed

# 4. Install Supabase CLI
curl -sL "https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz" \
  | tar -xz -C /tmp && mv /tmp/supabase ~/.local/bin/supabase
supabase --version

# 5. Authenticate and link Supabase
supabase login                                          # opens browser
supabase link --project-ref avzhlaxhopzmrjnmregc

# 6. Install playwright-cli
npm install -g @playwright/cli@latest
# If not on PATH: add to ~/.zshrc → export PATH="/Users/mark/.hermes/node/bin:$PATH"

# 7. Install Vercel CLI and link to project
npm install -g vercel
vercel login                              # browser OAuth
vercel link                               # select lever-claude project

# 8. Start dev server
npm run dev

# 8. Run the harness check (block at top of this file)
```

**Values to ask the founder for:**
- All `.env.local` keys (Supabase URL, anon key, service role key, Stripe keys, Anthropic key, UserJot token, PostHog key)

---

## What to do if something is missing

| Problem | Fix |
|---|---|
| `playwright-cli: command not found` | `export PATH="/Users/mark/.hermes/node/bin:$PATH"` — binary is installed, just not on PATH. Already added to `~/.zshrc` for new shells. |
| `supabase: command not found` | Install via the curl/tar command in the install section above |
| `supabase projects list` — access token error | Run `supabase login` to authenticate via browser |
| `mcp__claude_ai_Lever_Business__*` not loading | Sign in to Claude.ai in the VSCode extension |
| Stripe tools missing | Use REST API — Stripe MCP not connected at Claude.ai account level |
| UserJot MCP tools missing | Check `.mcp.json` has the correct `uj_live_...` Bearer token; restart Claude Code |
| Dev server MCP tool count wrong | Restart dev server; check `app/api/mcp/route.ts` for TypeScript errors |
| Production-only bug, can't see error | Install Vercel CLI: `npm install -g vercel && vercel login && vercel link` — then `vercel logs lever-claude.vercel.app` |
