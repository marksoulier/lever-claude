import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) redirect("/dashboard");
  return <>{children}</>;
}
