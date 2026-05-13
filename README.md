# lever

A financial planning tool with an AI-powered Claude integration. Play out financial decisions — retirement timelines, contribution rates, what-if scenarios — before you make them.

---

## Quick reference

| | URL |
|---|---|
| **Web app + MCP server (production)** | https://lever-claude.vercel.app |
| **MCP endpoint (production)** | https://lever-claude.vercel.app/api/mcp |
| **Local dev** | http://localhost:3000 |
| **MCP endpoint (local)** | http://localhost:3000/api/mcp |

---

## Architecture

This is a single Next.js application that serves both the web UI and the MCP server from one deployment.

```
lever-claude/
├── app/
│   ├── api/mcp/route.ts      ← MCP server (Next.js route handler)
│   ├── plan-widget/          ← Interactive plan UI (rendered in Claude iframe)
│   ├── scenario-widget/      ← Interactive scenario modeler (rendered in Claude iframe)
│   └── ...                   ← Web app pages
├── lib/store.ts              ← Plan data + projection math (stateless, Supabase-ready)
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

No `.env` file is required to run locally. Plan data is seeded in `lib/store.ts`. When Supabase is added, connection strings will go in `.env.local`.

For local testing of iframe UIs inside Claude (which loads widgets from an HTTPS URL), set a tunnel URL:

```bash
# .env.local
BASE_URL=https://xxxx-xxx-xxx.ngrok-free.app
```

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

| URL | Page | Render |
|---|---|---|
| `/` | Homepage / landing | Static |
| `/dashboard` | Metrics, plans, accounts | Static |
| `/connect` | Claude connector setup guide | Static |
| `/plan/[id]` | Plan detail — allocation, projections, scenarios | Dynamic |
| `/account/[id]` | Account detail — balance, stats, transactions | Dynamic |
| `/plan-widget` | Plan dashboard iframe UI (for Claude) | Static |
| `/scenario-widget` | Scenario modeler iframe UI (for Claude) | Static |
| `/api/mcp` | MCP server endpoint | Dynamic |
| `/api/plans` | Returns all plans as JSON | Dynamic |
| `/api/health` | Health check — returns `{status:"ok", timestamp}` | Dynamic |

**Seeded IDs:**
- Plans: `retire-65`, `retire-60`
- Accounts: `roth-ira`, `401k`, `mortgage`

---

## MCP server

### Tools

| Tool | Response type | What Claude does |
|---|---|---|
| `show_financial_plan` | Interactive UI | Renders the plan dashboard as an iframe in the chat |
| `run_what_if` | Interactive UI | Opens the scenario modeler with sliders in the chat |
| `update_contribution` | Plain text | Computes and returns a new projected balance for a given monthly savings amount |

### Interactive UI pattern

`show_financial_plan` and `run_what_if` use the [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview). Each tool declares a `_meta.ui.resourceUri` pointing to a `ui://` resource. When Claude calls the tool, it fetches that resource — the MCP route self-fetches the rendered Next.js page at `/plan-widget` or `/scenario-widget` and returns it as the iframe HTML. The iframe uses `@modelcontextprotocol/ext-apps` client-side to receive the tool result and call tools back through Claude bidirectionally.

This pattern is currently supported by Claude only. Other MCP clients (Cursor, Copilot) will call the tools but won't render the iframe.

### Stateless design

`update_contribution` computes and returns without writing anywhere. Plan data is read from `lib/store.ts` (hardcoded). When Supabase is added, reads become DB queries and writes get persisted — the tool signature stays the same.

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
│   ├── dashboard/page.tsx          /dashboard
│   ├── connect/page.tsx            /connect  Claude connector setup guide
│   ├── plan/[id]/page.tsx          /plan/:id  (dynamic)
│   ├── account/[id]/page.tsx       /account/:id  (dynamic)
│   ├── plan-widget/page.tsx        /plan-widget  iframe UI for Claude
│   ├── scenario-widget/page.tsx    /scenario-widget  iframe UI for Claude
│   └── api/mcp/route.ts            /api/mcp  MCP server endpoint
│
├── lib/
│   └── store.ts                    Read-only plan data + projection math
│
│  ── Config ────────────────────────────────────────────────────
├── baseUrl.ts                      Resolves public URL from Vercel env vars
├── proxy.ts                        Global CORS headers (Next.js 16)
├── next.config.ts                  assetPrefix for iframe asset loading
├── tsconfig.json
├── package.json
│
│  ── Tooling ───────────────────────────────────────────────────
├── .claude/skills/playwright-cli/  Browser automation skill for Claude Code
├── .mcp.json                       Claude Code connector → localhost:3000/api/mcp
└── .gitignore
```

---

## Known limitations (skeleton stage)

| Limitation | Impact | Fix when |
|---|---|---|
| Data is hardcoded in `lib/store.ts` | `update_contribution` computes but doesn't persist | Adding Supabase |
| No authentication | All routes and MCP tools are public | Adding auth layer |
| Nav header duplicated across 4 pages | Update in 4 files instead of 1 | Add `app/dashboard/layout.tsx` |
| MCP interactive UI is Claude-only | Other MCP clients get text responses, no iframe | MCP Apps spec matures across clients |
