import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { baseURL } from "@/baseUrl";

// Serves a personalised .mcpb file for Claude Desktop one-click MCP install.
// Claude Desktop reads this JSON and registers the server automatically.
// The file contains the user's token in the URL so it's user-specific.
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  // Upsert ensures a profile row exists for new users (trigger was removed).
  await admin.from("profiles").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
  const { data: profile } = await admin
    .from("profiles")
    .select("api_token")
    .eq("id", user.id)
    .single();

  if (!profile?.api_token) {
    return new Response("No API token found", { status: 404 });
  }

  const mcpExtension = {
    name: "Lever Financial Planning",
    description: "AI-powered retirement planning — create plans, run what-if scenarios, track net worth.",
    type: "http",
    url: `${baseURL}/api/mcp?token=${profile.api_token}`,
  };

  return new Response(JSON.stringify(mcpExtension, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="lever.mcpb"',
    },
  });
}
