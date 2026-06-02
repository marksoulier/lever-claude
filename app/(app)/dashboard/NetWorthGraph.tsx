"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { NetWorthSnapshot } from "@/app/api/net-worth/route";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: { recordedAt: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const { value, payload: { recordedAt } } = payload[0];
  return (
    <div className="rounded-xl bg-white border border-zinc-200 shadow-md px-3 py-2">
      <p className="text-xs text-zinc-400">{new Date(recordedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      <p className="text-sm font-bold text-zinc-900">{fmt(value)}</p>
    </div>
  );
}

export default function NetWorthGraph({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-2xl bg-zinc-50 border border-zinc-100">
        <p className="text-sm text-zinc-400 font-medium">No snapshots yet</p>
        <p className="text-xs text-zinc-300 mt-1">Log your first net worth below to start your history</p>
      </div>
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const first = snapshots[0];

  // Suppress chart when all snapshots share the same date — a single point renders
  // as a spike from zero, which looks like a real wealth change.
  const distinctDates = new Set(snapshots.map((s) => s.recordedAt.slice(0, 10))).size;
  const hasHistory = distinctDates >= 2;
  const change = latest.netWorth - first.netWorth;
  const changePct = first.netWorth !== 0 ? ((change / Math.abs(first.netWorth)) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-black text-zinc-900">{fmt(latest.netWorth)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Net worth · latest snapshot</p>
        </div>
        {snapshots.length > 1 && (
          <p className={`text-sm font-bold ${change >= 0 ? "text-teal-dark" : "text-red-500"}`}>
            {change >= 0 ? "+" : ""}{fmt(change)}
            {changePct !== null && ` (${change >= 0 ? "+" : ""}${changePct}%)`}
            <span className="text-zinc-400 font-normal"> all time</span>
          </p>
        )}
      </div>

      {hasHistory ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshots} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4bbdc8" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#4bbdc8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="recordedAt"
                tickFormatter={fmtDate}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                tickFormatter={fmt}
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#4bbdc8"
                strokeWidth={2}
                fill="url(#netWorthGradient)"
                dot={snapshots.length <= 12 ? { r: 3, fill: "#4bbdc8", strokeWidth: 0 } : false}
                activeDot={{ r: 5, fill: "#4bbdc8", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 rounded-2xl bg-zinc-50 border border-zinc-100">
          <p className="text-sm text-zinc-400 font-medium">Your chart will fill in over time</p>
          <p className="text-xs text-zinc-300 mt-1">Come back tomorrow to see your first data point</p>
        </div>
      )}
    </div>
  );
}
