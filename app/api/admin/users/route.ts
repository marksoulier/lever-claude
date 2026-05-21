import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin-auth";
import { planFromRow, type DbPlanRow } from "@/lib/supabase/mappers";

export interface AdminUserSummary {
  id: string;
  email: string;
  lastSignInAt: string | null;
  createdAt: string;
  planCount: number;
  accountCount: number;
  documentCount: number;
  draftNotificationCount: number;
  primaryPlan: {
    name: string;
    projectedBalance: number;
    successProbability: number;
    retirementAge: number;
    monthlyContribution: number;
    hasContext: boolean;
  } | null;
  subscription: { status: string } | null;
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // GoTrue's auth.admin.listUsers() has a DB error on this project.
  // Use a security-definer SQL function instead — same data, no GoTrue.
  const { data: users, error: usersError } = await admin.rpc("admin_list_users");
  if (usersError) return Response.json({ error: usersError.message }, { status: 500 });

  const [plansRes, accountsRes, docsRes, subsRes, notifsRes] = await Promise.all([
    admin.from("plans").select("user_id, id, name, is_primary, projected_balance, success_probability, retirement_age, monthly_contribution, context, current_age, target_year, current_balance, target_balance, assumed_return, inflation, allocation, monthly_income_at_retirement, created_at"),
    admin.from("accounts").select("user_id, id"),
    admin.from("documents").select("user_id, id"),
    admin.from("subscriptions").select("user_id, status"),
    admin.from("notifications").select("user_id, id, status"),
  ]);

  const plans = (plansRes.data ?? []) as DbPlanRow[];
  const accounts = accountsRes.data ?? [];
  const docs = docsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const notifs = notifsRes.data ?? [];

  type RpcUser = { id: string; email: string; last_sign_in_at: string | null; created_at: string };
  const result: AdminUserSummary[] = (users as RpcUser[]).map((u) => {
    const userPlans = plans.filter((p) => p.user_id === u.id).map(planFromRow);
    const primaryPlan = userPlans.find((p) => p.isPrimary) ?? null;
    const sub = subs.find((s: { user_id: string }) => s.user_id === u.id) ?? null;

    return {
      id: u.id,
      email: u.email ?? "",
      lastSignInAt: u.last_sign_in_at ?? null,
      createdAt: u.created_at,
      planCount: userPlans.length,
      accountCount: accounts.filter((a: { user_id: string }) => a.user_id === u.id).length,
      documentCount: docs.filter((d: { user_id: string }) => d.user_id === u.id).length,
      draftNotificationCount: notifs.filter((n: { user_id: string; status: string }) => n.user_id === u.id && n.status === "draft").length,
      primaryPlan: primaryPlan ? {
        name: primaryPlan.name,
        projectedBalance: primaryPlan.projectedBalance,
        successProbability: primaryPlan.successProbability,
        retirementAge: primaryPlan.retirementAge,
        monthlyContribution: primaryPlan.monthlyContribution,
        hasContext: primaryPlan.context !== null,
      } : null,
      subscription: sub ? { status: (sub as { user_id: string; status: string }).status } : null,
    };
  });

  // Sort: premium first, then by last active
  result.sort((a, b) => {
    if (a.subscription && !b.subscription) return -1;
    if (!a.subscription && b.subscription) return 1;
    return (b.lastSignInAt ?? "").localeCompare(a.lastSignInAt ?? "");
  });

  return Response.json(result);
}
