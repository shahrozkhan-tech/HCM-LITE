import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const ROLE_HOME = { admin: "/admin", hr: "/hr", employee: "/employee" };

const PUBLIC_PATHS = ["/login", "/setup", "/change-password"];

export async function middleware(request) {
  let response = NextResponse.next({ request });

  // the marketing landing page is always public
  if (request.nextUrl.pathname === "/") return response;

  // deployment not configured (e.g. missing env vars on Vercel): never crash —
  // send everything to /login, which shows a friendly configuration banner
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (PUBLIC_PATHS.some((p) => request.nextUrl.pathname === p)) return response;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isApiOrStatic = pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico";

  if (isApiOrStatic) return response;

  // ── not signed in ────────────────────────────────────────────────────
  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ── signed in: load own profile (RLS allows reading your own row) ────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, must_change_password, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "Account is deactivated");
    return NextResponse.redirect(url);
  }

  const home = ROLE_HOME[profile.role] ?? "/employee";

  // first-time password change gate
  if (profile.must_change_password && pathname !== "/change-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!profile.must_change_password && pathname === "/change-password") {
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
  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    return redirectHome(request, home);
  }
  if (pathname.startsWith("/hr") && !["hr", "admin"].includes(profile.role)) {
    return redirectHome(request, home);
  }
  if (pathname.startsWith("/employee") && !["employee", "hr", "admin"].includes(profile.role)) {
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
