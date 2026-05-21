"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_PROMPT = `I just connected Lever to this conversation. I'm setting up my financial plan for the first time.

Please start by calling get_onboarding_status to see where I am in setup, then guide me through the rest step by step. Ask me one thing at a time — don't overwhelm me with a long list of questions. Be conversational.

The goal is to set up my retirement plan with real numbers: my age, income, what I want in retirement, how I want to invest, and my current accounts.`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
        copied
          ? "bg-teal text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
      }`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-6 h-6 rounded-full bg-teal text-white text-xs font-black flex items-center justify-center shrink-0">
      {n}
    </div>
  );
}

export default function OnboardingGate() {
  const router = useRouter();
  const [mcpUrl, setMcpUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [checking, setChecking] = useState(false);
  const [tab, setTab] = useState<"web" | "desktop">("web");

  useEffect(() => {
    fetch("/api/mcp-url")
      .then((r) => r.json())
      .then((d) => setMcpUrl(d.mcpUrl ?? null))
      .catch(() => {})
      .finally(() => setLoadingUrl(false));
  }, []);

  const checkForPlan = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/plans");
      const plans = await res.json();
      if (Array.isArray(plans) && plans.length > 0) {
        router.refresh();
      } else {
        alert("No plan found yet — finish the conversation with Claude first, then click Check again.");
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  const mcpDisplayUrl = mcpUrl ?? (loadingUrl ? "Loading…" : "Could not load — refresh the page");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop — the app is behind this */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/60" />

      {/* Gate card */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden">

        {/* Header */}
        <div className="px-7 pt-7 pb-5 border-b border-zinc-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl font-black tracking-tight text-zinc-900 lowercase">lever</span>
            <span className="text-zinc-300">×</span>
            <span className="text-sm font-bold text-zinc-500">Claude</span>
          </div>
          <h1 className="text-xl font-black text-zinc-900">Set up your financial plan</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Lever works through Claude — connect once, then Claude walks you through everything.
          </p>
        </div>

        {/* Steps */}
        <div className="px-7 py-5 flex flex-col gap-5">

          {/* Step 1 — connect */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <StepNumber n={1} />
              <p className="text-sm font-bold text-zinc-800">Add the Lever connector to Claude</p>
            </div>

            {/* Web / Desktop tabs */}
            <div className="ml-8 flex flex-col gap-3">
              <div className="flex gap-2">
                {(["web", "desktop"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      tab === t
                        ? "bg-teal text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {t === "web" ? "Claude.ai (web)" : "Claude Desktop"}
                  </button>
                ))}
              </div>

              {tab === "web" && (
                <div className="flex flex-col gap-2 text-xs text-zinc-500">
                  <p>
                    In Claude.ai → <span className="font-bold text-zinc-700">Settings → Connectors → +</span>
                  </p>
                  <p>Paste this URL as the connector:</p>
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
                    <code className="flex-1 text-[11px] text-zinc-600 break-all">
                      {mcpDisplayUrl}
                    </code>
                    {mcpUrl && <CopyButton text={mcpUrl} label="Copy URL" />}
                  </div>
                  <p className="text-zinc-400">
                    Name it <span className="font-semibold text-zinc-600">"Lever"</span>. No auth fields needed.
                  </p>
                </div>
              )}

              {tab === "desktop" && (
                <div className="flex flex-col gap-2 text-xs text-zinc-500">
                  <p>Download your personalised extension file and double-click to install:</p>
                  <a
                    href="/api/mcp-extension"
                    download="lever.mcpb"
                    className="flex items-center justify-center gap-2 rounded-xl border border-teal-mid bg-teal-light px-4 py-2.5 text-sm font-bold text-teal-dark hover:bg-teal transition-colors hover:text-white"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8M5 7l3 3 3-3M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download lever.mcpb
                  </a>
                  <p className="text-zinc-400">Or paste the URL manually in Settings → Extensions → +</p>
                  <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
                    <code className="flex-1 text-[11px] text-zinc-600 break-all">{mcpDisplayUrl}</code>
                    {mcpUrl && <CopyButton text={mcpUrl} label="Copy URL" />}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-100" />

          {/* Step 2 — paste prompt */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <StepNumber n={2} />
              <p className="text-sm font-bold text-zinc-800">Start a new Claude conversation and paste this</p>
            </div>
            <div className="ml-8 flex items-start gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5">
              <p className="flex-1 text-xs text-zinc-500 italic leading-relaxed">
                &ldquo;I just connected Lever to this conversation. I&apos;m setting up my financial plan…&rdquo;
              </p>
              <CopyButton text={ONBOARDING_PROMPT} label="Copy prompt" />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-100" />

          {/* Step 3 — come back */}
          <div className="flex items-center gap-3">
            <StepNumber n={3} />
            <div className="flex-1">
              <p className="text-sm font-bold text-zinc-800">Come back here once Claude creates your plan</p>
              <p className="text-xs text-zinc-400 mt-0.5">Claude will guide you. When done, click below.</p>
            </div>
            <button
              onClick={checkForPlan}
              disabled={checking}
              className="shrink-0 rounded-full bg-teal px-5 py-2 text-sm font-bold text-white hover:bg-teal-dark transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {checking ? "Checking…" : "I'm done →"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-zinc-50 border-t border-zinc-100">
          <p className="text-xs text-zinc-400 text-center">
            Your MCP URL is unique to you — it connects your Claude account to your Lever data.
            {" "}Keep it private.
          </p>
        </div>
      </div>
    </div>
  );
}
