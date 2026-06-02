"use client";

import { useState, useEffect, useRef } from "react";
import { App } from "@modelcontextprotocol/ext-apps";

type Allocation = { label: string; pct: number; color: string };
type Plan = {
  id: string;
  name: string;
  targetYear: number;
  retirementAge: number;
  currentAge: number;
  monthlyContribution: number;
  currentBalance: number;
  projectedBalance: number;
  targetBalance: number;
  successProbability: number;
  assumedReturn: number;
  inflation: number;
  monthlyIncomeAtRetirement: number;
  allocation: Allocation[];
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function PlanWidget() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const appRef = useRef<App | null>(null);

  useEffect(() => {
    const mcpApp = new App({ name: "Lever Plan Dashboard", version: "1.0.0" });
    appRef.current = mcpApp;
    mcpApp.ontoolresult = (result) => {
      const text = result.content?.find((c) => c.type === "text")?.text;
      if (text) setPlan(JSON.parse(text));
    };
    mcpApp.connect().catch(() => {/* no MCP host — widget will wait for ontoolresult */});
  }, []);

  const openScenario = async () => {
    if (!plan || !appRef.current) return;
    try {
      await appRef.current.sendMessage({
        role: "user",
        content: [{ type: "text", text: `Open the what-if scenario modeler for my "${plan.name}" plan.` }],
      });
    } catch {
      // sendMessage requires an active Claude.ai host — not available in standalone preview
      console.warn("[plan-widget] sendMessage unavailable — widget requires a Claude.ai host");
    }
  };

  if (!plan) {
    return (
      <div style={s.loading}>
        <div style={s.spinner} />
        <p style={{ color: "#6b7280", fontSize: 13 }}>Loading plan…</p>
      </div>
    );
  }

  const surplus = plan.projectedBalance - plan.targetBalance;
  const onTrack = Math.min(100, Math.round((plan.projectedBalance / plan.targetBalance) * 100));
  const probColor =
    plan.successProbability >= 80
      ? { bg: "#d1fae5", text: "#065f46" }
      : plan.successProbability >= 60
        ? { bg: "#fef3c7", text: "#92400e" }
        : { bg: "#fee2e2", text: "#991b1b" };

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.badge}>Lever</div>
          <h1 style={s.title}>{plan.name}</h1>
          <p style={s.subtitle}>
            Target {plan.targetYear} · {plan.assumedReturn}% return · {plan.inflation}% inflation
          </p>
        </div>
        <div style={{ ...s.probChip, background: probColor.bg, color: probColor.text }}>
          {plan.successProbability}% success
        </div>
      </div>

      <div style={s.grid2}>
        {[
          { label: "Current Balance", value: fmt(plan.currentBalance) },
          { label: "Projected Balance", value: fmt(plan.projectedBalance) },
          {
            label: "vs. Target",
            value: fmt(plan.targetBalance),
            delta: `${surplus >= 0 ? "+" : ""}${fmt(surplus)}`,
            positive: surplus >= 0,
          },
          { label: "Monthly Income", value: `$${plan.monthlyIncomeAtRetirement.toLocaleString()}` },
        ].map((m) => (
          <div key={m.label} style={s.card}>
            <span style={s.cardLabel}>{m.label}</span>
            <span style={s.cardValue}>{m.value}</span>
            {m.delta && (
              <span style={{ fontSize: 12, fontWeight: 600, color: m.positive ? "#059669" : "#dc2626" }}>
                {m.delta}
              </span>
            )}
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={s.sectionLabel}>Goal progress</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{onTrack}%</span>
        </div>
        <div style={s.track}>
          <div
            style={{
              ...s.fill,
              width: `${onTrack}%`,
              background: onTrack >= 80 ? "#4bc3c8" : onTrack >= 60 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
      </div>

      <div>
        <p style={s.sectionLabel}>Asset Allocation</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {plan.allocation.map((a) => (
            <div key={a.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>{a.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{a.pct}%</span>
              </div>
              <div style={s.track}>
                <div style={{ ...s.fill, width: `${a.pct}%`, background: a.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.footer}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Monthly contribution</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
            ${plan.monthlyContribution.toLocaleString()}
          </span>
        </div>
        <button style={s.cta} onClick={openScenario}>
          Run what-if →
        </button>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { padding: 20, maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, fontFamily: "system-ui, sans-serif" },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 220, gap: 12, fontFamily: "system-ui, sans-serif" },
  spinner: { width: 22, height: 22, border: "2px solid #e5e7eb", borderTopColor: "#4bc3c8", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  badge: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4bc3c8", textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.3, margin: 0 },
  subtitle: { fontSize: 12, color: "#9ca3af", marginTop: 3, marginBottom: 0 },
  probChip: { padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, flexShrink: 0, marginTop: 2 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  card: { background: "#f9fafb", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 },
  cardLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" },
  cardValue: { fontSize: 20, fontWeight: 700, color: "#111827" },
  sectionLabel: { fontSize: 13, fontWeight: 600, color: "#374151" },
  track: { height: 5, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, transition: "width 0.4s ease" },
  footer: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid #f3f4f6" },
  cta: { background: "#4bc3c8", color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
};
