"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Plan } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import CreatePlanForm from "./CreatePlanForm";
import UserMenu, { displayName } from "./UserMenu";


type PlanRow = { id: string; name: string; targetYear: string; assets: string; progress: number };

function toPlanRow(p: Plan): PlanRow {
  return {
    id:         p.id,
    name:       p.name,
    targetYear: String(p.targetYear),
    assets:     `$${Math.round(p.currentBalance / 1000)}K saved`,
    progress:   Math.round((p.currentBalance / p.targetBalance) * 100),
  };
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/plans");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: Plan[] = await response.json();
        if (!cancelled) setPlans(data.map(toPlanRow));
      } catch (err) {
        if (!cancelled) setPlansError((err as Error).message);
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <Link href="/" className="text-xl font-black tracking-tight text-zinc-900 lowercase">lever</Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/dashboard" className="text-teal font-semibold">Dashboard</Link>
          </nav>
          <UserMenu />
        </div>
      </header>

      <main className="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">
            {timeGreeting()}{user ? `, ${displayName(user)}` : ""}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Here&apos;s where your retirement plan stands today.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl bg-white border border-zinc-100 p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{m.label}</span>
              <span className="text-2xl font-black text-zinc-900">{m.value}</span>
              <span className="text-xs font-semibold text-teal-dark">{m.change}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-teal-light border border-teal-mid p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-black text-zinc-900">Connect lever to Claude</p>
            <p className="text-sm text-zinc-500 mt-1 max-w-md">
              Add the lever MCP server to Claude to update your plan, run what-if scenarios, and find financial opportunities through conversation.
            </p>
          </div>
          <Link
            href="/connect"
            className="shrink-0 rounded-full bg-teal px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-dark transition-colors"
          >
            Set up connector
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-zinc-900">Your plans</h2>
            <CreatePlanForm />
          </div>
          {plansError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-6 py-4 mb-3">
              <p className="text-sm font-semibold text-red-600">Could not load plans</p>
              <p className="text-xs text-red-400 mt-0.5">{plansError}</p>
            </div>
          )}
          {plansLoading && !plansError && (
            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-100 px-6 py-5 shadow-sm flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="h-4 w-36 rounded bg-zinc-100" />
                    <div className="h-3 w-48 rounded bg-zinc-100" />
                  </div>
                  <div className="h-3 w-24 rounded bg-zinc-100" />
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/plan/${plan.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-zinc-100 px-6 py-5 hover:border-teal-mid hover:shadow-sm transition-all shadow-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-zinc-900">{plan.name}</span>
                  <span className="text-sm text-zinc-400">
                    Target: {plan.targetYear} · {plan.assets}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-sm font-bold text-zinc-900">{plan.progress}% on track</span>
                    <div className="w-36 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full rounded-full bg-teal" style={{ width: `${plan.progress}%` }} />
                    </div>
                  </div>
                  <span className="text-teal font-bold text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-base font-black text-zinc-900 mb-4">Accounts</h2>
          <div className="flex flex-col gap-3">
            {accountList.map((a) => (
              <Link
                key={a.id}
                href={`/account/${a.id}`}
                className="flex items-center justify-between rounded-2xl bg-white border border-zinc-100 px-6 py-4 hover:border-teal-mid hover:shadow-sm transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{a.icon}</span>
                  <div>
                    <p className="font-bold text-zinc-900 text-sm">{a.name}</p>
                    <p className="text-xs text-zinc-400">{a.institution}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-black text-sm ${a.balance < 0 ? "text-[#f08080]" : "text-zinc-900"}`}>
                    {a.balance < 0 ? "-" : ""}${Math.abs(a.balance).toLocaleString()}
                  </span>
                  <span className="text-teal font-bold text-lg">›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const metrics = [
  { label: "Portfolio value", value: "$487,200", change: "+$12,400 this year" },
  { label: "Retirement target", value: "$1.8M", change: "By age 65" },
  { label: "Monthly savings", value: "$3,200", change: "22% of income" },
  { label: "Years to retire", value: "24", change: "On current path" },
];

const accountList = [
  { id: "roth-ira", name: "Roth IRA", institution: "Fidelity", icon: "🏦", balance: 107000 },
  { id: "401k", name: "401(k)", institution: "Vanguard", icon: "💼", balance: 284000 },
  { id: "mortgage", name: "Mortgage", institution: "Chase", icon: "🏠", balance: -234000 },
];
