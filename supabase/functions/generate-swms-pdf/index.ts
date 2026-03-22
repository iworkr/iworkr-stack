/**
 * @module generate-swms-pdf
 * @status PARTIAL
 * @auth UNSECURED — Uses service_role key directly, no caller auth check
 * @description Generates immutable, GPS-stamped SWMS compliance HTML document (not actual PDF) and uploads to compliance-vault
 * @dependencies Supabase (Storage: compliance-vault), Project Aegis-Safety
 * @lastAudit 2026-03-22
 */

// =============================================================
// Edge Function: generate-swms-pdf
// Project Aegis-Safety — Compliance PDF Generation
// Generates an immutable, timestamped, GPS-stamped SWMS PDF
// =============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HazardAssessment {
  name: string;
  description?: string;
  initial_likelihood: number;
  initial_consequence: number;
  initial_score: number;
  initial_rating: string;
  mitigations: string[];
  residual_likelihood: number;
  residual_consequence: number;
  residual_score: number;
  residual_rating: string;
}

interface SwmsRecord {
  id: string;
  organization_id: string;
  job_id: string;
  template_id: string | null;
  worker_id: string;
  lat_lng_captured: unknown;
  distance_from_site_meters: number;
  geofence_passed: boolean;
  ppe_confirmed: string[];
  site_conditions_assessed: Record<string, boolean>;
  assessed_hazards: HazardAssessment[];
  initial_risk_scores: unknown[];
  mitigations_applied: unknown[];
  residual_risk_scores: unknown[];
  final_risk_score: number;
  highest_residual_risk: string;
  stop_work_triggered: boolean;
  stop_work_reason: string | null;
  status: string;
  completed_at: string;
  device_model: string | null;
  device_os: string | null;
  app_version: string | null;
  notes: string | null;
  public_access_token: string;
  created_at: string;
}

interface Signature {
  id: string;
  worker_id: string;
  worker_name: string;
  signature_svg: string;
  signed_at: string;
  device_ip: string | null;
}

// ── Risk color mapping ──────────────────────────────────────
function getRiskColor(rating: string): string {
  switch (rating) {
    case "EXTREME": return "#f43f5e";
    case "HIGH": return "#f59e0b";
    case "MEDIUM": return "#eab308";
    case "LOW": return "#10b981";
    default: return "#71717a";
  }
}

function getRiskBgColor(rating: string): string {
  switch (rating) {
    case "EXTREME": return "#fecdd3";
    case "HIGH": return "#fef3c7";
    case "MEDIUM": return "#fef9c3";
    case "LOW": return "#d1fae5";
    default: return "#f4f4f5";
  }
}

// ── Generate HTML for PDF conversion ────────────────────────
function generateSwmsHtml(
  record: SwmsRecord,
  signatures: Signature[],
  jobTitle: string,
  orgName: string,
  templateTitle: string | null,
  deviceLat: number | null,
  deviceLng: number | null,
  jobLat: number | null,
  jobLng: number | null,
): string {
  const completedDate = record.completed_at
    ? new Date(record.completed_at).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })
    : new Date(record.created_at).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" });
  const createdDate = new Date(record.created_at).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" });

  const hazards = Array.isArray(record.assessed_hazards) ? record.assessed_hazards : [];
  const ppe = Array.isArray(record.ppe_confirmed) ? record.ppe_confirmed : [];
  const siteConditions = record.site_conditions_assessed || {};

  // Build hazard rows
  const hazardRows = hazards.map((h: HazardAssessment) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;font-weight:600;">${h.name || "Unknown"}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">
        <span style="background:${getRiskBgColor(h.initial_rating)};color:${getRiskColor(h.initial_rating)};padding:2px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-weight:700;">
          ${h.initial_score} (${h.initial_rating})
        </span>
      </td>
      <td style="padding:8px;border:1px solid #ddd;">
        ${(h.mitigations || []).map((m: string) => `<div style="margin:2px 0;">• ${m}</div>`).join("")}
      </td>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">
        <span style="background:${getRiskBgColor(h.residual_rating)};color:${getRiskColor(h.residual_rating)};padding:2px 8px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-weight:700;">
          ${h.residual_score} (${h.residual_rating})
        </span>
      </td>
    </tr>
  `).join("");

  // Build PPE list
  const ppeList = ppe.map((item: string) => `<span style="background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:12px;margin:2px;display:inline-block;font-size:12px;">✓ ${item}</span>`).join("");

  // Build site conditions
  const siteCondList = Object.entries(siteConditions)
    .map(([key, val]) => `<div style="margin:2px 0;"><strong>${key.replace(/_/g, " ")}:</strong> ${val ? "YES ⚠️" : "No"}</div>`)
    .join("");

  // Build signature blocks
  const signatureBlocks = signatures.map((sig: Signature) => `
    <div style="border:1px solid #ddd;padding:12px;border-radius:8px;margin:8px 0;display:inline-block;min-width:250px;">
      <div style="font-weight:600;margin-bottom:4px;">${sig.worker_name || "Worker"}</div>
      <div style="border:1px solid #eee;padding:8px;border-radius:4px;background:#fafafa;min-height:60px;">
        ${sig.signature_svg ? `<img src="data:image/svg+xml;base64,${btoa(sig.signature_svg)}" alt="Signature" style="max-height:80px;" />` : "<em>Digital signature on file</em>"}
      </div>
      <div style="font-size:11px;color:#666;margin-top:4px;">
        Signed: ${new Date(sig.signed_at).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" })}
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SWMS - ${jobTitle}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #111; line-height: 1.5; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
    .header-left h1 { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; }
    .header-left h2 { font-size: 14px; font-weight: 400; color: #555; }
    .header-right { text-align: right; font-size: 11px; color: #666; }
    .header-right .gps { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 11px; color: #10b981; font-weight: 600; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f8f8f8; padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .meta-item { background: #f8f8f8; padding: 10px; border-radius: 6px; }
    .meta-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; display: block; }
    .meta-item span { font-size: 14px; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
    .badge-extreme { background: #fecdd3; color: #be123c; }
    .badge-high { background: #fef3c7; color: #b45309; }
    .badge-medium { background: #fef9c3; color: #a16207; }
    .badge-low { background: #d1fae5; color: #065f46; }
    .geofence-pass { color: #10b981; font-weight: 700; }
    .geofence-fail { color: #f43f5e; font-weight: 700; }
    .footer { margin-top: 30px; padding-top: 16px; border-top: 2px solid #10b981; font-size: 10px; color: #888; text-align: center; }
    .stop-work { background: #fef2f2; border: 2px solid #f43f5e; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .stop-work h3 { color: #be123c; font-size: 16px; margin-bottom: 4px; }
    @media print { body { padding: 20px; } .header { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <h1>📋 SAFE WORK METHOD STATEMENT</h1>
      <h2>${templateTitle || "General Site Assessment"} — ${orgName}</h2>
    </div>
    <div class="header-right">
      <div><strong>Generated:</strong> ${completedDate}</div>
      <div><strong>Record ID:</strong> ${record.id.substring(0, 8).toUpperCase()}</div>
      <div class="gps">
        <strong>GPS:</strong> ${deviceLat?.toFixed(6) || "N/A"}, ${deviceLng?.toFixed(6) || "N/A"}
      </div>
      <div>
        <span class="${record.geofence_passed ? "geofence-pass" : "geofence-fail"}">
          ${record.geofence_passed ? "✓ VERIFIED ON-SITE" : "✗ GEOFENCE FAILED"}
        </span>
        (${record.distance_from_site_meters?.toFixed(0) || 0}m from site)
      </div>
    </div>
  </div>

  <!-- JOB METADATA -->
  <div class="meta-grid">
    <div class="meta-item"><label>Job</label><span>${jobTitle}</span></div>
    <div class="meta-item"><label>Assessment Date</label><span>${createdDate}</span></div>
    <div class="meta-item">
      <label>Overall Risk</label>
      <span class="badge badge-${(record.highest_residual_risk || "low").toLowerCase()}" style="font-size:16px;">
        ${record.final_risk_score || 0} — ${record.highest_residual_risk || "LOW"}
      </span>
    </div>
    <div class="meta-item"><label>Distance from Site</label><span>${record.distance_from_site_meters?.toFixed(1) || 0} meters</span></div>
    <div class="meta-item"><label>Device</label><span>${record.device_model || "Unknown"} (${record.device_os || "N/A"})</span></div>
    <div class="meta-item"><label>Status</label><span>${record.status}</span></div>
  </div>

  ${record.stop_work_triggered ? `
  <div class="stop-work">
    <h3>⛔ STOP WORK AUTHORITY TRIGGERED</h3>
    <p>${record.stop_work_reason || "Residual risk remains HIGH or EXTREME after all control measures applied."}</p>
  </div>
  ` : ""}

  <!-- PPE CONFIRMATION -->
  <div class="section">
    <div class="section-title">Personal Protective Equipment Confirmed</div>
    <div>${ppeList || "<em>No PPE items recorded</em>"}</div>
  </div>

  <!-- SITE CONDITIONS -->
  <div class="section">
    <div class="section-title">Site Conditions Assessment</div>
    <div>${siteCondList || "<em>No site conditions assessed</em>"}</div>
  </div>

  <!-- HAZARD MATRIX -->
  <div class="section">
    <div class="section-title">Hazard Assessment & Control Measures</div>
    <table>
      <thead>
        <tr>
          <th style="width:25%;">Hazard</th>
          <th style="width:15%;text-align:center;">Initial Risk</th>
          <th style="width:35%;">Control Measures</th>
          <th style="width:15%;text-align:center;">Residual Risk</th>
        </tr>
      </thead>
      <tbody>
        ${hazardRows || '<tr><td colspan="4"><em>No hazards assessed</em></td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- SIGNATURES -->
  <div class="section">
    <div class="section-title">Worker Acknowledgment & Signatures</div>
    <p style="margin-bottom:12px;font-style:italic;color:#555;">
      "I confirm I have physically inspected the site, implemented the controls above, and will adhere to this Safe Work Method Statement."
    </p>
    <div>${signatureBlocks || "<em>No signatures captured</em>"}</div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>Generated by iWorkr Safety Compliance Engine v141.0 — <strong>This is an immutable audit document.</strong></div>
    <div>Public verification: safe.iworkr.app/swms/${record.public_access_token}</div>
    <div style="margin-top:4px;">Document ID: ${record.id} | Job: ${record.job_id}</div>
  </div>
</body>
</html>`;
}

// ── Main handler ────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record_id, organization_id } = await req.json();

    if (!record_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "record_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Fetch SWMS record ─────────────────────────────────
    const { data: record, error: recordError } = await supabase
      .from("job_swms_records")
      .select("*")
      .eq("id", record_id)
      .eq("organization_id", organization_id)
      .single();

    if (recordError || !record) {
      return new Response(
        JSON.stringify({ error: "SWMS record not found", details: recordError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Fetch signatures ──────────────────────────────────
    const { data: signatures } = await supabase
      .from("job_swms_signatures")
      .select("*")
      .eq("record_id", record_id)
      .order("signed_at", { ascending: true });

    // ── Fetch job title ───────────────────────────────────
    const { data: job } = await supabase
      .from("jobs")
      .select("title, site_lat, site_lng")
      .eq("id", record.job_id)
      .single();

    // ── Fetch org name ────────────────────────────────────
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    // ── Fetch template title ──────────────────────────────
    let templateTitle: string | null = null;
    if (record.template_id) {
      const { data: tpl } = await supabase
        .from("swms_templates")
        .select("title")
        .eq("id", record.template_id)
        .single();
      templateTitle = tpl?.title ?? null;
    }

    // ── Parse GPS coordinates ─────────────────────────────
    let deviceLat: number | null = null;
    let deviceLng: number | null = null;
    if (record.lat_lng_captured) {
      // PostGIS geography returns as WKT or GeoJSON
      const geo = record.lat_lng_captured;
      if (typeof geo === "object" && geo !== null) {
        if ("coordinates" in geo) {
          deviceLng = geo.coordinates[0];
          deviceLat = geo.coordinates[1];
        }
      } else if (typeof geo === "string") {
        const match = geo.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          deviceLng = parseFloat(match[1]);
          deviceLat = parseFloat(match[2]);
        }
      }
    }

    const jobLat = job?.site_lat ?? null;
    const jobLng = job?.site_lng ?? null;

    // ── Generate HTML ─────────────────────────────────────
    const html = generateSwmsHtml(
      record as SwmsRecord,
      (signatures || []) as Signature[],
      job?.title || "Untitled Job",
      org?.name || "Organization",
      templateTitle,
      deviceLat,
      deviceLng,
      jobLat,
      jobLng,
    );

    // ── Convert HTML to PDF using Deno-compatible approach ─
    // Use the HTML directly as a stored document since @react-pdf/renderer
    // is not available in Deno. We store HTML and can render client-side.
    // For production PDF, we use a headless browser or external service.
    const htmlBytes = new TextEncoder().encode(html);

    // ── Upload to compliance-vault ────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `${organization_id}/${record.job_id}/swms-${record.id.substring(0, 8)}-${timestamp}.html`;

    const { error: uploadError } = await supabase.storage
      .from("compliance-vault")
      .upload(storagePath, htmlBytes, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload PDF", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Get public URL ────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from("compliance-vault")
      .getPublicUrl(storagePath);

    // ── Update SWMS record with PDF link ──────────────────
    await supabase
      .from("job_swms_records")
      .update({
        pdf_url: urlData?.publicUrl || storagePath,
        pdf_storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record_id);

    return new Response(
      JSON.stringify({
        success: true,
        record_id,
        pdf_storage_path: storagePath,
        pdf_url: urlData?.publicUrl || storagePath,
        public_verification_url: `https://safe.iworkr.app/swms/${record.public_access_token}`,
        hazard_count: (record.assessed_hazards || []).length,
        signature_count: (signatures || []).length,
        final_risk_score: record.final_risk_score,
        highest_residual_risk: record.highest_residual_risk,
        geofence_passed: record.geofence_passed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("generate-swms-pdf error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
