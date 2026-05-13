import { createMcpHandler } from "mcp-handler";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { baseURL } from "@/baseUrl";
import { plans, projectBalance } from "@/lib/store";

const PLAN_DASHBOARD_URI = "ui://lever/plan-dashboard";
const SCENARIO_URI = "ui://lever/scenario-modeler";

async function fetchWidgetHtml(path: string): Promise<string> {
  const res = await fetch(`${baseURL}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch widget at ${path}: ${res.status}`);
  return res.text();
}

const handler = createMcpHandler(
  async (server) => {
    // ── Resources ──────────────────────────────────────────────────────────────
    // Each resource self-fetches the rendered Next.js page and serves it as the
    // iframe HTML. The CSP allows the iframe to load assets from the same origin.

    registerAppResource(
      server,
      "plan-dashboard",
      PLAN_DASHBOARD_URI,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        const html = await fetchWidgetHtml("/plan-widget");
        return {
          contents: [
            {
              uri: PLAN_DASHBOARD_URI,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
              _meta: {
                ui: {
                  csp: { connectDomains: [baseURL], resourceDomains: [baseURL] },
                },
              },
            },
          ],
        };
      },
    );

    registerAppResource(
      server,
      "scenario-modeler",
      SCENARIO_URI,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        const html = await fetchWidgetHtml("/scenario-widget");
        return {
          contents: [
            {
              uri: SCENARIO_URI,
              mimeType: RESOURCE_MIME_TYPE,
              text: html,
              _meta: {
                ui: {
                  csp: { connectDomains: [baseURL], resourceDomains: [baseURL] },
                },
              },
            },
          ],
        };
      },
    );

    // ── Tools ──────────────────────────────────────────────────────────────────

    registerAppTool(
      server,
      "show_financial_plan",
      {
        title: "Financial Plan Dashboard",
        description:
          "Display an interactive dashboard of the user's Lever retirement plan. Shows projected balance, asset allocation, goal progress, and monthly contribution. Supports plans: retire-65 and retire-60.",
        inputSchema: {
          plan_id: z
            .string()
            .optional()
            .describe("Plan ID to display: retire-65 or retire-60. Defaults to retire-65."),
        },
        _meta: { ui: { resourceUri: PLAN_DASHBOARD_URI } },
      },
      async ({ plan_id }: { plan_id?: string }) => {
        const plan = plans[plan_id ?? "retire-65"] ?? plans["retire-65"];
        return { content: [{ type: "text" as const, text: JSON.stringify(plan) }] };
      },
    );

    registerAppTool(
      server,
      "run_what_if",
      {
        title: "What-If Scenario Modeler",
        description:
          "Open an interactive scenario modeler. The user can adjust retirement age, monthly savings, and expected annual return using sliders to see projected balance and income at retirement.",
        inputSchema: {
          plan_id: z
            .string()
            .optional()
            .describe("Base plan ID to model from: retire-65 or retire-60."),
        },
        _meta: { ui: { resourceUri: SCENARIO_URI } },
      },
      async ({ plan_id }: { plan_id?: string }) => {
        const plan = plans[plan_id ?? "retire-65"] ?? plans["retire-65"];
        return { content: [{ type: "text" as const, text: JSON.stringify(plan) }] };
      },
    );

    // Stateless compute — reads from the static store, computes, returns result.
    // When Supabase is wired up this will read the live plan and persist the update.
    server.tool(
      "update_contribution",
      "Compute the projected retirement outcome for a new monthly savings amount. Returns updated balance, income, and success probability.",
      {
        plan_id: z.string().describe("Plan ID: retire-65 or retire-60."),
        new_amount: z.number().describe("New monthly contribution in dollars."),
      },
      async ({ plan_id, new_amount }) => {
        const plan = plans[plan_id];
        if (!plan) {
          return { content: [{ type: "text" as const, text: `Plan "${plan_id}" not found.` }] };
        }
        const years = plan.targetYear - new Date().getFullYear();
        const projected = projectBalance(
          plan.currentBalance,
          new_amount,
          plan.assumedReturn,
          years,
        );
        const prob = Math.min(
          99,
          Math.max(10, Math.round(50 + (projected / plan.targetBalance) * 40)),
        );
        const income = Math.round((projected * 0.04) / 12);
        return {
          content: [
            {
              type: "text" as const,
              text: `For "${plan.name}": $${new_amount.toLocaleString()}/mo → projected $${projected.toLocaleString()} at retirement. Monthly income: $${income.toLocaleString()}. Success probability: ${prob}%.`,
            },
          ],
        };
      },
    );
  },
  {},
  { basePath: "/api" },
);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
