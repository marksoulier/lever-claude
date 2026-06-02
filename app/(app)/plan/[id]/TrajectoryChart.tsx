"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { PlanSnapshotRow } from "@/lib/supabase/plan-snapshot";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl bg-white border border-zinc-200 shadow-md px-3 py-2 max-w-[200px]">
      <p className="text-xs text-zinc-400">{new Date(d.recorded_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      <p className="text-sm font-bold text-zinc-900">{fmt(d.projected_balance)}</p>
      {d.snapshot_note && <p className="text-xs text-zinc-400 mt-0.5">{d.snapshot_note}</p>}
    </div>
  );
}

export default function TrajectoryChart({ planId }: { planId: string }) {
  const [snapshots, setSnapshots] = useState<PlanSnapshotRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/plans/${planId}/snapshots`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setSnapshots(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [planId]);

  if (loading) return null;

  // Need at least 2 snapshots for a meaningful trajectory
  if (snapshots.length < 2) return null;

  const first  = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const delta  = latest.projected_balance - first.projected_balance;
  const pct    = first.projected_balance !== 0
    ? ((delta / Math.abs(first.projected_balance)) * 100).toFixed(0)
    : null;

  const positive = delta >= 0;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm px-6 py-5 flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-black text-zinc-900">Projection trajectory</p>
          <p className="text-xs text-zinc-400 mt-0.5">How your projected retirement balance has changed</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${positive ? "text-teal-dark" : "text-red-500"}`}>
            {positive ? "+" : ""}{fmt(delta)}
            {pct !== null && ` (${positive ? "+" : ""}${pct}%)`}
          </p>
          <p className="text-xs text-zinc-400">since first snapshot</p>
        </div>
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={snapshots} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trajGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4bbdc8" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#4bbdc8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="recorded_at"
              tickFormatter={fmtDate}
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              minTickGap={60}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={first.projected_balance}
              stroke="#d4d4d8"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <Area
              type="monotone"
              dataKey="projected_balance"
              stroke="#4bbdc8"
              strokeWidth={2}
              fill="url(#trajGradient)"
              dot={snapshots.length <= 20 ? { r: 2.5, fill: "#4bbdc8", strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: "#4bbdc8", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-zinc-400">
        {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} · updates whenever your plan changes
      </p>
    </div>
  );
}
