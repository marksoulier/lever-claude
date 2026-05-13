"use client";

import { useState } from "react";

type Result = {
  projectedBalance: number;
  successProbability: number;
  monthlyIncomeAtRetirement: number;
};

function fmt(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${Math.round(n / 1000)}K`;
}

export default function ContributionForm({
  planId,
  currentContribution,
}: {
  planId: string;
  currentContribution: number;
}) {
  const [value, setValue] = useState(String(currentContribution));
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    // Stop the browser navigating away — without this the page reloads
    e.preventDefault();

    const amount = Number(value);
    // Validate locally before touching the network
    if (!amount || amount <= 0) {
      setError("Enter a positive monthly amount");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyContribution: amount }),
      });

      // fetch does not throw for 4xx/5xx — must check response.ok explicitly
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      const data: Result = await response.json();
      setResult(data);
      setStatus("success");
    } catch (err) {
      // Covers network failure AND server errors thrown above
      setError((err as Error).message);
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 focus-within:border-teal transition-colors">
          <span className="text-sm text-zinc-400">$</span>
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={status === "submitting"}
            className="w-24 text-sm font-semibold text-zinc-900 outline-none bg-transparent"
          />
          <span className="text-sm text-zinc-400">/mo</span>
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {status === "submitting" ? "Calculating…" : "Recalculate"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-600">Could not recalculate</p>
          <p className="text-xs text-red-400 mt-0.5">{error}</p>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Projected balance", value: fmt(result.projectedBalance) },
            { label: "Monthly income", value: `$${result.monthlyIncomeAtRetirement.toLocaleString()}` },
            { label: "Success probability", value: `${result.successProbability}%` },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-teal-mid bg-teal-light px-4 py-3 flex flex-col gap-1"
            >
              <span className="text-xs font-semibold text-teal-dark uppercase tracking-wider">
                {m.label}
              </span>
              <span className="text-xl font-black text-zinc-900">{m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
