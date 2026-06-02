"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Plan } from "@/lib/store";
import { ADMIN_EMAILS } from "@/lib/admin-auth";
import UserModal from "./UserModal";

type SidebarPlan = Pick<Plan, "id" | "name"> & { isPrimary: boolean };

function ChartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 12L6 7L9 10L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HomeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 7l6-5 6 5v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M6 14v-4h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function DocumentIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function FeedbackIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 2V3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}

function AdminIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={collapsed ? "M6 4l4 4-4 4" : "M10 4L6 8l4 4"}
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [plans, setPlans] = useState<SidebarPlan[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/plans");
      if (!res.ok) return;
      const data: (Plan & { isPrimary?: boolean })[] = await res.json();
      setPlans(
        data.map((p) => ({ id: p.id, name: p.name, isPrimary: p.isPrimary ?? false }))
      );
    } catch {
      // sidebar silently degrades
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans, pathname]);

  useEffect(() => {
    window.addEventListener("plans-updated", loadPlans);
    return () => window.removeEventListener("plans-updated", loadPlans);
  }, [loadPlans]);

  useEffect(() => {
    import("@/lib/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUserIsAdmin(ADMIN_EMAILS.includes(user?.email ?? ""));
      });
    });
  }, []);

  const primaryPlan = plans.find((p) => p.isPrimary);
  const whatIfs = plans.filter((p) => !p.isPrimary);

  function isActive(planId: string) {
    return pathname === `/plan/${planId}`;
  }

  return (
    <>
      <aside
        className={`flex flex-col h-full bg-zinc-50 border-r border-zinc-200 transition-all duration-200 shrink-0 ${
          collapsed ? "w-14" : "w-56"
        }`}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-200">
          {!collapsed && (
            <Link href="/dashboard" className="text-lg font-black tracking-tight text-zinc-900 lowercase pl-1">
              lever
            </Link>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors ${
              collapsed ? "mx-auto" : ""
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>

        {/* Scrollable plan list */}
        <nav className="flex-1 overflow-y-auto py-3 flex flex-col gap-1 px-2">
          {/* Home */}
          <Link
            href="/dashboard"
            title={collapsed ? "Home" : undefined}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors mb-1 ${
              pathname === "/dashboard"
                ? "bg-teal-light text-teal-dark font-semibold"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <HomeIcon />
            {!collapsed && <span>Home</span>}
          </Link>

          {/* Primary plan section */}
          {(primaryPlan || !collapsed) && (
            <div className="mb-1">
              {!collapsed && (
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-1">
                  Primary plan
                </p>
              )}
              {primaryPlan ? (
                <SidebarItem
                  plan={primaryPlan}
                  active={isActive(primaryPlan.id)}
                  collapsed={collapsed}
                />
              ) : (
                !collapsed && (
                  <p className="text-xs text-zinc-400 px-2 py-1 italic">No primary plan set</p>
                )
              )}
            </div>
          )}

          {/* What-if scenarios */}
          {(whatIfs.length > 0 || !collapsed) && (
            <div>
              {!collapsed && (
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-2 mb-1 mt-2">
                  What-if scenarios
                </p>
              )}
              {whatIfs.length === 0 && !collapsed ? (
                <p className="text-xs text-zinc-400 px-2 py-1 italic">No scenarios yet</p>
              ) : (
                whatIfs.map((plan) => (
                  <SidebarItem
                    key={plan.id}
                    plan={plan}
                    active={isActive(plan.id)}
                    collapsed={collapsed}
                  />
                ))
              )}
            </div>
          )}
        </nav>

        {/* Admin — only shown to admin accounts */}
        {userIsAdmin && (
          <div className="px-2 py-2 border-t border-zinc-200 mt-auto">
            <Link
              href="/admin"
              title={collapsed ? "Admin" : undefined}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-amber-50 text-amber-600 font-semibold"
                  : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <AdminIcon />
              {!collapsed && <span>Admin</span>}
            </Link>
          </div>
        )}

        {/* Documents */}
        <div className={`px-2 py-2 border-t border-zinc-200 ${!userIsAdmin ? "mt-auto" : ""}`}>
          <Link
            href="/documents"
            title={collapsed ? "Documents" : undefined}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
              pathname.startsWith("/documents")
                ? "bg-teal-light text-teal-dark font-semibold"
                : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <DocumentIcon />
            {!collapsed && <span>Documents</span>}
          </Link>
        </div>

        {/* New plan button */}
        <div className="px-2 py-2 border-t border-zinc-200">
          {collapsed ? (
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-10 h-10 mx-auto rounded-lg text-zinc-400 hover:text-teal hover:bg-zinc-200 transition-colors"
              title="New plan"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              New plan
            </Link>
          )}
        </div>

        {/* Feedback */}
        <div className="px-2 py-2 border-t border-zinc-200">
          <a
            href="https://lever.userjot.com/b/features"
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? "Give feedback (free account required)" : undefined}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <FeedbackIcon />
            {!collapsed && (
              <span className="flex flex-col leading-tight">
                <span>Give feedback</span>
                <span className="text-[10px] text-zinc-400">free account required</span>
              </span>
            )}
          </a>
        </div>

        {/* User button */}
        <div className="px-2 py-3 border-t border-zinc-200">
          <button
            onClick={() => setModalOpen(true)}
            className={`flex items-center gap-2.5 w-full rounded-lg px-2 py-1.5 hover:bg-zinc-200 transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <UserAvatar />
            {!collapsed && <UserName />}
          </button>
        </div>
      </aside>

      <UserModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

function SidebarItem({
  plan,
  active,
  collapsed,
}: {
  plan: SidebarPlan;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={`/plan/${plan.id}`}
      title={collapsed ? plan.name : undefined}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
        active
          ? "bg-teal-light text-teal-dark font-semibold"
          : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <span className="relative shrink-0 text-zinc-400">
        <ChartIcon size={15} />
        <span
          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
            plan.isPrimary ? "bg-teal" : "bg-zinc-400"
          }`}
        />
      </span>
      {!collapsed && (
        <span className="truncate">{plan.name}</span>
      )}
    </Link>
  );
}

function UserAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initials, setInitials] = useState("?");

  useEffect(() => {
    import("@/lib/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        const url = user.user_metadata?.avatar_url as string | undefined;
        if (url) setAvatarUrl(url);
        const name: string =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email ??
          "?";
        setInitials(
          name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
        );
      });
    });
  }, []);

  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={initials} className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-7 h-7 rounded-full bg-teal flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-white">{initials}</span>
    </div>
  );
}

function UserName() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    import("@/lib/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        const full: string =
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email ??
          "";
        setName(full.split(/\s+/)[0] || full || "Account");
      });
    });
  }, []);

  return (
    <span className="text-sm text-zinc-700 font-medium truncate">{name ?? "…"}</span>
  );
}
