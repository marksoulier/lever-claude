"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { AdminUserSummary } from "@/app/api/admin/users/route";

function formatRelative(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SetupDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${ok ? "text-teal-dark" : "text-zinc-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-teal" : "bg-zinc-300"}`} />
      {label}
    </span>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) setUsers(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const premiumCount = users.filter((u) => u.subscription?.status === "active").length;
  const activeThisWeek = users.filter((u) => u.lastSignInAt && Date.now() - new Date(u.lastSignInAt).getTime() < 7 * 86400000).length;
  const totalPlans = users.reduce((s, u) => s + u.planCount, 0);

  return (
    <div className="flex flex-col gap-8 px-8 py-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-zinc-900">Admin</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Visible to admin accounts only</p>
        </div>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          ADMIN
        </span>
      </div>

      {/* Stats bar */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total users", value: users.length },
            { label: "Premium", value: premiumCount },
            { label: "Active this week", value: activeThisWeek },
            { label: "Total plans", value: totalPlans },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-4">
              <p className="text-2xl font-black text-zinc-900">{s.value}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* User cards */}
      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-zinc-100 px-5 py-5 shadow-sm flex flex-col gap-3">
              <div className="h-4 w-40 rounded bg-zinc-100" />
              <div className="h-3 w-24 rounded bg-zinc-100" />
              <div className="h-3 w-32 rounded bg-zinc-100" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <p className="text-sm font-semibold text-red-600">Failed to load users</p>
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-2 gap-4">
          {users.map((u) => {
            const isPremium = u.subscription?.status === "active";
            const hasDrafts = u.draftNotificationCount > 0;
            return (
              <div key={u.id} className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-5 flex flex-col gap-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-white">
                        {(u.email[0] ?? "?").toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{u.email}</p>
                      <p className="text-xs text-zinc-400">Active {formatRelative(u.lastSignInAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasDrafts && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {u.draftNotificationCount} draft
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isPremium
                        ? "text-teal-dark bg-teal-light border-teal-mid"
                        : "text-zinc-400 bg-zinc-50 border-zinc-200"
                    }`}>
                      {isPremium ? "Premium" : "Free"}
                    </span>
                  </div>
                </div>

                {/* Setup health */}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <SetupDot ok={u.planCount > 0} label="Plan" />
                  <SetupDot ok={u.primaryPlan?.hasContext ?? false} label="Context" />
                  <SetupDot ok={u.accountCount > 0} label="Accounts" />
                  <SetupDot ok={u.documentCount > 0} label="Docs" />
                </div>

                {/* Primary plan snippet */}
                {u.primaryPlan ? (
                  <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-3 py-2.5 text-xs text-zinc-600">
                    <span className="font-semibold text-zinc-800">{u.primaryPlan.name}</span>
                    {" · "}${(u.primaryPlan.projectedBalance / 1_000_000).toFixed(2)}M projected
                    {" · "}{u.primaryPlan.successProbability}% success
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-50 border border-zinc-100 px-3 py-2.5 text-xs text-zinc-400 italic">
                    No plan created yet
                  </div>
                )}

                {/* Counts + action */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-xs text-zinc-400">
                    <span>{u.planCount} plan{u.planCount !== 1 ? "s" : ""}</span>
                    <span>{u.accountCount} acct{u.accountCount !== 1 ? "s" : ""}</span>
                    <span>{u.documentCount} doc{u.documentCount !== 1 ? "s" : ""}</span>
                  </div>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors"
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
