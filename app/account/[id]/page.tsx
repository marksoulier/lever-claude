import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AccountPage(props: PageProps<"/account/[id]">) {
  const { id } = await props.params;
  const account = accounts[id];

  if (!account) notFound();

  const isDebt = account.balance < 0;

  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link href="/" className="text-xl font-black tracking-tight text-zinc-900 lowercase">lever</Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <Link href="/dashboard" className="text-teal font-semibold">Dashboard</Link>
        </nav>
      </header>

      <main className="flex flex-col gap-8 px-8 py-10 max-w-3xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/dashboard" className="hover:text-teal transition-colors">Dashboard</Link>
          <span>›</span>
          <span className="text-zinc-600 font-medium">{account.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: isDebt ? "#fff0f0" : "#e8f8fa" }}>
              {account.icon}
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900">{account.name}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">{account.type} · {account.institution}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black" style={{ color: isDebt ? "#f08080" : "#111111" }}>
              {isDebt ? "-" : ""}${Math.abs(account.balance).toLocaleString()}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">Current balance</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {account.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-zinc-100 p-5 shadow-sm">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-black text-zinc-900 mt-1">{s.value}</p>
              {s.sub && <p className="text-xs text-zinc-400 mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="font-black text-zinc-900 mb-4">Recent activity</h2>
          <div className="flex flex-col divide-y divide-zinc-100 rounded-2xl border border-zinc-100 overflow-hidden shadow-sm">
            {account.transactions.map((t, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4 bg-white">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{t.label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{t.date}</p>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: t.amount > 0 ? "#2d9faa" : "#f08080" }}
                >
                  {t.amount > 0 ? "+" : ""}${Math.abs(t.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Linked plan */}
        <div className="rounded-2xl bg-teal-light border border-teal-mid p-5 flex items-center justify-between">
          <div>
            <p className="font-bold text-zinc-900 text-sm">Used in plan: {account.linkedPlan}</p>
            <p className="text-xs text-zinc-400 mt-0.5">This account contributes to your retirement projection.</p>
          </div>
          <Link
            href={`/plan/${account.linkedPlanId}`}
            className="rounded-full bg-teal px-5 py-2 text-sm font-bold text-white hover:bg-teal-dark transition-colors"
          >
            View plan →
          </Link>
        </div>
      </main>
    </div>
  );
}

const accounts: Record<string, {
  name: string;
  type: string;
  institution: string;
  icon: string;
  balance: number;
  linkedPlan: string;
  linkedPlanId: string;
  stats: { label: string; value: string; sub?: string }[];
  transactions: { label: string; date: string; amount: number }[];
}> = {
  "roth-ira": {
    name: "Roth IRA",
    type: "Retirement account",
    institution: "Fidelity",
    icon: "🏦",
    balance: 107000,
    linkedPlan: "Retire at 65",
    linkedPlanId: "retire-65",
    stats: [
      { label: "YTD return", value: "+8.4%", sub: "vs. 7% target" },
      { label: "Annual limit", value: "$7,000", sub: "2026 max" },
      { label: "Contributed", value: "$3,500", sub: "50% of limit used" },
    ],
    transactions: [
      { label: "Monthly contribution", date: "May 1, 2026", amount: 583 },
      { label: "Dividend reinvestment", date: "Apr 30, 2026", amount: 214 },
      { label: "Monthly contribution", date: "Apr 1, 2026", amount: 583 },
      { label: "Dividend reinvestment", date: "Mar 31, 2026", amount: 198 },
      { label: "Monthly contribution", date: "Mar 1, 2026", amount: 583 },
    ],
  },
  "401k": {
    name: "401(k)",
    type: "Employer retirement",
    institution: "Vanguard",
    icon: "💼",
    balance: 284000,
    linkedPlan: "Retire at 65",
    linkedPlanId: "retire-65",
    stats: [
      { label: "YTD return", value: "+9.1%", sub: "vs. 7% target" },
      { label: "Employer match", value: "4%", sub: "Fully matched" },
      { label: "Vesting", value: "100%", sub: "Fully vested" },
    ],
    transactions: [
      { label: "Payroll contribution", date: "May 1, 2026", amount: 1200 },
      { label: "Employer match", date: "May 1, 2026", amount: 480 },
      { label: "Payroll contribution", date: "Apr 15, 2026", amount: 1200 },
      { label: "Employer match", date: "Apr 15, 2026", amount: 480 },
      { label: "Payroll contribution", date: "Apr 1, 2026", amount: 1200 },
    ],
  },
  "mortgage": {
    name: "Mortgage",
    type: "Home loan",
    institution: "Chase",
    icon: "🏠",
    balance: -234000,
    linkedPlan: "Retire at 65",
    linkedPlanId: "retire-65",
    stats: [
      { label: "Rate", value: "3.25%", sub: "Fixed 30yr" },
      { label: "Monthly payment", value: "$1,840", sub: "P&I" },
      { label: "Payoff date", value: "2048", sub: "22 years left" },
    ],
    transactions: [
      { label: "Monthly payment", date: "May 1, 2026", amount: -1840 },
      { label: "Monthly payment", date: "Apr 1, 2026", amount: -1840 },
      { label: "Monthly payment", date: "Mar 1, 2026", amount: -1840 },
      { label: "Monthly payment", date: "Feb 1, 2026", amount: -1840 },
      { label: "Monthly payment", date: "Jan 1, 2026", amount: -1840 },
    ],
  },
};
