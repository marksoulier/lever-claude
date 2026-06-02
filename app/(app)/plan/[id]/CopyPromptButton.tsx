"use client";

import { useState } from "react";

export default function CopyPromptButton({ prompt, label = "Copy prompt" }: { prompt: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={`text-xs font-semibold transition-all ${
        copied
          ? "text-teal bg-teal/10 px-2 py-0.5 rounded-full"
          : "text-teal hover:text-teal-dark"
      }`}
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
