import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { baseURL } from "@/baseUrl";

// Returns the user's personalised MCP connector URL (includes their API token).
// The token is already stored in the profiles table — created when the user
// signed up. This route just fetches it so the client can display it.
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // Upsert ensures a profile row exists for new users (trigger was removed).
  // ignoreDuplicates means existing rows are untouched.
  const { error: upsertError } = await admin
    .from("profiles")
    .upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
  if (upsertError) {
    console.error("[mcp-url] profile upsert failed:", upsertError.message);
    return Response.json({ error: "Failed to create profile", detail: upsertError.message }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("api_token")
    .eq("id", user.id)
    .single();

  if (!profile?.api_token) {
    return Response.json({ error: "No API token found" }, { status: 404 });
  }

  const mcpUrl = `${baseURL}/api/mcp?token=${profile.api_token}`;
  return Response.json({ mcpUrl, token: profile.api_token });
}
