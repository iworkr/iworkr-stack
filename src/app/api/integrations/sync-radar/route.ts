import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("orgId");
    const limit = Number(req.nextUrl.searchParams.get("limit") || "15");
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { data, error } = await supabase
      .from("integration_sync_log")
      .select("id, integration_id, direction, entity_type, status, error_message, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = Array.isArray(data) ? data : [];
    const ids = Array.from(new Set(rows.map((r) => r.integration_id).filter(Boolean)));

    let names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: ints } = await supabase
        .from("integrations")
        .select("id, provider")
        .in("id", ids);
      names = Object.fromEntries((ints || []).map((i) => [i.id, i.provider]));
    }

    const activeCount = rows.filter(
      (r) =>
        r.status === "pending" ||
        (typeof r.created_at === "string" && Date.now() - new Date(r.created_at).getTime() < 90_000)
    ).length;

    return NextResponse.json({
      activeCount,
      logs: rows.map((r) => ({
        ...r,
        integration_name: names[r.integration_id] || "integration",
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Unexpected sync radar error" },
      { status: 500 }
    );
  }
}

