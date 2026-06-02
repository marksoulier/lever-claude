"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  Legend,
} from "recharts";
import { projectBalance } from "@/lib/store";

type PlanSnapshot = {
  label: string;
  currentBalance: number;
  monthlyContribution: number;
  assumedReturn: number;
  targetBalance: number;
  currentAge: number;
  retirementAge: number;
};

type DataPoint = {
  age: number;
  whatif: number | null;   // null before the what-if plan's current age — recharts renders as gap
  primary: number | null;  // null before the primary plan's current age — recharts renders as gap
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function buildData(whatif: PlanSnapshot, primary: PlanSnapshot): DataPoint[] {
  const startAge = Math.min(whatif.currentAge, primary.currentAge);
  const endAge   = Math.max(whatif.retirementAge, primary.retirementAge);
  const points: DataPoint[] = [];

  for (let age = startAge; age <= endAge; age++) {
    const wiYears = age - whatif.currentAge;
    const prYears = age - primary.currentAge;
    points.push({
      age,
      // null before plan start → recharts connectNulls=false renders a gap, not a zero (B-4)
      whatif:  wiYears >= 0 ? projectBalance(whatif.currentBalance, whatif.monthlyContribution, whatif.assumedReturn, wiYears)  : null,
      primary: prYears >= 0 ? projectBalance(primary.currentBalance, primary.monthlyContribution, primary.assumedReturn, prYears) : null,
    });
  }
  return points;
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-white border border-zinc-200 shadow-lg px-4 py-3">
      <p className="text-xs font-bold text-zinc-400 mb-2">Age {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-xs text-zinc-500 capitalize">{p.name}:</span>
          <span className="text-xs font-bold text-zinc-900">{fmt(p.value)}</span>
        </div>
      ))}
      {payload.length === 2 && (
        <p className={`text-xs font-semibold mt-1.5 pt-1.5 border-t border-zinc-100 ${payload[0].value >= payload[1].value ? "text-amber-500" : "text-teal-dark"}`}>
          {payload[0].value >= payload[1].value ? "+" : ""}{fmt(payload[0].value - payload[1].value)} vs primary
        </p>
      )}
    </div>
  );
}

export default function ComparisonChart({
  whatif,
  primary,
}: {
  whatif: PlanSnapshot;
  primary: PlanSnapshot;
}) {
  const data = buildData(whatif, primary);
  const wiEnd = data.find((d) => d.age === whatif.retirementAge);
  const prEnd = data.find((d) => d.age === primary.retirementAge);
  const diff  = (wiEnd?.whatif ?? 0) - (prEnd?.primary ?? 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">This scenario</p>
          <p className="text-xl font-black text-zinc-900">{fmt(wiEnd?.whatif ?? 0)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">at age {whatif.retirementAge}</p>
        </div>
        <div className="rounded-xl bg-teal-light border border-teal-mid px-4 py-3">
          <p className="text-[10px] font-bold text-teal-dark uppercase tracking-wider mb-1">Primary plan</p>
          <p className="text-xl font-black text-zinc-900">{fmt(prEnd?.primary ?? 0)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">at age {primary.retirementAge}</p>
        </div>
      </div>

      <div className={`text-sm font-bold text-center ${diff >= 0 ? "text-amber-500" : "text-red-400"}`}>
        {diff >= 0 ? "+" : ""}{fmt(Math.abs(diff))} difference vs primary plan
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="wiGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="prGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4bbdc8" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#4bbdc8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Age", position: "insideBottomRight", offset: -4, fontSize: 11, fill: "#a1a1aa" }}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Primary plan (teal, behind) */}
            <Area
              type="monotone"
              dataKey="primary"
              name="primary"
              stroke="#4bbdc8"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#prGradient)"
              dot={false}
              connectNulls={false}
              activeDot={{ r: 4, fill: "#4bbdc8", strokeWidth: 0 }}
            />

            {/* What-if (amber, in front) */}
            <Area
              type="monotone"
              dataKey="whatif"
              name={whatif.label}
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill="url(#wiGradient)"
              dot={false}
              connectNulls={false}
              activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 0 }}
            />

            {/* Endpoint dots */}
            {wiEnd?.whatif != null && (
              <ReferenceDot x={whatif.retirementAge} y={wiEnd.whatif}
                r={5} fill="#f59e0b" stroke="white" strokeWidth={2} />
            )}
            {prEnd?.primary != null && (
              <ReferenceDot x={primary.retirementAge} y={prEnd.primary}
                r={5} fill="#4bbdc8" stroke="white" strokeWidth={2} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-5 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 bg-amber-400 rounded" />
          {whatif.label}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-teal border-t border-dashed border-teal" />
          {primary.label} (primary)
        </span>
      </div>
    </div>
  );
}
