import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  // If Supabase isn't configured, pass through without auth checks
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

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

  // Refresh the session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow public routes (auth, invite acceptance, landing, api)
  const publicPaths = ["/auth", "/accept-invite", "/join", "/invite", "/api"];
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

  // If signed in and visiting /dashboard, check if user has an org
  // Redirect to /setup if they haven't completed onboarding (no org membership)
  if (user && pathname.startsWith("/dashboard")) {
    const { data: membership } = await (supabase as any)
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
    const RBAC_ROUTES: Record<string, string[]> = {
      "/dashboard/finance": ["owner", "admin", "manager", "office_admin"],
      "/dashboard/team": ["owner", "admin", "manager"],
      "/dashboard/settings": ["owner", "admin"],
      "/dashboard/integrations": ["owner", "admin", "manager"],
      "/dashboard/billing": ["owner"],
    };
    const role = (membership as { role?: string }).role as string | undefined;
    if (role) {
      for (const [routePrefix, allowedRoles] of Object.entries(RBAC_ROUTES)) {
        if (pathname.startsWith(routePrefix) && !allowedRoles.includes(role)) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
