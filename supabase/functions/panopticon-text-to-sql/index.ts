/**
 * @module panopticon-text-to-sql
 * @status COMPLETE
 * @auth SECURED — Authorization header + auth.getUser() + org membership verification
 * @description Text-to-SQL conversational analytics: NL question → GPT-4o SQL → sandboxed exec → viz agent → SSE stream
 * @dependencies Supabase (RPC: execute_analytics_query), OpenAI (gpt-4o, gpt-4o-mini)
 * @lastAudit 2026-03-22
 */

// Edge Function: panopticon-text-to-sql
// Project Panopticon-Chat — Text-to-SQL Conversational Analytics
// Pipeline: NL question → GPT-4o SQL → sandboxed execution → visualization agent → SSE stream

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const MAX_RETRIES = 2;
const MAX_RESULT_ROWS = 1000;

const SCHEMA_CONTEXT = `You are a read-only PostgreSQL expert for iWorkr analytics. Translate the user's natural language question into a valid, read-only SQL query.

You ONLY have access to these views (all pre-filtered by workspace — do NOT add workspace_id filters):

1. secure_job_profitability
   Columns: job_id (uuid), job_display_id (text), job_title (text), job_status (text), job_category (text), assignee_id (uuid), branch (text), total_revenue (numeric), invoice_count (int), total_labor_cost (numeric), total_labor_hours (numeric), total_material_cost (numeric), po_count (int), quoted_total (numeric), gross_margin_dollars (numeric), gross_margin_pct (numeric), estimated_hours (numeric), actual_hours (numeric), hours_variance_pct (numeric), created_month (date), created_year (int), created_quarter (int), created_at (timestamptz)
   Use for: Revenue analysis, profitability by category/branch, margin tracking, job cost analysis, quote accuracy.

2. secure_worker_utilization
   Columns: worker_id (uuid), worker_name (text), branch (text), worker_role (text), total_hours_paid (numeric), ordinary_hours (numeric), overtime_hours (numeric), leave_hours (numeric), total_labor_cost (numeric), overtime_cost (numeric), billable_hours (numeric), utilization_pct (numeric), period_month (date), period_year (int), days_worked (bigint)
   Use for: Worker productivity, overtime analysis, utilization rates, labor cost breakdown, branch comparisons.

3. secure_ndis_fund_burn
   Columns: participant_id (uuid), participant_name (text), ndis_participant_number (text), funding_type (text), total_billed (numeric), claim_count (bigint), billing_month (date), billing_year (int), avg_claim_amount (numeric)
   Use for: NDIS participant funding analysis, burn rates, claim patterns, funding category breakdown.

4. secure_trade_estimate_vs_actual
   Columns: job_id (uuid), job_display_id (text), job_title (text), job_category (text), job_status (text), quoted_labor (numeric), quoted_materials (numeric), quoted_total (numeric), actual_labor (numeric), actual_materials (numeric), actual_total (numeric), labor_variance (numeric), material_variance (numeric), total_variance (numeric), variance_pct (numeric), created_month (date), created_at (timestamptz)
   Use for: Quote accuracy, estimate vs actual analysis, cost overrun tracking.

STRICT RULES:
- ONLY use SELECT statements. Never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE.
- Never use SELECT *. Always explicitly name columns.
- Always include LIMIT (max 1000 rows) unless doing aggregation that guarantees few rows.
- For temporal queries, use created_month or period_month for monthly grouping.
- Round numeric results to 2 decimal places using ROUND().
- Use meaningful column aliases (e.g., AS total_revenue, AS margin_percent).
- Do NOT reference workspace_id — the views are pre-filtered.

Return STRICTLY valid JSON: { "sql": "SELECT...", "reasoning": "Brief explanation of the query approach" }`;

const VIZ_SYSTEM_PROMPT = `You are a data visualization expert. Given query results and the original question, select the optimal chart type and write a concise executive summary.

Return STRICTLY valid JSON matching this schema:
{
  "executive_summary": "2-sentence summary of key insights from the data",
  "chart_type": "BAR_CHART" | "LINE_CHART" | "DONUT_CHART" | "METRIC_CARD" | "DATA_TABLE",
  "x_axis_key": "the JSON key for the X axis / index column",
  "y_axis_key": "the JSON key for the primary Y axis / value column",
  "y_axis_keys": ["array of JSON keys if multiple series"],
  "title": "Short chart title"
}

Guidelines:
- BAR_CHART: Best for comparing categories (e.g., revenue by branch, margin by category)
- LINE_CHART: Best for temporal/time-series data (e.g., monthly revenue trend)
- DONUT_CHART: Best for proportional/percentage data (e.g., funding type split)
- METRIC_CARD: Best for single aggregate values (e.g., total revenue, average margin)
- DATA_TABLE: Fallback for complex multi-column data`;

async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  model = "gpt-4o"
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

function injectLimit(sql: string): string {
  const upper = sql.toUpperCase().trim();
  if (!upper.includes("LIMIT")) {
    const cleaned = sql.replace(/;\s*$/, "");
    return `${cleaned} LIMIT ${MAX_RESULT_ROWS}`;
  }
  return sql;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Aegis Auth Gate ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      question,
      organization_id,
      session_id,
      stream = true,
    } = body as {
      question: string;
      organization_id: string;
      session_id?: string;
      stream?: boolean;
    };

    if (!question || !organization_id) {
      return new Response(
        JSON.stringify({ error: "question and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Org Membership Verification ────────────────────────
    const { data: membership, error: memberErr } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr || !membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (event: string, data: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          };

          try {
            // Phase 1: Analyze question
            send("status", { phase: "analyzing", message: "Analyzing question semantics..." });

            // Phase 2: Generate SQL
            send("status", { phase: "writing_sql", message: "Writing optimized SQL query..." });

            let sqlQuery = "";
            let reasoning = "";
            let retryCount = 0;
            let lastError = "";

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
              const prompt = attempt === 0
                ? question
                : `Your previous query failed with this Postgres error:\n"${lastError}"\n\nOriginal question: "${question}"\n\nFix the SQL and return valid JSON.`;

              const sqlResponse = await callOpenAI(SCHEMA_CONTEXT, prompt);
              const parsed = JSON.parse(sqlResponse);
              sqlQuery = injectLimit(parsed.sql ?? "");
              reasoning = parsed.reasoning ?? "";

              if (!sqlQuery || !sqlQuery.trim()) {
                lastError = "Empty SQL query generated";
                retryCount = attempt + 1;
                continue;
              }

              send("sql", { query: sqlQuery, reasoning, attempt });

              // Phase 3: Execute query
              send("status", { phase: "fetching", message: "Fetching data from Panopticon Warehouse..." });

              const { data: queryResult, error: queryErr } = await supabase.rpc(
                "execute_analytics_query",
                { p_sql: sqlQuery, p_workspace_id: organization_id }
              );

              if (queryErr) {
                lastError = queryErr.message;
                retryCount = attempt + 1;

                if (attempt < MAX_RETRIES) {
                  send("status", {
                    phase: "retrying",
                    message: `Query error — self-healing attempt ${attempt + 1}...`,
                    error: lastError,
                  });
                  continue;
                }

                send("error", {
                  message: "I couldn't format that query correctly. Could you rephrase the question?",
                  sql_error: lastError,
                  retry_count: retryCount,
                });
                controller.close();
                return;
              }

              const rows = (queryResult ?? []) as Record<string, unknown>[];

              send("data", { row_count: rows.length, preview: rows.slice(0, 5) });

              // Phase 4: Visualization agent
              send("status", { phase: "rendering", message: "Rendering visualizations..." });

              const truncatedData = rows.slice(0, 50);
              const vizPrompt = `Original question: "${question}"\n\nQuery returned ${rows.length} rows. Sample data:\n${JSON.stringify(truncatedData, null, 2)}\n\nColumn keys: ${Object.keys(rows[0] ?? {}).join(", ")}`;

              const vizResponse = await callOpenAI(VIZ_SYSTEM_PROMPT, vizPrompt, "gpt-4o-mini");
              const rendering = JSON.parse(vizResponse);

              const processingMs = Date.now() - startTime;

              // Save message to DB
              if (session_id) {
                await supabase.from("panopticon_chat_messages").insert({
                  session_id,
                  role: "assistant",
                  content: rendering.executive_summary ?? "",
                  sql_query: sqlQuery,
                  retry_count: retryCount,
                  data_result: rows.length <= 200 ? rows : rows.slice(0, 200),
                  row_count: rows.length,
                  rendering,
                  executive_summary: rendering.executive_summary,
                  processing_ms: processingMs,
                  model_used: "gpt-4o + gpt-4o-mini",
                });

                await supabase
                  .from("panopticon_chat_sessions")
                  .update({
                    message_count: (await supabase
                      .from("panopticon_chat_messages")
                      .select("id", { count: "exact" })
                      .eq("session_id", session_id)).count ?? 0,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", session_id);
              }

              // Final payload
              send("result", {
                data: rows,
                rendering,
                sql_query: sqlQuery,
                reasoning,
                row_count: rows.length,
                retry_count: retryCount,
                processing_ms: processingMs,
              });

              controller.close();
              return;
            }

            send("error", {
              message: "I couldn't format that query correctly after multiple attempts. Could you rephrase the question?",
              retry_count: retryCount,
            });
            controller.close();
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            send("error", { message: msg });
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming fallback
    const sqlResponse = await callOpenAI(SCHEMA_CONTEXT, question);
    const parsed = JSON.parse(sqlResponse);
    const sqlQuery = injectLimit(parsed.sql ?? "");

    const { data: queryResult, error: queryErr } = await supabase.rpc(
      "execute_analytics_query",
      { p_sql: sqlQuery, p_workspace_id: organization_id }
    );

    if (queryErr) {
      return new Response(
        JSON.stringify({ error: queryErr.message, sql_query: sqlQuery }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = (queryResult ?? []) as Record<string, unknown>[];
    const truncatedData = rows.slice(0, 50);
    const vizPrompt = `Original question: "${question}"\n\nQuery returned ${rows.length} rows. Sample data:\n${JSON.stringify(truncatedData, null, 2)}\n\nColumn keys: ${Object.keys(rows[0] ?? {}).join(", ")}`;
    const vizResponse = await callOpenAI(VIZ_SYSTEM_PROMPT, vizPrompt, "gpt-4o-mini");
    const rendering = JSON.parse(vizResponse);

    return new Response(
      JSON.stringify({
        data: rows,
        rendering,
        sql_query: sqlQuery,
        reasoning: parsed.reasoning,
        row_count: rows.length,
        processing_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
