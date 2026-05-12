# lever

A financial planning tool with an AI-powered Claude integration. Play out financial decisions — retirement timelines, contribution rates, what-if scenarios — before you make them.

The project has two parts that deploy independently:

| Part | Directory | Deployed to |
|---|---|---|
| Web app | `/` (root) | Vercel |
| MCP server | `mcp-server/` | Railway |

---

## Prerequisites

- **Node.js 18+** (v24 recommended — run `node --version` to check)
- **npm 9+**

---

## Local development

### Web app

```bash
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### MCP server

```bash
cd mcp-server
npm install
npm run dev        # builds the UIs then starts the server
```

Server starts at [http://localhost:3001/mcp](http://localhost:3001/mcp).

For Claude Code, `.mcp.json` already points to `localhost:3001`. Restart Claude Code after starting the server.

---

## Deployment

The web app and MCP server deploy independently. The web app goes to **Vercel**. The MCP server goes to **Railway** — it's a long-running Express process and needs a host that keeps it alive, not a serverless platform.

### 1 — Push to GitHub

Both are committed in the same repo. Push it if you haven't already:

```bash
git remote add origin https://github.com/your-username/lever-claude.git
git push -u origin main
```

---

### 2 — Deploy the web app to Vercel

**a. Create an account**

Go to [vercel.com/signup](https://vercel.com/signup) and sign up with GitHub. This gives Vercel permission to read your repositories.

**b. Import the project**

1. Click **Add New → Project**
2. Find `lever-claude` in your repository list and click **Import**
3. Vercel detects Next.js automatically and pre-fills all build settings — leave everything as the default:
   - Framework: Next.js
   - Root directory: `/`
   - Build command: `next build`
   - Install command: `npm install`
4. Click **Deploy**

The build takes about 60 seconds. When it finishes you get a live URL:

```
https://lever-claude.vercel.app
```

**c. Every future deploy is automatic**

From this point on, every `git push` to `main` triggers a new Vercel build and updates the live URL. Every pull request gets its own separate preview URL automatically.

---

### 3 — Deploy the MCP server to Railway

Railway is the recommended host for the MCP server. It runs Node.js processes continuously (no sleeping), scales on demand, and deploys from GitHub the same way Vercel does.

**a. Create an account**

Go to [railway.app](https://railway.app) and sign up with GitHub.

**b. Create a new project**

1. Click **New Project → Deploy from GitHub repo**
2. Select the `lever-claude` repository
3. Railway will detect the repo. Before it deploys, click **Configure** (or go to the service settings after creation)

**c. Set the root directory**

This is the most important step. The MCP server lives in a subdirectory, not the repo root.

1. In your Railway service, go to **Settings → Source**
2. Set **Root Directory** to `mcp-server`
3. Railway now treats `mcp-server/` as the project root — it installs dependencies from `mcp-server/package.json` and runs scripts from there

**d. Set the build and start commands**

Railway auto-detects `npm run build` and `npm start` from `package.json`. Both are already configured:

- **Build command:** `npm run build` — runs Vite to bundle the two React UIs
- **Start command:** `npm start` — starts the Express MCP server

You can verify or override these in **Settings → Deploy**.

**e. Deploy**

Click **Deploy**. Railway runs `npm install`, then `npm run build`, then `npm start`.

When the deploy completes, go to **Settings → Networking → Generate Domain**. Railway creates a `*.up.railway.app` URL on demand — it is not created automatically.

The Lever MCP server is live at:

```
https://lever-claude-production.up.railway.app/mcp
```

**f. Auto-deploy on every merge to main**

Yes — Railway deploys automatically on every push to `main`, the same as Vercel. The trigger is configured under **Settings → Deploy → Branch**. It defaults to `main`. Every `git push` or merged pull request redeploys within about 60 seconds, with zero manual steps.

To redeploy without a code change (e.g. after updating an environment variable), click **Redeploy** from the deployment history in the Railway dashboard.

---

### 4 — Connect the deployed MCP server to Claude

**Claude.ai (web or desktop)**

Custom connectors require a paid Claude plan (Pro, Max, or Team).

1. Open Claude → click your profile picture → **Settings**
2. Go to **Connectors**
3. Click **Add custom connector**
4. Paste your Railway MCP URL: `https://lever-claude-production.up.railway.app/mcp`
5. Click **Save**

Claude will now offer Lever tools in every conversation. Try:

- *"Show me my financial plan"* → renders the interactive plan dashboard
- *"Run a what-if scenario for retiring at 60"* → opens the scenario modeler with sliders
- *"Update my monthly savings to $4,000"*

**Claude Code (local development only)**

`.mcp.json` at the project root already configures Claude Code for local dev. When developing, start the MCP server locally and Claude Code connects automatically:

```json
{
  "mcpServers": {
    "lever": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

---

## MCP server details

The MCP server uses the [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) extension to render interactive React UIs as iframes directly inside the Claude chat window — not just plain text responses.

### Tools

| Tool | Type | Description |
|---|---|---|
| `show_financial_plan` | Interactive UI | Renders the plan dashboard as a live iframe in Claude |
| `run_what_if` | Interactive UI | Opens the scenario modeler with sliders in Claude |
| `update_contribution` | Plain text | Updates the monthly savings contribution for a plan |

### How the interactive UIs work

When Claude calls `show_financial_plan` or `run_what_if`, the tool response includes a `_meta.ui.resourceUri` that points to a `ui://` resource. Claude fetches that resource — a self-contained HTML file bundled with React — and renders it as a sandboxed iframe in the conversation. The iframe communicates back to the MCP server bidirectionally: the user can interact with the UI, and clicking "Apply" calls `update_contribution` back through Claude to the server.

### Stack

- **@modelcontextprotocol/sdk** — MCP server and Streamable HTTP transport
- **@modelcontextprotocol/ext-apps** — MCP Apps tool/resource registration and iframe protocol
- **Express** — HTTP server wrapping the MCP transport
- **Vite** + **vite-plugin-singlefile** — bundles each React UI into one self-contained HTML file
- **zod** — input schema validation

---

## Web app

### Routes

| URL | Page |
|---|---|
| `/` | Homepage / landing |
| `/dashboard` | Financial overview — metrics, plans, accounts |
| `/plan/[id]` | Plan detail — allocation, projections, scenarios |
| `/account/[id]` | Account detail — balance, stats, transactions |

Seeded plan IDs: `retire-65`, `retire-60`
Seeded account IDs: `roth-ira`, `401k`, `mortgage`

### Build

```bash
npm run build   # type-check + production build
npm run start   # serve the production build locally
npm run lint    # run ESLint
```

### Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4** — color tokens in `app/globals.css`
- **TypeScript 5**

---

## Developer tools

### playwright-cli

The `playwright-cli` skill is installed at `.claude/skills/playwright-cli/`. It lets Claude Code open a real browser, navigate pages, and verify UI state during development.

**Firefox is required** in this environment (Chromium needs system libraries that require sudo to install in WSL). Firefox was installed during initial setup:

```bash
playwright-cli install-browser firefox
```

Verify all routes are working:

```bash
playwright-cli open --browser=firefox http://localhost:3000/
playwright-cli snapshot
playwright-cli goto http://localhost:3000/dashboard
playwright-cli goto http://localhost:3000/plan/retire-65
playwright-cli goto http://localhost:3000/account/roth-ira
playwright-cli goto http://localhost:3000/account/fake-id   # should 404
playwright-cli close
```

---

## Project structure

```
lever-claude/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── globals.css             # Tailwind + brand color tokens
│   ├── page.tsx                # / homepage
│   ├── dashboard/
│   │   └── page.tsx            # /dashboard
│   ├── plan/[id]/
│   │   └── page.tsx            # /plan/:id  (dynamic)
│   └── account/[id]/
│       └── page.tsx            # /account/:id  (dynamic)
│
├── mcp-server/
│   ├── server.ts               # MCP server — tools, resources, Express HTTP
│   ├── src/
│   │   ├── store.ts            # In-memory plan data + projection logic
│   │   ├── plan-app.tsx        # React UI: plan dashboard (renders in Claude)
│   │   └── scenario-app.tsx    # React UI: what-if scenario modeler
│   ├── plan-app.html           # Vite entry point for plan UI
│   ├── scenario-app.html       # Vite entry point for scenario UI
│   └── vite.config.ts          # Bundles UIs into single HTML files
│
├── .claude/
│   └── skills/playwright-cli/ # Browser automation skill for Claude Code
│
├── .mcp.json                   # Claude Code connector (points to localhost:3001)
└── public/                     # Static assets
```

---

## Known limitations (skeleton stage)

- **Data is in-memory.** Plans and accounts reset on every MCP server restart. `update_contribution` changes are lost when Railway redeploys.
- **No authentication.** All routes and MCP tools are public.
- **Nav header is duplicated** across the four app pages — a shared `app/dashboard/layout.tsx` would fix this.
- **`#f08080` (debt/negative color) is hardcoded** in multiple files rather than defined as a CSS variable.
