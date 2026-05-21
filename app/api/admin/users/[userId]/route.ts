import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";
import { accountFromRow, type DbAccountRow } from "@/lib/accounts";

export interface AdminUserDetail {
  id: string;
  email: string;
  lastSignInAt: string | null;
  createdAt: string;
  subscription: { status: string; currentPeriodEnd: string | null } | null;
  plans: ReturnType<typeof planFromRow>[];
  accounts: ReturnType<typeof accountFromRow>[];
  documents: {
    id: string;
    name: string;
    fileType: string;
    summary: string | null;
    createdAt: string;
  }[];
  notifications: {
    id: string;
    message: string;
    status: string;
    createdAt: string;
    approvedAt: string | null;
    sentAt: string | null;
  }[];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const admin = createAdminClient();

  type AuthUser = { id: string; email: string; last_sign_in_at: string | null; created_at: string };
  const [authUserRes, plansRes, accountsRes, docsRes, subsRes, notifsRes] = await Promise.all([
    admin.rpc("admin_list_users").then(({ data }) =>
      ((data ?? []) as AuthUser[]).find((u) => u.id === userId) ?? null
    ),
    admin.from("plans").select("*").eq("user_id", userId).order("created_at"),
    admin.from("accounts").select("*").eq("user_id", userId).order("created_at"),
    admin.from("documents").select("id, name, file_type, summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("subscriptions").select("status, current_period_end").eq("user_id", userId).maybeSingle(),
    admin.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  const u = authUserRes;
  if (!u) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  const sub = subsRes.data as { status: string; current_period_end: string | null } | null;

  const detail: AdminUserDetail = {
    id: u.id,
    email: u.email ?? "",
    lastSignInAt: u.last_sign_in_at ?? null,
    createdAt: u.created_at,
    subscription: sub ? { status: sub.status, currentPeriodEnd: sub.current_period_end } : null,
    plans: ((plansRes.data ?? []) as DbPlanRow[]).map(planFromRow),
    accounts: ((accountsRes.data ?? []) as DbAccountRow[]).map(accountFromRow),
    documents: (docsRes.data ?? []).map((d: { id: string; name: string; file_type: string; summary: string | null; created_at: string }) => ({
      id: d.id,
      name: d.name,
      fileType: d.file_type,
      summary: d.summary,
      createdAt: d.created_at,
    })),
    notifications: (notifsRes.data ?? []).map((n: { id: string; message: string; status: string; created_at: string; approved_at: string | null; sent_at: string | null }) => ({
      id: n.id,
      message: n.message,
      status: n.status,
      createdAt: n.created_at,
      approvedAt: n.approved_at,
      sentAt: n.sent_at,
    })),
  };

  return Response.json(detail);
}
