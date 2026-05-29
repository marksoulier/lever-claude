"use client";

// Cash flow widget — modular visualization for net worth growth by year.
// Loaded as an MCP App iframe when Claude calls show_cash_flow.
// Receives plan data via App.ontoolresult from the MCP host.

import { useState, useEffect, useRef } from "react";
import { App } from "@modelcontextprotocol/ext-apps";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";

type YearlyPoint = {
  year: number;
  age: number;
  netWorth: number;
  annualGrowth: number; // net worth change from prior year
  cashBalance: number;
  retirementBalance: number;
  investmentBalance: number;
};

type CashFlowData = {
  planName: string;
  currentAge: number;
  retirementAge: number;
  birthDate: string;
  points: YearlyPoint[];
};

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as YearlyPoint;
  if (!d) return null;
  return (
    <div className="rounded-xl bg-white border border-zinc-200 shadow-lg px-4 py-3 min-w-44">
      <p className="text-xs font-bold text-zinc-400 mb-2">Age {d.age} · {label}</p>
      <p className="text-sm font-black text-zinc-900">Net worth: {fmt(d.netWorth)}</p>
      <p className={`text-xs font-semibold mt-1 ${d.annualGrowth >= 0 ? "text-teal-600" : "text-red-400"}`}>
        Annual change: {d.annualGrowth >= 0 ? "+" : ""}{fmt(d.annualGrowth)}
      </p>
      {d.retirementBalance > 0 && (
        <p className="text-xs text-zinc-400 mt-1">Retirement: {fmt(d.retirementBalance)}</p>
      )}
      {d.cashBalance !== 0 && (
        <p className="text-xs text-zinc-400">Cash: {fmt(d.cashBalance)}</p>
      )}
    </div>
  );
}

function CashFlowChart({ data }: { data: CashFlowData }) {
  const { points, planName, currentAge, retirementAge } = data;
  const maxGrowth = Math.max(...points.map((p) => Math.abs(p.annualGrowth)));

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-black text-zinc-900">{planName}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Annual net worth growth · age {currentAge} to {retirementAge}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400">At retirement</p>
          <p className="text-base font-black text-zinc-900">
            {fmt(points[points.length - 1]?.netWorth ?? 0)}
          </p>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 10, fill: "#a1a1aa" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#e4e4e7" strokeWidth={1} />
            <Bar dataKey="annualGrowth" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {points.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.annualGrowth >= 0 ? "#4bbdc8" : "#f87171"}
                  opacity={entry.age === retirementAge ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Account breakdown legend */}
      {points.some((p) => p.retirementBalance > 0) && (
        <div className="border-t border-zinc-100 pt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Cash</p>
            <p className="text-sm font-bold text-zinc-700">{fmt(points[points.length - 1]?.cashBalance ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Retirement</p>
            <p className="text-sm font-bold text-teal-600">{fmt(points[points.length - 1]?.retirementBalance ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Investments</p>
            <p className="text-sm font-bold text-zinc-700">{fmt(points[points.length - 1]?.investmentBalance ?? 0)}</p>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-300 text-center">
        Each bar is the annual change in net worth. Teal = growth, red = decline.
      </p>
    </div>
  );
}

export default function CashFlowWidget() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const appRef = useRef<App | null>(null);

  useEffect(() => {
    const mcpApp = new App({ name: "Lever Cash Flow", version: "1.0.0" });
    appRef.current = mcpApp;

    mcpApp.ontoolresult = (result) => {
      try {
        const block = result.content?.find((c: any) => c.type === "text");
        const text = block && "text" in (block as any) ? (block as any).text as string : undefined;
        if (text) setData(JSON.parse(text));
      } catch {
        setError("Could not parse cash flow data.");
      }
    };

    return () => { appRef.current = null; };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-3 rounded-sm bg-zinc-200 animate-pulse"
              style={{ height: `${20 + i * 8}px`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-400">Loading cash flow data…</p>
      </div>
    );
  }

  return (
    <div className="font-sans bg-white min-h-screen">
      <CashFlowChart data={data} />
    </div>
  );
}
