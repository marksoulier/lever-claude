"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PlanSettingsMenu({
  planId,
  isPrimary,
}: {
  planId: string;
  isPrimary: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function setAsPrimary() {
    setLoading(true);
    setOpen(false);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
      window.dispatchEvent(new CustomEvent("plans-updated"));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-50"
        aria-label="Plan settings"
      >
        {loading ? (
          <svg className="animate-spin" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
            <circle cx="7.5" cy="2.5" r="1.25"/><circle cx="7.5" cy="7.5" r="1.25"/><circle cx="7.5" cy="12.5" r="1.25"/>
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-48 rounded-xl bg-white border border-zinc-200 shadow-xl overflow-hidden">
          {!isPrimary && (
            <button
              onClick={setAsPrimary}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal" />
              Set as primary plan
            </button>
          )}
          {isPrimary && (
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-teal" />
              Already primary plan
            </div>
          )}
        </div>
      )}
    </div>
  );
}
