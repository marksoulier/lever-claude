"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

type SubscriptionStatus = "free" | "premium" | "loading";

function useSubscription(): SubscriptionStatus {
  const [status, setStatus] = useState<SubscriptionStatus>("loading");
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setStatus("free"); return; }
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      setStatus(data?.status === "active" ? "premium" : "free");
    });
  }, []);
  return status;
}

export default function UserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const subscriptionStatus = useSubscription();

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!open) return null;

  const displayName: string =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email ??
    "";

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <>
      {/* Transparent click-outside trap */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Modal — anchored above the user button at bottom of sidebar */}
      <div className="fixed bottom-[68px] left-2 z-50 w-72 rounded-2xl bg-white border border-zinc-200 shadow-xl overflow-hidden">
        {/* Profile header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={initials} className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-teal flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">{initials}</span>
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-zinc-900 truncate">{displayName || "—"}</span>
            <span className="text-xs text-zinc-400 truncate">{user?.email}</span>
          </div>
        </div>

        {/* Subscription */}
        <div className="px-5 py-3 border-b border-zinc-100">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Subscription</p>
          {subscriptionStatus === "loading" ? (
            <div className="h-4 w-24 rounded bg-zinc-100" />
          ) : subscriptionStatus === "premium" ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-light px-3 py-1 text-xs font-bold text-teal-dark">
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                Premium
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500">
                Free plan
              </span>
              <button
                disabled={upgrading}
                onClick={async () => {
                  setUpgrading(true);
                  try {
                    const res = await fetch("/api/stripe/checkout", { method: "POST" });
                    const { url } = await res.json();
                    window.location.href = url;
                  } catch {
                    setUpgrading(false);
                  }
                }}
                className="text-xs font-semibold text-teal hover:text-teal-dark transition-colors disabled:opacity-50"
              >
                {upgrading ? "Redirecting…" : "Upgrade →"}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-3 flex flex-col gap-1">
          <button
            onClick={signOut}
            disabled={signingOut}
            className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50 text-left"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </>
  );
}
