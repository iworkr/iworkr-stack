import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Mutation {
  mutation_id: string;
  action: string;
  table: string;
  record_id: string;
  payload: Record<string, unknown>;
  timestamp_utc: string;
}

interface ConflictEntry {
  field: string;
  client_value: unknown;
  server_value: unknown;
}

interface MutationResult {
  mutation_id: string;
  status: "applied" | "partial" | "rejected";
  conflicts: ConflictEntry[];
}

const ALLOWED_TABLES = new Set([
  "jobs",
  "invoices",
  "customers",
  "assets",
  "inventory_items",
  "job_activity",
  "time_entries",
  "quotes",
  "forms",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { mutations } = (await req.json()) as { mutations: Mutation[] };

    if (!Array.isArray(mutations) || mutations.length === 0) {
      return jsonResponse({ error: "mutations array is required" }, 400);
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const results: MutationResult[] = [];

    for (const mut of mutations) {
      const result = await processMutation(svc, user.id, mut);
      results.push(result);
    }

    return jsonResponse({ success: true, data: results });
  } catch (err) {
    console.error("process-sync-queue error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function processMutation(
  svc: ReturnType<typeof createClient>,
  userId: string,
  mut: Mutation,
): Promise<MutationResult> {
  const { mutation_id, table, record_id, payload, timestamp_utc } = mut;

  if (!ALLOWED_TABLES.has(table)) {
    return { mutation_id, status: "rejected", conflicts: [] };
  }

  const { data: currentRow, error: fetchErr } = await svc
    .from(table)
    .select("*")
    .eq("id", record_id)
    .maybeSingle();

  if (fetchErr || !currentRow) {
    await logConflict(svc, userId, mut, [], "row_not_found");
    return { mutation_id, status: "rejected", conflicts: [] };
  }

  const serverUpdatedAt = new Date(currentRow.updated_at).getTime();
  const clientTimestamp = new Date(timestamp_utc).getTime();

  const fieldsToApply: Record<string, unknown> = {};
  const conflicts: ConflictEntry[] = [];

  for (const [field, clientValue] of Object.entries(payload)) {
    if (field === "id" || field === "created_at" || field === "organization_id") continue;

    const serverValue = currentRow[field];

    // No collision: server value hasn't changed since the client mutation was created,
    // OR the field didn't exist on the server row before (new column for this row).
    const serverFieldUnchanged =
      clientTimestamp >= serverUpdatedAt || serverValue === undefined;

    if (serverFieldUnchanged) {
      fieldsToApply[field] = clientValue;
    } else {
      // Column collision — server was modified after the client mutation timestamp
      if (JSON.stringify(serverValue) !== JSON.stringify(clientValue)) {
        conflicts.push({
          field,
          client_value: clientValue,
          server_value: serverValue,
        });
      } else {
        // Values converged to the same thing — no real conflict
        fieldsToApply[field] = clientValue;
      }
    }
  }

  let status: MutationResult["status"];

  if (conflicts.length === 0 && Object.keys(fieldsToApply).length > 0) {
    status = "applied";
  } else if (conflicts.length > 0 && Object.keys(fieldsToApply).length > 0) {
    status = "partial";
  } else if (conflicts.length > 0) {
    status = "rejected";
  } else {
    // Nothing to apply and no conflicts (empty payload or all fields skipped)
    status = "applied";
  }

  if (Object.keys(fieldsToApply).length > 0) {
    fieldsToApply.updated_at = new Date().toISOString();
    await svc.from(table).update(fieldsToApply).eq("id", record_id);
  }

  if (conflicts.length > 0) {
    await logConflict(svc, userId, mut, conflicts, "field_collision");
  }

  return { mutation_id, status, conflicts };
}

async function logConflict(
  svc: ReturnType<typeof createClient>,
  userId: string,
  mut: Mutation,
  conflicts: ConflictEntry[],
  reason: string,
) {
  await svc.from("audit_log").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    action: "sync_conflict",
    entity_type: mut.table,
    entity_id: mut.record_id,
    metadata: {
      mutation_id: mut.mutation_id,
      reason,
      conflicts,
      client_timestamp: mut.timestamp_utc,
    },
    created_at: new Date().toISOString(),
  });
}
