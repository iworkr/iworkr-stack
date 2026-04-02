/**
 * @route GET /api/telemetry/export
 * @status COMPLETE
 * @auth REQUIRED — Super admin only
 * @description Exports system telemetry data as JSON or CSV for super admins
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdminServer } from "@/lib/super-admin-server";
import { listSystemTelemetry } from "@/app/actions/system-telemetry";

function escapeCsvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const caller = await verifySuperAdminServer();
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
