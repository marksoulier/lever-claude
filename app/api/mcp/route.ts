import Anthropic from "@anthropic-ai/sdk";
import { ADMIN_EMAILS } from "@/lib/admin-auth";
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
import {
  resolveContextDefaults,
  ALLOCATION_BY_RISK,
  type PlanContext,
  type RiskTolerance,
} from "@/lib/plan-context";
import {
  accountFromRow,
  computeNetWorth,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type DbAccountRow,
  type AccountType,
} from "@/lib/accounts";
import { upsertNetWorthSnapshot } from "@/lib/supabase/net-worth-snapshot";
// Simulator infrastructure — see STEERING.md → Simulator infrastructure
import { getEventList, getEventSchema, isValidEventType, nextEventId } from "@/lib/simulator/schema";
import { getHardErrors } from "@/lib/simulator/schema-checker";
import { runSimulation, DEFAULT_ACCOUNTS } from "@/lib/simulator/runner";
import { simulationToScalars, simulationBounds } from "@/lib/simulator/bridge";
import { runMonteCarlo } from "@/lib/simulator/monte-carlo";
import type { PlanData, SimEvent, Parameter } from "@/lib/simulator/types";

const PLAN_DASHBOARD_URI = "ui://lever/plan-dashboard";
const SCENARIO_URI      = "ui://lever/scenario-modeler";
const CASHFLOW_URI      = "ui://lever/cash-flow";

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

      registerAppResource(
        server,
        "cash-flow",
        CASHFLOW_URI,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
          const html = await fetchWidgetHtml("/cashflow-widget");
          return {
            contents: [
              {
                uri: CASHFLOW_URI,
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

      registerAppTool(
        server,
        "show_cash_flow",
        {
          title: "Cash Flow Visualization",
          description:
            "Show an interactive chart of the user's annual net worth growth from today to retirement. Each bar represents one year of net worth change, broken down by cash, retirement, and investment accounts. Use this when the user asks about their year-by-year financial trajectory, annual growth, or wants to see how their wealth builds over time.",
          inputSchema: {
            plan_id: z
              .string()
              .optional()
              .describe("UUID of the plan to visualize. Omit to use the most recent plan."),
          },
          _meta: { ui: { resourceUri: CASHFLOW_URI } },
        },
        async ({ plan_id }: { plan_id?: string }) => {
          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) {
            return { content: [{ type: "text" as const, text: "No plan found. Create a plan first." }] };
          }

          // Fetch plan_data for simulation results
          const { data: raw } = await admin.from("plans").select("plan_data").eq("id", plan.id).single();
          const planData = (raw as any)?.plan_data as import("@/lib/simulator/types").PlanData | null;

          if (!planData?.simulation_results || planData.simulation_results.length < 2) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  planName: plan.name,
                  currentAge: plan.currentAge,
                  retirementAge: plan.retirementAge,
                  birthDate: planData?.birth_date ?? "",
                  points: [],
                }),
              }],
            };
          }

          const results = planData.simulation_results;
          const CASH_CATEGORIES = new Set(["Cash"]);
          const RETIREMENT_CATEGORIES = new Set(["Retirement"]);
          const INVESTMENT_CATEGORIES = new Set(["Investments"]);

          // Build account→category map from planData.accounts
          const accountCategory: Record<string, string> = {};
          for (const acc of planData.accounts ?? []) {
            accountCategory[acc.name] = acc.category;
          }

          const points = results.map((r, i) => {
            const age = Math.floor(r.date / 365.25);
            const prior = i > 0 ? results[i - 1] : null;
            const annualGrowth = prior ? r.value - prior.value : 0;

            // Sum balances by category from parts
            let cash = 0, retirement = 0, investment = 0;
            for (const [name, balance] of Object.entries(r.parts ?? {})) {
              const cat = accountCategory[name] ?? "";
              if (CASH_CATEGORIES.has(cat)) cash += balance;
              else if (RETIREMENT_CATEGORIES.has(cat)) retirement += balance;
              else if (INVESTMENT_CATEGORIES.has(cat)) investment += balance;
            }

            return {
              year: new Date().getFullYear() - (plan.currentAge - age),
              age,
              netWorth: Math.round(r.value),
              annualGrowth: Math.round(annualGrowth),
              cashBalance: Math.round(cash),
              retirementBalance: Math.round(retirement),
              investmentBalance: Math.round(investment),
            };
          });

          const payload = {
            planName: plan.name,
            currentAge: plan.currentAge,
            retirementAge: plan.retirementAge,
            birthDate: planData.birth_date,
            points,
          };

          return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
        },
      );

      server.tool(
        "create_plan",
        "Create a new retirement plan for the user. Use this during onboarding before calling update_plan_context — a plan must exist first. You can optionally provide all context fields (date_of_birth, annual_income, etc.) in a single call to create the plan and set context together. The plan is created as the primary plan if the user has none, otherwise as a what-if scenario.",
        {
          name: z.string().describe("Name for the plan, e.g. 'Retire at 65' or 'My retirement plan'"),
          retirement_age: z.number().int().min(45).max(80).describe("Target retirement age"),
          monthly_contribution: z.number().positive().describe("Monthly savings contribution in dollars"),
          current_balance: z.number().nonnegative().optional().describe("Current total retirement savings in dollars. Default 0 if unknown."),
          date_of_birth: z.string().optional().describe("YYYY-MM-DD — used to compute current age for projections"),
          annual_income: z.number().nonnegative().optional().describe("Annual income in dollars"),
          target_monthly_income: z.number().nonnegative().optional().describe("Desired monthly income in retirement — sets target balance via 4% rule"),
          risk_tolerance: z.enum(["low", "medium", "high"]).optional().describe("Investment risk tolerance. low=5% return, medium=7%, high=9%"),
          narrative: z.string().optional().describe("Free-text context about this plan's assumptions and goals"),
        },
        async ({
          name, retirement_age, monthly_contribution, current_balance = 0,
          date_of_birth, annual_income, target_monthly_income, risk_tolerance, narrative,
        }: {
          name: string; retirement_age: number; monthly_contribution: number; current_balance?: number;
          date_of_birth?: string; annual_income?: number; target_monthly_income?: number;
          risk_tolerance?: RiskTolerance; narrative?: string;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          // Build context from any provided fields
          const ctx: PlanContext = {};
          if (date_of_birth)        ctx.dateOfBirth         = date_of_birth;
          if (annual_income)        ctx.annualIncome        = annual_income;
          if (target_monthly_income) ctx.targetMonthlyIncome = target_monthly_income;
          if (risk_tolerance)       ctx.riskTolerance       = risk_tolerance;
          if (narrative)            ctx.narrative           = narrative;
          const hasContext = Object.keys(ctx).length > 0;

          const { currentAge, assumedReturn, targetBalance } = resolveContextDefaults(
            hasContext ? ctx : null,
            { currentAge: 30, assumedReturn: 7, targetBalance: 1_800_000 },
          );

          if (retirement_age <= currentAge) {
            return { content: [{ type: "text" as const, text: `Retirement age (${retirement_age}) must be greater than current age (${currentAge}). Please check the date of birth.` }] };
          }

          const years          = retirement_age - currentAge;
          const targetYear     = new Date().getFullYear() + years;
          const projected      = projectBalance(current_balance, monthly_contribution, assumedReturn, years);
          const prob           = Math.min(99, Math.max(10, Math.round(50 + (projected / targetBalance) * 40)));
          const income         = Math.round((projected * 0.04) / 12);
          const allocation     = (risk_tolerance ? ALLOCATION_BY_RISK[risk_tolerance] : null)
                                 ?? ALLOCATION_BY_RISK.medium;

          // Check if user already has a primary plan
          const { data: existing } = await admin.from("plans").select("id").eq("user_id", userId).eq("is_primary", true).limit(1);
          const makePrimary = !existing || existing.length === 0;

          const { data, error } = await admin.from("plans").insert({
            user_id:                      userId,
            name,
            retirement_age,
            current_age:                  currentAge,
            target_year:                  targetYear,
            monthly_contribution,
            current_balance,
            target_balance:               targetBalance,
            assumed_return:               assumedReturn,
            inflation:                    2.5,
            projected_balance:            projected,
            success_probability:          prob,
            monthly_income_at_retirement: income,
            is_primary:                   makePrimary,
            context:                      hasContext ? ctx : null,
            allocation,
          }).select().single();

          if (error || !data) {
            return { content: [{ type: "text" as const, text: `Failed to create plan: ${error?.message}` }] };
          }

          const lines = [
            `Created plan "${name}"${makePrimary ? " (set as your primary plan)" : ""}.`,
            ``,
            `Projection (age ${currentAge} → ${retirement_age}):`,
            `• Monthly contribution: $${monthly_contribution.toLocaleString()}`,
            `• Assumed return: ${assumedReturn}% (${risk_tolerance ?? "medium"} risk)`,
            `• Projected balance at retirement: $${projected.toLocaleString()}`,
            `• Target balance: $${targetBalance.toLocaleString()}`,
            `• Monthly income at retirement: $${income.toLocaleString()}`,
            `• Probability of success: ${prob}%`,
            ``,
            prob >= 70
              ? `You're on track. Next, let's add your financial accounts to track net worth.`
              : `There's a gap to close. We can explore ways to improve this — or add your accounts first to get the full picture.`,
          ].join("\n");

          return { content: [{ type: "text" as const, text: lines }] };
        },
      );

      server.tool(
        "update_plan_context",
        "Set or update the personal context for a plan — date of birth, income, retirement income goal, risk tolerance, and a narrative describing assumptions. This triggers a full recomputation of the plan's projections. Call this during onboarding or whenever the user wants to model different personal circumstances. You can update any subset of fields; unset fields are left unchanged.",
        {
          plan_id: z
            .string()
            .optional()
            .describe("UUID of the plan to update. Omit to update the most recently created plan."),
          date_of_birth: z
            .string()
            .optional()
            .describe("User's date of birth in YYYY-MM-DD format. Used to compute current age for projections."),
          annual_income: z
            .number()
            .nonnegative()
            .optional()
            .describe("User's current annual income in dollars."),
          target_monthly_income: z
            .number()
            .nonnegative()
            .optional()
            .describe("Desired monthly income in retirement, in dollars. Used to set the target balance via the 4% rule."),
          risk_tolerance: z
            .enum(["low", "medium", "high"])
            .optional()
            .describe("Investment risk tolerance. low=5% return/conservative allocation, medium=7%/balanced, high=9%/aggressive."),
          narrative: z
            .string()
            .optional()
            .describe("Free-text description of assumptions, goals, and context for this plan. Write this in first person as the user."),
        },
        async ({
          plan_id,
          date_of_birth,
          annual_income,
          target_monthly_income,
          risk_tolerance,
          narrative,
        }: {
          plan_id?: string;
          date_of_birth?: string;
          annual_income?: number;
          target_monthly_income?: number;
          risk_tolerance?: RiskTolerance;
          narrative?: string;
        }) => {
          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) {
            return { content: [{ type: "text" as const, text: "No plan found. Create a plan first." }] };
          }

          const patch: PlanContext = {};
          if (date_of_birth !== undefined)        patch.dateOfBirth         = date_of_birth;
          if (annual_income !== undefined)         patch.annualIncome        = annual_income;
          if (target_monthly_income !== undefined) patch.targetMonthlyIncome = target_monthly_income;
          if (risk_tolerance !== undefined)        patch.riskTolerance       = risk_tolerance;
          if (narrative !== undefined)             patch.narrative           = narrative;

          const merged: PlanContext = { ...(plan.context ?? {}), ...patch };

          const { currentAge, assumedReturn, targetBalance } = resolveContextDefaults(merged, {
            currentAge:    plan.currentAge,
            assumedReturn: plan.assumedReturn,
            targetBalance: plan.targetBalance,
          });

          const years = plan.retirementAge - currentAge;
          const projected = projectBalance(plan.currentBalance, plan.monthlyContribution, assumedReturn, years);
          const prob = Math.min(99, Math.max(10, Math.round(50 + (projected / targetBalance) * 40)));
          const income = Math.round((projected * 0.04) / 12);
          const allocation = merged.riskTolerance
            ? ALLOCATION_BY_RISK[merged.riskTolerance as RiskTolerance]
            : plan.allocation;

          await admin.from("plans").update({
            context:                      merged,
            current_age:                  currentAge,
            assumed_return:               assumedReturn,
            target_balance:               targetBalance,
            target_year:                  new Date().getFullYear() + years,
            projected_balance:            projected,
            success_probability:          prob,
            monthly_income_at_retirement: income,
            allocation,
          }).eq("id", plan.id);

          const lines = [
            `Updated context for "${plan.name}":`,
            merged.dateOfBirth        ? `• Age: ${currentAge} (DOB ${merged.dateOfBirth})` : null,
            merged.annualIncome       ? `• Income: $${merged.annualIncome.toLocaleString()}/year` : null,
            merged.targetMonthlyIncome
              ? `• Retirement income goal: $${merged.targetMonthlyIncome.toLocaleString()}/month → target balance $${(targetBalance / 1_000_000).toFixed(2)}M`
              : null,
            merged.riskTolerance      ? `• Risk tolerance: ${merged.riskTolerance} (${assumedReturn}% assumed return)` : null,
            merged.narrative          ? `• Narrative recorded.` : null,
            ``,
            `Recomputed projections:`,
            `• Projected balance at retirement: $${projected.toLocaleString()}`,
            `• Monthly income: $${income.toLocaleString()}`,
            `• Probability of success: ${prob}%`,
          ].filter((l) => l !== null).join("\n");

          return { content: [{ type: "text" as const, text: lines }] };
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

      // ── Account tools ──────────────────────────────────────────────────────

      server.tool(
        "add_account",
        "Add a financial account for the user. Use this to record assets (cash, investments, real estate) and liabilities (debt). Balance is always entered as a positive number regardless of type — debt balances are subtracted automatically when computing net worth. After adding, a net worth snapshot is auto-logged for today.",
        {
          name:        z.string().describe("Account name, e.g. 'Roth IRA', 'Mortgage', 'Checking'"),
          type:        z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]]).describe("cash | investment | real_estate | debt"),
          balance:     z.number().int().nonnegative().describe("Current balance in whole dollars (always positive)"),
          institution: z.string().optional().describe("Financial institution name, e.g. 'Fidelity', 'Chase'"),
          subtype:     z.string().optional().describe("Optional subtype, e.g. 'Roth IRA', '401k', 'mortgage', 'credit card'"),
        },
        async ({ name, type, balance, institution, subtype }: {
          name: string; type: AccountType; balance: number; institution?: string; subtype?: string;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          const { data, error } = await admin.from("accounts").insert({
            user_id: userId, name, type, balance,
            institution: institution ?? null,
            subtype: subtype ?? null,
          }).select().single();

          if (error || !data) {
            return { content: [{ type: "text" as const, text: `Failed to add account: ${error?.message}` }] };
          }

          // Auto net worth snapshot
          const { data: allAccounts } = await admin.from("accounts").select("*").eq("user_id", userId);
          if (allAccounts) {
            const accounts = (allAccounts as DbAccountRow[]).map(accountFromRow);
            await upsertNetWorthSnapshot(admin, userId, accounts);
            const nw = computeNetWorth(accounts);
            return {
              content: [{
                type: "text" as const,
                text: [
                  `Added "${name}" (${ACCOUNT_TYPE_LABELS[type]}) — $${balance.toLocaleString()}.`,
                  institution ? `Institution: ${institution}.` : null,
                  `Net worth updated to $${nw.toLocaleString()}.`,
                ].filter(Boolean).join(" "),
              }],
            };
          }

          return { content: [{ type: "text" as const, text: `Added "${name}".` }] };
        },
      );

      server.tool(
        "update_account_balance",
        "Update the balance of an existing account by name or ID. Use this whenever the user reports a new balance for an account. Automatically re-logs today's net worth snapshot.",
        {
          account_name: z.string().optional().describe("Account name to update (case-insensitive partial match). Use this OR account_id."),
          account_id:   z.string().optional().describe("Exact account UUID to update. Use this OR account_name."),
          balance:      z.number().int().nonnegative().describe("New balance in whole dollars (always positive)."),
        },
        async ({ account_name, account_id, balance }: {
          account_name?: string; account_id?: string; balance: number;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };
          if (!account_name && !account_id) {
            return { content: [{ type: "text" as const, text: "Provide account_name or account_id." }] };
          }

          let query = admin.from("accounts").select("*").eq("user_id", userId);
          if (account_id) {
            query = query.eq("id", account_id);
          } else if (account_name) {
            query = query.ilike("name", `%${account_name}%`);
          }

          const { data: matches } = await query;
          if (!matches || matches.length === 0) {
            return { content: [{ type: "text" as const, text: `No account found matching "${account_name ?? account_id}".` }] };
          }
          if (matches.length > 1) {
            const names = matches.map((a: DbAccountRow) => `"${a.name}"`).join(", ");
            return { content: [{ type: "text" as const, text: `Multiple matches: ${names}. Be more specific or use account_id.` }] };
          }

          const acct = matches[0] as DbAccountRow;
          await admin.from("accounts").update({ balance, updated_at: new Date().toISOString() }).eq("id", acct.id);

          const { data: allAccounts } = await admin.from("accounts").select("*").eq("user_id", userId);
          const accounts = ((allAccounts ?? []) as DbAccountRow[]).map(accountFromRow);
          await upsertNetWorthSnapshot(admin, userId, accounts);
          const nw = computeNetWorth(accounts);

          return {
            content: [{
              type: "text" as const,
              text: `Updated "${acct.name}" balance to $${balance.toLocaleString()}. Net worth: $${nw.toLocaleString()}.`,
            }],
          };
        },
      );

      // ── What-if tool ───────────────────────────────────────────────────────

      server.tool(
        "create_what_if_plan",
        "Clone the user's primary plan with one or more parameters changed to model a hypothetical scenario. The new plan appears in the sidebar as a what-if scenario and can be compared side-by-side with the primary plan. Use this when the user asks 'what if I retired earlier', 'what if I saved more', 'what if I took more risk', etc. Always give the scenario a descriptive name.",
        {
          name: z
            .string()
            .describe("Descriptive name for the scenario, e.g. 'Retire at 60', 'Aggressive savings', 'Lower risk tolerance'"),
          base_plan_id: z
            .string()
            .optional()
            .describe("UUID of the plan to clone. Omit to clone the primary plan."),
          retirement_age: z
            .number()
            .int()
            .optional()
            .describe("Override retirement age for this scenario."),
          monthly_contribution: z
            .number()
            .positive()
            .optional()
            .describe("Override monthly contribution for this scenario."),
          current_balance: z
            .number()
            .nonnegative()
            .optional()
            .describe("Override current balance for this scenario."),
          risk_tolerance: z
            .enum(["low", "medium", "high"])
            .optional()
            .describe("Override risk tolerance (changes assumed return and allocation)."),
          target_monthly_income: z
            .number()
            .nonnegative()
            .optional()
            .describe("Override desired monthly retirement income (changes target balance via 4% rule)."),
          narrative: z
            .string()
            .optional()
            .describe("Short description of what this scenario is testing."),
        },
        async ({
          name,
          base_plan_id,
          retirement_age,
          monthly_contribution,
          current_balance,
          risk_tolerance,
          target_monthly_income,
          narrative,
        }: {
          name: string;
          base_plan_id?: string;
          retirement_age?: number;
          monthly_contribution?: number;
          current_balance?: number;
          risk_tolerance?: RiskTolerance;
          target_monthly_income?: number;
          narrative?: string;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          // Find base plan — use provided ID, or fall back to primary plan
          let basePlans: ReturnType<typeof planFromRow>[];
          if (base_plan_id) {
            basePlans = await fetchPlans(base_plan_id);
          } else {
            const all = await fetchPlans();
            basePlans = all.filter((p) => p.isPrimary);
            if (basePlans.length === 0) basePlans = all.slice(0, 1);
          }

          const base = basePlans[0];
          if (!base) return { content: [{ type: "text" as const, text: "No base plan found. Create a primary plan first." }] };

          // Fetch plan_data from the base plan so the what-if inherits the full event model (B-12)
          const { data: baseRaw } = await admin.from("plans").select("plan_data").eq("id", base.id).single();
          const basePlanData = (baseRaw as any)?.plan_data ?? null;

          // Merge context overrides
          const baseCtx = base.context ?? {};
          const mergedCtx: PlanContext = {
            ...baseCtx,
            ...(risk_tolerance       ? { riskTolerance: risk_tolerance }             : {}),
            ...(target_monthly_income ? { targetMonthlyIncome: target_monthly_income } : {}),
            ...(narrative             ? { narrative }                                   : {}),
          };

          const { currentAge, assumedReturn, targetBalance } = resolveContextDefaults(mergedCtx, {
            currentAge:    base.currentAge,
            assumedReturn: base.assumedReturn,
            targetBalance: base.targetBalance,
          });

          const effectiveRetirementAge  = retirement_age        ?? base.retirementAge;
          const effectiveContribution   = monthly_contribution   ?? base.monthlyContribution;
          const effectiveCurrentBalance = current_balance        ?? base.currentBalance;

          if (effectiveRetirementAge <= currentAge) {
            return { content: [{ type: "text" as const, text: `Retirement age (${effectiveRetirementAge}) must be greater than current age (${currentAge}).` }] };
          }

          const years         = effectiveRetirementAge - currentAge;
          const targetYear    = new Date().getFullYear() + years;
          const projected     = projectBalance(effectiveCurrentBalance, effectiveContribution, assumedReturn, years);
          const prob          = Math.min(99, Math.max(10, Math.round(50 + (projected / targetBalance) * 40)));
          const income        = Math.round((projected * 0.04) / 12);
          const allocation    = mergedCtx.riskTolerance
            ? ALLOCATION_BY_RISK[mergedCtx.riskTolerance as RiskTolerance]
            : base.allocation;

          const { data, error } = await admin.from("plans").insert({
            user_id:                      userId,
            name,
            retirement_age:               effectiveRetirementAge,
            current_age:                  currentAge,
            target_year:                  targetYear,
            monthly_contribution:         effectiveContribution,
            current_balance:              effectiveCurrentBalance,
            target_balance:               targetBalance,
            assumed_return:               assumedReturn,
            inflation:                    base.inflation,
            projected_balance:            projected,
            success_probability:          prob,
            monthly_income_at_retirement: income,
            is_primary:                   false,
            context:                      mergedCtx,
            allocation,
            plan_data:                    basePlanData, // inherit event model from base plan (B-12)
          }).select().single();

          if (error || !data) {
            return { content: [{ type: "text" as const, text: `Failed to create scenario: ${error?.message}` }] };
          }

          const diff = projected - base.projectedBalance;
          const sign = diff >= 0 ? "+" : "";
          const lines = [
            `Created what-if scenario "${name}" (cloned from "${base.name}"):`,
            retirement_age        ? `• Retirement age: ${effectiveRetirementAge} (was ${base.retirementAge})` : null,
            monthly_contribution  ? `• Monthly contribution: $${effectiveContribution.toLocaleString()} (was $${base.monthlyContribution.toLocaleString()})` : null,
            risk_tolerance        ? `• Risk tolerance: ${risk_tolerance} → ${assumedReturn}% return (was ${base.assumedReturn}%)` : null,
            target_monthly_income ? `• Retirement income goal: $${target_monthly_income.toLocaleString()}/mo → target $${(targetBalance/1_000_000).toFixed(2)}M` : null,
            ``,
            `Projected balance at retirement: $${projected.toLocaleString()} (${sign}$${Math.abs(diff).toLocaleString()} vs primary)`,
            `Monthly income: $${income.toLocaleString()} · Success probability: ${prob}%`,
            ``,
            `View it in the sidebar under "What-if scenarios" and compare it side-by-side with your primary plan.`,
          ].filter((l) => l !== null).join("\n");

          return { content: [{ type: "text" as const, text: lines }] };
        },
      );

      // ── Documents tool ────────────────────────────────────────────────────

      server.tool(
        "get_document_summaries",
        "Retrieve Claude's summaries of all financial documents the user has uploaded — tax forms, pay stubs, bank statements, mortgage contracts, etc. Call this when you need financial context from the user's documents before building or updating a plan. Returns the document name, type, upload date, and the extracted financial summary for each file. IMPORTANT: If the user has no documents yet, or wants to add more, always direct them to upload via the Lever dashboard (Documents section in the sidebar at lever-claude.vercel.app or localhost:3000). Do NOT attempt to accept files directly in this conversation — the dashboard upload pipeline stores the file, runs it through Claude for summarisation, and saves the result so it is available in all future conversations.",
        {},
        async () => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          const { data, error } = await admin
            .from("documents")
            .select("id, name, file_type, summary, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

          if (error) return { content: [{ type: "text" as const, text: `Failed to load documents: ${error.message}` }] };

          const docs = data ?? [];
          if (docs.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text: "No documents uploaded yet. Ask the user to upload financial documents (tax forms, pay stubs, bank statements) at lever — there is a Documents section in the sidebar.",
              }],
            };
          }

          const lines = docs.map((d: { name: string; file_type: string; created_at: string; summary: string | null }) =>
            [
              `## ${d.name} (${d.file_type}, uploaded ${new Date(d.created_at).toLocaleDateString()})`,
              d.summary ?? "_No summary available — document may still be processing._",
            ].join("\n")
          );

          return {
            content: [{
              type: "text" as const,
              text: `${docs.length} document(s) on file:\n\n${lines.join("\n\n")}`,
            }],
          };
        },
      );

      server.tool(
        "read_document",
        "Read the full content of a specific financial document that the user previously uploaded via the Lever dashboard, and answer a question about it. Use this when the stored summary is not detailed enough — e.g. 'What does my W-2 say about box 12?' or 'What is the exact interest rate on my mortgage?'. The original file is read directly from storage. If the Anthropic file cache has expired (files older than 25 days), it re-uploads from Supabase Storage automatically. NOTE: This tool only works for documents already uploaded through the Lever dashboard. If the user mentions a document they have not uploaded yet, tell them to go to the Lever dashboard → Documents and upload it there first.",
        {
          document_name: z
            .string()
            .optional()
            .describe("Name of the document to read (partial match, case-insensitive). Use this OR document_id."),
          document_id: z
            .string()
            .optional()
            .describe("Exact UUID of the document. Use this OR document_name."),
          question: z
            .string()
            .optional()
            .describe("Specific question to answer about the document. If omitted, returns a detailed extraction of all financial data in the file."),
        },
        async ({
          document_name,
          document_id,
          question,
        }: {
          document_name?: string;
          document_id?: string;
          question?: string;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };
          if (!document_name && !document_id) {
            return { content: [{ type: "text" as const, text: "Provide document_name or document_id." }] };
          }

          let query = admin.from("documents").select("*").eq("user_id", userId);
          if (document_id) {
            query = query.eq("id", document_id);
          } else if (document_name) {
            query = query.ilike("name", `%${document_name}%`);
          }
          const { data: matches } = await query;

          if (!matches || matches.length === 0) {
            return { content: [{ type: "text" as const, text: `No document found matching "${document_name ?? document_id}". Ask the user to upload it first.` }] };
          }
          if (matches.length > 1) {
            const names = (matches as { name: string }[]).map((d) => `"${d.name}"`).join(", ");
            return { content: [{ type: "text" as const, text: `Multiple documents matched: ${names}. Be more specific or use document_id.` }] };
          }

          const doc = matches[0] as {
            id: string;
            name: string;
            file_type: string;
            storage_path: string;
            anthropic_file_id: string | null;
            created_at: string;
          };

          if (!process.env.ANTHROPIC_API_KEY) {
            return { content: [{ type: "text" as const, text: "Document reading requires ANTHROPIC_API_KEY to be set on the server." }] };
          }

          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

          // Use the cached file_id if it is within the 25-day safe window;
          // re-upload from Supabase Storage otherwise.
          const SAFE_WINDOW_MS = 25 * 24 * 60 * 60 * 1000;
          const ageMs = Date.now() - new Date(doc.created_at).getTime();
          let fileId = (ageMs < SAFE_WINDOW_MS && doc.anthropic_file_id) ? doc.anthropic_file_id : null;

          if (!fileId) {
            const { data: fileData, error: downloadError } = await admin.storage
              .from("documents")
              .download(doc.storage_path);

            if (downloadError || !fileData) {
              return { content: [{ type: "text" as const, text: `Could not retrieve document from storage: ${downloadError?.message}` }] };
            }

            const buffer = Buffer.from(await fileData.arrayBuffer());
            const uploaded = await (anthropic.beta as unknown as {
              files: { upload: (args: { file: File }) => Promise<{ id: string }> };
            }).files.upload({ file: new File([buffer], doc.name, { type: doc.file_type }) });

            fileId = uploaded.id;
            // Persist the refreshed file_id so subsequent calls within 25 days skip the re-upload
            await admin.from("documents").update({ anthropic_file_id: fileId }).eq("id", doc.id);
          }

          const isImage = doc.file_type.startsWith("image/");
          const contentBlock = isImage
            ? { type: "image", source: { type: "file", file_id: fileId } }
            : { type: "document", source: { type: "file", file_id: fileId } };

          const prompt = question
            ? `Answer this question about the document: ${question}`
            : "Extract and provide ALL financial information from this document in full detail. Include every dollar amount, date, rate, term, account number (last 4 digits only), name, and any other financially relevant data.";

          const msg = await (anthropic.messages.create as (args: unknown) => Promise<{
            content: Array<{ type: string; text?: string }>;
          }>)({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,
            messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
            betas: ["files-api-2025-04-14"],
          });

          const textBlock = msg.content.find((b) => b.type === "text");
          const answer = textBlock?.text ?? "Could not extract content from this document.";

          return {
            content: [{ type: "text" as const, text: `**${doc.name}**\n\n${answer}` }],
          };
        },
      );

      // ── Onboarding tool ────────────────────────────────────────────────────

      server.tool(
        "get_onboarding_status",
        "Check what the user has already set up in Lever and get instructions for what to do next. Call this at the start of every new conversation to know where the user is in their setup — whether they are brand new, mid-onboarding, or fully set up. Use the returned next_steps to guide the conversation.",
        {},
        async () => {
          if (!userId) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  authenticated: false,
                  message: "User is not authenticated. Ask them to check their Lever MCP connector URL includes their token.",
                }),
              }],
            };
          }

          const [plansResult, accountsResult, documentsResult] = await Promise.all([
            admin.from("plans").select("id, name, is_primary, context").eq("user_id", userId),
            admin.from("accounts").select("id").eq("user_id", userId),
            admin.from("documents").select("id").eq("user_id", userId),
          ]);

          const plans     = plansResult.data ?? [];
          const accounts  = accountsResult.data ?? [];
          const documents = documentsResult.data ?? [];
          const primary   = plans.find((p: { is_primary: boolean }) => p.is_primary);
          const hasContext = primary && (primary as { context: unknown }).context !== null;

          type Step = {
            step: string;
            action: string;
            tool?: string;
          };

          const completedSteps: string[] = [];
          const nextSteps: Step[] = [];

          if (plans.length > 0) {
            completedSteps.push(`Has ${plans.length} plan(s): ${plans.map((p: { name: string }) => `"${p.name}"`).join(", ")}`);
          }
          if (hasContext) {
            completedSteps.push("Primary plan has personal context set (age, income, goals, risk tolerance)");
          }
          if (accounts.length > 0) {
            completedSteps.push(`Has ${accounts.length} financial account(s) recorded`);
          }
          if (documents.length > 0) {
            completedSteps.push(`Has ${documents.length} financial document(s) uploaded`);
          }

          if (plans.length === 0) {
            nextSteps.push({
              step: "Create first plan",
              action: "Start by welcoming the user to Lever warmly. In 2-3 sentences explain the value: Lever connects your real financial data to this conversation so we can build a retirement plan around your actual income, goals, and accounts — not a generic estimate. Unlike a calculator you fill out once, this plan lives here and I can flag opportunities specific to your numbers as life changes. Then say: 'I'll ask you 8 quick questions — one at a time. Takes about 10 minutes. You can pause anytime and come back later — just say where you left off.' Then ask each question one at a time, prefixing each with its number: '**1 of 8:**', '**2 of 8:**', etc. Wait for each answer before asking the next. After question 4, acknowledge halfway: 'Halfway there — you're doing great.' Questions: (1) date of birth (YYYY-MM-DD)? (2) how would you describe your income — salaried, hourly, freelance/business, or a mix? (3) based on their answer: approximate total annual income this year (for variable earners, a rough total is fine)? (4) how much monthly income do you want in retirement? (5) risk tolerance — low (conservative, ~5% growth), medium (balanced, ~7%), or high (aggressive, ~9%)? (6) target retirement age? (7) monthly savings amount? (8) current total retirement savings balance? Then call create_plan with all answers in a single call. Do NOT ask the user to go to a website.",
              tool: "create_plan",
            });
          } else if (!hasContext) {
            nextSteps.push({
              step: "Set personal context",
              action: `The primary plan "${primary?.name ?? plans[0]?.name}" has no personal context. Ask for: date of birth, annual income, desired monthly retirement income, risk tolerance. Then call update_plan_context.`,
              tool: "update_plan_context",
            });
          }

          if (accounts.length === 0) {
            nextSteps.push({
              step: "Add financial accounts",
              action: "Ask the user to list their key accounts: checking/savings, retirement accounts (401k, IRA, Roth IRA), investments, real estate, and any significant debts (mortgage, loans). For each, ask the approximate current balance. Call add_account for each one. Balances are always positive — debt type handles the sign.",
              tool: "add_account",
            });
          }

          if (plans.length > 0 && hasContext && accounts.length > 0 && documents.length === 0) {
            nextSteps.push({
              step: "Upload financial documents",
              action: "Ask the user if they have any financial documents handy — W-2s, pay stubs, bank statements, mortgage documents, 401k statements. Tell them to go to the Lever dashboard → Documents (sidebar) and upload them there. The dashboard runs each file through Claude automatically and saves a summary. Once uploaded, you can reference the summaries in this conversation using get_document_summaries.",
            });
          }

          if (plans.length > 0 && hasContext && accounts.length > 0) {
            nextSteps.push({
              step: "Deliver proactive insights",
              action: `Setup is complete. Do NOT just say "you're all set" — that's a wasted moment. Instead, immediately do the following without waiting for the user to ask:

1. Call get_plan_data to read the user's plan structure (events, accounts, context).
2. Use web search to find 2-3 specific opportunities relevant to this person RIGHT NOW. Search for:
   - IRS contribution limit changes this tax year (401k, IRA, Roth IRA, HSA)
   - Programs or credits matching their income bracket and age
   - Interest rate environment — does it affect their debt or savings allocation?
   - Roth conversion windows given their current income
   - Employer match gaps (if their plan has a job event, check if contribution % captures the full match)
3. Deliver each finding as a numbered insight in plain language. Format: what it is → why it applies to their specific numbers → what they should do. Be concrete: cite their actual income, age, account balances. Skip anything that would apply to anyone regardless of their situation.
4. End with one specific action they can take this week — not a direction, an actual step ("Call HR and increase your 401k contribution from X% to Y%").

This is the moment Lever proves its value. Make it count.`,
              tool: "get_plan_data",
            });
          }

          const isComplete = plans.length > 0 && hasContext && accounts.length > 0;

          const status = {
            authenticated: true,
            isComplete,
            completedSteps,
            nextSteps,
            summary: isComplete
              ? `User is fully set up with ${plans.length} plan(s) and ${accounts.length} account(s). Deliver proactive insights now — do not wait for the user to ask.`
              : `Setup ${Math.round(((plans.length > 0 ? 1 : 0) + (hasContext ? 1 : 0) + (accounts.length > 0 ? 1 : 0)) / 3 * 100)}% complete. Next: ${nextSteps[0]?.step ?? "done"}.`,
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
          };
        },
      );

      // ── Simulator tools ───────────────────────────────────────────────────
      // These three tools give Claude direct access to the event-based planning
      // engine described in STEERING.md. They operate on plan_data (JSONB) and
      // keep the legacy scalar columns in sync via the bridge after each run.

      server.tool(
        "get_event_schema",
        "Browse the financial event library. Without arguments, returns every available event type with its display name, description, and category — use this to discover what events exist before building a plan. Pass event_type to get the full parameter specification for a specific event (names, types, units, descriptions) so you know exactly what to provide when calling update_plan. Always call this before adding an event you haven't used before.",
        {
          event_type: z
            .string()
            .optional()
            .describe("Event type identifier, e.g. 'get_job', 'buy_house', 'outflow'. Omit to list all available event types."),
        },
        async ({ event_type }: { event_type?: string }) => {
          if (event_type) {
            const detail = getEventSchema(event_type);
            if (!detail) {
              return {
                content: [{
                  type: "text" as const,
                  text: `Unknown event type "${event_type}". Call get_event_schema with no arguments to see all valid types.`,
                }],
              };
            }
            return { content: [{ type: "text" as const, text: JSON.stringify(detail, null, 2) }] };
          }

          const list = getEventList();
          const grouped = list.reduce<Record<string, typeof list>>((acc, e) => {
            (acc[e.category] ??= []).push(e);
            return acc;
          }, {});

          const lines = Object.entries(grouped).map(([category, events]) =>
            [`## ${category}`, ...events.map((e) => `  ${e.type} — ${e.display_name}: ${e.description}`)].join("\n")
          );

          return {
            content: [{
              type: "text" as const,
              text: `${list.length} event types available:\n\n${lines.join("\n\n")}\n\nCall get_event_schema with event_type="<type>" to see full parameter details for any event.`,
            }],
          };
        },
      );

      server.tool(
        "get_plan_data",
        "Read the full plan_data for a plan — the rich event-based representation including all life events, accounts, and the latest simulation results. Use this to understand the current state of a plan before adding or modifying events, or to show the user what's in their plan. The simulation_results field contains the day-by-day net worth timeline.",
        {
          plan_id: z
            .string()
            .optional()
            .describe("UUID of the plan to read. Omit to read the most recent plan."),
        },
        async ({ plan_id }: { plan_id?: string }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) return { content: [{ type: "text" as const, text: "No plan found." }] };

          const { data } = await admin.from("plans").select("plan_data").eq("id", plan.id).single();
          const planData = (data as { plan_data: PlanData | null })?.plan_data;

          if (!planData) {
            return {
              content: [{
                type: "text" as const,
                text: `Plan "${plan.name}" has no plan_data yet. Use update_plan to start adding events. Available accounts after initialization: ${DEFAULT_ACCOUNTS.map((a) => a.name).join(", ")}.`,
              }],
            };
          }

          // Return plan_data without simulation_results to keep response concise
          const { simulation_results, ...rest } = planData;
          const summary = {
            ...rest,
            simulation_results_count: simulation_results?.length ?? 0,
            latest_net_worth: simulation_results?.at(-1)?.value ?? null,
          };

          return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
        },
      );

      server.tool(
        "update_plan",
        `Modify the event-based plan_data for a plan. Three operations:

• add_event — add a life event from the event library. Always call get_event_schema with the event_type first to confirm which parameters are required. Provide parameters as an array of {type, value} objects. Dates use ISO format (YYYY-MM-DD). Account references (to_key, from_key, etc.) must match account names in the plan — call get_plan_data to see available accounts.

• remove_event — remove an event by its numeric id. Get the id from get_plan_data.

• update_field — change a single parameter value on an existing event. Provide the event_id, param_type (the parameter's type string), and the new value.

After every operation the plan is validated, the simulator runs, and the scalar columns (projected_balance, success_probability) are updated so the dashboard stays current. Validation errors are returned as text — correct them and retry.

Default accounts available in a new plan: Checking, Savings, 401k, Roth IRA, Investment, Federal Withholdings, State Withholdings, Local Withholdings, Taxable Income.`,
        {
          plan_id: z
            .string()
            .optional()
            .describe("UUID of the plan to modify. Omit to modify the most recent plan."),
          op: z
            .enum(["add_event", "remove_event", "update_field"])
            .describe("Operation to perform."),
          // add_event fields
          event_type: z
            .string()
            .optional()
            .describe("add_event: the event type to add, e.g. 'get_job'. Call get_event_schema first."),
          title: z
            .string()
            .optional()
            .describe("add_event: human-readable title for this event, e.g. 'Software Engineer at Acme'."),
          is_recurring: z
            .boolean()
            .optional()
            .describe("add_event: whether this event repeats on a schedule (requires frequency_days parameter)."),
          parameters: z
            .array(z.object({ type: z.string(), value: z.union([z.string(), z.number()]) }))
            .optional()
            .describe("add_event: event parameters as [{type, value}] pairs. Use ISO dates for date values."),
          event_functions: z
            .array(z.object({ type: z.string(), enabled: z.boolean() }))
            .optional()
            .describe("add_event: optional toggles for event sub-behaviors, e.g. [{type: 'enable_401k', enabled: true}]."),
          // remove_event / update_field fields
          event_id: z
            .number()
            .int()
            .optional()
            .describe("remove_event / update_field: numeric id of the event to target. Get from get_plan_data."),
          // update_field fields
          param_type: z
            .string()
            .optional()
            .describe("update_field: the parameter type string to update, e.g. 'salary', 'end_time'."),
          param_value: z
            .union([z.string(), z.number()])
            .optional()
            .describe("update_field: new value for the parameter."),
        },
        async ({
          plan_id, op, event_type, title, is_recurring, parameters, event_functions,
          event_id, param_type, param_value,
        }: {
          plan_id?: string; op: "add_event" | "remove_event" | "update_field";
          event_type?: string; title?: string; is_recurring?: boolean;
          parameters?: { type: string; value: string | number }[];
          event_functions?: { type: string; enabled: boolean }[];
          event_id?: number; param_type?: string; param_value?: string | number;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          const plans = await fetchPlans(plan_id);
          const plan = plans[0];
          if (!plan) return { content: [{ type: "text" as const, text: "No plan found." }] };

          // Load or initialize plan_data
          const { data: row } = await admin.from("plans").select("plan_data, context, retirement_age, target_balance").eq("id", plan.id).single();
          const stored = (row as any);

          let planData: PlanData = stored?.plan_data ?? {
            birth_date: (stored?.context as PlanContext | null)?.dateOfBirth ?? "1990-01-01",
            inflation_rate: 0.03,
            adjust_for_inflation: true,
            accounts: DEFAULT_ACCOUNTS,
            events: [],
          };

          // ── Apply operation ──────────────────────────────────────────────

          if (op === "add_event") {
            if (!event_type) return { content: [{ type: "text" as const, text: "add_event requires event_type." }] };
            if (!isValidEventType(event_type)) {
              return { content: [{ type: "text" as const, text: `Unknown event type "${event_type}". Call get_event_schema to see valid types.` }] };
            }

            const schema = getEventSchema(event_type);
            const newEvent: SimEvent = {
              id: nextEventId(planData.events),
              type: event_type,
              title: title ?? (schema as any)?.default_title ?? event_type,
              description: "",
              is_recurring: is_recurring ?? false,
              parameters: (parameters ?? []).map((p, i) => ({ id: i, type: p.type, value: p.value } as Parameter)),
              event_functions: (event_functions ?? []).map((f) => ({ type: f.type, title: f.type, enabled: f.enabled })),
              updating_events: [],
            };
            planData = { ...planData, events: [...planData.events, newEvent] };

          } else if (op === "remove_event") {
            if (event_id == null) return { content: [{ type: "text" as const, text: "remove_event requires event_id." }] };
            const before = planData.events.length;
            planData = { ...planData, events: planData.events.filter((e) => e.id !== event_id) };
            if (planData.events.length === before) {
              return { content: [{ type: "text" as const, text: `No event with id ${event_id} found.` }] };
            }

          } else if (op === "update_field") {
            if (event_id == null || !param_type || param_value === undefined) {
              return { content: [{ type: "text" as const, text: "update_field requires event_id, param_type, and param_value." }] };
            }
            const events = planData.events.map((e) => {
              if (e.id !== event_id) return e;
              const existing = e.parameters.find((p) => p.type === param_type);
              const updated: Parameter[] = existing
                ? e.parameters.map((p) => p.type === param_type ? { ...p, value: param_value } : p)
                : [...e.parameters, { id: (e.parameters.at(-1)?.id ?? -1) + 1, type: param_type, value: param_value }];
              return { ...e, parameters: updated };
            });
            planData = { ...planData, events };
          }

          // ── Validate ─────────────────────────────────────────────────────

          const errors = getHardErrors(planData);
          if (errors.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text: `Plan validation failed:\n${errors.map((e) => `• ${e}`).join("\n")}\n\nFix these errors and retry.`,
              }],
            };
          }

          // ── Run simulation ────────────────────────────────────────────────

          let scalars: { projected_balance: number; success_probability: number; monthly_income_at_retirement: number } | null = null;
          let simulationResultCount = 0;

          try {
            const { startDay, endDay } = simulationBounds(planData, plan.retirementAge);
            const results = await runSimulation(planData, startDay, endDay);
            simulationResultCount = results.length;

            scalars = simulationToScalars(
              results,
              planData,
              plan.retirementAge,
              plan.targetBalance,
            );

            // Store results back in plan_data (trim to ~yearly snapshots to keep DB size sane)
            const yearly = results.filter((_, i) => i % 365 === 0);
            planData = { ...planData, simulation_results: yearly };
          } catch (err) {
            // Simulation errors don't block the save — the plan structure is valid
            console.error("[update_plan] simulation error:", err);
          }

          // ── Persist ───────────────────────────────────────────────────────

          const update: Record<string, unknown> = { plan_data: planData };
          if (scalars) {
            update.projected_balance = scalars.projected_balance;
            update.success_probability = scalars.success_probability;
            update.monthly_income_at_retirement = scalars.monthly_income_at_retirement;
          }

          const { error: saveErr } = await admin.from("plans").update(update).eq("id", plan.id);
          if (saveErr) {
            return { content: [{ type: "text" as const, text: `Failed to save: ${saveErr.message}` }] };
          }

          // ── Response ──────────────────────────────────────────────────────

          const eventCount = planData.events.length;
          const accountList = planData.accounts.map((a) => a.name).join(", ");

          const lines: string[] = [
            `✓ ${op} applied to "${plan.name}".`,
            ``,
            `Plan now has ${eventCount} event(s). Available accounts: ${accountList}.`,
          ];

          if (scalars) {
            lines.push(
              ``,
              `Simulation ran over ${simulationResultCount} days:`,
              `• Projected balance at retirement (age ${plan.retirementAge}): $${scalars.projected_balance.toLocaleString()}`,
              `• Monthly income at retirement: $${scalars.monthly_income_at_retirement.toLocaleString()}`,
              `• Probability of success: ${scalars.success_probability}%`,
            );
          }

          if (op === "add_event") {
            lines.push(``, `Next: use update_plan with op="add_event" to add more events, or get_plan_data to review the current state.`);
          }

          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        },
      );

      // ── Monte Carlo ───────────────────────────────────────────────────────

      server.tool(
        "run_monte_carlo",
        `Run a Monte Carlo simulation on the user's primary plan (or a specified plan) to estimate the probability distribution of outcomes at retirement.

Call this when the user asks questions like "what are my chances of retiring comfortably?", "how bad could it get in a downturn?", or "what's my real probability of success?". Do NOT call it for routine plan updates — it's compute-intensive and is only meaningful for uncertainty questions.

The simulation runs 500 iterations, each with an annual return rate sampled from a historical distribution (mean 7%, σ 12% for a balanced portfolio). Returns real probability percentiles — not the simplified linear estimate shown on the plan page.

After calling this tool, always surface:
• The success_rate (% of scenarios where the user hits their target)
• The p10 and p90 range (the likely spread of outcomes)
• The p5 worst case (what a bad market decade looks like)
• Compare to the current projected_balance (p50 ≈ deterministic result)`,
        {
          plan_id: z.string().optional().describe("UUID of the plan to simulate. Omit to use the primary plan."),
          iterations: z.number().int().min(100).max(2000).optional().describe("Number of Monte Carlo iterations. Default 500. Use 1000+ for more precise tail estimates."),
          mean_return: z.number().min(-0.2).max(0.3).optional().describe("Override the assumed mean annual return. Default 0.07 (7%)."),
          std_dev: z.number().min(0.01).max(0.5).optional().describe("Override the assumed annual std deviation. Default 0.12 (12%)."),
        },
        async ({
          plan_id,
          iterations,
          mean_return,
          std_dev,
        }: {
          plan_id?: string;
          iterations?: number;
          mean_return?: number;
          std_dev?: number;
        }) => {
          if (!userId) return { content: [{ type: "text" as const, text: "Not authenticated." }] };

          // Find the target plan
          const all = await fetchPlans();
          let plan = plan_id
            ? all.find(p => p.id === plan_id)
            : all.find(p => p.isPrimary) ?? all[0];
          if (!plan) return { content: [{ type: "text" as const, text: "No plan found. Create a plan first." }] };

          const { data: raw } = await admin.from("plans").select("plan_data, target_balance").eq("id", plan.id).single();
          const planData = (raw as any)?.plan_data as PlanData | null;
          if (!planData?.birth_date) {
            return { content: [{ type: "text" as const, text: `Plan "${plan.name}" has no simulation data yet. Use update_plan to add events first.` }] };
          }

          const targetBalance = plan.targetBalance;

          const mc = await runMonteCarlo({
            planData,
            retirementAge: plan.retirementAge,
            targetBalance,
            iterations:  iterations ?? 500,
            meanReturn:  mean_return,
            stdDev:      std_dev,
          });

          // Persist Monte Carlo results into plan_data so the UI can show them
          const updatedPlanData = { ...planData, monte_carlo: mc };
          await admin.from("plans").update({
            plan_data: updatedPlanData,
            success_probability: mc.success_rate,
          }).eq("id", plan.id);

          const fmt = (n: number) => n >= 1_000_000
            ? `$${(n / 1_000_000).toFixed(2)}M`
            : `$${Math.round(n / 1000)}K`;

          const lines = [
            `Monte Carlo simulation complete — ${mc.iterations} scenarios run for "${plan.name}":`,
            ``,
            `📊 Probability of success: **${mc.success_rate}%** (reaching $${fmt(targetBalance)} target)`,
            ``,
            `Outcome range at retirement (age ${plan.retirementAge}):`,
            `• Best case (p90):   ${fmt(mc.p90)}`,
            `• Expected (p50):    ${fmt(mc.p50)}`,
            `• Cautious (p25):    ${fmt(mc.p25)}`,
            `• Worst case (p5):   ${fmt(mc.p5)}`,
            ``,
            `Assumptions: ${((mc.mean_return_used) * 100).toFixed(0)}% mean annual return, ±${(mc.std_dev_used * 100).toFixed(0)}% standard deviation (historical balanced portfolio).`,
            ``,
            `The plan page now shows the real probability. To improve your odds, consider increasing contributions or adjusting your retirement age.`,
          ];

          return { content: [{ type: "text" as const, text: lines.join("\n") }] };
        },
      );

      // ── Admin tools ────────────────────────────────────────────────────────

      async function requireAdmin() {
        if (!userId) return "Not authenticated.";
        const { data } = await admin.rpc("admin_list_users");
        const u = (data ?? []).find((row: { id: string; email: string }) => row.id === userId);
        if (!ADMIN_EMAILS.includes(u?.email ?? "")) return "Admin access required.";
        return null;
      }

      server.tool(
        "list_users",
        "Admin tool: list all Lever users with their setup status, plan metrics, account count, document count, and draft notification count. Use this to get an overview of all users before deciding who to analyse. Requires admin access.",
        {},
        async () => {
          const err = await requireAdmin();
          if (err) return { content: [{ type: "text" as const, text: err }] };

          const { data: users, error: usersErr } = await admin.rpc("admin_list_users");
          if (usersErr) return { content: [{ type: "text" as const, text: `Failed to fetch users: ${usersErr.message}` }] };

          const [plansRes, accountsRes, docsRes, subsRes, notifsRes] = await Promise.all([
            admin.from("plans").select("user_id, name, is_primary, projected_balance, success_probability, context"),
            admin.from("accounts").select("user_id"),
            admin.from("documents").select("user_id"),
            admin.from("subscriptions").select("user_id, status"),
            admin.from("notifications").select("user_id, status"),
          ]);

          const plans = plansRes.data ?? [];
          const accounts = accountsRes.data ?? [];
          const docs = docsRes.data ?? [];
          const subs = subsRes.data ?? [];
          const notifs = notifsRes.data ?? [];

          type RpcUser = { id: string; email: string; last_sign_in_at: string | null; created_at: string };
          const lines = (users as RpcUser[]).map((u) => {
            const userPlans = plans.filter((p: { user_id: string }) => p.user_id === u.id);
            const primary = userPlans.find((p: { is_primary: boolean }) => p.is_primary) as { name: string; projected_balance: number; success_probability: number; context: unknown } | undefined;
            const sub = subs.find((s: { user_id: string }) => s.user_id === u.id) as { status: string } | undefined;
            const draftCount = notifs.filter((n: { user_id: string; status: string }) => n.user_id === u.id && n.status === "draft").length;

            return [
              `## ${u.email} (${sub?.status === "active" ? "Premium" : "Free"})`,
              `Plans: ${userPlans.length} | Accounts: ${accounts.filter((a: { user_id: string }) => a.user_id === u.id).length} | Docs: ${docs.filter((d: { user_id: string }) => d.user_id === u.id).length} | Draft notifications: ${draftCount}`,
              primary ? `Primary plan: "${primary.name}" — $${primary.projected_balance.toLocaleString()} projected, ${primary.success_probability}% success, context: ${primary.context ? "set" : "missing"}` : "No primary plan",
              `Last active: ${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "never"} | ID: ${u.id}`,
            ].join("\n");
          });

          return {
            content: [{ type: "text" as const, text: `${users.length} users:\n\n${lines.join("\n\n")}` }],
          };
        },
      );

      server.tool(
        "get_user_context",
        "Admin tool: retrieve the complete financial context for a specific user — all their plans (with metrics and context), accounts, and document summaries. Use this before generating a recommendation for a user. Identify the user by email or user ID.",
        {
          email: z.string().optional().describe("User's email address (partial match, case-insensitive). Use this OR user_id."),
          user_id: z.string().optional().describe("Exact user UUID. Use this OR email."),
        },
        async ({ email, user_id: targetId }: { email?: string; user_id?: string }) => {
          const err = await requireAdmin();
          if (err) return { content: [{ type: "text" as const, text: err }] };
          if (!email && !targetId) return { content: [{ type: "text" as const, text: "Provide email or user_id." }] };

          let resolvedId = targetId;
          type AuthUserRow = { id: string; email: string; last_sign_in_at: string | null; created_at: string };
          let targetUser: AuthUserRow | null = null;

          const { data: allUsers } = await admin.rpc("admin_list_users");
          const userList = (allUsers ?? []) as AuthUserRow[];

          if (!resolvedId && email) {
            const match = userList.find((u) => u.email?.toLowerCase().includes(email.toLowerCase()));
            if (!match) return { content: [{ type: "text" as const, text: `No user found with email matching "${email}".` }] };
            resolvedId = match.id;
          }
          targetUser = userList.find((u) => u.id === resolvedId) ?? null;
          if (!targetUser) return { content: [{ type: "text" as const, text: "User not found." }] };

          const [plansRes, accountsRes, docsRes, subsRes] = await Promise.all([
            admin.from("plans").select("*").eq("user_id", resolvedId!).order("created_at"),
            admin.from("accounts").select("*").eq("user_id", resolvedId!).order("created_at"),
            admin.from("documents").select("name, file_type, summary, created_at").eq("user_id", resolvedId!),
            admin.from("subscriptions").select("status, current_period_end").eq("user_id", resolvedId!).maybeSingle(),
          ]);

          const userPlans = ((plansRes.data ?? []) as DbPlanRow[]).map(planFromRow);
          const primary = userPlans.find((p) => p.isPrimary);
          const sub = subsRes.data as { status: string; current_period_end: string | null } | null;

          const sections = [
            `# User: ${targetUser?.email}`,
            `Subscription: ${sub?.status === "active" ? "Premium" : "Free"} | Last active: ${targetUser?.last_sign_in_at ? new Date(targetUser.last_sign_in_at).toLocaleDateString() : "never"} | ID: ${targetUser?.id}`,
            "",
            `## Plans (${userPlans.length})`,
            ...userPlans.map((p) => [
              `**${p.name}**${p.isPrimary ? " (Primary)" : " (What-if)"}`,
              `Projected: $${p.projectedBalance.toLocaleString()} | Success: ${p.successProbability}% | Monthly: $${p.monthlyContribution.toLocaleString()} | Retire at: ${p.retirementAge}`,
              p.context ? `Context: DOB ${(p.context as Record<string, unknown>).dateOfBirth ?? "unknown"} | Income $${(p.context as Record<string, unknown>).annualIncome ?? "unknown"}/yr | Risk: ${(p.context as Record<string, unknown>).riskTolerance ?? "unknown"} | Target income: $${(p.context as Record<string, unknown>).targetMonthlyIncome ?? "unknown"}/mo` : "Context: not set",
              (p.context as Record<string, unknown>)?.narrative ? `Narrative: ${(p.context as Record<string, unknown>).narrative}` : "",
            ].filter(Boolean).join("\n")),
            "",
            `## Accounts (${(accountsRes.data ?? []).length})`,
            ...(accountsRes.data ?? []).map((a: { name: string; type: string; balance: number; institution: string | null }) =>
              `${a.name} (${a.type}${a.institution ? ` · ${a.institution}` : ""}): $${a.balance.toLocaleString()}`
            ),
            "",
            `## Documents (${(docsRes.data ?? []).length})`,
            ...(docsRes.data ?? []).map((d: { name: string; summary: string | null }) =>
              `**${d.name}**: ${d.summary ?? "_no summary_"}`
            ),
          ];

          if (userPlans.length > 0 && primary) {
            const gap = primary.projectedBalance - primary.targetBalance;
            sections.push("", "## Quick analysis");
            sections.push(gap >= 0
              ? `On track: $${gap.toLocaleString()} surplus vs target balance of $${primary.targetBalance.toLocaleString()}.`
              : `Gap: $${Math.abs(gap).toLocaleString()} short of target balance of $${primary.targetBalance.toLocaleString()}.`
            );
          }

          return { content: [{ type: "text" as const, text: sections.join("\n") }] };
        },
      );

      server.tool(
        "queue_recommendation",
        "Admin tool: save a recommendation or notification message as a draft for a specific user. The draft will appear in the admin dashboard under that user's Notifications section, where it can be reviewed and approved before sending. Use this after analysing a user with get_user_context and deciding on a recommendation to send them.",
        {
          user_id: z.string().describe("The user's UUID to queue the recommendation for. Get this from list_users or get_user_context."),
          message: z.string().describe("The recommendation message to send to the user. Write it in second person, as if speaking directly to them. Should be specific to their situation — not generic advice."),
        },
        async ({ user_id: targetId, message }: { user_id: string; message: string }) => {
          const err = await requireAdmin();
          if (err) return { content: [{ type: "text" as const, text: err }] };

          const { data, error } = await admin.from("notifications").insert({
            user_id: targetId,
            message,
            status: "draft",
          }).select().single();

          if (error || !data) return { content: [{ type: "text" as const, text: `Failed to queue: ${error?.message}` }] };

          return {
            content: [{
              type: "text" as const,
              text: `Queued as draft notification (ID: ${(data as { id: string }).id}). Review and approve it at /admin/users/${targetId} in the Lever dashboard.`,
            }],
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
