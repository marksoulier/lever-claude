"use client";

import { useState, useEffect, useCallback } from "react";
import type { Account, AccountType } from "@/lib/accounts";
import { ACCOUNT_ICONS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES, computeNetWorth } from "@/lib/accounts";

function fmtBalance(n: number): string {
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString()}`;
}

function TypeBadge({ type }: { type: AccountType }) {
  const colors: Record<AccountType, string> = {
    cash:        "bg-blue-50 text-blue-600",
    investment:  "bg-teal-light text-teal-dark",
    real_estate: "bg-amber-50 text-amber-600",
    debt:        "bg-red-50 text-red-500",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors[type]}`}>
      {ACCOUNT_TYPE_LABELS[type]}
    </span>
  );
}

function AccountRow({ account, onUpdated }: { account: Account; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState(String(account.balance));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveBalance() {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: Number(balance) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      onUpdated();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!confirm(`Delete "${account.name}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      onUpdated();
    } finally {
      setDeleting(false);
    }
  }

  const isDebt = account.type === "debt";

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white border border-zinc-100 px-5 py-3.5 shadow-sm group">
      <div className="flex items-center gap-3">
        <span className="text-lg">{ACCOUNT_ICONS[account.type]}</span>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-zinc-900 text-sm">{account.name}</p>
            <TypeBadge type={account.type} />
          </div>
          {account.institution && (
            <p className="text-xs text-zinc-400">{account.institution}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">$</span>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              disabled={saving}
              className="w-28 rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-900 outline-none focus:border-teal"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveBalance(); if (e.key === "Escape") setEditing(false); }}
            />
            <button onClick={saveBalance} disabled={saving}
              className="text-xs font-semibold text-teal hover:text-teal-dark disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs text-zinc-400 hover:text-zinc-600">Cancel</button>
          </div>
        ) : (
          <>
            <span
              className={`font-black text-sm cursor-pointer hover:underline decoration-dotted ${isDebt ? "text-red-400" : "text-zinc-900"}`}
              onClick={() => { setBalance(String(account.balance)); setEditing(true); }}
              title="Click to update balance"
            >
              {isDebt ? "-" : ""}{fmtBalance(account.balance)}
            </span>
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all text-xs disabled:opacity-50"
              title="Remove account"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddAccountForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("investment");
  const [balance, setBalance] = useState("");
  const [institution, setInstitution] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, balance: Number(balance), institution: institution || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setName(""); setBalance(""); setInstitution(""); setType("investment");
      setOpen(false);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-zinc-200 py-3 text-sm text-zinc-400 hover:border-teal hover:text-teal transition-colors">
        + Add account
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-teal-mid bg-teal-light px-5 py-4 flex flex-col gap-3">
      <p className="text-sm font-black text-zinc-900">New account</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Account name</span>
          <input type="text" required placeholder="e.g. Roth IRA" value={name}
            onChange={(e) => setName(e.target.value)} disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-teal disabled:opacity-50" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}
            disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-teal disabled:opacity-50">
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Current balance ($)</span>
          <input type="number" required placeholder="e.g. 107000" value={balance}
            onChange={(e) => setBalance(e.target.value)} disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-teal disabled:opacity-50" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-zinc-500">Institution (optional)</span>
          <input type="text" placeholder="e.g. Fidelity" value={institution}
            onChange={(e) => setInstitution(e.target.value)} disabled={status === "submitting"}
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-teal disabled:opacity-50" />
        </label>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={status === "submitting"}
          className="rounded-full bg-teal px-5 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-50 disabled:cursor-wait">
          {status === "submitting" ? "Adding…" : "Add account"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm text-zinc-400 hover:text-zinc-600">Cancel</button>
      </div>
    </form>
  );
}

export default function AccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let cancelled = false;
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Account[] = await res.json();
      if (!cancelled) setAccounts(data);
    } catch (e) {
      if (!cancelled) setError((e as Error).message);
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { load(); }, [load]);

  const netWorth = computeNetWorth(accounts);
  const assets = accounts.filter((a) => a.type !== "debt");
  const debts  = accounts.filter((a) => a.type === "debt");

  if (error) return (
    <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4">
      <p className="text-sm font-semibold text-red-600">Could not load accounts</p>
      <p className="text-xs text-red-400">{error}</p>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-zinc-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-full bg-zinc-100" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-28 rounded bg-zinc-100" />
              <div className="h-2.5 w-20 rounded bg-zinc-100" />
            </div>
          </div>
          <div className="h-3.5 w-20 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {accounts.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-400 font-semibold">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm font-black text-zinc-900">
            Net: <span className={netWorth >= 0 ? "text-teal-dark" : "text-red-400"}>{netWorth >= 0 ? "" : "-"}${Math.abs(netWorth).toLocaleString()}</span>
          </p>
        </div>
      )}

      {/* Assets */}
      {assets.map((a) => (
        <AccountRow key={a.id} account={a} onUpdated={load} />
      ))}

      {/* Debts */}
      {debts.length > 0 && (
        <>
          {assets.length > 0 && <div className="border-t border-zinc-100 my-1" />}
          {debts.map((a) => (
            <AccountRow key={a.id} account={a} onUpdated={load} />
          ))}
        </>
      )}

      {accounts.length === 0 && (
        <p className="text-sm text-zinc-400 italic px-1">
          No accounts yet. Add one below or tell Claude: &ldquo;add my Fidelity Roth IRA with $107k balance.&rdquo;
        </p>
      )}

      <AddAccountForm onAdded={load} />
    </div>
  );
}
