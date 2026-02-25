import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RBAC_ROUTES: Record<string, string[]> = {
  "/dashboard/finance": ["owner", "admin", "manager", "office_admin"],
  "/dashboard/team": ["owner", "admin", "manager"],
  "/dashboard/settings": ["owner", "admin"],
  "/dashboard/integrations": ["owner", "admin", "manager"],
  "/dashboard/billing": ["owner"],
};

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseKey) return supabaseResponse;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow public routes (auth, invite acceptance, landing)
  const publicPaths = ["/auth", "/accept-invite", "/invite", "/api"];
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname === "/") {
    if (pathname === "/auth" && user) {
      const next = request.nextUrl.searchParams.get("next");
      const url = request.nextUrl.clone();
      url.pathname = next || "/dashboard";
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Protected routes: redirect to /auth if not signed in
  const protectedPaths = ["/dashboard", "/setup", "/settings"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Onboarding gate: redirect to /setup if no org membership
  if (user && pathname.startsWith("/dashboard")) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      return NextResponse.redirect(url);
    }

    // RBAC enforcement at the Edge
    const role = membership.role as string;
    for (const [routePrefix, allowedRoles] of Object.entries(RBAC_ROUTES)) {
      if (pathname.startsWith(routePrefix) && !allowedRoles.includes(role)) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
