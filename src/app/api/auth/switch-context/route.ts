import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/auth/switch-context
 *
 * Validates the requested workspace switch and sets the HTTP-only
 * `iworkr_active_workspace` cookie. Called by the WorkspaceSwitcher UI
 * before the React cache purge + router.refresh() sequence.
 *
 * Body: { workspaceId: string; branchId?: string | null }
 *
 * Returns: { ok: boolean; workspace: { id, name, slug, role } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, branchId } = body as {
      workspaceId: string;
      branchId?: string | null;
    };

    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the user is an active member of the requested workspace
    const { data: membership, error: memberError } = await (supabase as any)
      .from("organization_members")
      .select(
        "role, organization_id, organizations(id, name, slug, logo_url, industry_type, brand_color_hex)"
      )
      .eq("user_id", user.id)
      .eq("organization_id", workspaceId)
      .eq("status", "active")
      .maybeSingle();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: "You are not a member of this workspace" },
        { status: 403 }
      );
    }

    const org = (membership as any).organizations;

    const response = NextResponse.json({
      ok: true,
      workspace: {
        id: workspaceId,
        name: org?.name,
        slug: org?.slug,
        role: (membership as any).role,
        logoUrl: org?.logo_url,
        industryType: org?.industry_type,
        brandColorHex: org?.brand_color_hex,
      },
    });

    // Set the HTTP-only active workspace cookie (30-day expiry)
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    response.cookies.set("iworkr_active_workspace", workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });

    // Optional: set active branch cookie
    if (branchId) {
      response.cookies.set("iworkr_active_branch", branchId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        expires,
      });
    } else {
      // Clear branch cookie when switching workspace
      response.cookies.delete("iworkr_active_branch");
    }

    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/switch-context
 * Returns the current active workspace from the cookie.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const activeWorkspaceId = cookieStore.get("iworkr_active_workspace")?.value;
    const activeBranchId = cookieStore.get("iworkr_active_branch")?.value;

    return NextResponse.json({
      workspaceId: activeWorkspaceId ?? null,
      branchId: activeBranchId ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
