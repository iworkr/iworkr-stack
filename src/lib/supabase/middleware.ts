import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════
// ── Project Aegis — Edge RBAC Middleware ──────────────────────
// Uses JWT app_metadata for fast role checks (no DB round-trip).
// Falls back to DB query when app_metadata isn't populated yet.
// ═══════════════════════════════════════════════════════════════

/** Route prefix → roles allowed to access it */
const RBAC_ROUTES: Record<string, string[]> = {
  "/dashboard/finance": ["owner", "admin", "manager", "office_admin"],
  "/dashboard/team": ["owner", "admin", "manager"],
  "/dashboard/settings": ["owner", "admin"],
  "/dashboard/integrations": ["owner", "admin", "manager"],
  "/dashboard/billing": ["owner"],
  "/dashboard/dispatch": ["owner", "admin", "manager"],
  "/dashboard/care/medications/asclepius": ["owner", "admin", "manager"],
  "/dashboard/care/governance": ["owner", "admin"],
  "/dashboard/ai-agent": ["owner", "admin"],
};

/** Roles that belong in the /portal experience, not /dashboard */
const PORTAL_ROLES = ["participant", "carer"];

/** Emails that are always treated as super admins (bootstrap fallback) */
const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];

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

  // Refresh the session — also validates JWT
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ─── Project Olympus: Super Admin Route Gate ───────────────────
  // Returns hard 404 (not 401) to prevent path enumeration
  if (pathname.startsWith("/olympus")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/not-found";
      return NextResponse.rewrite(url);
    }

    // Fast path: check JWT app_metadata first
    const isSuperAdminJwt = user.app_metadata?.is_super_admin === true;
    if (isSuperAdminJwt) {
      return supabaseResponse;
    }

    // Fallback: check profile table (for when JWT claims aren't synced yet)
    try {
      const { data: adminProfile, error: profileError } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("profiles")
        .select("is_super_admin, email")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || adminProfile === null) {
        // Column doesn't exist or no profile — fallback to email allowlist
        if (!SUPER_ADMIN_EMAILS.includes(user.email || "")) {
          const url = request.nextUrl.clone();
          url.pathname = "/not-found";
          return NextResponse.rewrite(url);
        }
        return supabaseResponse;
      }

      if (!adminProfile?.is_super_admin) {
        const url = request.nextUrl.clone();
        url.pathname = "/not-found";
        return NextResponse.rewrite(url);
      }
    } catch {
      // If anything fails, fall back to email check
      if (!SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        const url = request.nextUrl.clone();
        url.pathname = "/not-found";
        return NextResponse.rewrite(url);
      }
    }

    return supabaseResponse;
  }

  // ─── Public Routes ────────────────────────────────────────────
  const publicPaths = ["/auth", "/accept-invite", "/join", "/invite", "/api"];
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname === "/") {
    if (pathname === "/auth" && user) {
      const next = request.nextUrl.searchParams.get("next");

      // Determine redirect target from JWT claims first (fast path)
      const jwtRole = user.app_metadata?.role as string | undefined;
      const jwtOrgId = user.app_metadata?.org_id as string | undefined;

      let hasOrg = !!jwtOrgId;
      let hasPortalLink = PORTAL_ROLES.includes(jwtRole ?? "");

      // If JWT doesn't have claims, fall back to DB queries
      if (!jwtRole && !jwtOrgId) {
        const { data: activeMembership } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        hasOrg = !!activeMembership;

        if (!hasOrg) {
          const { data: portalLink } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .from("participant_network_members")
            .select("participant_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();
          hasPortalLink = !!portalLink;
        }
      }

      const url = request.nextUrl.clone();
      if (next) {
        url.pathname = next;
      } else if (hasPortalLink && !hasOrg) {
        url.pathname = "/portal";
      } else {
        url.pathname = "/dashboard";
      }
      url.searchParams.delete("next");
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ─── Protected Routes: require auth ───────────────────────────
  const protectedPaths = ["/dashboard", "/setup", "/settings", "/checkout", "/portal"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ─── Extract role from JWT app_metadata (fast path) ───────────
  const jwtRole = user?.app_metadata?.role as string | undefined;
  const jwtOrgId = user?.app_metadata?.org_id as string | undefined;

  // ─── Portal Routes ────────────────────────────────────────────
  // Portal is for participants/carers. Staff shouldn't access it.
  if (user && pathname.startsWith("/portal")) {
    // If JWT says user is staff (not participant/carer), redirect to dashboard
    if (jwtRole && !PORTAL_ROLES.includes(jwtRole)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // If no JWT role, fall back to DB check
    if (!jwtRole) {
      const { data: hasPortalLink } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("participant_network_members")
        .select("participant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!hasPortalLink) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  // ─── Dashboard Routes ─────────────────────────────────────────
  if (user && pathname.startsWith("/dashboard")) {
    // If JWT says user is a portal role, redirect to /portal
    if (jwtRole && PORTAL_ROLES.includes(jwtRole)) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      return NextResponse.redirect(url);
    }

    // Resolve role — prefer JWT, fall back to DB
    let role: string | undefined = jwtRole;
    let hasActiveMembership = !!jwtOrgId;

    if (!role) {
      // No JWT claims — query organization_members
      const { data: membership } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (membership) {
        role = (membership as { role?: string }).role;
        hasActiveMembership = true;
      }
    }

    // No active membership — check portal link or send to setup
    if (!hasActiveMembership) {
      const { data: hasPortalLink } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("participant_network_members")
        .select("participant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (hasPortalLink) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        return NextResponse.redirect(url);
      }

      // Check for any membership (pending/invited)
      const { data: anyMembership } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organization_members")
        .select("organization_id, role, status")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (anyMembership) {
        // Membership exists but not active — let dashboard handle the state
        return supabaseResponse;
      }

      // Check if onboarding was already marked complete (prevents infinite loop)
      const { data: profile } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        return supabaseResponse;
      }

      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      return NextResponse.redirect(url);
    }

    // ─── RBAC Enforcement at the Edge ─────────────────────────
    // Don't block the /dashboard/unauthorized page itself
    if (role && !pathname.startsWith("/dashboard/unauthorized")) {
      for (const [routePrefix, allowedRoles] of Object.entries(RBAC_ROUTES)) {
        if (pathname.startsWith(routePrefix) && !allowedRoles.includes(role)) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard/unauthorized";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // ─── Inject active workspace header into response ─────────────
  // The iworkr_active_workspace cookie is set by /api/auth/switch-context.
  // We forward it as a request header so that Supabase SSR edge functions and
  // server components that call createServerSupabaseClient() inherit the correct
  // x-active-workspace-id for RLS enforcement.
  const activeWorkspaceId = request.cookies.get("iworkr_active_workspace")?.value;
  if (activeWorkspaceId) {
    supabaseResponse.headers.set("x-active-workspace-id", activeWorkspaceId);
  }

  return supabaseResponse;
}

