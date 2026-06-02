import { notFound } from "next/navigation";
import ContributionForm from "./ContributionForm";
import WhatIfPanel from "./WhatIfPanel";
import PlanSettingsMenu from "./PlanSettingsMenu";
import GrowthProjectionChart, { type SimPoint } from "./GrowthProjectionChart";
import ComparisonChart from "./ComparisonChart";
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

  const shortfall = plan.projectedBalance - plan.targetBalance;

  const metrics = [
    { label: "Projected balance",      subtitle: "at retirement",       value: fmtBalance(plan.projectedBalance) },
    { label: "Monthly income",         subtitle: "in retirement",       value: `$${plan.monthlyIncomeAtRetirement.toLocaleString()}` },
    { label: "Shortfall / surplus",    subtitle: "vs target balance",   value: `${shortfall >= 0 ? "+" : "-"}${fmtBalance(Math.abs(shortfall))}` },
    { label: "Probability of success", subtitle: "of reaching goal",    value: `${plan.successProbability}%`,
      tooltip: "Estimates how close your projected balance is to your retirement target. Not a Monte Carlo simulation." },
  ];

  // B-3: dynamic what-if scenarios using real plan numbers
  const scenarios = buildScenarios(plan);

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
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-zinc-700">This plan has no personal context yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              Tell Claude your age, income, retirement income goal, and risk tolerance — it will set up this plan and recompute the projections for you.
            </p>
          </div>
          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors"
          >
            Set up with Claude →
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

      {/* Claude CTA */}
      <div className="rounded-2xl bg-teal p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-bold text-white">Ask Claude about this plan</p>
          <p className="text-sm text-white/70 mt-1">
            Open a Claude conversation with Lever connected to model new scenarios, update your plan, and get personalised insights.
          </p>
        </div>
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-teal hover:bg-zinc-100 transition-colors"
        >
          Open in Claude
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
