"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { NetWorthSnapshot } from "@/app/api/net-worth/route";
import type { DocumentRecord } from "@/app/api/documents/route";
import NetWorthGraph from "./NetWorthGraph";
import CreatePlanForm from "./CreatePlanForm";
import AccountsPanel from "./AccountsPanel";
import OnboardingGate from "./OnboardingGate";
import type { Plan } from "@/lib/store";

export default function DashboardPage() {
  const [hasPlans, setHasPlans] = useState<boolean | null>(null); // null = loading
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);

  const [docCount, setDocCount] = useState<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data: DocumentRecord[]) => { if (!cancelled) setDocCount(Array.isArray(data) ? data.length : 0); })
      .catch(() => { if (!cancelled) setDocCount(0); });
    return () => { cancelled = true; };
  }, []);

  // Load plans — drives both the onboarding gate and the plan cards
  useEffect(() => {
    let cancelled = false;
    fetch("/api/plans")
      .then((r) => r.json())
      .then((data: Plan[]) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setPlans(list);
          setHasPlans(list.length > 0);
          setPlansLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setHasPlans(true); setPlansLoading(false); }
      });
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
      {showGate && <OnboardingGate onComplete={() => setHasPlans(true)} />}

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

      {/* Plans */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black text-zinc-900">Your plans</h2>
          <CreatePlanForm />
        </div>

        {plansLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-zinc-100 px-6 py-5 shadow-sm flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <div className="h-4 w-36 rounded bg-zinc-100" />
                  <div className="h-3 w-48 rounded bg-zinc-100" />
                </div>
                <div className="h-3 w-20 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl bg-teal-light border border-teal-mid px-5 py-4 text-sm text-zinc-600">
            No plans yet — connect Claude with the Lever connector and ask it to create your first plan.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((p) => {
              const fmtBalance = (n: number) =>
                n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1_000)}K`;
              const onTrack = p.projectedBalance >= p.targetBalance;
              return (
                <Link
                  key={p.id}
                  href={`/plan/${p.id}`}
                  className="rounded-2xl border border-zinc-100 bg-white shadow-sm px-6 py-5 flex items-center justify-between gap-4 hover:border-teal hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-zinc-900 truncate">{p.name}</span>
                      {p.isPrimary && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-light px-2 py-0.5 text-[10px] font-bold text-teal-dark">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Retire at {p.retirementAge} · {fmtBalance(p.monthlyContribution)}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-zinc-900">{fmtBalance(p.projectedBalance)}</p>
                      <p className={`text-[10px] font-semibold ${onTrack ? "text-teal-dark" : "text-red-400"}`}>
                        {p.successProbability}% success
                      </p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden
                      className="text-zinc-300 group-hover:text-teal transition-colors">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Documents teaser */}
      <section>
        <h2 className="text-base font-black text-zinc-900 mb-3">Documents</h2>
        <Link
          href="/documents"
          className="flex items-center justify-between rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-4 hover:border-teal hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 group-hover:bg-teal-light flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-zinc-400 group-hover:text-teal transition-colors">
                <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              {docCount === null ? (
                <div className="h-4 w-32 rounded bg-zinc-100" />
              ) : docCount === 0 ? (
                <p className="text-sm font-semibold text-zinc-700">Upload your first document</p>
              ) : (
                <p className="text-sm font-semibold text-zinc-700">
                  {docCount} document{docCount !== 1 ? "s" : ""} uploaded
                </p>
              )}
              <p className="text-xs text-zinc-400 mt-0.5">Tax forms, pay stubs, bank statements</p>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="text-zinc-300 group-hover:text-teal transition-colors shrink-0">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>
    </div>
  );
}
