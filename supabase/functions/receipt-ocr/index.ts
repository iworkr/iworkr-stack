/**
 * @module receipt-ocr
 * @status COMPLETE
 * @auth UNSECURED — No user auth; triggered by storage webhook or direct POST
 * @description Project Aegis-Spend: Vision AI receipt parsing via GPT-4o/Gemini with dual-model fallback, GST validation, PO variance matching, and catalog price checks
 * @dependencies OpenAI (GPT-4o), Google Gemini, Supabase Storage
 * @lastAudit 2026-03-22
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { MockOpenAI, isTestEnv } from "../_shared/mockClients.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface ExtractedReceipt {
  supplier_name: string;
  invoice_number: string | null;
  po_number: string | null;
  total_incl_tax: number;
  tax_amount: number;
  subtotal: number;
  date: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_cost: number;
    line_total: number;
  }>;
  confidence: number;
}

const EXTRACTION_PROMPT = `You are an expert accounts payable document parser for Australian trade businesses.
Examine this receipt or supplier invoice image carefully.

Extract ALL of the following into EXACT JSON (no markdown, no code blocks):
{
  "supplier_name": "The supplier/store name",
  "invoice_number": "The invoice or receipt number (null if not visible)",
  "po_number": "Any PO number printed on the receipt (null if not found)",
  "total_incl_tax": 0.00,
  "tax_amount": 0.00,
  "subtotal": 0.00,
  "date": "YYYY-MM-DD or null",
  "line_items": [
    {
      "description": "Item description",
      "quantity": 1,
      "unit_cost": 0.00,
      "line_total": 0.00
    }
  ],
  "confidence": 0.95
}

RULES:
1. All monetary values in AUD. Use decimals (e.g., 152.40, not 15240).
2. Tax in Australia is GST at 10%. If tax is not explicitly shown, calculate it as total / 11.
3. If the receipt is blurry or partially unreadable, set confidence below 0.7.
4. The confidence field is YOUR assessment of extraction accuracy (0.0 to 1.0).
5. CRITICAL: Return ONLY valid JSON. No explanation text, no markdown.`;

async function extractWithOpenAI(imageBase64: string, mimeType: string): Promise<ExtractedReceipt> {
  if (isTestEnv) {
    const mock = await MockOpenAI.chat.completions.create();
    return JSON.parse(mock.choices[0].message.content) as ExtractedReceipt;
  }
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
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
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Strip markdown code blocks if present
  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleaned) as ExtractedReceipt;
}

async function extractWithGemini(imageBase64: string, mimeType: string): Promise<ExtractedReceipt> {
  if (isTestEnv) {
    const mock = await MockOpenAI.chat.completions.create();
    return JSON.parse(mock.choices[0].message.content) as ExtractedReceipt;
  }
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const cleaned = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleaned) as ExtractedReceipt;
}

function validateExtraction(extracted: ExtractedReceipt): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Sanity check: total must be positive
  if (extracted.total_incl_tax <= 0) {
    warnings.push("Total amount is zero or negative");
  }

  // Sanity check: line items sum should roughly match total
  if (extracted.line_items && extracted.line_items.length > 0) {
    const lineSum = extracted.line_items.reduce((s, l) => s + (l.line_total || 0), 0);
    const variance = Math.abs(lineSum - extracted.subtotal);
    if (extracted.subtotal > 0 && variance > extracted.subtotal * 0.1) {
      warnings.push(`Line items sum ($${lineSum.toFixed(2)}) differs from subtotal ($${extracted.subtotal.toFixed(2)}) by >10%`);
    }
  }

  // Sanity check: tax should be approximately 10% of subtotal (Australian GST)
  if (extracted.subtotal > 0 && extracted.tax_amount > 0) {
    const expectedTax = extracted.subtotal * 0.1;
    const taxVariance = Math.abs(extracted.tax_amount - expectedTax);
    if (taxVariance > expectedTax * 0.15) {
      warnings.push(`Tax ($${extracted.tax_amount.toFixed(2)}) deviates >15% from expected GST ($${expectedTax.toFixed(2)})`);
    }
  }

  // Sanity check: subtotal + tax should equal total
  if (extracted.subtotal > 0 && extracted.tax_amount > 0) {
    const expectedTotal = extracted.subtotal + extracted.tax_amount;
    if (Math.abs(expectedTotal - extracted.total_incl_tax) > 0.10) {
      warnings.push(`Subtotal + Tax ($${expectedTotal.toFixed(2)}) does not match total ($${extracted.total_incl_tax.toFixed(2)})`);
    }
  }

  // Confidence check
  if (extracted.confidence < 0.7) {
    warnings.push("AI confidence below 70% threshold");
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      receipt_id,
      storage_path,
      organization_id,
      po_id,
      job_id,
      worker_id,
      image_base64,
      mime_type,
      preferred_model,
    } = body;

    let imageData = image_base64;
    let imageMime = mime_type || "image/jpeg";

    // If storage_path provided, download from Supabase Storage
    if (storage_path && !imageData) {
      const { data: fileData, error: dlError } = await supabase.storage
        .from("supplier-receipts-photos")
        .download(storage_path);

      if (dlError || !fileData) {
        throw new Error(`Failed to download receipt: ${dlError?.message}`);
      }

      const buffer = await fileData.arrayBuffer();
      imageData = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      imageMime = fileData.type || "image/jpeg";
    }

    if (!imageData) {
      throw new Error("No image data provided (supply image_base64 or storage_path)");
    }

    // Create or update the receipt record
    let receiptId = receipt_id;
    if (!receiptId && organization_id) {
      const { data: newReceipt, error: insErr } = await supabase
        .from("supplier_receipts")
        .insert({
          organization_id,
          po_id: po_id || null,
          job_id: job_id || null,
          worker_id: worker_id || null,
          receipt_storage_path: storage_path || null,
          status: "PENDING_AI_PARSE",
        })
        .select("id")
        .single();

      if (insErr) throw new Error(`Insert receipt: ${insErr.message}`);
      receiptId = newReceipt.id;
    }

    // Run Vision AI extraction (try preferred model, fallback to other)
    let extracted: ExtractedReceipt;
    let modelUsed: string;

    try {
      if (preferred_model === "gemini") {
        extracted = await extractWithGemini(imageData, imageMime);
        modelUsed = "gemini-1.5-pro";
      } else {
        extracted = await extractWithOpenAI(imageData, imageMime);
        modelUsed = "gpt-4o";
      }
    } catch (primaryError) {
      // Fallback to the other model
      console.warn(`Primary model failed, falling back: ${primaryError}`);
      try {
        if (preferred_model === "gemini") {
          extracted = await extractWithOpenAI(imageData, imageMime);
          modelUsed = "gpt-4o (fallback)";
        } else {
          extracted = await extractWithGemini(imageData, imageMime);
          modelUsed = "gemini-1.5-pro (fallback)";
        }
      } catch (fallbackError) {
        // Both models failed — mark receipt as NEEDS_REVIEW
        if (receiptId) {
          await supabase
            .from("supplier_receipts")
            .update({
              status: "NEEDS_REVIEW",
              ai_model_used: "FAILED",
              ai_raw_response: { error: String(fallbackError) },
              updated_at: new Date().toISOString(),
            })
            .eq("id", receiptId);
        }
        throw new Error(`Both AI models failed: ${fallbackError}`);
      }
    }

    // Validate the extraction
    const validation = validateExtraction(extracted);

    // Determine status based on validation
    const receiptStatus = validation.valid && extracted.confidence >= 0.8
      ? "NEEDS_REVIEW"  // Good extraction, but always needs human verification
      : "NEEDS_REVIEW"; // Flagged for manual review

    // Calculate PO variance if linked to a PO
    let poVariance: number | null = null;
    let poVariancePct: number | null = null;
    let matchStatus = "unmatched";

    if (po_id || extracted.po_number) {
      // Try to find the PO
      let poQuery = supabase.from("purchase_orders").select("id, expected_total, po_number, total");

      if (po_id) {
        poQuery = poQuery.eq("id", po_id);
      } else if (extracted.po_number && organization_id) {
        poQuery = poQuery.eq("organization_id", organization_id).eq("po_number", extracted.po_number);
      }

      const { data: po } = await poQuery.maybeSingle();
      if (po) {
        const poExpected = po.expected_total || po.total || 0;
        if (poExpected > 0) {
          poVariance = extracted.total_incl_tax - poExpected;
          poVariancePct = (poVariance / poExpected) * 100;
          matchStatus = Math.abs(poVariancePct) <= 10 ? "matched" : "variance_flagged";
        } else {
          matchStatus = "matched";
        }
      }
    }

    // Update the receipt record with AI results
    if (receiptId) {
      const { error: updateErr } = await supabase
        .from("supplier_receipts")
        .update({
          supplier_name_extracted: extracted.supplier_name,
          supplier_invoice_number: extracted.invoice_number,
          actual_total_amount: extracted.total_incl_tax,
          actual_tax_amount: extracted.tax_amount,
          actual_subtotal: extracted.subtotal,
          extracted_date: extracted.date,
          extracted_po_number: extracted.po_number,
          ai_raw_response: extracted,
          ai_model_used: modelUsed,
          ai_confidence: extracted.confidence,
          po_variance_amount: poVariance,
          po_variance_pct: poVariancePct,
          match_status: matchStatus,
          status: receiptStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receiptId);

      if (updateErr) {
        console.error("Failed to update receipt:", updateErr);
      }
    }

    // Historical variance check — if linked to existing inventory
    let priceWarnings: string[] = [];
    if (extracted.line_items && extracted.line_items.length > 0) {
      for (const item of extracted.line_items) {
        if (item.unit_cost > 0) {
          // Check if unit cost is > 50% different from known prices
          const { data: catalogMatch } = await supabase
            .from("supplier_catalog_cache")
            .select("trade_price, name")
            .ilike("name", `%${item.description.substring(0, 30)}%`)
            .limit(1)
            .maybeSingle();

          if (catalogMatch && catalogMatch.trade_price > 0) {
            const priceDelta = Math.abs(item.unit_cost - catalogMatch.trade_price) / catalogMatch.trade_price;
            if (priceDelta > 0.5) {
              priceWarnings.push(
                `"${item.description}" cost $${item.unit_cost} vs catalog $${catalogMatch.trade_price} (${(priceDelta * 100).toFixed(0)}% variance)`
              );
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id: receiptId,
        extracted: {
          supplier_name: extracted.supplier_name,
          invoice_number: extracted.invoice_number,
          po_number: extracted.po_number,
          total: extracted.total_incl_tax,
          tax: extracted.tax_amount,
          subtotal: extracted.subtotal,
          date: extracted.date,
          line_items_count: extracted.line_items?.length || 0,
          confidence: extracted.confidence,
        },
        validation: {
          passed: validation.valid,
          warnings: validation.warnings,
        },
        po_match: {
          status: matchStatus,
          variance_amount: poVariance,
          variance_pct: poVariancePct,
        },
        price_warnings: priceWarnings,
        model_used: modelUsed,
        status: receiptStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("receipt-ocr error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
