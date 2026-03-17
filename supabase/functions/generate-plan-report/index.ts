// Deno Edge Function: generate-plan-report
// Aggregates NDIS goal data and returns a structured JSON payload for PDF rendering
// PDF is rendered client-side via @react-pdf/renderer using this payload

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

    const body = await req.json();
    const { organization_id, participant_id, from_date, to_date } = body;

    if (!organization_id || !participant_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: CORS });
    }

    const fromDate = from_date ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const toDate = to_date ?? new Date().toISOString().split("T")[0];

    // Get all report data via RPC
    const { data: reportData, error: rpcError } = await supabase.rpc("get_plan_report_data", {
      p_organization_id: organization_id,
      p_participant_id: participant_id,
      p_from_date: fromDate,
      p_to_date: toDate,
    });

    if (rpcError) throw new Error(rpcError.message);

    // Optionally enrich with OpenAI synthesis (if API key present)
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    let enrichedGoals = reportData?.goals ?? [];

    if (openAiKey && enrichedGoals.length > 0) {
      enrichedGoals = await Promise.all(
        enrichedGoals.map(async (goal: any) => {
          const evidenceTexts = (goal.evidence ?? [])
            .filter((e: any) => e.observation)
            .slice(0, 30)
            .map((e: any) => `[${e.rating}] ${e.observation}`)
            .join("\n");

          if (!evidenceTexts || goal.stats?.total < 3) return goal;

          try {
            const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                max_tokens: 300,
                messages: [
                  {
                    role: "system",
                    content:
                      "You are an NDIS Allied Health professional writing clinical progress summaries. Be concise, evidence-based, and professional. Write exactly 3-4 sentences.",
                  },
                  {
                    role: "user",
                    content: `Summarize the participant's progress toward the goal "${goal.title}" based on the following worker observations:\n\n${evidenceTexts}`,
                  },
                ],
              }),
            });
            const aiJson = await aiRes.json();
            return {
              ...goal,
              ai_synthesis: aiJson.choices?.[0]?.message?.content ?? null,
            };
          } catch {
            return goal;
          }
        })
      );
    }

    const payload = {
      ...reportData,
      goals: enrichedGoals,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ ok: true, data: payload }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
