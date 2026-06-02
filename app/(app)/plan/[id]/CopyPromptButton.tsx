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
      className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors"
    >
      {copied ? "✓ Copied!" : label}
    </button>
  );
}
