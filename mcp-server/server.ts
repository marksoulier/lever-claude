import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { plans, projectBalance } from "./src/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: "Lever Financial Planning",
  version: "1.0.0",
});

// ── Tool: show_financial_plan ────────────────────────────────────────────────
// Returns an interactive dashboard of the user's retirement plan rendered
// as an iframe inside Claude.

const planDashboardUri = "ui://lever/plan-dashboard";

registerAppTool(
  server,
  "show_financial_plan",
  {
    title: "Financial Plan Dashboard",
    description:
      "Display an interactive dashboard of the user's Lever retirement plan. Shows projected balance, asset allocation, goal progress, and monthly contribution. Supports both plans: retire-65 and retire-60.",
    inputSchema: {
      plan_id: z
        .string()
        .optional()
        .describe("Plan ID to display. Options: retire-65, retire-60. Defaults to retire-65."),
    },
    _meta: { ui: { resourceUri: planDashboardUri } },
  },
  async (args: { plan_id?: string }) => {
    const plan = plans[args.plan_id ?? "retire-65"] ?? plans["retire-65"];
    return {
      content: [{ type: "text" as const, text: JSON.stringify(plan) }],
    };
  },
);

registerAppResource(
  server,
  planDashboardUri,
  planDashboardUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile(
      join(__dirname, "dist", "plan-app.html"),
      "utf-8",
    );
    return {
      contents: [{ uri: planDashboardUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);

// ── Tool: run_what_if ────────────────────────────────────────────────────────
// Opens an interactive scenario modeler where the user can drag sliders for
// retirement age, monthly savings, and expected return to see projected impact.

const scenarioUri = "ui://lever/scenario-modeler";

registerAppTool(
  server,
  "run_what_if",
  {
    title: "What-If Scenario Modeler",
    description:
      "Open an interactive scenario modeler. The user can adjust retirement age, monthly savings, and expected annual return using sliders to see the projected balance and monthly income at retirement. Optionally apply the new savings rate directly to the plan.",
    inputSchema: {
      plan_id: z
        .string()
        .optional()
        .describe("Base plan ID to model from. Options: retire-65, retire-60."),
    },
    _meta: { ui: { resourceUri: scenarioUri } },
  },
  async (args: { plan_id?: string }) => {
    const plan = plans[args.plan_id ?? "retire-65"] ?? plans["retire-65"];
    return {
      content: [{ type: "text" as const, text: JSON.stringify(plan) }],
    };
  },
);

registerAppResource(
  server,
  scenarioUri,
  scenarioUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile(
      join(__dirname, "dist", "scenario-app.html"),
      "utf-8",
    );
    return {
      contents: [{ uri: scenarioUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);

// ── Tool: update_contribution ────────────────────────────────────────────────
// Plain data mutation — no UI. Called from within the scenario modeler iframe
// via app.callServerTool(), or directly by Claude.

server.tool(
  "update_contribution",
  "Update the monthly savings contribution for a plan. Returns the updated projected balance.",
  {
    plan_id: z.string().describe("The plan ID to update (retire-65 or retire-60)."),
    new_amount: z.number().describe("New monthly contribution in dollars."),
  },
  async ({ plan_id, new_amount }) => {
    const plan = plans[plan_id];
    if (!plan) {
      return {
        content: [{ type: "text" as const, text: `Plan "${plan_id}" not found.` }],
      };
    }

    const years = plan.targetYear - new Date().getFullYear();
    plan.monthlyContribution = new_amount;
    plan.projectedBalance = projectBalance(
      plan.currentBalance,
      new_amount,
      plan.assumedReturn,
      years,
    );
    plan.successProbability = Math.min(
      99,
      Math.max(10, Math.round(50 + (plan.projectedBalance / plan.targetBalance) * 40)),
    );
    plan.monthlyIncomeAtRetirement = Math.round((plan.projectedBalance * 0.04) / 12);

    return {
      content: [
        {
          type: "text" as const,
          text: `Updated "${plan.name}": monthly contribution → $${new_amount.toLocaleString()}. New projected balance: $${plan.projectedBalance.toLocaleString()}. Success probability: ${plan.successProbability}%.`,
        },
      ],
    };
  },
);

// ── HTTP server ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3001, () => {
  console.log("Lever MCP server running at http://localhost:3001/mcp");
  console.log("Add as a custom connector in Claude: https://<tunnel>.trycloudflare.com/mcp");
});
