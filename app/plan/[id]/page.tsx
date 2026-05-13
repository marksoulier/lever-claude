import Link from "next/link";
import ContributionForm from "./ContributionForm";
import { plans as storePlans } from "@/lib/store";

export default async function PlanPage(props: PageProps<"/plan/[id]">) {
  const { id } = await props.params;
  const plan = plans[id] ?? plans["retire-65"];
  const currentContribution = storePlans[id]?.monthlyContribution ?? 3200;

  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link href="/" className="text-xl font-black tracking-tight text-zinc-900 lowercase">
          lever
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/dashboard" className="text-teal font-semibold">Dashboard</Link>
        </nav>
      </header>

      <main className="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/dashboard" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-zinc-600 dark:text-zinc-300">{plan.name}</span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-zinc-900">{plan.name}</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Target retirement: {plan.targetYear} · Assumed return: {plan.assumedReturn} · Inflation: {plan.inflation}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-100 p-5 shadow-sm flex flex-col gap-3">
            <div>
              <p className="text-sm font-black text-zinc-900">Monthly savings</p>
              <p className="text-xs text-zinc-400 mt-0.5">Enter a new amount to recalculate your retirement projection.</p>
            </div>
            <ContributionForm planId={id} currentContribution={currentContribution} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {plan.metrics.map((m) => (
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
          <div className="flex flex-col gap-3">
            {plan.scenarios.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between rounded-2xl bg-white border border-zinc-100 px-6 py-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-bold text-zinc-900">{s.label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>
                </div>
                <span className={`text-sm font-bold ${s.positive ? "text-teal-dark" : "text-red-400"}`}>
                  {s.delta}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-teal dark:bg-teal-dark p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

const plans: Record<string, {
  name: string;
  targetYear: string;
  assumedReturn: string;
  inflation: string;
  metrics: { label: string; value: string }[];
  allocation: { label: string; pct: number; color: string }[];
  scenarios: { label: string; description: string; delta: string; positive: boolean }[];
}> = {
  "retire-65": {
    name: "Retire at 65",
    targetYear: "2049",
    assumedReturn: "7%",
    inflation: "2.5%",
    metrics: [
      { label: "Projected balance", value: "$1.84M" },
      { label: "Monthly income", value: "$7,200" },
      { label: "Shortfall / surplus", value: "+$40K" },
      { label: "Probability of success", value: "87%" },
    ],
    allocation: [
      { label: "US Equities", pct: 50, color: "#4bc3c8" },
      { label: "International Equities", pct: 20, color: "#3b82f6" },
      { label: "Bonds", pct: 20, color: "#f59e0b" },
      { label: "Cash & Alternatives", pct: 10, color: "#8b5cf6" },
    ],
    scenarios: [
      { label: "Increase monthly savings by $500", description: "From $3,200 to $3,700/mo", delta: "+$124K at retirement", positive: true },
      { label: "Market downturn of 30% in 2030", description: "One-time shock, then recovery", delta: "-$89K at retirement", positive: false },
      { label: "Retire two years earlier (age 63)", description: "Shorter accumulation phase", delta: "-$201K at retirement", positive: false },
    ],
  },
  "retire-60": {
    name: "Retire early at 60",
    targetYear: "2044",
    assumedReturn: "7%",
    inflation: "2.5%",
    metrics: [
      { label: "Projected balance", value: "$1.21M" },
      { label: "Monthly income", value: "$4,800" },
      { label: "Shortfall / surplus", value: "-$240K" },
      { label: "Probability of success", value: "61%" },
    ],
    allocation: [
      { label: "US Equities", pct: 60, color: "#4bc3c8" },
      { label: "International Equities", pct: 20, color: "#3b82f6" },
      { label: "Bonds", pct: 15, color: "#f59e0b" },
      { label: "Cash & Alternatives", pct: 5, color: "#8b5cf6" },
    ],
    scenarios: [
      { label: "Increase monthly savings by $1,000", description: "From $3,200 to $4,200/mo", delta: "+$198K at retirement", positive: true },
      { label: "Part-time income of $2K/mo until 65", description: "Bridge income reduces withdrawals", delta: "+$310K at retirement", positive: true },
      { label: "Healthcare costs increase by $500/mo", description: "Pre-Medicare gap coverage", delta: "-$78K at retirement", positive: false },
    ],
  },
};
