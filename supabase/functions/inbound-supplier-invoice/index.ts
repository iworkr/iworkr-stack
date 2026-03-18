import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Project Hephaestus — Inbound Supplier Invoice AI Parser
// ============================================================================
// Receives PDF invoices (via email webhook or direct upload), runs Vision AI
// extraction, fuzzy-matches line items to inventory, and prepares for
// human triage with sanity checks.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ── AI Extraction Schema ────────────────────────────────────

const EXTRACTION_PROMPT = `You are a highly precise invoice parser for Australian trade suppliers (Reece Plumbing, Rexel Electrical, MMEM, Middy's, L&H, etc.).

Extract ALL line items from this supplier invoice into the exact JSON schema below. Be extremely precise with numbers — do not round or estimate.

Output ONLY valid JSON, no markdown, no explanation:

{
  "supplier_name": "string — The supplier company name",
  "invoice_number": "string — The invoice/tax invoice number",
  "invoice_date": "string — YYYY-MM-DD format",
  "subtotal_excl_tax": number,
  "tax_amount": number,
  "total_incl_tax": number,
  "line_items": [
    {
      "sku": "string or null — supplier product code/SKU",
      "description": "string — product description exactly as printed",
      "quantity": number,
      "unit_cost": number — cost per unit excluding tax,
      "line_total": number — quantity × unit_cost
    }
  ]
}

CRITICAL RULES:
- Extract EVERY line item, even partial ones
- SKU is the supplier's product/part number (may be labelled "Code", "Item", "Part No", etc.)
- unit_cost must be the price PER UNIT, not the line total
- All monetary values in AUD
- If you cannot determine a field, use null
- Do NOT fabricate or estimate values — only extract what is clearly visible`;

// ── Sanity Check Engine ─────────────────────────────────────

interface ExtractedInvoice {
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal_excl_tax: number | null;
  tax_amount: number | null;
  total_incl_tax: number | null;
  line_items: Array<{
    sku: string | null;
    description: string;
    quantity: number;
    unit_cost: number;
    line_total: number;
  }>;
}

function sanityCheck(extracted: ExtractedInvoice): {
  passed: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check 1: Line item math verification
  const calculatedSubtotal = extracted.line_items.reduce(
    (sum, item) => sum + (item.quantity * item.unit_cost),
    0
  );

  if (extracted.subtotal_excl_tax != null) {
    const subtotalDiff = Math.abs(calculatedSubtotal - extracted.subtotal_excl_tax);
    if (subtotalDiff > 1.0) {
      issues.push(
        `Line items sum ($${calculatedSubtotal.toFixed(2)}) differs from extracted subtotal ($${extracted.subtotal_excl_tax.toFixed(2)}) by $${subtotalDiff.toFixed(2)}`
      );
    }
  }

  // Check 2: Total = Subtotal + Tax
  if (
    extracted.total_incl_tax != null &&
    extracted.subtotal_excl_tax != null &&
    extracted.tax_amount != null
  ) {
    const expectedTotal = extracted.subtotal_excl_tax + extracted.tax_amount;
    const totalDiff = Math.abs(expectedTotal - extracted.total_incl_tax);
    if (totalDiff > 1.0) {
      issues.push(
        `Subtotal ($${extracted.subtotal_excl_tax}) + Tax ($${extracted.tax_amount}) = $${expectedTotal.toFixed(2)} but total is $${extracted.total_incl_tax}`
      );
    }
  }

  // Check 3: No line item with absurd values
  for (const item of extracted.line_items) {
    if (item.unit_cost > 50000) {
      issues.push(
        `Suspicious unit cost: "${item.description}" at $${item.unit_cost} — possible decimal error`
      );
    }
    if (item.quantity > 10000) {
      issues.push(
        `Suspicious quantity: "${item.description}" × ${item.quantity}`
      );
    }
  }

  return { passed: issues.length === 0, issues };
}

// ── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabase = serviceClient();

    const contentType = req.headers.get("content-type") || "";
    let organizationId: string;
    let pdfBuffer: Uint8Array;
    let sourceEmail: string | undefined;
    let sourceSubject: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Direct upload from web UI
      const formData = await req.formData();
      organizationId = formData.get("organization_id") as string;
      const file = formData.get("file") as File;
      if (!file || !organizationId) {
        return jsonResponse(req, { error: "Missing file or organization_id" }, 400);
      }
      pdfBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
      // JSON payload (from email webhook or API call)
      const body = await req.json();
      organizationId = body.organization_id;
      sourceEmail = body.from_email;
      sourceSubject = body.subject;

      if (body.pdf_base64) {
        // Base64-encoded PDF from email webhook
        const binaryStr = atob(body.pdf_base64);
        pdfBuffer = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          pdfBuffer[i] = binaryStr.charCodeAt(i);
        }
      } else if (body.pdf_url) {
        // Fetch PDF from URL
        const res = await fetch(body.pdf_url);
        pdfBuffer = new Uint8Array(await res.arrayBuffer());
      } else {
        return jsonResponse(req, { error: "No PDF provided" }, 400);
      }
    }

    if (!organizationId) {
      return jsonResponse(req, { error: "Missing organization_id" }, 400);
    }

    // ── Step 1: Store PDF in Supabase Storage ───────────────
    const timestamp = Date.now();
    const storagePath = `${organizationId}/${timestamp}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("supplier-invoices")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return jsonResponse(req, { error: "Failed to store PDF" }, 500);
    }

    // Get signed URL for the PDF
    const { data: urlData } = await supabase.storage
      .from("supplier-invoices")
      .createSignedUrl(storagePath, 86400 * 30); // 30 day expiry

    // ── Step 2: Create invoice record (PENDING_AI) ──────────
    const { data: invoice, error: insertError } = await supabase
      .from("supplier_invoices")
      .insert({
        organization_id: organizationId,
        processing_status: "PENDING_AI",
        pdf_storage_path: storagePath,
        pdf_url: urlData?.signedUrl || null,
        source_email: sourceEmail,
        source_email_subject: sourceSubject,
      })
      .select()
      .single();

    if (insertError || !invoice) {
      console.error("Insert error:", insertError);
      return jsonResponse(req, { error: "Failed to create invoice record" }, 500);
    }

    // ── Step 3: Vision AI Extraction ────────────────────────
    const base64Pdf = btoa(String.fromCharCode(...pdfBuffer));

    let extracted: ExtractedInvoice;
    let aiModel = "gpt-4o";

    try {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: EXTRACTION_PROMPT },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${base64Pdf}`,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0,
        }),
      });

      const aiResult = await aiResponse.json();
      const rawContent = aiResult.choices?.[0]?.message?.content || "";

      // Parse the JSON response (strip any markdown fences)
      const jsonStr = rawContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch (aiError) {
      console.error("AI extraction failed:", aiError);

      // Mark as FAILED
      await supabase
        .from("supplier_invoices")
        .update({
          processing_status: "FAILED",
          ai_raw_response: { error: String(aiError) },
        })
        .eq("id", invoice.id);

      return jsonResponse(req, {
        error: "AI extraction failed",
        invoice_id: invoice.id,
      }, 500);
    }

    // ── Step 4: Sanity Check ────────────────────────────────
    const check = sanityCheck(extracted);

    // ── Step 5: Fuzzy Match Line Items ──────────────────────
    const matchedLines = [];

    for (const item of extracted.line_items) {
      // Try fuzzy matching
      const { data: matches } = await supabase.rpc("fuzzy_match_inventory", {
        p_org_id: organizationId,
        p_sku: item.sku,
        p_description: item.description,
        p_supplier_name: extracted.supplier_name,
        p_threshold: 0.3,
      });

      const match = matches?.[0];
      let matchStatus = "NEEDS_MAPPING";
      let matchConfidence = 0;
      let matchMethod = null;
      let previousCost = null;
      let costVariancePct = null;
      let costAnomaly = false;

      if (match) {
        matchStatus = match.match_method === "sku_exact" || match.match_method === "supplier_mapping"
          ? "AUTO_MATCHED"
          : "FUZZY_MATCHED";
        matchConfidence = match.similarity * 100;
        matchMethod = match.match_method;

        // Check cost variance
        const { data: existingItem } = await supabase
          .from("inventory_items")
          .select("moving_average_cost, latest_cost")
          .eq("id", match.item_id)
          .single();

        if (existingItem?.latest_cost && existingItem.latest_cost > 0) {
          previousCost = existingItem.latest_cost;
          costVariancePct = ((item.unit_cost - existingItem.latest_cost) / existingItem.latest_cost) * 100;

          // Flag anomaly if >50% variance
          if (Math.abs(costVariancePct) > 50) {
            costAnomaly = true;
            matchStatus = "NEEDS_MAPPING"; // Force review for anomalies
          }
        }
      }

      matchedLines.push({
        invoice_id: invoice.id,
        raw_sku: item.sku,
        raw_description: item.description,
        raw_quantity: item.quantity,
        raw_unit_cost: item.unit_cost,
        raw_total: item.line_total,
        match_status: matchStatus,
        matched_inventory_id: match?.item_id || null,
        match_confidence: matchConfidence,
        match_method: matchMethod,
        previous_cost: previousCost,
        cost_variance_pct: costVariancePct,
        cost_anomaly: costAnomaly,
      });
    }

    // ── Step 6: Insert matched lines ────────────────────────
    if (matchedLines.length > 0) {
      await supabase.from("supplier_invoice_lines").insert(matchedLines);
    }

    // ── Step 7: Determine final status ──────────────────────
    const allAutoMatched = matchedLines.every(
      (l) => l.match_status === "AUTO_MATCHED" && !l.cost_anomaly
    );
    const hasAnomalies = matchedLines.some((l) => l.cost_anomaly);

    let finalStatus: string;
    if (!check.passed || hasAnomalies) {
      finalStatus = "NEEDS_REVIEW";
    } else if (allAutoMatched) {
      // Could auto-sync, but we still route to review for safety
      finalStatus = "NEEDS_REVIEW";
    } else {
      finalStatus = "NEEDS_REVIEW";
    }

    // ── Step 8: Update invoice with results ─────────────────
    await supabase
      .from("supplier_invoices")
      .update({
        supplier_name: extracted.supplier_name,
        invoice_number: extracted.invoice_number,
        invoice_date: extracted.invoice_date,
        subtotal_amount: extracted.subtotal_excl_tax,
        tax_amount: extracted.tax_amount,
        total_amount: extracted.total_incl_tax,
        processing_status: finalStatus,
        ai_model_used: aiModel,
        ai_raw_response: extracted as unknown,
        ai_confidence: allAutoMatched ? 95 : 70,
        math_check_passed: check.passed,
      })
      .eq("id", invoice.id);

    // ── Step 9: Log to audit ────────────────────────────────
    await supabase.from("audit_log").insert({
      organization_id: organizationId,
      action: "supplier_invoice.processed",
      entity_type: "supplier_invoices",
      entity_id: invoice.id,
      new_data: {
        supplier: extracted.supplier_name,
        invoice_number: extracted.invoice_number,
        total: extracted.total_incl_tax,
        line_items: matchedLines.length,
        auto_matched: matchedLines.filter((l) => l.match_status === "AUTO_MATCHED").length,
        needs_mapping: matchedLines.filter((l) => l.match_status === "NEEDS_MAPPING").length,
        math_check: check.passed,
        sanity_issues: check.issues,
      },
    });

    return jsonResponse(req, {
      success: true,
      invoice_id: invoice.id,
      supplier: extracted.supplier_name,
      invoice_number: extracted.invoice_number,
      total: extracted.total_incl_tax,
      line_items_count: matchedLines.length,
      auto_matched: matchedLines.filter((l) => l.match_status === "AUTO_MATCHED").length,
      needs_mapping: matchedLines.filter((l) => l.match_status === "NEEDS_MAPPING").length,
      math_check_passed: check.passed,
      sanity_issues: check.issues,
      status: finalStatus,
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return jsonResponse(req, { error: String(error) }, 500);
  }
});
