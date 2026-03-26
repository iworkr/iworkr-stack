/**
 * @middleware SupabaseSessionMiddleware
 * @status COMPLETE
 * @description Edge RBAC middleware with JWT-based role checks and session refresh
 * @lastAudit 2026-03-22
 */
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

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
  "/settings": ["owner", "admin"],
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

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
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

  // Legacy bridge: /settings/* => /dashboard/settings/* (non-destructive parity path)
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    const bridgeUrl = request.nextUrl.clone();
    bridgeUrl.pathname = `/dashboard${pathname}`;
    if (bridgeUrl.pathname !== pathname || bridgeUrl.search !== request.nextUrl.search) {
      return NextResponse.redirect(bridgeUrl);
    }
  }

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
      const { data: adminProfile, error: profileError } = await supabase
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

  // ─── Synapse-Gate: Authenticated Root Redirect ────────────────
  // If user is authenticated and on public marketing pages or auth,
  // redirect them to their workspace instead of showing marketing content
  const PUBLIC_MARKETING = ["/", "/pricing", "/contact", "/ndis", "/features"];
  const isMarketingPage = PUBLIC_MARKETING.includes(pathname);
  const isAuthPage = pathname.startsWith("/auth") && !pathname.startsWith("/auth/callback");
  const isSignupPage = pathname === "/signup";

  if (user && (isMarketingPage || isAuthPage || isSignupPage)) {
    const next = request.nextUrl.searchParams.get("next");

    const jwtRole = user.app_metadata?.role as string | undefined;
    const jwtOrgId = user.app_metadata?.org_id as string | undefined;

    let hasOrg = !!jwtOrgId;
    let hasPortalLink = PORTAL_ROLES.includes(jwtRole ?? "");

    if (!jwtRole && !jwtOrgId) {
      const { data: activeMembership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      hasOrg = !!activeMembership;

      if (!hasOrg) {
        const { data: portalLink } = await (supabase as SupabaseClient)
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
    if (url.pathname === pathname && url.search === request.nextUrl.search) {
      return supabaseResponse;
    }
    return NextResponse.redirect(url);
  }

  // ─── Public Routes (unauthenticated access allowed) ─────────
  const publicPaths = ["/auth", "/accept-invite", "/join", "/invite", "/api"];
  const portalPublicPaths = ["/portal/view", "/portal/login", "/portal/magic"];
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    portalPublicPaths.some((p) => pathname.startsWith(p)) ||
    isMarketingPage ||
    isSignupPage
  ) {
    return supabaseResponse;
  }

  // ─── Protected Routes: require auth ───────────────────────────
  const protectedPaths = ["/dashboard", "/setup", "/settings", "/checkout", "/portal"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    if (url.pathname === pathname && url.search === request.nextUrl.search) {
      return supabaseResponse;
    }
    return NextResponse.redirect(url);
  }

  // ─── Extract role from JWT app_metadata (fast path) ───────────
  const jwtRole = user?.app_metadata?.role as string | undefined;
  const jwtOrgId = user?.app_metadata?.org_id as string | undefined;

  // ─── Portal Routes ────────────────────────────────────────────
  // Portal is for participants/carers/portal_users. Staff shouldn't access it
  // unless they also have a portal_access_grant or participant_network_member link.
  if (user && pathname.startsWith("/portal")) {
    // /portal/c/ routes are the white-labeled client portal — allow any authenticated user
    // (RLS handles data isolation via portal_access_grants)
    if (pathname.startsWith("/portal/c/")) {
      return supabaseResponse;
    }

    // If JWT says user is staff (not participant/carer), redirect to dashboard
    if (jwtRole && !PORTAL_ROLES.includes(jwtRole)) {
      // But check if they have a portal_access_grant first (they might be a portal user too)
      const { data: hasPortalGrant } = await (supabase as SupabaseClient)
        .from("portal_access_grants")
        .select("id")
        .eq("portal_user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!hasPortalGrant) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        if (url.pathname === pathname && url.search === request.nextUrl.search) {
          return supabaseResponse;
        }
        return NextResponse.redirect(url);
      }
    }

    // If no JWT role, fall back to DB check
    if (!jwtRole) {
      const { data: hasPortalLink } = await (supabase as SupabaseClient)
        .from("participant_network_members")
        .select("participant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!hasPortalLink) {
        // Also check portal_access_grants for B2C/B2B portal users
        const { data: hasPortalGrant } = await (supabase as SupabaseClient)
          .from("portal_access_grants")
          .select("id")
          .eq("portal_user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (!hasPortalGrant) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard";
          if (url.pathname === pathname && url.search === request.nextUrl.search) {
            return supabaseResponse;
          }
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // ─── Dashboard Routes ─────────────────────────────────────────
  if (user && pathname.startsWith("/dashboard")) {
    // If JWT says user is a portal role, redirect to /portal
    if (jwtRole && PORTAL_ROLES.includes(jwtRole)) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      if (url.pathname === pathname && url.search === request.nextUrl.search) {
        return supabaseResponse;
      }
      return NextResponse.redirect(url);
    }

    // Resolve role — prefer JWT, fall back to DB
    let role: string | undefined = jwtRole;
    let hasActiveMembership = !!jwtOrgId;

    if (!role) {
      // No JWT claims — query organization_members
      const { data: membership } = await supabase
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
      const { data: hasPortalLink } = await (supabase as SupabaseClient)
        .from("participant_network_members")
        .select("participant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (hasPortalLink) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        if (url.pathname === pathname && url.search === request.nextUrl.search) {
          return supabaseResponse;
        }
        return NextResponse.redirect(url);
      }

      // Check for any membership (pending/invited)
      const { data: anyMembership } = await supabase
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        return supabaseResponse;
      }

      const url = request.nextUrl.clone();
      url.pathname = "/setup";
      if (url.pathname === pathname && url.search === request.nextUrl.search) {
        return supabaseResponse;
      }
      return NextResponse.redirect(url);
    }

    // ─── RBAC Enforcement at the Edge ─────────────────────────
    // Don't block the /dashboard/unauthorized page itself
    if (role && !pathname.startsWith("/dashboard/unauthorized")) {
      for (const [routePrefix, allowedRoles] of Object.entries(RBAC_ROUTES)) {
        if (pathname.startsWith(routePrefix) && !allowedRoles.includes(role)) {
          const url = request.nextUrl.clone();
          url.pathname = "/dashboard/unauthorized";
          if (url.pathname === pathname && url.search === request.nextUrl.search) {
            return supabaseResponse;
          }
          return NextResponse.redirect(url);
        }
      }
    }
  }

  // ─── Aegis-Citadel: Velocity Anomaly Detection ───────────────
  // Uses Vercel's free geolocation headers to detect impossible travel.
  // If a user's session appears in a different country within 5 minutes,
  // the session is revoked and a 403 is returned.
  if (user && isProtected) {
    const currentCountry = request.headers.get("x-vercel-ip-country");
    const currentIp = request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

    // Only run velocity checks if we have geolocation data (Vercel production)
    // and skip for localhost/development
    if (
      currentCountry &&
      currentIp &&
      currentCountry !== "XX" &&
      !currentIp.startsWith("127.") &&
      currentIp !== "::1"
    ) {
      try {
        // Lightweight check: store last known country in a cookie
        const lastCountry = request.cookies.get("_citadel_geo")?.value;
        const lastTimestamp = request.cookies.get("_citadel_ts")?.value;

        if (lastCountry && lastTimestamp && lastCountry !== currentCountry) {
          const elapsedMs = Date.now() - parseInt(lastTimestamp, 10);
          const elapsedMinutes = elapsedMs / 60_000;

          // Impossible travel: different country within 5 minutes
          if (elapsedMinutes < 5) {
            console.warn(
              `[Citadel] VELOCITY ANOMALY: User ${user.id} traveled ${lastCountry} → ${currentCountry} in ${Math.round(elapsedMinutes)}min`
            );

            // Revoke the session
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (serviceKey) {
              const { createClient } = await import("@supabase/supabase-js");
              const admin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                serviceKey,
                { auth: { persistSession: false, autoRefreshToken: false } }
              );
              await admin.auth.admin.signOut(user.id, "global");
              await admin.rpc("log_security_event", {
                p_event_type: "IMPOSSIBLE_TRAVEL",
                p_severity: "critical",
                p_user_id: user.id,
                p_ip_address: currentIp,
                p_country_code: currentCountry,
                p_details: {
                  previous_country: lastCountry,
                  minutes_elapsed: Math.round(elapsedMinutes),
                },
              });
            }

            // Return 403 — session has been revoked
            return new NextResponse(
              JSON.stringify({ error: "Session terminated: impossible travel detected" }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            );
          }
        }

        // Update geolocation cookies for next request comparison
        supabaseResponse.cookies.set("_citadel_geo", currentCountry, {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: 86400, // 24 hours
          path: "/",
        });
        supabaseResponse.cookies.set("_citadel_ts", Date.now().toString(), {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          maxAge: 86400,
          path: "/",
        });
      } catch (velocityErr) {
        // Never block the request due to velocity check failure
        console.error("[Citadel] Velocity check error:", velocityErr);
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

