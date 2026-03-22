/**
 * @module live-price-check
 * @status PARTIAL
 * @auth UNSECURED — No auth header check, uses service_role key directly
 * @description Queries supplier B2B APIs (Reece, Rexel, Tradelink, etc.) for real-time trade pricing and branch stock availability
 * @dependencies Supabase, External supplier B2B APIs (Reece, Rexel, Tradelink, MMEM, CNW)
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Project Forge-Link — Live Price & Stock Check
// ============================================================================
// On-demand endpoint that hits supplier B2B APIs to get absolute to-the-second
// trade pricing and branch stock availability. Used by the Margin Protector
// and the mobile quoting engine.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

interface PriceCheckRequest {
  organization_id: string;
  supplier: string;
  skus: string[];
  branch_id?: string;
}

interface LivePriceResult {
  sku: string;
  live_cost: number | null;
  retail_price: number | null;
  cached_cost: number | null;
  cost_delta: number | null;
  cost_delta_pct: number | null;
  stock_at_branch: number | null;
  stock_at_dc: number | null;
  branch_name: string | null;
  dc_name: string | null;
  available: boolean;
  checked_at: string;
}

// Supplier B2B API endpoints
const SUPPLIER_PRICING_APIS: Record<string, string> = {
  REECE: "https://api.reece.com.au/v2/pricing/live",
  REXEL: "https://api.rexel.com.au/b2b/v1/pricing",
  TRADELINK: "https://api.tradelink.com.au/v1/pricing",
  MMEM: "https://api.mmem.com.au/v1/pricing",
  CNW: "https://api.cnw.com.au/v1/pricing",
};

const SUPPLIER_STOCK_APIS: Record<string, string> = {
  REECE: "https://api.reece.com.au/v2/inventory/availability",
  REXEL: "https://api.rexel.com.au/b2b/v1/stock",
  TRADELINK: "https://api.tradelink.com.au/v1/stock",
  MMEM: "https://api.mmem.com.au/v1/stock",
  CNW: "https://api.cnw.com.au/v1/stock",
};

async function fetchLivePricing(
  supplier: string,
  token: string,
  skus: string[],
  accountNumber: string
): Promise<Record<string, { live_cost: number; retail_price: number }>> {
  const endpoint = SUPPLIER_PRICING_APIS[supplier];
  if (!endpoint) return {};

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Account-Number": accountNumber,
      },
      body: JSON.stringify({ skus, include_retail: true }),
    });

    if (!response.ok) {
      console.error(`Live pricing failed for ${supplier}: ${response.status}`);
      return {};
    }

    const data = await response.json();
    const result: Record<string, { live_cost: number; retail_price: number }> = {};

    // Normalize response
    const items = data.prices || data.items || data.data || [];
    // deno-lint-ignore no-explicit-any
    for (const item of items as any[]) {
      const sku = item.sku || item.product_code || item.code;
      if (sku) {
        result[sku] = {
          live_cost: parseFloat(item.trade_price || item.cost || item.net_price || "0"),
          retail_price: parseFloat(item.retail_price || item.rrp || item.list_price || "0"),
        };
      }
    }

    return result;
  } catch (err) {
    console.error(`Live pricing error for ${supplier}:`, err);
    return {};
  }
}

async function fetchStockAvailability(
  supplier: string,
  token: string,
  skus: string[],
  branchId?: string
): Promise<Record<string, { branch_stock: number; dc_stock: number; branch_name: string; dc_name: string }>> {
  const endpoint = SUPPLIER_STOCK_APIS[supplier];
  if (!endpoint) return {};

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        skus,
        branch_id: branchId,
        include_dc: true,
      }),
    });

    if (!response.ok) {
      console.error(`Stock check failed for ${supplier}: ${response.status}`);
      return {};
    }

    const data = await response.json();
    const result: Record<string, { branch_stock: number; dc_stock: number; branch_name: string; dc_name: string }> = {};

    const items = data.availability || data.stock || data.data || [];
    // deno-lint-ignore no-explicit-any
    for (const item of items as any[]) {
      const sku = item.sku || item.product_code;
      if (sku) {
        result[sku] = {
          branch_stock: parseInt(item.branch_qty || item.branch_stock || item.local_stock || "0"),
          dc_stock: parseInt(item.dc_qty || item.dc_stock || item.warehouse_stock || "0"),
          branch_name: item.branch_name || item.branch || branchId || "Local Branch",
          dc_name: item.dc_name || item.warehouse_name || "Distribution Center",
        };
      }
    }

    return result;
  } catch (err) {
    console.error(`Stock check error for ${supplier}:`, err);
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const body: PriceCheckRequest = await req.json();

    if (!body.organization_id || !body.supplier || !body.skus?.length) {
      return jsonResponse(req, { error: "Missing organization_id, supplier, or skus" }, 400);
    }

    const supabase = serviceClient();

    // Get workspace supplier credentials
    const { data: ws } = await supabase
      .from("workspace_suppliers")
      .select("*")
      .eq("organization_id", body.organization_id)
      .eq("supplier", body.supplier)
      .single();

    const branchId = body.branch_id || ws?.preferred_branch_id;

    // Get cached prices for comparison
    const { data: cachedItems } = await supabase
      .from("supplier_catalog_cache")
      .select("sku, trade_price, retail_price")
      .eq("organization_id", body.organization_id)
      .eq("supplier", body.supplier)
      .in("sku", body.skus);

    const cachedMap: Record<string, { trade_price: number; retail_price: number }> = {};
    if (cachedItems) {
      for (const item of cachedItems) {
        cachedMap[item.sku] = {
          trade_price: parseFloat(item.trade_price || "0"),
          retail_price: parseFloat(item.retail_price || "0"),
        };
      }
    }

    // Attempt live API calls (if credentials exist)
    let livePrices: Record<string, { live_cost: number; retail_price: number }> = {};
    let stockData: Record<string, { branch_stock: number; dc_stock: number; branch_name: string; dc_name: string }> = {};

    if (ws?.api_key_encrypted) {
      // Fetch live pricing and stock in parallel
      const [priceResult, stockResult] = await Promise.all([
        fetchLivePricing(body.supplier, ws.api_key_encrypted, body.skus, ws.account_number || ""),
        fetchStockAvailability(body.supplier, ws.api_key_encrypted, body.skus, branchId),
      ]);

      livePrices = priceResult;
      stockData = stockResult;

      // Update the cache with fresh live prices
      for (const [sku, price] of Object.entries(livePrices)) {
        await supabase
          .from("supplier_catalog_cache")
          .update({
            trade_price: price.live_cost,
            retail_price: price.retail_price,
            last_synced_at: new Date().toISOString(),
          })
          .eq("organization_id", body.organization_id)
          .eq("supplier", body.supplier)
          .eq("sku", sku);
      }
    }

    // Build results
    const results: LivePriceResult[] = body.skus.map((sku) => {
      const cached = cachedMap[sku];
      const live = livePrices[sku];
      const stock = stockData[sku];

      const liveCost = live?.live_cost ?? cached?.trade_price ?? null;
      const cachedCost = cached?.trade_price ?? null;
      const delta = liveCost !== null && cachedCost !== null ? liveCost - cachedCost : null;
      const deltaPct = delta !== null && cachedCost && cachedCost > 0 ? (delta / cachedCost) * 100 : null;

      return {
        sku,
        live_cost: liveCost,
        retail_price: live?.retail_price ?? cached?.retail_price ?? null,
        cached_cost: cachedCost,
        cost_delta: delta ? Math.round(delta * 100) / 100 : null,
        cost_delta_pct: deltaPct ? Math.round(deltaPct * 100) / 100 : null,
        stock_at_branch: stock?.branch_stock ?? null,
        stock_at_dc: stock?.dc_stock ?? null,
        branch_name: stock?.branch_name ?? null,
        dc_name: stock?.dc_name ?? null,
        available: (stock?.branch_stock ?? 0) > 0 || (stock?.dc_stock ?? 0) > 0,
        checked_at: new Date().toISOString(),
      };
    });

    return jsonResponse(req, {
      success: true,
      supplier: body.supplier,
      branch_id: branchId,
      items: results,
      checked_at: new Date().toISOString(),
      api_available: !!ws?.api_key_encrypted,
    });
  } catch (error) {
    console.error("Live price check error:", error);
    return jsonResponse(req, { error: String(error) }, 500);
  }
});
