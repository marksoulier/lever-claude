import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <span className="text-xl font-black tracking-tight text-zinc-900 lowercase">lever</span>
        <nav className="flex items-center gap-7 text-sm font-medium">
          <Link href="/" className="text-teal font-semibold">Home</Link>
          <a href="#" className="text-zinc-500 hover:text-zinc-900 transition-colors">Demo</a>
          <a href="#" className="text-zinc-500 hover:text-zinc-900 transition-colors">lever Education</a>
          <a href="#" className="text-zinc-500 hover:text-zinc-900 transition-colors">About</a>
          <a href="#" className="text-zinc-500 hover:text-zinc-900 transition-colors">Contact</a>
          <Link
            href="/dashboard"
            className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors"
          >
            Open Timeline
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-center px-16 gap-16 max-w-7xl mx-auto w-full py-20">
        {/* Left: hero copy */}
        <div className="flex flex-col gap-7 flex-1">
          <h1 className="text-6xl font-black leading-[1.08] tracking-tight text-zinc-900">
            Play out your financial<br />
            decisions{" "}
            <em className="not-italic italic text-teal">before</em>{" "}
            you make them.
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed max-w-md">
            lever is a sandbox for your financial what-ifs. Add life events, move things around, and explore how different paths unfold over time.
          </p>
          <div className="flex gap-3 mt-1">
            <Link
              href="/dashboard"
              className="rounded-full bg-teal px-8 py-4 text-base font-bold text-white hover:bg-teal-dark transition-colors shadow-sm"
            >
              Start Your Free Timeline
            </Link>
          </div>
          <div className="flex items-center gap-8 mt-2">
            <div className="w-8 h-8 rounded-full border-[2.5px] border-[#f08080] opacity-70" />
            <span className="text-teal text-2xl font-light opacity-70">✕</span>
            <span className="text-teal text-3xl font-thin leading-none opacity-70">+</span>
          </div>
        </div>

        {/* Right: dashboard preview */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 shadow-xl overflow-hidden bg-white">
            {/* Mock browser chrome */}
            <div className="flex items-center gap-1.5 px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            {/* Mock chart area */}
            <div className="p-5 bg-white">
              <div className="flex gap-2 mb-4 text-xs text-zinc-400 font-medium">
                {["3m", "CurM", "CurYr", "5yr", "10yr", "50yr"].map((t) => (
                  <span
                    key={t}
                    className={`px-2 py-0.5 rounded ${t === "50yr" ? "bg-teal text-white" : "hover:text-zinc-600"}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="relative h-52 flex items-end gap-0.5 px-2">
                {chartBars.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
                    <div className="rounded-t-sm opacity-80" style={{ height: `${b.net}%`, background: "#4bbdc8" }} />
                    <div className="rounded-t-sm opacity-40" style={{ height: `${b.inv}%`, background: "#4bbdc8" }} />
                    <div className="rounded-t-sm opacity-20" style={{ height: `${b.cash}%`, background: "#4bbdc8" }} />
                  </div>
                ))}
                <div className="absolute inset-x-0 bottom-0 border-t border-zinc-200" />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 mt-2 px-2">
                {["2024", "2030", "2035", "2041", "2048", "2055", "2062", "2074"].map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-zinc-100 p-3 text-xs">
                <div className="flex justify-between font-semibold text-zinc-700 mb-2">
                  <span>Net Worth</span><span>$835k</span>
                </div>
                {[
                  { label: "Cash", value: "$475k", color: "#4bbdc8" },
                  { label: "Investments", value: "$36k", color: "#4bbdc8" },
                  { label: "Retirement", value: "$107k", color: "#4bbdc8" },
                  { label: "Debt", value: "-$234k", color: "#f08080" },
                  { label: "Assets", value: "$450k", color: "#4bbdc8" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between text-zinc-500 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm" style={{ background: r.color }} />
                      {r.label}
                    </div>
                    <span style={{ color: r.color === "#f08080" ? r.color : undefined }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-100 px-8 py-4 text-center text-xs text-zinc-400">
        © {new Date().getFullYear()} lever. Not financial advice.
      </footer>
    </div>
  );
}

const chartBars = [
  { cash: 20, inv: 10, net: 18 },
  { cash: 22, inv: 12, net: 22 },
  { cash: 24, inv: 15, net: 27 },
  { cash: 26, inv: 18, net: 33 },
  { cash: 28, inv: 22, net: 40 },
  { cash: 30, inv: 27, net: 48 },
  { cash: 32, inv: 33, net: 57 },
  { cash: 34, inv: 40, net: 67 },
  { cash: 36, inv: 48, net: 76 },
  { cash: 38, inv: 55, net: 85 },
  { cash: 40, inv: 62, net: 92 },
  { cash: 42, inv: 68, net: 96 },
];
