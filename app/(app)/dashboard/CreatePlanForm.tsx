"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/store";

export default function CreatePlanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [retirementAge, setRetirementAge] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [currentBalance, setCurrentBalance] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setRetirementAge("");
    setMonthlyContribution("");
    setCurrentBalance("");
    setStatus("idle");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          retirementAge:       Number(retirementAge),
          monthlyContribution: Number(monthlyContribution),
          currentBalance:      currentBalance ? Number(currentBalance) : 0,
        }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }

      const plan: Plan = await response.json();
      // Navigate to the new plan — the detail page fetches its own data,
      // so there is nothing to update here.
      router.push(`/plan/${plan.id}`);
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-semibold text-zinc-600 hover:border-teal hover:text-teal transition-colors"
      >
        + New plan
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-teal-mid bg-teal-light px-6 py-5 flex flex-col gap-4"
    >
      <p className="text-sm font-black text-zinc-900">New plan</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Plan name</span>
          <input
            type="text"
            required
            placeholder="e.g. Retire at 67"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-teal transition-colors disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Target retirement age</span>
          <input
            type="number"
            required
            min={42}
            max={80}
            placeholder="e.g. 65"
            value={retirementAge}
            onChange={(e) => setRetirementAge(e.target.value)}
            disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-teal transition-colors disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Monthly contribution ($)</span>
          <input
            type="number"
            required
            min={1}
            placeholder="e.g. 3200"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-teal transition-colors disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Current balance ($) — optional</span>
          <input
            type="number"
            min={0}
            placeholder="e.g. 50000"
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-teal transition-colors disabled:opacity-50"
          />
        </label>
      </div>

      <p className="text-xs text-zinc-400">
        This creates a baseline projection. For a personalized plan — income, tax, life events — open Claude and say <span className="font-semibold text-zinc-500">&ldquo;Help me build my financial plan.&rdquo;</span>
      </p>

      {error && (
        <p className="text-xs font-semibold text-red-500">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {status === "submitting" ? "Creating…" : "Create plan"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); reset(); }}
          disabled={status === "submitting"}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
