"use client";

import { useState, useEffect, useCallback } from "react";
import type { NetWorthSnapshot } from "@/app/api/net-worth/route";
import NetWorthGraph from "./NetWorthGraph";
import CreatePlanForm from "./CreatePlanForm";
import AccountsPanel from "./AccountsPanel";
import OnboardingGate from "./OnboardingGate";

export default function DashboardPage() {
  const [hasPlans, setHasPlans] = useState<boolean | null>(null); // null = loading

  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);

  const [logAmount, setLogAmount] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logStatus, setLogStatus] = useState<"idle" | "submitting">("idle");
  const [logError, setLogError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    let cancelled = false;
    try {
      const res = await fetch("/api/net-worth");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NetWorthSnapshot[] = await res.json();
      if (!cancelled) setSnapshots(data);
    } catch (err) {
      if (!cancelled) setSnapshotsError((err as Error).message);
    } finally {
      if (!cancelled) setSnapshotsLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cancel = loadSnapshots();
    return () => { cancel.then((fn) => fn?.()); };
  }, [loadSnapshots]);

  // Check for existing plans to decide whether to show the onboarding gate
  useEffect(() => {
    let cancelled = false;
    fetch("/api/plans")
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setHasPlans(Array.isArray(data) && data.length > 0); })
      .catch(() => { if (!cancelled) setHasPlans(true); }); // on error, don't block
    return () => { cancelled = true; };
  }, []);

  async function handleLogSnapshot(e: React.FormEvent) {
    e.preventDefault();
    setLogStatus("submitting");
    setLogError(null);
    try {
      const res = await fetch("/api/net-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netWorth: Number(logAmount), recordedAt: logDate }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const snap: NetWorthSnapshot = await res.json();
      setSnapshots((prev) => {
        const next = [...prev.filter((s) => s.recordedAt !== snap.recordedAt), snap];
        return next.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      });
      setLogAmount("");
    } catch (err) {
      setLogError((err as Error).message);
    } finally {
      setLogStatus("idle");
    }
  }

  // Show gate when we know there are no plans (null = still loading, don't flash gate)
  const showGate = hasPlans === false;

  return (
    <div className="flex flex-col gap-8 px-8 py-8 max-w-3xl mx-auto w-full">
      {showGate && <OnboardingGate />}

      {/* Net worth graph */}
      <section>
        <h1 className="text-base font-black text-zinc-900 mb-4">Net worth</h1>
        <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-6 py-5">
          {snapshotsError ? (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm font-semibold text-red-600">Could not load snapshots</p>
              <p className="text-xs text-red-400">{snapshotsError}</p>
            </div>
          ) : snapshotsLoading ? (
            <div className="flex flex-col gap-3">
              <div className="h-8 w-32 rounded bg-zinc-100" />
              <div className="h-48 rounded-xl bg-zinc-100" />
            </div>
          ) : (
            <NetWorthGraph snapshots={snapshots} />
          )}
        </div>
      </section>

      {/* Accounts + log snapshot */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-black text-zinc-900">Accounts</h2>
        <AccountsPanel />

        {/* Log snapshot */}
        <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-5 py-4">
          <p className="text-sm font-bold text-zinc-700 mb-3">Log net worth snapshot</p>
          <form onSubmit={handleLogSnapshot} className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500">Date</span>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                disabled={logStatus === "submitting"}
                required
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-teal transition-colors disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-zinc-500">Net worth ($)</span>
              <input
                type="number"
                placeholder="e.g. 350000"
                value={logAmount}
                onChange={(e) => setLogAmount(e.target.value)}
                disabled={logStatus === "submitting"}
                required
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-900 outline-none focus:border-teal transition-colors disabled:opacity-50 w-40"
              />
            </label>
            <button
              type="submit"
              disabled={logStatus === "submitting" || !logAmount}
              className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {logStatus === "submitting" ? "Saving…" : "Log it"}
            </button>
          </form>
          {logError && <p className="text-xs text-red-500 mt-2">{logError}</p>}
        </div>
      </section>

      {/* Plans quick-create */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-zinc-900">Plans</h2>
          <CreatePlanForm />
        </div>
        <div className="rounded-2xl bg-teal-light border border-teal-mid px-5 py-4 text-sm text-zinc-600">
          Select a plan from the sidebar to view its detail and run what-if scenarios.
        </div>
      </section>
    </div>
  );
}
