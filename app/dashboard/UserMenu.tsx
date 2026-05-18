"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

function initials(user: User): string {
  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "?";
  return name
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function displayName(user: User): string {
  const full =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "";
  return full.split(/\s+/)[0] || "there";
}

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) return null;

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={initials(user)}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-teal flex items-center justify-center">
            <span className="text-xs font-bold text-white">{initials(user)}</span>
          </div>
        )}
        <span className="text-sm text-zinc-500 hidden sm:block">
          {user.email}
        </span>
      </div>
      <button
        onClick={signOut}
        disabled={signingOut}
        className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
