"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import type { AdminUserDetail } from "@/app/api/admin/users/[userId]/route";

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "text-amber-600 bg-amber-50 border-amber-200",
    approved: "text-teal-dark bg-teal-light border-teal-mid",
    discarded: "text-zinc-400 bg-zinc-50 border-zinc-200",
    sent: "text-blue-600 bg-blue-50 border-blue-100",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  );
}

export default function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const [composeMessage, setComposeMessage] = useState("");
  const [composeSending, setComposeSending] = useState(false);
  const [composeResult, setComposeResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${userId}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  async function sendNotification() {
    if (!composeMessage.trim() || !detail) return;
    setComposeSending(true);
    setComposeResult(null);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.id, message: composeMessage.trim(), send: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const pushed = data._pushed as boolean;
      setComposeResult({
        ok: true,
        text: pushed ? "Sent to phone." : "Saved — no push token registered yet.",
      });
      setComposeMessage("");
      setDetail((prev) => prev ? {
        ...prev,
        notifications: [{ ...data, approvedAt: data.approved_at, createdAt: data.created_at }, ...prev.notifications],
      } : prev);
    } catch (err) {
      setComposeResult({ ok: false, text: (err as Error).message });
    } finally {
      setComposeSending(false);
    }
  }

  async function patchNotification(id: string, status: "approved" | "discarded") {
    setActionPending(id);
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setDetail((prev) => prev ? {
        ...prev,
        notifications: prev.notifications.map((n) => n.id === id ? { ...n, status: updated.status, approvedAt: updated.approved_at } : n),
      } : prev);
    } finally {
      setActionPending(null);
    }
  }

  if (loading) return (
    <div className="px-8 py-8 max-w-4xl mx-auto flex flex-col gap-6">
      {[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-zinc-100 animate-pulse" />)}
    </div>
  );

  if (error || !detail) return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
        <p className="text-sm font-semibold text-red-600">{error ?? "User not found"}</p>
      </div>
    </div>
  );

  const primary = detail.plans.find((p) => p.isPrimary);
  const setupItems = [
    { label: "Plan", ok: detail.plans.length > 0 },
    { label: "Context", ok: primary?.context !== null && primary?.context !== undefined },
    { label: "Accounts", ok: detail.accounts.length > 0 },
    { label: "Documents", ok: detail.documents.length > 0 },
  ];
  const gaps = setupItems.filter((s) => !s.ok).map((s) => s.label);

  return (
    <div className="flex flex-col gap-6 px-8 py-8 max-w-4xl mx-auto w-full">
      {/* Back + header */}
      <div>
        <Link href="/admin" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
          ← Admin
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-base font-black text-zinc-900">{detail.email}</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Joined {formatDate(detail.createdAt)} · Last active {formatDate(detail.lastSignInAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
              detail.subscription?.status === "active"
                ? "text-teal-dark bg-teal-light border-teal-mid"
                : "text-zinc-400 bg-zinc-50 border-zinc-200"
            }`}>
              {detail.subscription?.status === "active" ? "Premium" : "Free"}
            </span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              ADMIN VIEW
            </span>
          </div>
        </div>
      </div>

      {/* Activity & health */}
      <section className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-4 flex flex-col gap-3">
        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Setup health</p>
        <div className="flex gap-4">
          {setupItems.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${s.ok ? "bg-teal text-white" : "bg-zinc-200 text-zinc-400"}`}>
                {s.ok ? "✓" : "✗"}
              </span>
              <span className={`text-xs font-medium ${s.ok ? "text-zinc-700" : "text-zinc-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>
        {gaps.length > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
            Missing: {gaps.join(", ")}
          </p>
        )}
      </section>

      {/* Plans */}
      <section>
        <h2 className="text-sm font-black text-zinc-900 mb-3">Plans</h2>
        {detail.plans.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No plans yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {detail.plans.map((p) => (
              <div key={p.id} className={`rounded-2xl border px-5 py-4 ${p.isPrimary ? "bg-teal-light border-teal-mid" : "bg-white border-zinc-100"} shadow-sm`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                  <div className="flex gap-2">
                    {p.isPrimary && <span className="text-[10px] font-bold text-teal-dark bg-white border border-teal-mid px-2 py-0.5 rounded-full">Primary</span>}
                    {!p.isPrimary && <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">What-if</span>}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Projected", value: formatMoney(p.projectedBalance) },
                    { label: "Success", value: `${p.successProbability}%` },
                    { label: "Monthly", value: `$${p.monthlyContribution.toLocaleString()}` },
                    { label: "Retire at", value: p.retirementAge },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-zinc-400">{m.label}</p>
                      <p className="font-semibold text-zinc-900">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Accounts */}
      <section>
        <h2 className="text-sm font-black text-zinc-900 mb-3">Accounts</h2>
        {detail.accounts.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No accounts yet.</p>
        ) : (
          <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm divide-y divide-zinc-100">
            {detail.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{a.name}</p>
                  <p className="text-xs text-zinc-400">{a.institution ?? a.type}</p>
                </div>
                <p className="text-sm font-semibold text-zinc-900">${a.balance.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents */}
      <section>
        <h2 className="text-sm font-black text-zinc-900 mb-3">Documents</h2>
        {detail.documents.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No documents uploaded.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.documents.map((d) => (
              <div key={d.id} className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-zinc-900">{d.name}</p>
                  <p className="text-xs text-zinc-400">{formatDate(d.createdAt)}</p>
                </div>
                {d.summary ? (
                  <p className="text-xs text-zinc-500 line-clamp-2">{d.summary}</p>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No summary</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Notifications */}
      <section>
        <h2 className="text-sm font-black text-zinc-900 mb-3">Notifications</h2>

        {/* Compose */}
        <div className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-4 flex flex-col gap-3 mb-3">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Send notification</p>
          <textarea
            rows={3}
            placeholder="Write a message to send to this user's phone…"
            value={composeMessage}
            onChange={(e) => { setComposeMessage(e.target.value); setComposeResult(null); }}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal/40 focus:border-teal"
          />
          <div className="flex items-center justify-between gap-3">
            {composeResult ? (
              <p className={`text-xs font-medium ${composeResult.ok ? "text-teal-dark" : "text-red-500"}`}>
                {composeResult.text}
              </p>
            ) : (
              <span />
            )}
            <button
              onClick={sendNotification}
              disabled={composeSending || !composeMessage.trim()}
              className="text-xs font-semibold text-white bg-teal hover:bg-teal-dark px-4 py-2 rounded-full transition-colors disabled:opacity-40"
            >
              {composeSending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>

        {detail.notifications.length === 0 ? (
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 px-5 py-6 text-center">
            <p className="text-sm text-zinc-400">No notifications yet.</p>
            <p className="text-xs text-zinc-400 mt-1">
              Ask Claude to analyse this user and call <code className="bg-zinc-100 px-1 rounded">queue_recommendation</code>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {detail.notifications.map((n) => (
              <div key={n.id} className="rounded-2xl bg-white border border-zinc-100 shadow-sm px-5 py-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-zinc-700 leading-relaxed flex-1">{n.message}</p>
                  <StatusBadge status={n.status} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">{formatDate(n.createdAt)}</p>
                  {n.status === "draft" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => patchNotification(n.id, "approved")}
                        disabled={actionPending === n.id}
                        className="text-xs font-semibold text-white bg-teal hover:bg-teal-dark px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => patchNotification(n.id, "discarded")}
                        disabled={actionPending === n.id}
                        className="text-xs font-semibold text-zinc-500 hover:text-red-500 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
