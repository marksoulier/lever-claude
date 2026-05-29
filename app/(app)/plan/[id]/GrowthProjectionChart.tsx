"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
  ComposedChart,
  Label,
} from "recharts";
import { projectBalance } from "@/lib/store";

// A simulation point from plan_data.simulation_results, pre-converted to age.
export type SimPoint = { age: number; value: number };

type Props = {
  currentBalance: number;
  monthlyContribution: number;
  assumedReturn: number;
  targetBalance: number;
  currentAge: number;
  retirementAge: number;
  // When provided, use event-based simulation results instead of the simple formula.
  simulationPoints?: SimPoint[] | null;
};

type DataPoint = {
  year: number;
  age: number;
  projected: number;
  target: number;
  isToday: boolean;
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

// Fallback: simple compound-interest formula when no simulation results exist.
function buildCurveFromFormula(props: Props): DataPoint[] {
  const { currentBalance, monthlyContribution, assumedReturn, targetBalance, currentAge, retirementAge } = props;
  const currentYear = new Date().getFullYear();
  return Array.from({ length: retirementAge - currentAge + 1 }, (_, i) => {
    const age = currentAge + i;
    return {
      year: currentYear + i,
      age,
      projected: projectBalance(currentBalance, monthlyContribution, assumedReturn, i),
      target: targetBalance,
      isToday: age === currentAge,
    };
  });
}

// Primary: build chart data from event-based simulation results.
function buildCurveFromSimulation(points: SimPoint[], props: Props): DataPoint[] {
  const { targetBalance, currentAge, retirementAge } = props;
  const currentYear = new Date().getFullYear();

  // Deduplicate by age (keep last entry per age), then fill range.
  const byAge = new Map<number, number>();
  for (const p of points) {
    if (p.age >= currentAge && p.age <= retirementAge) byAge.set(p.age, p.value);
  }

  return Array.from({ length: retirementAge - currentAge + 1 }, (_, i) => {
    const age = currentAge + i;
    return {
      year: currentYear + i,
      age,
      projected: Math.round(byAge.get(age) ?? 0),
      target: targetBalance,
      isToday: age === currentAge,
    };
  });
}

function buildCurve(props: Props): DataPoint[] {
  if (props.simulationPoints && props.simulationPoints.length > 1) {
    return buildCurveFromSimulation(props.simulationPoints, props);
  }
  return buildCurveFromFormula(props);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const projected = payload.find((p) => p.name === "projected")?.value;
  const target    = payload.find((p) => p.name === "target")?.value;
  if (projected === undefined) return null;

  const diff = projected - (target ?? 0);
  const sign = diff >= 0 ? "+" : "";

  return (
    <div className="rounded-xl bg-white border border-zinc-200 shadow-lg px-4 py-3 min-w-40">
      <p className="text-xs font-bold text-zinc-400 mb-1.5">Age {label}</p>
      <p className="text-sm font-black text-zinc-900">{fmt(projected)}</p>
      {target !== undefined && (
        <p className={`text-xs font-semibold mt-0.5 ${diff >= 0 ? "text-teal-dark" : "text-red-400"}`}>
          {sign}{fmt(Math.abs(diff))} vs goal
        </p>
      )}
    </div>
  );
}

export default function GrowthProjectionChart(props: Props) {
  const { currentBalance, targetBalance, currentAge, retirementAge } = props;
  const data = buildCurve(props);
  const finalPoint = data[data.length - 1];
  const surplus = finalPoint.projected - targetBalance;
  const onTrack = surplus >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary row */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-2xl font-black text-zinc-900">{fmt(finalPoint.projected)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Projected at retirement (age {retirementAge})</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs text-zinc-400">Today</p>
            <p className="text-sm font-bold text-zinc-700">{fmt(currentBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Target</p>
            <p className="text-sm font-bold text-zinc-700">{fmt(targetBalance)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">{onTrack ? "Surplus" : "Shortfall"}</p>
            <p className={`text-sm font-bold ${onTrack ? "text-teal-dark" : "text-red-400"}`}>
              {onTrack ? "+" : "-"}{fmt(Math.abs(surplus))}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={onTrack ? "#4bbdc8" : "#f87171"} stopOpacity={0.2} />
                <stop offset="95%" stopColor={onTrack ? "#4bbdc8" : "#f87171"} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(age) => `${age}`}
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

            {/* Target line */}
            <ReferenceLine
              y={targetBalance}
              stroke="#d4d4d8"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={<Label value={`Goal ${fmt(targetBalance)}`} position="right" fontSize={10} fill="#a1a1aa" />}
            />

            {/* Today vertical marker */}
            <ReferenceLine
              x={currentAge}
              stroke="#4bbdc8"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={<Label value="Today" position="top" fontSize={10} fill="#4bbdc8" />}
            />

            {/* Projection area */}
            <Area
              type="monotone"
              dataKey="projected"
              name="projected"
              stroke={onTrack ? "#4bbdc8" : "#f87171"}
              strokeWidth={2.5}
              fill="url(#projGradient)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0, fill: onTrack ? "#4bbdc8" : "#f87171" }}
            />

            {/* Target line (invisible area just for tooltip) */}
            <Area
              type="monotone"
              dataKey="target"
              name="target"
              stroke="transparent"
              fill="transparent"
              dot={false}
              activeDot={false}
            />

            {/* Current balance dot */}
            <ReferenceDot
              x={currentAge}
              y={currentBalance}
              r={5}
              fill="#4bbdc8"
              stroke="white"
              strokeWidth={2}
            />

            {/* Retirement endpoint dot */}
            <ReferenceDot
              x={retirementAge}
              y={finalPoint.projected}
              r={5}
              fill={onTrack ? "#4bbdc8" : "#f87171"}
              stroke="white"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-zinc-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className={`w-3 h-0.5 rounded ${onTrack ? "bg-teal" : "bg-red-400"}`} />
          Projected balance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-zinc-300" style={{ borderTop: "1.5px dashed #d4d4d8" }} />
          Retirement goal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal inline-block" />
          Today / retirement
        </span>
      </div>
    </div>
  );
}
