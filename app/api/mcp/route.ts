import { createMcpHandler } from "mcp-handler";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { baseURL } from "@/baseUrl";
import { projectBalance } from "@/lib/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";

const PLAN_DASHBOARD_URI = "ui://lever/plan-dashboard";
const SCENARIO_URI = "ui://lever/scenario-modeler";

async function fetchWidgetHtml(path: string): Promise<string> {
  const res = await fetch(`${baseURL}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch widget at ${path}: ${res.status}`);
  return res.text();
}

// Created per-request so the token from the URL is captured in the closure.
// On Vercel each serverless invocation is already isolated, so there is no
// shared state concern from creating a new handler per call.
async function handleMcp(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  const admin = createAdminClient();
  let userId: string | null = null;

  if (token) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("api_token", token)
      .single();
    userId = profile?.id ?? null;
  }

  async function fetchPlans(planId?: string) {
    if (!userId) return [];
    let query = admin.from("plans").select("*").eq("user_id", userId);
    if (planId) {
      query = query.eq("id", planId);
    } else {
      query = query.order("created_at", { ascending: false });
    }
    const { data } = await query;
    return ((data as DbPlanRow[]) ?? []).map(planFromRow);
  }

  const handler = createMcpHandler(
    async (server) => {
      // ── Resources ──────────────────────────────────────────────────────────

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
                  ui: { csp: { connectDomains: [baseURL], resourceDomains: [baseURL] } },
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
                  ui: { csp: { connectDomains: [baseURL], resourceDomains: [baseURL] } },
                },
              },
            ],
          };
        },
      );

      // ── Tools ──────────────────────────────────────────────────────────────

      registerAppTool(
        server,
        "show_financial_plan",
        {
          title: "Financial Plan Dashboard",
          description:
            "Display an interactive dashboard of the user's Lever retirement plan. Shows projected balance, asset allocation, goal progress, and monthly contribution.",
          inputSchema: {
            plan_id: z
              .string()
              .optional()
              .describe("UUID of the plan to display. Omit to show the most recent plan."),
          },
          _meta: { ui: { resourceUri: PLAN_DASHBOARD_URI } },
        },
        async ({ plan_id }: { plan_id?: string }) => {
          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No plan found. Create a plan at lever first, then come back.",
                },
              ],
            };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify(plan) }] };
        },
      );

      registerAppTool(
        server,
        "run_what_if",
        {
          title: "What-If Scenario Modeler",
          description:
            "Open an interactive scenario modeler. The user can adjust retirement age, monthly savings, and expected return using sliders to see projected outcomes.",
          inputSchema: {
            plan_id: z
              .string()
              .optional()
              .describe("UUID of the base plan to model from. Omit to use the most recent plan."),
          },
          _meta: { ui: { resourceUri: SCENARIO_URI } },
        },
        async ({ plan_id }: { plan_id?: string }) => {
          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No plan found. Create a plan at lever first, then come back.",
                },
              ],
            };
          }
          return { content: [{ type: "text" as const, text: JSON.stringify(plan) }] };
        },
      );

      server.tool(
        "update_contribution",
        "Compute and save a new monthly contribution for a plan. Returns updated projected balance, monthly income, and success probability.",
        {
          plan_id: z
            .string()
            .optional()
            .describe("UUID of the plan to update. Omit to update the most recent plan."),
          new_amount: z.number().describe("New monthly contribution in dollars."),
        },
        async ({ plan_id, new_amount }: { plan_id?: string; new_amount: number }) => {
          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) {
            return {
              content: [{ type: "text" as const, text: "No plan found." }],
            };
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

          await admin
            .from("plans")
            .update({
              monthly_contribution: new_amount,
              projected_balance: projected,
              success_probability: prob,
              monthly_income_at_retirement: income,
            })
            .eq("id", plan.id);

          return {
            content: [
              {
                type: "text" as const,
                text: `Updated "${plan.name}": $${new_amount.toLocaleString()}/mo → projected $${projected.toLocaleString()} at retirement. Monthly income: $${income.toLocaleString()}. Success probability: ${prob}%.`,
              },
            ],
          };
        },
      );
    },
    {},
    { basePath: "/api" },
  );

  return handler(request);
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
