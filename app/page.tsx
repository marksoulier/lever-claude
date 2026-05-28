import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <span className="text-xl font-black tracking-tight text-zinc-900 lowercase">lever</span>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/dashboard"
            className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-center px-16 gap-16 max-w-7xl mx-auto w-full py-16">
        {/* Left: hero copy */}
        <div className="flex flex-col gap-7 flex-1">
          <h1 className="text-6xl font-black leading-[1.08] tracking-tight text-zinc-900">
            Your retirement plan,<br />
            built with{" "}
            <em className="not-italic italic text-teal">AI</em>.
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed max-w-md">
            Lever connects to Claude to model your retirement, run what-if scenarios, and surface personalised opportunities — all through conversation.
          </p>
          <div className="flex flex-col gap-2 mt-1">
            <Link
              href="/dashboard"
              className="self-start rounded-full bg-teal px-8 py-4 text-base font-bold text-white hover:bg-teal-dark transition-colors shadow-sm"
            >
              Get started free
            </Link>
            <p className="text-xs text-zinc-400">Works with Claude.ai (free or paid) or Claude Desktop</p>
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
              {/* Header row */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Projected balance</p>
                  <p className="text-2xl font-black text-zinc-900 leading-none mt-0.5">$1.84M</p>
                  <p className="text-[10px] text-teal font-semibold mt-0.5">at retirement · age 63</p>
                </div>
                <div className="flex gap-1">
                  {["5yr", "10yr", "20yr", "all"].map((t) => (
                    <span
                      key={t}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t === "all" ? "bg-teal text-white" : "text-zinc-400"}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* SVG area chart */}
              <div className="relative">
                <svg
                  viewBox="0 0 400 110"
                  className="w-full"
                  style={{ height: "110px" }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4bbdc8" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#4bbdc8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Goal dashed line */}
                  <line x1="0" y1="6" x2="400" y2="6" stroke="#e4e4e7" strokeWidth="1" strokeDasharray="4 3" />
                  {/* Area fill */}
                  <path
                    d="M0,102 C50,101 90,99 130,93 C170,86 200,76 240,60 C280,44 320,22 400,7 L400,110 L0,110 Z"
                    fill="url(#areaGrad)"
                  />
                  {/* Line */}
                  <path
                    d="M0,102 C50,101 90,99 130,93 C170,86 200,76 240,60 C280,44 320,22 400,7"
                    fill="none"
                    stroke="#4bbdc8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Today dot */}
                  <circle cx="0" cy="102" r="3" fill="white" stroke="#4bbdc8" strokeWidth="1.5" />
                  {/* Retirement dot */}
                  <circle cx="400" cy="7" r="4" fill="#4bbdc8" />
                </svg>
                <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                  {["2024", "2030", "2036", "2041", "2047"].map((y) => (
                    <span key={y}>{y}</span>
                  ))}
                </div>
              </div>

              {/* Summary row */}
              <div className="mt-4 rounded-xl border border-zinc-100 p-3 flex justify-between text-xs">
                {[
                  { label: "Today", value: "$95K" },
                  { label: "Target", value: "$2.1M" },
                  { label: "Shortfall", value: "−$261K", red: true },
                  { label: "Success", value: "85%" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col gap-0.5 items-center">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">{s.label}</span>
                    <span className={`font-black text-sm ${s.red ? "text-red-400" : "text-zinc-800"}`}>{s.value}</span>
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

