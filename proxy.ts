import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// In Next.js 16, this file (proxy.ts) is the middleware entry point —
// not middleware.ts. The export must be named `proxy`, not `middleware`.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

// Routes that require a logged-in user.
const PROTECTED_PREFIXES = ["/dashboard", "/plan/", "/account/", "/connect"];

// Routes an already-logged-in user should not see.
const AUTH_ONLY_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OPTIONS preflight — return immediately with CORS headers.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Build a mutable response. Supabase may replace it when writing
  // refreshed session cookies — that replacement is expected and correct.
  let response = NextResponse.next({ request });
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));

  // Create a Supabase client wired to request/response cookies.
  // This is the middleware-specific client — it reads from the incoming
  // request cookies and writes Set-Cookie headers onto the response.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          // Re-apply CORS after response is rebuilt.
          Object.entries(CORS_HEADERS).forEach(([k, v]) =>
            response.headers.set(k, v),
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session on every request. This is the only reason auth needs
  // middleware — without it the JWT expires after 1 hour and the user is
  // silently logged out. getUser() validates against the Supabase server
  // rather than trusting the local cookie value.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected pages.
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect already-authenticated users away from the login page.
  if (AUTH_ONLY_ROUTES.includes(pathname) && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
