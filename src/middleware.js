import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const ROLE_HOME = { admin: "/admin", hr: "/hr", employee: "/employee" };

const PUBLIC_PATHS = ["/login", "/change-password"];

/**
 * Fast-path context cookie: "role|must_change_password" cached for 30 min.
 * It is only a ROUTING hint — every API route re-verifies the real profile
 * from the database (getAuthContext), so a stale cookie can never grant data.
 */
const CTX_COOKIE = "hcm_ctx";
const CTX_MAX_AGE = 60 * 30;

function parseCtxCookie(value) {
  if (!value) return null;
  const [role, mcp] = value.split("|");
  if (!ROLE_HOME[role]) return null;
  return { role, mustChange: mcp === "1" };
}

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // the marketing landing page is always public
  if (pathname === "/") return response;

  // deployment not configured (e.g. missing env vars on Vercel): never crash —
  // send everything to /login, which shows a friendly configuration banner
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (PUBLIC_PATHS.some((p) => pathname === p)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // the old /setup wizard is gone — everything happens on /login now
  if (pathname === "/setup") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const isApiOrStatic = pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico";
  if (isApiOrStatic) return response;

  // ── session check: LOCAL read (no network round-trip) ────────────────
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    response.cookies.delete(CTX_COOKIE);
    if (PUBLIC_PATHS.some((p) => pathname === p)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── role from cached cookie → ZERO network on warm navigations ──────
  let ctx = parseCtxCookie(request.cookies.get(CTX_COOKIE)?.value);

  // cold path: one profile fetch, then cache for 30 min
  if (!ctx) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password, is_active")
      .eq("id", session.user.id)
      .single();

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut();
      response.cookies.delete(CTX_COOKIE);
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Account is deactivated");
      return NextResponse.redirect(url);
    }

    ctx = { role: profile.role, mustChange: profile.must_change_password };
    response.cookies.set(CTX_COOKIE, `${ctx.role}|${ctx.mustChange ? 1 : 0}`, {
      httpOnly: true,
      path: "/",
      maxAge: CTX_MAX_AGE,
      sameSite: "lax",
    });
  }

  const home = ROLE_HOME[ctx.role] ?? "/employee";

  // first-time password change gate
  if (ctx.mustChange && pathname !== "/change-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!ctx.mustChange && pathname === "/change-password") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // signed-in users skip login/setup
  if (pathname === "/login" || pathname === "/setup") {
    const url = request.nextUrl.clone();
    url.pathname = home;
    return NextResponse.redirect(url);
  }

  // role-scoped route areas
  if (pathname.startsWith("/admin") && ctx.role !== "admin") {
    return redirectHome(request, home);
  }
  if (pathname.startsWith("/hr") && !["hr", "admin"].includes(ctx.role)) {
    return redirectHome(request, home);
  }

  return response;
}

function redirectHome(request, home) {
  const url = request.nextUrl.clone();
  url.pathname = home;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
