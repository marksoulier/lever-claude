# lever

A financial planning tool with an AI-powered Claude integration. Play out financial decisions — retirement timelines, contribution rates, what-if scenarios — before you make them.

The project has two parts:

| Part | Directory | Purpose |
|---|---|---|
| Web app | `/` (root) | Next.js 16 customer-facing UI |
| MCP server | `mcp-server/` | Exposes Lever data and tools to Claude |

---

## Prerequisites

- **Node.js 18+** (v24 recommended — run `node --version` to check)
- **npm 9+**

---

## Web App

### Install

```bash
npm install
```

### Develop

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
npm run start
```

### Routes

| URL | Page |
|---|---|
| `/` | Homepage / landing |
| `/dashboard` | Financial overview — metrics, plans, accounts |
| `/plan/[id]` | Plan detail — allocation, projections, scenarios |
| `/account/[id]` | Account detail — balance, stats, transactions |

Seeded plan IDs: `retire-65`, `retire-60`  
Seeded account IDs: `roth-ira`, `401k`, `mortgage`

### Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4** — color system defined in `app/globals.css`
- **TypeScript 5**

---

## MCP Server

The MCP server runs separately from the web app. It exposes Lever's financial data and tools to Claude via the [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) extension, which renders interactive React UIs as iframes inside the Claude chat window.

### Install

```bash
cd mcp-server
npm install
```

### Build the UIs

The two interactive Claude apps (plan dashboard and scenario modeler) are React apps bundled into single HTML files by Vite:

```bash
npm run build
```

This produces `dist/plan-app.html` and `dist/scenario-app.html`.

### Run the server

```bash
npm run serve
```

Server starts at [http://localhost:3001/mcp](http://localhost:3001/mcp).

### Develop (build + serve in one step)

```bash
npm run dev
```

### Tools exposed to Claude

| Tool | Type | Description |
|---|---|---|
| `show_financial_plan` | Interactive UI | Renders the plan dashboard as an iframe in Claude |
| `run_what_if` | Interactive UI | Opens a scenario modeler with sliders in Claude |
| `update_contribution` | Plain text | Mutates the monthly contribution for a plan |

### Stack

- **@modelcontextprotocol/sdk** — MCP server and HTTP transport
- **@modelcontextprotocol/ext-apps** — MCP Apps tool/resource registration and iframe protocol
- **Express** — HTTP server wrapping the MCP transport
- **Vite** + **vite-plugin-singlefile** — bundles each React UI into one self-contained HTML file
- **zod** — input schema validation for tools

---

## Connecting to Claude

### Claude Code (local)

`.mcp.json` at the project root is already configured. When the MCP server is running on port 3001, Claude Code will connect automatically:

```json
{
  "mcpServers": {
    "lever": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Restart Claude Code after starting the server if it doesn't pick it up automatically.

### Claude.ai (web / desktop)

Claude.ai requires a public URL. Use [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) to tunnel your local server:

```bash
npx cloudflared tunnel --url http://localhost:3001
```

Copy the generated URL (e.g. `https://random-name.trycloudflare.com`) and add it as a custom connector in Claude:

**Settings → Connectors → Add custom connector** → paste `https://random-name.trycloudflare.com/mcp`

> Custom connectors require a paid Claude plan (Pro, Max, or Team).

### What you can say to Claude

Once connected, Claude can call tools by name or by intent:

- *"Show me my financial plan"*
- *"Run a what-if scenario for retiring at 60"*
- *"Update my monthly savings to $4,000"*
- *"What happens if market returns drop to 5%?"*

---

## Developer Tools

### playwright-cli (browser testing)

The `playwright-cli` skill is installed at `.claude/skills/playwright-cli/`. It lets Claude Code open a real browser, navigate pages, take snapshots, and verify UI state.

**Firefox is the working browser in this environment** (Chromium requires system libraries unavailable in WSL without sudo). Firefox was installed during setup:

```bash
playwright-cli install-browser firefox
```

To run a manual verification of all routes:

```bash
playwright-cli open --browser=firefox http://localhost:3000/
playwright-cli snapshot
playwright-cli goto http://localhost:3000/dashboard
playwright-cli goto http://localhost:3000/plan/retire-65
playwright-cli goto http://localhost:3000/account/roth-ira
playwright-cli close
```

---

## Project Structure

```
lever-claude/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx              # Root layout (fonts, metadata)
│   ├── globals.css             # Tailwind + brand color tokens
│   ├── page.tsx                # Homepage
│   ├── dashboard/
│   │   └── page.tsx            # /dashboard
│   ├── plan/[id]/
│   │   └── page.tsx            # /plan/:id  (dynamic)
│   └── account/[id]/
│       └── page.tsx            # /account/:id  (dynamic)
│
├── mcp-server/
│   ├── server.ts               # MCP server — tools, resources, HTTP
│   ├── src/
│   │   ├── store.ts            # In-memory plan data + projection logic
│   │   ├── plan-app.tsx        # React UI: plan dashboard (renders in Claude)
│   │   └── scenario-app.tsx    # React UI: what-if modeler (renders in Claude)
│   ├── plan-app.html           # Vite entry for plan UI
│   ├── scenario-app.html       # Vite entry for scenario UI
│   └── vite.config.ts          # Bundles each UI into a single HTML file
│
├── .claude/
│   └── skills/
│       └── playwright-cli/     # Browser automation skill for Claude Code
│
├── .mcp.json                   # Claude Code MCP connector config
└── public/                     # Static assets
```

---

## Known Limitations (skeleton stage)

- **Data is in-memory.** All plans and accounts are seeded at startup. Changes made via `update_contribution` persist only until the MCP server restarts.
- **No authentication.** All routes are public.
- **Nav header is duplicated** across the four app pages. A shared `layout.tsx` for the authenticated section is the next structural improvement.
- **`#f08080` (debt/negative color) is hardcoded** in several files rather than defined as a CSS variable alongside the teal tokens.
