/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listSystemTelemetry } from "@/app/actions/system-telemetry";

async function verifySuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];
  const admin = createAdminSupabaseClient();

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }

    if (!profile?.is_super_admin) {
      if (SUPER_ADMIN_EMAILS.includes(profile?.email || user.email || "")) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    }
    return { id: user.id, email: profile.email };
  } catch {
    if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
      return { id: user.id, email: user.email || "" };
    }
    return null;
  }
}

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const caller = await verifySuperAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get("severity") || undefined;
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  const since = searchParams.get("since") || undefined;
  const until = searchParams.get("until") || undefined;

  const { data, total } = await listSystemTelemetry({
    limit: 10_000,
    offset: 0,
    severity,
    category,
    search,
    since,
    until,
  });

  const headers = [
    "created_at",
    "severity",
    "event_category",
    "url_path",
    "message",
    "workspace_id",
    "user_id",
    "payload_json",
  ];

  const lines = [headers.join(",")];
  for (const row of data) {
    const payload = row.payload || {};
    const message =
      typeof (payload as any).message === "string" ? (payload as any).message : "";
    const cells = [
      row.created_at,
      row.severity,
      row.event_category,
      row.url_path ?? "",
      message,
      row.workspace_id ?? "",
      row.user_id ?? "",
      JSON.stringify(payload),
    ].map(escapeCsvCell);
    lines.push(cells.join(","));
  }

  const csv = lines.join("\r\n");
  const filename = `telemetry-export-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Total-Count": String(total),
    },
  });
}
