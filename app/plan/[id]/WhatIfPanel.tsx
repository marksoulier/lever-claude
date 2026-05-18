"use client";

import { useState } from "react";

type Scenario = { label: string; description: string; delta: string; positive: boolean };

function UpgradeCTA() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      if (!res.ok) throw new Error("Could not start checkout");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
      {/* blurred preview of locked scenarios */}
      <div className="select-none pointer-events-none blur-sm p-6 flex flex-col gap-3">
        {[
          { label: "Increase monthly savings by $500", delta: "+$124K", positive: true },
          { label: "Market downturn of 30% in 2030",   delta: "-$89K",  positive: false },
          { label: "Retire two years earlier",          delta: "-$201K", positive: false },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between rounded-xl border border-zinc-100 px-5 py-3">
            <p className="text-sm font-bold text-zinc-900">{s.label}</p>
            <span className={`text-sm font-bold ${s.positive ? "text-teal-dark" : "text-red-400"}`}>{s.delta}</span>
          </div>
        ))}
      </div>

      {/* upgrade overlay */}
      <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-bold text-zinc-900">Upgrade to Premium to unlock what-if scenarios</p>
          <p className="text-sm text-zinc-400 mt-0.5">Model how savings changes, market shocks, and early retirement affect your balance. $19.99/month.</p>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="shrink-0 rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {loading ? "Redirecting…" : "Upgrade — $19.99/mo"}
        </button>
      </div>
    </div>
  );
}

export default function WhatIfPanel({
  isPremium,
  scenarios,
}: {
  isPremium: boolean;
  scenarios: Scenario[];
}) {
  if (!isPremium) return <UpgradeCTA />;

  if (scenarios.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {scenarios.map((s) => (
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
  );
}
