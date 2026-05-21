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

          const [plansResult, accountsResult] = await Promise.all([
            admin.from("plans").select("id, name, is_primary, context").eq("user_id", userId),
            admin.from("accounts").select("id").eq("user_id", userId),
          ]);

          const plans     = plansResult.data ?? [];
          const accounts  = accountsResult.data ?? [];
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

          if (plans.length === 0) {
            nextSteps.push({
              step: "Create first plan",
              action: "Ask the user one question at a time: (1) What name for their plan, e.g. 'Retire at 65'? (2) Their date of birth (YYYY-MM-DD)? (3) Their annual income? (4) How much monthly income do they want in retirement? (5) Risk tolerance — low, medium, or high? (6) Their target retirement age? (7) Monthly savings amount? (8) Current retirement savings balance? Then call create_plan with all answers in a single call — it creates the plan AND sets context together. Do NOT ask the user to go to a website.",
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

          if (plans.length > 0 && hasContext && accounts.length > 0) {
            nextSteps.push({
              step: "Explore what-if scenarios",
              action: "User is fully set up! Ask if they'd like to explore any scenarios: retiring earlier/later, saving more/less, different risk tolerance. Use create_what_if_plan to model them.",
              tool: "create_what_if_plan",
            });
          }

          const isComplete = plans.length > 0 && hasContext && accounts.length > 0;

          const status = {
            authenticated: true,
            isComplete,
            completedSteps,
            nextSteps,
            summary: isComplete
              ? `User is fully set up with ${plans.length} plan(s) and ${accounts.length} account(s). Ready to explore.`
              : `Setup ${Math.round(((plans.length > 0 ? 1 : 0) + (hasContext ? 1 : 0) + (accounts.length > 0 ? 1 : 0)) / 3 * 100)}% complete. Next: ${nextSteps[0]?.step ?? "done"}.`,
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
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
