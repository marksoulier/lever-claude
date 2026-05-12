# lever

A financial planning tool with an AI-powered Claude integration. Play out financial decisions — retirement timelines, contribution rates, what-if scenarios — before you make them.

---

## Quick reference

| | URL |
|---|---|
| **Web app (production)** | https://lever-claude.vercel.app |
| **MCP server (production)** | https://lever-claude-production.up.railway.app/mcp |
| **Web app (local)** | http://localhost:3000 |
| **MCP server (local)** | http://localhost:3001/mcp |

---

## Architecture

This is a monorepo with two independent packages:

```
lever-claude/
├── /            ← Next.js web app  (deploys to Vercel)
└── mcp-server/  ← Express MCP server  (deploys to Railway)
```

They are **separate Node.js projects** with separate `package.json` files, separate `node_modules`, and separate TypeScript configs. The root `tsconfig.json` explicitly excludes `mcp-server/` so the Next.js compiler never touches MCP server code, and vice versa.

They share nothing at runtime — the web app is a customer-facing UI and the MCP server is a Claude integration layer. Both read from the same in-memory data today; when a database is added they will both connect to it.

---

## Environments

There are three environments:

| Environment | Web app | MCP server | Claude connector |
|---|---|---|---|
| **Local dev** | `localhost:3000` | `localhost:3001` | `.mcp.json` → localhost |
| **Preview** | Vercel preview URL (per PR) | Railway (shared, always production) | n/a |
| **Production** | `lever-claude.vercel.app` | `lever-claude-production.up.railway.app` | Custom connector in Claude |

**Preview deployments:** Every pull request to `main` gets its own Vercel preview URL automatically (e.g. `lever-claude-git-my-branch.vercel.app`). Railway does not create preview environments — all branches share the same Railway deployment.

**Auto-deploy on merge:** Both Vercel and Railway watch the `main` branch. Every `git push` to `main` triggers both to rebuild and redeploy automatically within ~60 seconds. No manual steps required after initial setup.

---

## Prerequisites

- **Node.js 18+** (v24 recommended — `node --version` to check)
- **npm 9+**
- A GitHub account (both Vercel and Railway deploy from GitHub)

---

## Local development

You need two terminals — one for each package.

### Terminal 1 — Web app

```bash
# from repo root
npm install
npm run dev
```

Starts Next.js at **http://localhost:3000**.

### Terminal 2 — MCP server

```bash
cd mcp-server
npm install
npm run dev   # builds the React UIs, then starts Express
```

Starts the MCP server at **http://localhost:3001/mcp**.

`npm run dev` in the MCP server does two things in sequence:
1. Runs Vite twice to bundle `plan-app.tsx` and `scenario-app.tsx` into self-contained HTML files in `dist/`
2. Starts the Express server which serves those HTML files as MCP resources

If you only change server logic (not the React UIs), you can skip the build and run `npm run serve` directly.

### Claude Code connector (local)

`.mcp.json` at the repo root points Claude Code to your local MCP server:

```json
{
  "mcpServers": {
    "lever": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Start the MCP server first, then restart Claude Code if it doesn't pick it up automatically. In Claude Code you can then say *"show me my financial plan"* and the tools will call your local server.

### No environment variables needed locally

Neither package requires a `.env` file to run. All data is seeded in-memory in `mcp-server/src/store.ts`. When a database is added, connection strings will go in `.env.local` (web app) and a Railway environment variable (MCP server).

---

## Deployment

### Web app → Vercel

Vercel was chosen because it built Next.js and has native support for its App Router, static pages, and serverless dynamic routes. No configuration file is needed — Vercel auto-detects everything.

**Initial setup (one time):**

1. Go to [vercel.com/signup](https://vercel.com/signup) → sign up with GitHub
2. **Add New → Project** → import `lever-claude`
3. Vercel auto-fills all settings — leave them as-is:
   - Framework: Next.js
   - Root directory: `./`
   - Build command: `next build`
   - Install command: `npm install`
4. Click **Deploy**

Build takes ~60 seconds. The live URL appears on the success screen.

**After that, deploys are automatic.** Every push to `main` rebuilds and republishes.

**Build output:** Vercel splits the build into static files (served from CDN globally) and serverless functions (for dynamic routes):

```
○ /               static  — served from CDN
○ /dashboard      static  — served from CDN
○ /connect        static  — served from CDN
ƒ /plan/[id]      dynamic — serverless function
ƒ /account/[id]   dynamic — serverless function
```

---

### MCP server → Railway

Railway was chosen because it runs Node.js processes continuously — no sleeping, no cold starts. Vercel's serverless model isn't suited for a long-running Express server that holds in-memory state.

**Initial setup (one time):**

1. Go to [railway.app](https://railway.app) → sign up with GitHub
2. **New Project → Deploy from GitHub repo** → select `lever-claude`
3. In the service settings → **Settings → Source** → set **Root Directory** to `mcp-server`

   > This is the critical step. Without it Railway sees the repo root, finds the Next.js `package.json`, and tries to deploy the web app instead of the MCP server.

4. Confirm build and start commands in **Settings → Deploy**:
   - Build command: `npm run build`
   - Start command: `npm start`
5. Click **Deploy**
6. Go to **Settings → Networking → Generate Domain** — Railway does not create a public URL automatically, you must click this button

**After that, deploys are automatic.** Every push to `main` rebuilds and redeploys.

**How the build works on Railway:**
1. `npm install` — installs all mcp-server dependencies including Vite and React
2. `npm run build` — runs Vite twice to bundle the two React UI apps into `dist/`
3. `npm start` — starts Express; reads `dist/*.html` to serve as MCP UI resources

**PORT:** Railway injects a `PORT` environment variable. `server.ts` reads it with `process.env.PORT || 3001`. Do not hardcode 3001 in production.

---

### Connecting to Claude

The web app has a `/connect` page with step-by-step instructions. From the dashboard, click **Set up connector**.

**Short version (Pro/Max personal plan):**

1. Open Claude → **Customize → Connectors**
2. Click **+** → **Add custom connector**
3. Paste `https://lever-claude-production.up.railway.app/mcp`
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

**Seeded IDs:**
- Plans: `retire-65`, `retire-60`
- Accounts: `roth-ira`, `401k`, `mortgage`

Try `/plan/fake-id` or `/account/fake-id` to verify the 404 handler.

---

## MCP server

### Tools

| Tool | Response type | What Claude does |
|---|---|---|
| `show_financial_plan` | Interactive UI | Renders the plan dashboard as an iframe in the chat |
| `run_what_if` | Interactive UI | Opens the scenario modeler with sliders in the chat |
| `update_contribution` | Plain text | Mutates the monthly savings contribution for a plan |

### Interactive UI pattern

`show_financial_plan` and `run_what_if` use the [MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview). Each tool declares a `_meta.ui.resourceUri` pointing to a `ui://` resource. When Claude calls the tool, it fetches that resource — a self-contained React app bundled into a single HTML file by Vite — and renders it as a sandboxed iframe in the conversation. The iframe can call tools back through Claude bidirectionally (e.g. the scenario modeler calls `update_contribution` when the user clicks Apply).

This pattern is currently supported by Claude only. Other MCP clients (Cursor, Copilot) will call the tools but won't render the iframe.

### Stack

- `@modelcontextprotocol/sdk` — MCP server and Streamable HTTP transport
- `@modelcontextprotocol/ext-apps` — MCP Apps tool/resource registration and iframe protocol
- `express` + `cors` — HTTP server
- `vite` + `vite-plugin-singlefile` — bundles each React UI into one HTML file
- `zod` — input schema validation for tools

---

## Web app stack

- **Next.js 16** App Router
- **React 19**
- **Tailwind CSS v4** — brand color tokens defined in `app/globals.css`
- **TypeScript 5**

### Useful commands (run from repo root)

```bash
npm run dev     # start dev server
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
│  ── Web app (Vercel) ──────────────────────────────────────
├── app/
│   ├── layout.tsx              Root layout — fonts, metadata
│   ├── globals.css             Tailwind import + brand color tokens
│   ├── page.tsx                /  homepage
│   ├── dashboard/page.tsx      /dashboard
│   ├── connect/page.tsx        /connect  Claude connector setup guide
│   ├── plan/[id]/page.tsx      /plan/:id  (dynamic)
│   └── account/[id]/page.tsx   /account/:id  (dynamic)
│
├── public/                     Static assets
├── next.config.ts              Next.js config
├── tsconfig.json               Next.js TypeScript config (excludes mcp-server/)
├── package.json                Web app dependencies
│
│  ── MCP server (Railway) ──────────────────────────────────
└── mcp-server/
    ├── server.ts               Entry point — tools, resources, Express HTTP
    ├── src/
    │   ├── store.ts            In-memory plan data + projection math
    │   ├── plan-app.tsx        React UI: plan dashboard (iframe in Claude)
    │   └── scenario-app.tsx    React UI: what-if scenario modeler
    ├── plan-app.html           Vite HTML entry for plan UI
    ├── scenario-app.html       Vite HTML entry for scenario UI
    ├── vite.config.ts          Bundles each UI into a single self-contained HTML file
    ├── tsconfig.json           MCP server TypeScript config (independent of root)
    └── package.json            MCP server dependencies (independent of root)

│  ── Tooling ───────────────────────────────────────────────
├── .claude/skills/playwright-cli/   Browser automation skill for Claude Code
├── .mcp.json                        Claude Code connector → localhost:3001
└── .gitignore                       Excludes node_modules, dist/, .playwright-cli/
```

---

## Known limitations (skeleton stage)

| Limitation | Impact | Fix when |
|---|---|---|
| Data is in-memory | `update_contribution` resets on every Railway redeploy | Adding a database |
| No authentication | All routes and MCP tools are public | Adding auth layer |
| Nav header duplicated across 4 pages | Update in 4 files instead of 1 | Add `app/dashboard/layout.tsx` |
| `#f08080` debt color hardcoded | Color change requires hunting multiple files | Add `--lever-salmon` to `globals.css` |
| MCP interactive UI is Claude-only | Other MCP clients get text responses, no iframe | MCP Apps spec matures across clients |
