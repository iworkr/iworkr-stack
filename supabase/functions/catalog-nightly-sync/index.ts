import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// Project Forge-Link — Nightly Supplier Catalog Sync
// ============================================================================
// Triggered by pg_cron at 02:00 AM AEST daily. Iterates active workspace
// suppliers, fetches differential catalog updates via B2B API, and performs
// bulk UPSERT into supplier_catalog_cache.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// B2B API endpoint templates per supplier
const SUPPLIER_APIS: Record<string, { catalog: string; auth: string }> = {
  REECE: {
    catalog: "https://api.reece.com.au/v2/catalog/products",
    auth: "https://api.reece.com.au/v2/auth/token",
  },
  REXEL: {
    catalog: "https://api.rexel.com.au/b2b/v1/catalog",
    auth: "https://api.rexel.com.au/b2b/v1/auth",
  },
  TRADELINK: {
    catalog: "https://api.tradelink.com.au/v1/products",
    auth: "https://api.tradelink.com.au/v1/auth",
  },
  MMEM: {
    catalog: "https://api.mmem.com.au/v1/catalog",
    auth: "https://api.mmem.com.au/v1/auth",
  },
  CNW: {
    catalog: "https://api.cnw.com.au/v1/products",
    auth: "https://api.cnw.com.au/v1/auth",
  },
};

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY_MS = 2000;

interface CatalogItem {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  trade_price: number;
  retail_price?: number;
  uom?: string;
  pack_size?: number;
  barcode?: string;
  image_url?: string;
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Authenticate with supplier B2B API
async function authenticateSupplier(
  supplier: string,
  apiKey: string,
  accountNumber: string
): Promise<string | null> {
  const config = SUPPLIER_APIS[supplier];
  if (!config) return apiKey; // For custom suppliers, API key IS the token

  try {
    const response = await fetch(config.auth, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        account_number: accountNumber,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      console.error(`Auth failed for ${supplier}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.access_token || data.token || apiKey;
  } catch (err) {
    console.error(`Auth error for ${supplier}:`, err);
    // Fallback: use the API key directly (many suppliers accept key as bearer)
    return apiKey;
  }
}

// Fetch catalog page from supplier with retry + backoff
async function fetchCatalogPage(
  supplier: string,
  token: string,
  page: number,
  updatedSince?: string
): Promise<{ items: CatalogItem[]; hasMore: boolean; totalPages: number }> {
  const config = SUPPLIER_APIS[supplier];
  const baseUrl = config?.catalog || `https://api.${supplier.toLowerCase()}.com.au/v1/catalog`;

  const params = new URLSearchParams({
    page: String(page),
    per_page: String(BATCH_SIZE),
    ...(updatedSince ? { updated_since: updatedSince } : {}),
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${baseUrl}?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "X-Account-Context": "iworkr-sync",
        },
      });

      if (response.status === 429) {
        // Rate limited — exponential backoff
        const retryAfter = parseInt(response.headers.get("Retry-After") || "5") * 1000;
        console.log(`Rate limited by ${supplier}. Waiting ${retryAfter}ms...`);
        await sleep(Math.max(retryAfter, RATE_LIMIT_DELAY_MS * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        console.error(`Catalog fetch failed for ${supplier}: ${response.status}`);
        return { items: [], hasMore: false, totalPages: 0 };
      }

      const data = await response.json();

      // Normalize response — different suppliers have different schemas
      const items: CatalogItem[] = (data.products || data.items || data.data || []).map(
        // deno-lint-ignore no-explicit-any
        (item: any) => ({
          sku: item.sku || item.product_code || item.code || "",
          name: item.name || item.description || item.title || "",
          description: item.long_description || item.description || item.name || "",
          category: item.category || item.product_group || null,
          subcategory: item.subcategory || item.product_subgroup || null,
          brand: item.brand || item.manufacturer || null,
          trade_price: parseFloat(item.trade_price || item.cost || item.net_price || "0"),
          retail_price: parseFloat(item.retail_price || item.rrp || item.list_price || "0"),
          uom: item.uom || item.unit_of_measure || "EACH",
          pack_size: parseInt(item.pack_size || item.pack_qty || "1"),
          barcode: item.barcode || item.ean || null,
          image_url: item.image_url || item.image || null,
        })
      );

      const totalPages = data.total_pages || data.pages || Math.ceil((data.total || items.length) / BATCH_SIZE);

      return {
        items,
        hasMore: page < totalPages,
        totalPages,
      };
    } catch (err) {
      console.error(`Fetch attempt ${attempt + 1} failed:`, err);
      if (attempt < MAX_RETRIES - 1) await sleep(RATE_LIMIT_DELAY_MS * (attempt + 1));
    }
  }

  return { items: [], hasMore: false, totalPages: 0 };
}

// Bulk UPSERT batch into supplier_catalog_cache
// deno-lint-ignore no-explicit-any
async function upsertBatch(supabase: any, orgId: string, supplier: string, items: CatalogItem[]) {
  if (items.length === 0) return 0;

  const rows = items
    .filter((item) => item.sku && item.name)
    .map((item) => ({
      organization_id: orgId,
      supplier: supplier,
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      subcategory: item.subcategory,
      brand: item.brand,
      trade_price: item.trade_price,
      retail_price: item.retail_price,
      uom: item.uom,
      pack_size: item.pack_size,
      barcode: item.barcode,
      image_url: item.image_url,
      is_active: true,
      last_synced_at: new Date().toISOString(),
    }));

  const { error } = await supabase
    .from("supplier_catalog_cache")
    .upsert(rows, {
      onConflict: "organization_id,supplier,sku",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error(`Upsert error for ${supplier}:`, error);
    return 0;
  }

  return rows.length;
}

// Main sync handler
Deno.serve(async (req) => {
  // Allow both CRON trigger (GET/POST without body) and manual trigger
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = serviceClient();
  const results: Array<{
    supplier: string;
    workspace: string;
    items_synced: number;
    pages_processed: number;
    status: string;
    error?: string;
  }> = [];

  try {
    // Get all active workspace suppliers
    const { data: suppliers, error: fetchErr } = await supabase
      .from("workspace_suppliers")
      .select("*")
      .in("sync_status", ["ACTIVE", "SETUP"]);

    if (fetchErr || !suppliers) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch suppliers", detail: fetchErr }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting nightly sync for ${suppliers.length} supplier connections...`);

    for (const ws of suppliers) {
      const startTime = Date.now();

      // Mark as syncing
      await supabase
        .from("workspace_suppliers")
        .update({ sync_status: "SYNCING", updated_at: new Date().toISOString() })
        .eq("id", ws.id);

      try {
        // Authenticate
        const token = await authenticateSupplier(
          ws.supplier,
          ws.api_key_encrypted || "",
          ws.account_number || ""
        );

        if (!token) {
          await supabase
            .from("workspace_suppliers")
            .update({
              sync_status: "AUTH_FAILED",
              last_sync_error: "Authentication failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", ws.id);

          results.push({
            supplier: ws.supplier,
            workspace: ws.organization_id,
            items_synced: 0,
            pages_processed: 0,
            status: "AUTH_FAILED",
            error: "Authentication failed",
          });
          continue;
        }

        // Calculate differential sync window (last 25 hours for overlap safety)
        const updatedSince = ws.last_sync_at
          ? new Date(new Date(ws.last_sync_at).getTime() - 25 * 3600 * 1000).toISOString()
          : undefined;

        let page = 1;
        let totalSynced = 0;
        let hasMore = true;

        while (hasMore) {
          const result = await fetchCatalogPage(ws.supplier, token, page, updatedSince);
          const synced = await upsertBatch(supabase, ws.organization_id, ws.supplier, result.items);
          totalSynced += synced;
          hasMore = result.hasMore;
          page++;

          // Respect rate limits
          if (hasMore) await sleep(500);

          // Safety: don't exceed 50 pages per supplier per run
          if (page > 50) {
            console.log(`Page limit reached for ${ws.supplier} in org ${ws.organization_id}`);
            break;
          }
        }

        // Update success status
        await supabase
          .from("workspace_suppliers")
          .update({
            sync_status: "ACTIVE",
            last_sync_at: new Date().toISOString(),
            last_sync_items: totalSynced,
            last_sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", ws.id);

        results.push({
          supplier: ws.supplier,
          workspace: ws.organization_id,
          items_synced: totalSynced,
          pages_processed: page - 1,
          status: "SUCCESS",
        });

        console.log(
          `Synced ${totalSynced} items for ${ws.supplier} (org: ${ws.organization_id}) in ${Date.now() - startTime}ms`
        );
      } catch (syncErr) {
        console.error(`Sync error for ${ws.supplier}:`, syncErr);

        await supabase
          .from("workspace_suppliers")
          .update({
            sync_status: "ACTIVE",
            last_sync_error: String(syncErr),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ws.id);

        results.push({
          supplier: ws.supplier,
          workspace: ws.organization_id,
          items_synced: 0,
          pages_processed: 0,
          status: "ERROR",
          error: String(syncErr),
        });
      }
    }

    // Log to audit
    await supabase.from("audit_log").insert({
      action: "catalog_nightly_sync.completed",
      entity_type: "workspace_suppliers",
      new_data: {
        suppliers_processed: results.length,
        total_items_synced: results.reduce((s, r) => s + r.items_synced, 0),
        results,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        suppliers_processed: results.length,
        total_items_synced: results.reduce((s, r) => s + r.items_synced, 0),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Nightly sync fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
