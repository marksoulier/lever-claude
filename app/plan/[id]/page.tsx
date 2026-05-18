import Link from "next/link";
import { notFound } from "next/navigation";
import ContributionForm from "./ContributionForm";
import WhatIfPanel from "./WhatIfPanel";
import UserMenu from "@/app/dashboard/UserMenu";
import { createServerClient } from "@/lib/supabase/server";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";
import { isPremium } from "@/lib/supabase/subscription";

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
  const shortfall = plan.projectedBalance - plan.targetBalance;

  const metrics = [
    { label: "Projected balance",    value: fmtBalance(plan.projectedBalance) },
    { label: "Monthly income",        value: `$${plan.monthlyIncomeAtRetirement.toLocaleString()}` },
    { label: "Shortfall / surplus",   value: `${shortfall >= 0 ? "+" : ""}${fmtBalance(Math.abs(shortfall))}` },
    { label: "Probability of success", value: `${plan.successProbability}%` },
  ];

  const scenarios = scenariosByRetirementAge[plan.retirementAge] ?? [];

  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link href="/" className="text-xl font-black tracking-tight text-zinc-900 lowercase">
          lever
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/dashboard" className="text-teal font-semibold">Dashboard</Link>
          </nav>
          <UserMenu />
        </div>
      </header>

      <main className="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/dashboard" className="hover:text-zinc-600 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-zinc-600">{plan.name}</span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-zinc-900">{plan.name}</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Target retirement: {plan.targetYear} · Assumed return: {plan.assumedReturn}% · Inflation: {plan.inflation}%
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-100 p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="text-sm font-black text-zinc-900">Monthly savings</p>
              <p className="text-xs text-zinc-400 mt-0.5">Enter a new amount to recalculate your retirement projection.</p>
            </div>
            <ContributionForm planId={id} currentContribution={plan.monthlyContribution} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl bg-white border border-zinc-100 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{m.label}</span>
              <span className="text-2xl font-black text-zinc-900">{m.value}</span>
            </div>
          ))}
        </div>

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

          <div className="rounded-2xl bg-white border border-zinc-100 p-6 flex flex-col gap-3 shadow-sm">
            <h2 className="font-black text-zinc-900">Growth projection</h2>
            <p className="text-sm text-zinc-400">Chart coming soon</p>
            <div className="flex-1 rounded-xl bg-teal-light flex items-center justify-center min-h-32">
              <span className="text-xs text-teal-dark font-medium">Portfolio growth over time</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-black text-zinc-900 mb-4">What-if scenarios</h2>
          <WhatIfPanel isPremium={premium} scenarios={scenarios} />
        </div>

        <div className="rounded-2xl bg-teal p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-bold text-white">Ask Claude about this plan</p>
            <p className="text-sm text-white/70 mt-1">
              Use the lever MCP connector in Claude to update contributions, model new scenarios, and get personalized insights.
            </p>
          </div>
          <a
            href="#"
            className="shrink-0 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-teal hover:bg-zinc-100 transition-colors"
          >
            Open in Claude
          </a>
        </div>
      </main>
    </div>
  );
}

type Scenario = { label: string; description: string; delta: string; positive: boolean };

// Keyed by retirementAge. Scenarios aren't in the DB yet — add a scenarios
// table when users need to save or share them.
const scenariosByRetirementAge: Record<number, Scenario[]> = {
  65: [
    { label: "Increase monthly savings by $500", description: "From $3,200 to $3,700/mo", delta: "+$124K at retirement", positive: true },
    { label: "Market downturn of 30% in 2030",   description: "One-time shock, then recovery", delta: "-$89K at retirement", positive: false },
    { label: "Retire two years earlier (age 63)", description: "Shorter accumulation phase",   delta: "-$201K at retirement", positive: false },
  ],
  60: [
    { label: "Increase monthly savings by $1,000",         description: "From $3,200 to $4,200/mo",          delta: "+$198K at retirement", positive: true },
    { label: "Part-time income of $2K/mo until 65",        description: "Bridge income reduces withdrawals", delta: "+$310K at retirement", positive: true },
    { label: "Healthcare costs increase by $500/mo",        description: "Pre-Medicare gap coverage",         delta: "-$78K at retirement",  positive: false },
  ],
};
