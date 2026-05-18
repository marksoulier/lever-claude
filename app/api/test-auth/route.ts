import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Dev-only server-side sign-in for agents and playwright tests.
// Bypasses browser CORS by doing the auth exchange on the server.
// Returns a redirect to /dashboard with auth cookies set.
//
// Usage:
//   GET /api/test-auth?email=demo@lever.dev&password=demo1234
//
// Never available in production — returns 404 outside of development.
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const email = searchParams.get("email") ?? "";
  const password = searchParams.get("password") ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password query params required" },
      { status: 400 },
    );
  }

  // Build the redirect response first so Supabase can attach cookies to it.
  const response = NextResponse.redirect(`${origin}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        // Write session cookies directly onto the redirect response.
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return response;
}
