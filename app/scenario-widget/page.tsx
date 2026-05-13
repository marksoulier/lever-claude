"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { App } from "@modelcontextprotocol/ext-apps";

type Plan = {
  id: string;
  name: string;
  retirementAge: number;
  currentAge: number;
  monthlyContribution: number;
  currentBalance: number;
  projectedBalance: number;
  targetBalance: number;
  assumedReturn: number;
};

function project(balance: number, monthly: number, annualReturn: number, years: number): number {
  const r = annualReturn / 100 / 12;
  const n = years * 12;
  return Math.round(balance * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r));
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#d1d5db" }}>
          {min >= 1000 ? `$${min.toLocaleString()}` : min}
        </span>
        <span style={{ fontSize: 11, color: "#d1d5db" }}>
          {max >= 1000 ? `$${max.toLocaleString()}` : max}
        </span>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  valueColor,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <div style={s.card}>
      <span style={s.cardLabel}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "#111827" }}>{value}</span>
      <span style={{ fontSize: 11, color: subColor ?? "#9ca3af" }}>{sub}</span>
    </div>
  );
}

export default function ScenarioWidget() {
  const [base, setBase] = useState<Plan | null>(null);
  const [retireAge, setRetireAge] = useState(65);
  const [monthly, setMonthly] = useState(3200);
  const [returnRate, setReturnRate] = useState(7);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const appRef = useRef<App | null>(null);

  useEffect(() => {
    const mcpApp = new App({ name: "Lever Scenario Modeler", version: "1.0.0" });
    appRef.current = mcpApp;
    mcpApp.connect();
    mcpApp.ontoolresult = (result) => {
      const text = result.content?.find((c) => c.type === "text")?.text;
      if (!text) return;
      const plan: Plan = JSON.parse(text);
      setBase(plan);
      setRetireAge(plan.retirementAge);
      setMonthly(plan.monthlyContribution);
      setReturnRate(plan.assumedReturn);
    };
  }, []);

  const projected = useCallback((): number => {
    if (!base) return 0;
    const years = retireAge - base.currentAge;
    return project(base.currentBalance, monthly, returnRate, Math.max(1, years));
  }, [base, retireAge, monthly, returnRate]);

  const handleApply = async () => {
    if (!base || !appRef.current || status === "saving") return;
    setStatus("saving");
    await appRef.current.callServerTool({
      name: "update_contribution",
      arguments: { plan_id: base.id, new_amount: monthly },
    });
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 3000);
  };

  if (!base) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
        Loading plan…
      </div>
    );
  }

  const bal = projected();
  const delta = bal - base.projectedBalance;
  const income = Math.round((bal * 0.04) / 12);
  const prob = Math.min(99, Math.max(10, Math.round(50 + (bal / base.targetBalance) * 40)));
  const years = retireAge - base.currentAge;
  const probColor = prob >= 80 ? "#059669" : prob >= 60 ? "#d97706" : "#dc2626";

  return (
    <div style={s.root}>
      <div>
        <div style={s.badge}>Lever · What-If</div>
        <h1 style={s.title}>Scenario Modeler</h1>
        <p style={s.subtitle}>Adjust the sliders to explore retirement outcomes</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SliderRow
          label="Retirement Age"
          value={retireAge}
          min={52}
          max={72}
          step={1}
          display={`${retireAge}`}
          onChange={setRetireAge}
        />
        <SliderRow
          label="Monthly Savings"
          value={monthly}
          min={500}
          max={10000}
          step={100}
          display={`$${monthly.toLocaleString()}`}
          onChange={setMonthly}
        />
        <SliderRow
          label="Expected Annual Return"
          value={returnRate}
          min={3}
          max={12}
          step={0.5}
          display={`${returnRate}%`}
          onChange={setReturnRate}
        />
      </div>

      <div style={s.results}>
        <p style={s.resultsTitle}>Projected Outcome</p>
        <div style={s.grid}>
          <ResultCard
            label="Balance at Retirement"
            value={bal >= 1_000_000 ? `$${(bal / 1_000_000).toFixed(2)}M` : `$${(bal / 1000).toFixed(0)}K`}
            sub={`${delta >= 0 ? "+" : ""}$${(Math.abs(delta) / 1000).toFixed(0)}K vs. base`}
            subColor={delta >= 0 ? "#059669" : "#dc2626"}
          />
          <ResultCard label="Monthly Income" value={`$${income.toLocaleString()}`} sub="4% withdrawal rule" />
          <ResultCard label="Success Probability" value={`${prob}%`} valueColor={probColor} sub="Monte Carlo est." />
          <ResultCard label="Years to Retire" value={`${years}`} sub={`At age ${retireAge}`} />
        </div>
      </div>

      <button
        style={{
          ...s.applyBtn,
          background: status === "saved" ? "#059669" : "#4bc3c8",
          opacity: status === "saving" ? 0.7 : 1,
          cursor: status === "saving" ? "wait" : "pointer",
        }}
        onClick={handleApply}
        disabled={status === "saving"}
      >
        {status === "saved"
          ? "✓ Applied to plan"
          : status === "saving"
            ? "Applying…"
            : "Apply savings rate to plan"}
      </button>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { padding: 20, maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "system-ui, sans-serif" },
  badge: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4bc3c8", textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.3, margin: 0 },
  subtitle: { fontSize: 12, color: "#9ca3af", marginTop: 3, marginBottom: 0 },
  results: { background: "#f9fafb", borderRadius: 14, padding: 16 },
  resultsTitle: { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  card: { background: "#fff", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2, border: "1px solid #f3f4f6" },
  cardLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" },
  applyBtn: { color: "#fff", border: "none", borderRadius: 999, padding: "11px 0", fontSize: 13, fontWeight: 600, width: "100%", transition: "background 0.2s" },
};
