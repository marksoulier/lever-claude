import { notFound } from "next/navigation";
import ContributionForm from "./ContributionForm";
import WhatIfPanel from "./WhatIfPanel";
import PlanSettingsMenu from "./PlanSettingsMenu";
import GrowthProjectionChart, { type SimPoint } from "./GrowthProjectionChart";
import ComparisonChart from "./ComparisonChart";
import CopyPromptButton from "./CopyPromptButton";
import { createServerClient } from "@/lib/supabase/server";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";
import { isPremium } from "@/lib/supabase/subscription";
import { projectBalance } from "@/lib/store";
import type { PlanContext } from "@/lib/plan-context";
import type { PlanData } from "@/lib/simulator/types";

const RISK_LABEL: Record<string, string> = { low: "Low (5%)", medium: "Medium (7%)", high: "High (9%)" };

function fmtBalance(n: number): string {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n / 1000)}K`;
}

export default async function PlanPage(props: PageProps<"/plan/[id]">) {
  const { id } = await props.params;

  const supabase = await createServerClient();
  const [{ data, error }, premium] = await Promise.all([
    supabase.from("plans").select("*").eq("id", id).single(),
    isPremium(),
  ]);

  if (error || !data) notFound();

  const plan = planFromRow(data as DbPlanRow);

  // Extract plan_data for event-based simulation results (B-1)
  const planData = (data as any).plan_data as PlanData | null;
  // Simulation stores snapshots every 365 days (not 365.25), so use /365 to get exact integer ages.
  const simulationPoints: SimPoint[] | null = planData?.simulation_results && planData.birth_date
    ? planData.simulation_results.map((r) => ({
        age: Math.round(r.date / 365),
        value: r.value,
      }))
    : null;

  // For what-if plans, also fetch the primary plan for comparison
  let primaryPlan: ReturnType<typeof planFromRow> | null = null;
  if (!plan.isPrimary) {
    const { data: primaryData } = await supabase
      .from("plans")
      .select("*")
      .eq("is_primary", true)
      .single();
    if (primaryData) primaryPlan = planFromRow(primaryData as DbPlanRow);
  }

  // B-1: when event-based simulation results exist, use the last point as the source of
  // truth for all derived metrics so the chart and metric cards always agree.
  const simProjectedBalance = simulationPoints && simulationPoints.length > 0
    ? simulationPoints[simulationPoints.length - 1].value
    : null;
  const projectedBalance = simProjectedBalance ?? plan.projectedBalance;
  const monthlyIncomeAtRetirement = simProjectedBalance != null
    ? Math.round((simProjectedBalance * 0.04) / 12)
    : plan.monthlyIncomeAtRetirement;

  // Use Monte Carlo success rate when available; fall back to the linear estimate.
  const monteCarlo = planData?.monte_carlo ?? null;
  const successProbability = monteCarlo
    ? monteCarlo.success_rate
    : simProjectedBalance != null
      ? Math.min(99, Math.max(10, Math.round(50 + (simProjectedBalance / plan.targetBalance) * 40)))
      : plan.successProbability;
  const successTooltip = monteCarlo
    ? `Monte Carlo result: ${monteCarlo.iterations} scenarios run on ${new Date(monteCarlo.computed_at).toLocaleDateString()}. Range: $${(monteCarlo.p10 / 1e6).toFixed(1)}M–$${(monteCarlo.p90 / 1e6).toFixed(1)}M (p10–p90). Assumes ${(monteCarlo.mean_return_used * 100).toFixed(0)}% mean return, ±${(monteCarlo.std_dev_used * 100).toFixed(0)}% std dev.`
    : "Estimates how close your projected balance is to your retirement target. Not a Monte Carlo simulation — ask Claude to run one for a real probability.";

  const shortfall = projectedBalance - plan.targetBalance;

  const metrics = [
    { label: "Projected balance",      subtitle: "at retirement",       value: fmtBalance(projectedBalance) },
    { label: "Monthly income",         subtitle: "in retirement",       value: `$${monthlyIncomeAtRetirement.toLocaleString()}` },
    { label: "Shortfall / surplus",    subtitle: "vs target balance",   value: `${shortfall >= 0 ? "+" : "-"}${fmtBalance(Math.abs(shortfall))}` },
    { label: "Probability of success", subtitle: monteCarlo ? "Monte Carlo" : "of reaching goal", value: `${successProbability}%`,
      tooltip: successTooltip },
  ];

  // B-3: dynamic what-if scenarios using real plan numbers
  const scenarios = buildScenarios(plan);

  // Prompts for Claude deep-links — give users something concrete to paste
  const setupPrompt = `Set up my Lever financial plan called "${plan.name}". Ask me for my date of birth, annual income, desired monthly retirement income, and risk tolerance — then update the plan so the projections reflect my real situation.`;
  const monteCarloPrompt = `Run a Monte Carlo simulation on my "${plan.name}" plan and tell me my real probability of reaching my retirement goal, including the best-case and worst-case range.`;
  const askClaudePrompt = `I'm looking at my Lever financial plan called "${plan.name}" — projected ${fmtBalance(projectedBalance)} at retirement. What's one thing I should change to improve my outlook?`;

  return (
    <div className="flex flex-col gap-8 px-8 py-8 max-w-3xl mx-auto w-full">

      {/* Plan header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-zinc-900">{plan.name}</h1>
            {plan.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-light px-2.5 py-0.5 text-[11px] font-bold text-teal-dark">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                Primary
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Target retirement: {plan.targetYear} · Return: {plan.assumedReturn}% · Inflation: {plan.inflation}%
          </p>
        </div>
        <PlanSettingsMenu planId={id} isPrimary={plan.isPrimary} />
      </div>

      {/* Comparison panel — only shown for what-if plans */}
      {!plan.isPrimary && primaryPlan && (
        <div className="rounded-2xl border border-amber-100 bg-white shadow-sm px-6 py-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <p className="text-sm font-black text-zinc-900">Comparing vs primary plan</p>
            <span className="text-sm text-zinc-400">· {primaryPlan.name}</span>
          </div>
          <ComparisonChart
            whatif={{
              label:               plan.name,
              currentBalance:      plan.currentBalance,
              monthlyContribution: plan.monthlyContribution,
              assumedReturn:       plan.assumedReturn,
              targetBalance:       plan.targetBalance,
              currentAge:          plan.currentAge,
              retirementAge:       plan.retirementAge,
            }}
            primary={{
              label:               primaryPlan.name,
              currentBalance:      primaryPlan.currentBalance,
              monthlyContribution: primaryPlan.monthlyContribution,
              assumedReturn:       primaryPlan.assumedReturn,
              targetBalance:       primaryPlan.targetBalance,
              currentAge:          primaryPlan.currentAge,
              retirementAge:       primaryPlan.retirementAge,
            }}
          />
        </div>
      )}

      {!plan.isPrimary && !primaryPlan && (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-600">
          Set a primary plan to compare this scenario against it.
        </div>
      )}

      {/* Context panel — nudge if missing, summary if present */}
      {plan.context ? (
        <ContextPanel context={plan.context} />
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-5 flex flex-col gap-4">
          <div>
            <p className="text-sm font-bold text-zinc-700">This plan has no personal context yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              Open Claude with the Lever connector, paste the prompt below, and Claude will personalise this plan for you.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-zinc-200 px-4 py-3 flex items-start justify-between gap-3">
            <p className="text-xs text-zinc-500 leading-relaxed flex-1 font-mono">{setupPrompt}</p>
            <CopyPromptButton prompt={setupPrompt} />
          </div>
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors"
          >
            Open Claude →
          </a>
        </div>
      )}

      {/* Contribution */}
      <div className="rounded-2xl border border-zinc-100 p-5 shadow-sm flex flex-col gap-3">
        <div>
          <p className="text-sm font-black text-zinc-900">Monthly savings</p>
          <p className="text-xs text-zinc-400 mt-0.5">Enter a new amount to recalculate your retirement projection.</p>
        </div>
        <ContributionForm planId={id} currentContribution={plan.monthlyContribution} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl bg-white border border-zinc-100 p-5 flex flex-col gap-0.5 shadow-sm">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{m.label}</span>
            <span className="text-2xl font-black text-zinc-900">{m.value}</span>
            <span className="text-[10px] text-zinc-400">{m.subtitle}</span>
            {"tooltip" in m && (
              <span className="text-[10px] text-zinc-400 mt-1 leading-tight">{(m as any).tooltip}</span>
            )}
          </div>
        ))}
      </div>

      {/* Monte Carlo prompt — shown when no MC results yet */}
      {!monteCarlo && (
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
          <div className="flex-1">
            <p className="text-sm font-bold text-zinc-700">Run a real probability simulation</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              The {successProbability}% above is an estimate. Ask Claude to run 500 Monte Carlo scenarios for a real probability with best/worst-case range.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <CopyPromptButton prompt={monteCarloPrompt} label="Copy prompt" />
            <a
              href="https://claude.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-teal text-teal px-4 py-1.5 text-xs font-semibold hover:bg-teal hover:text-white transition-colors"
            >
              Open Claude
            </a>
          </div>
        </div>
      )}

      {/* Allocation + projection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white border border-zinc-100 p-6 shadow-sm">
          <h2 className="font-black text-zinc-900 mb-4">Asset allocation</h2>
          <div className="flex flex-col gap-3">
            {plan.allocation.map((a) => (
              <div key={a.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">{a.label}</span>
                  <span className="font-bold text-zinc-900">{a.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.pct}%`, backgroundColor: a.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-zinc-100 p-6 shadow-sm col-span-1 sm:col-span-2">
          <h2 className="font-black text-zinc-900 mb-5">Growth projection</h2>
          <GrowthProjectionChart
            currentBalance={plan.currentBalance}
            monthlyContribution={plan.monthlyContribution}
            assumedReturn={plan.assumedReturn}
            targetBalance={plan.targetBalance}
            currentAge={plan.currentAge}
            retirementAge={plan.retirementAge}
            simulationPoints={simulationPoints}
          />
        </div>
      </div>

      {/* What-if */}
      <div>
        <h2 className="font-black text-zinc-900 mb-4">What-if scenarios</h2>
        <WhatIfPanel isPremium={premium} scenarios={scenarios} />
      </div>

      {/* Events in this plan */}
      {planData?.events && planData.events.filter(e => !e.hide).length > 0 ? (
        <EventsSummary events={planData.events.filter(e => !e.hide)} />
      ) : planData != null ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-4">
          <p className="text-sm font-bold text-zinc-700">No events modeled yet</p>
          <p className="text-xs text-zinc-400 mt-1">
            Your plan uses a simple projection. Ask Claude to build your full event model — income, rent, mortgage, retirement contributions — for a simulation that reflects your real life.
          </p>
        </div>
      ) : null}

      {/* Claude CTA */}
      <div className="rounded-2xl bg-teal p-6 flex flex-col gap-4">
        <div>
          <p className="font-bold text-white">Ask Claude about this plan</p>
          <p className="text-sm text-white/70 mt-1">
            Copy the prompt below, open Claude with the Lever connector, and paste it to get personalised insights on your plan.
          </p>
        </div>
        <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-xs text-white/80 leading-relaxed flex-1 font-mono">{askClaudePrompt}</p>
          <CopyPromptButton prompt={askClaudePrompt} label="Copy" />
        </div>
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-teal hover:bg-zinc-100 transition-colors"
        >
          Open Claude →
        </a>
      </div>
    </div>
  );
}

function ContextPanel({ context }: { context: PlanContext }) {
  const items: { label: string; value: string }[] = [];
  if (context.dateOfBirth)
    items.push({ label: "Date of birth", value: context.dateOfBirth });
  if (context.annualIncome)
    items.push({ label: "Annual income", value: `$${context.annualIncome.toLocaleString()}` });
  if (context.targetMonthlyIncome)
    items.push({ label: "Retirement income goal", value: `$${context.targetMonthlyIncome.toLocaleString()}/month` });
  if (context.riskTolerance)
    items.push({ label: "Risk tolerance", value: RISK_LABEL[context.riskTolerance] ?? context.riskTolerance });

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm px-6 py-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-zinc-900">Plan context</p>
        <span className="text-xs text-zinc-400">Set via Claude · to update, ask Claude</span>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{item.label}</span>
              <span className="text-sm font-semibold text-zinc-800">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {context.narrative && (
        <p className="text-sm text-zinc-500 italic border-t border-zinc-100 pt-3">&ldquo;{context.narrative}&rdquo;</p>
      )}
    </div>
  );
}

// ── Event type display names ──────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  get_job: "Full-time Job", get_wage_job: "Hourly Job", start_business: "Business",
  inflow: "Income", outflow: "Expense", rent_payment: "Rent",
  buy_house: "Home Purchase", existing_mortgage: "Existing Mortgage",
  buy_car: "Car Purchase", loan_amortization: "Personal Loan",
  payment_schedule: "Debt Repayment", loan: "Loan",
  federal_subsidized_loan: "Federal Student Loan", federal_unsubsidized_loan: "Federal Student Loan",
  private_student_loan: "Private Student Loan",
  roth_ira_contribution: "Roth IRA", invest_money: "Investment Goal",
  high_yield_savings_account: "High Yield Savings",
  monthly_budgeting: "Monthly Budget", buy_groceries: "Groceries",
  buy_health_insurance: "Health Insurance", buy_life_insurance: "Life Insurance",
  receive_government_aid: "Government Aid",
  have_kid: "Having a Child", childcare_expense: "Childcare",
  marriage: "Marriage", divorce: "Divorce", career_break: "Career Break",
  moving_costs: "Moving Costs", windfall: "Windfall",
  freelance_income: "Freelance Income", retirement: "Retirement",
  transfer_money: "Money Transfer", usa_tax_system: "US Tax System",
  declare_accounts: "Account Declaration", manual_correction: "Manual Adjustment",
  purchase: "Purchase", gift: "Gift",
};

const FREQ_LABEL: Record<number, string> = { 7: "weekly", 14: "biweekly", 30: "monthly", 365: "yearly" };

function getEventSummary(event: { type: string; parameters: { type: string; value: string | number }[] }): string {
  const p = Object.fromEntries(event.parameters.map(x => [x.type, x.value]));
  const fmtMoney = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : null;
  const fmtFreq = (v: unknown) => v != null ? (FREQ_LABEL[Number(v)] ?? `every ${v} days`) : null;

  switch (event.type) {
    case "get_job": case "get_wage_job": case "income_with_changing_parameters":
      return [fmtMoney(p.salary ?? p.annual_salary), "salary"].filter(Boolean).join(" ");
    case "inflow": case "rent_payment": case "outflow":
    case "childcare_expense": case "buy_groceries": case "freelance_income":
      return [fmtMoney(p.amount ?? p.monthly_cost), fmtFreq(p.frequency_days)].filter(Boolean).join(" ");
    case "payment_schedule": case "existing_mortgage":
      return [fmtMoney(p.payment), "monthly"].filter(Boolean).join(" ");
    case "monthly_budgeting": {
      // sum all category fields since there is no single `amount`
      const cats = ["groceries","utilities","rent","transportation","insurance",
                    "healthcare","dining_out","entertainment","personal_care","miscellaneous"];
      const total = cats.reduce((sum, k) => sum + (Number(p[k]) || 0), 0);
      return total > 0 ? `$${total.toLocaleString()} monthly` : "";
    }
    case "buy_house": case "loan_amortization": case "federal_subsidized_loan":
    case "federal_unsubsidized_loan": case "private_student_loan":
      return [fmtMoney(p.principal), p.interest_rate != null ? `@ ${(Number(p.interest_rate) * 100).toFixed(1)}%` : null].filter(Boolean).join(" ");
    case "buy_car":
      return [fmtMoney(p.price ?? p.cost), "purchase"].filter(Boolean).join(" ");
    case "roth_ira_contribution": case "invest_money": case "high_yield_savings_account":
      return [fmtMoney(p.monthly_contribution ?? p.amount), "monthly"].filter(Boolean).join(" ");
    case "buy_health_insurance": case "buy_life_insurance":
      return [fmtMoney(p.monthly_premium ?? p.premium), "monthly"].filter(Boolean).join(" ");
    case "windfall":
      return fmtMoney(p.amount) ?? "";
    default:
      return "";
  }
}

function EventsSummary({ events }: { events: { id: number; type: string; title: string; parameters: { type: string; value: string | number }[] }[] }) {
  const displayEvents = events.filter(e =>
    !["declare_accounts", "usa_tax_system", "life_event", "manual_correction"].includes(e.type)
  );
  if (displayEvents.length === 0) return null;

  return (
    <details className="rounded-2xl border border-zinc-100 bg-white shadow-sm group">
      <summary className="px-6 py-4 cursor-pointer list-none flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-zinc-900">Events in this plan</p>
          <span className="text-xs font-semibold text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">
            {displayEvents.length}
          </span>
        </div>
        <span className="text-xs text-zinc-400 group-open:hidden">Show ▾</span>
        <span className="text-xs text-zinc-400 hidden group-open:inline">Hide ▴</span>
      </summary>
      <div className="border-t border-zinc-100 divide-y divide-zinc-50">
        {displayEvents.map(event => {
          const label = EVENT_LABELS[event.type] ?? event.type;
          const summary = getEventSummary(event);
          return (
            <div key={event.id} className="px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{label}</span>
                <span className="text-sm text-zinc-800">{event.title || label}</span>
              </div>
              {summary && (
                <span className="text-sm font-semibold text-zinc-500 shrink-0">{summary}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-6 py-3 border-t border-zinc-100">
        <p className="text-xs text-zinc-400">To add or change events, ask Claude to update your plan.</p>
      </div>
    </details>
  );
}

type Scenario = { label: string; description: string; delta: string; positive: boolean };

// B-3: dynamic scenarios derived from the plan's actual numbers.
function buildScenarios(plan: ReturnType<typeof planFromRow>): Scenario[] {
  const { currentBalance, monthlyContribution, assumedReturn, targetBalance, currentAge, retirementAge } = plan;
  const years = retirementAge - currentAge;
  if (years <= 0) return [];

  const base = projectBalance(currentBalance, monthlyContribution, assumedReturn, years);
  const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(Math.abs(n) / 1000)}K`;
  const delta = (n: number) => `${n >= 0 ? "+" : "-"}${fmt(n)} at retirement`;

  // Scenario 1: increase savings by $500/mo
  const withMore = projectBalance(currentBalance, monthlyContribution + 500, assumedReturn, years) - base;

  // Scenario 2: retire 2 years later (more accumulation)
  const withLater = years >= 2
    ? projectBalance(currentBalance, monthlyContribution, assumedReturn, years + 2) - base
    : null;

  // Scenario 3: retire 2 years earlier (less accumulation)
  const withEarlier = years >= 3
    ? projectBalance(currentBalance, monthlyContribution, assumedReturn, years - 2) - base
    : null;

  // Scenario 4: lower return (market headwind, 2% less)
  const withLowerReturn = projectBalance(currentBalance, monthlyContribution, Math.max(0, assumedReturn - 2), years) - base;

  const scenarios: Scenario[] = [
    {
      label: "Increase monthly savings by $500",
      description: `From $${monthlyContribution.toLocaleString()} to $${(monthlyContribution + 500).toLocaleString()}/mo`,
      delta: delta(withMore),
      positive: withMore >= 0,
    },
    {
      label: `Lower market return (${Math.max(0, assumedReturn - 2)}% instead of ${assumedReturn}%)`,
      description: "Headwind scenario — conservative market",
      delta: delta(withLowerReturn),
      positive: false,
    },
  ];

  if (withEarlier !== null) {
    scenarios.push({
      label: `Retire two years earlier (age ${retirementAge - 2})`,
      description: "Shorter accumulation phase",
      delta: delta(withEarlier),
      positive: false,
    });
  }

  if (withLater !== null) {
    scenarios.push({
      label: `Retire two years later (age ${retirementAge + 2})`,
      description: "Extra accumulation time",
      delta: delta(withLater),
      positive: true,
    });
  }

  return scenarios;
}
