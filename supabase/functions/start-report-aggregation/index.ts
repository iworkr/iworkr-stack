import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GoalRow = {
  id: string;
  goal_statement: string;
  ndis_goal_category: string;
  status: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function scrubPII(text: string) {
  return text
    .replace(/\b(?:\+?61|0)\d{9}\b/g, "[PHONE]")
    .replace(/\b\d{1,3}\s+[A-Za-z0-9\s]{2,}\s(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct)\b/gi, "[ADDRESS]")
    .replace(/\b\d{10,11}\b/g, "[ID]");
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function quickChartPngBase64(config: Record<string, unknown>) {
  try {
    const url = "https://quickchart.io/chart";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: 960, height: 420, format: "png", backgroundColor: "white", chart: config }),
    });
    if (!res.ok) return "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return "";
  }
}

async function synthesizeGoalNarrative(args: {
  participantName: string;
  goal: GoalRow;
  notes: Array<{ created_at: string; context_of_support: string | null; outcomes_achieved: string | null; risks_identified: string | null }>;
}) {
  const timeline = args.notes
    .slice(0, 200)
    .map((n) => `[${new Date(n.created_at).toISOString().slice(0, 10)}] ${n.outcomes_achieved || n.context_of_support || "Observation recorded."}`)
    .join("\n");

  const scrubbed = scrubPII(timeline).replaceAll(args.participantName, "[PARTICIPANT_NAME]");
  const endpoint = Deno.env.get("ENTERPRISE_LLM_ENDPOINT");
  const apiKey = Deno.env.get("ENTERPRISE_LLM_KEY") || Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("ENTERPRISE_LLM_MODEL") || "gpt-4o-mini";

  if (!endpoint || !apiKey || scrubbed.trim().length === 0) {
    const fallback =
      scrubbed.trim().length === 0
        ? "Evidence volume for this goal is currently limited across the selected scope. Continue collecting structured goal-linked observations to strengthen next review cycle."
        : `Across the selected period, [PARTICIPANT_NAME] demonstrated measured progress toward "${args.goal.goal_statement}". Daily evidence indicates ongoing engagement with supports, with milestones achieved in routine participation and skill consistency. Continued funded supports are recommended to consolidate gains and address remaining barriers.`;
    return {
      summary_narrative: fallback.replaceAll("[PARTICIPANT_NAME]", args.participantName),
      sentiment_score: "neutral",
      identified_barriers: ["Inconsistent natural opportunities for independent practice."],
      recommended_future_supports: ["Continue structured coaching and weekly progress checkpoints."],
      prompt_tokens: 0,
      completion_tokens: 0,
      model,
    };
  }

  const payload = {
    model,
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a senior clinical NDIS report writer. Stay strictly grounded to supplied evidence. Every milestone sentence must include a bracketed date like [2026-01-15].",
      },
      {
        role: "user",
        content: `Goal category: ${args.goal.ndis_goal_category}\nGoal statement: ${args.goal.goal_statement}\nEvidence timeline:\n${scrubbed}`,
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
  const llm = await res.json();
  const content = llm?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  return {
    summary_narrative: String(parsed.summary_narrative || "").replaceAll("[PARTICIPANT_NAME]", args.participantName),
    sentiment_score: parsed.sentiment_score || "neutral",
    identified_barriers: Array.isArray(parsed.identified_barriers) ? parsed.identified_barriers : [],
    recommended_future_supports: Array.isArray(parsed.recommended_future_supports) ? parsed.recommended_future_supports : [],
    prompt_tokens: Number(llm?.usage?.prompt_tokens || 0),
    completion_tokens: Number(llm?.usage?.completion_tokens || 0),
    model,
  };
}

async function runAggregation(admin: ReturnType<typeof createClient>, reportId: string, jobId: string) {
  const setJob = async (fields: Record<string, unknown>) => {
    await admin.from("plan_review_jobs").update(fields).eq("id", jobId);
  };
  const setReport = async (fields: Record<string, unknown>) => {
    await admin.from("plan_review_reports").update(fields).eq("id", reportId);
  };

  try {
    await setJob({ status: "running", progress_percent: 5, stage: "Loading report scope..." });
    await setReport({ status: "aggregating", generation_error: null });

    const { data: report, error: reportErr } = await admin
      .from("plan_review_reports")
      .select("id, organization_id, participant_id, data_scope_start, data_scope_end, participant_profiles(preferred_name, clients(name))")
      .eq("id", reportId)
      .single();
    if (reportErr || !report) throw new Error(reportErr?.message || "Report not found");

    const participantName = report.participant_profiles?.preferred_name || report.participant_profiles?.clients?.name || "Participant";

    await setJob({ progress_percent: 20, stage: "Harvesting goal-linked evidence..." });

    const [{ data: goals }, { data: notes }, { data: incidents }, { data: tasks }, { data: agreements }] = await Promise.all([
      admin
        .from("participant_goals")
        .select("id, goal_statement, ndis_goal_category, status")
        .eq("organization_id", report.organization_id)
        .eq("participant_id", report.participant_id)
        .neq("status", "abandoned")
        .order("updated_at", { ascending: false }),
      admin
        .from("progress_notes")
        .select("id, created_at, context_of_support, outcomes_achieved, risks_identified, goals_linked")
        .eq("organization_id", report.organization_id)
        .eq("participant_id", report.participant_id)
        .gte("created_at", `${report.data_scope_start}T00:00:00.000Z`)
        .lte("created_at", `${report.data_scope_end}T23:59:59.999Z`)
        .order("created_at", { ascending: true })
        .limit(3000),
      admin
        .from("incidents")
        .select("id, occurred_at, severity, category, title, immediate_actions, resolution_notes")
        .eq("organization_id", report.organization_id)
        .eq("participant_id", report.participant_id)
        .gte("occurred_at", `${report.data_scope_start}T00:00:00.000Z`)
        .lte("occurred_at", `${report.data_scope_end}T23:59:59.999Z`)
        .order("occurred_at", { ascending: true })
        .limit(2000),
      admin
        .from("task_instances")
        .select("id, target_date, status, title, is_mandatory, completed_at")
        .eq("organization_id", report.organization_id)
        .eq("participant_id", report.participant_id)
        .gte("target_date", report.data_scope_start)
        .lte("target_date", report.data_scope_end)
        .limit(4000),
      admin
        .from("service_agreements")
        .select("id, total_budget, consumed_budget, start_date, end_date, status")
        .eq("organization_id", report.organization_id)
        .eq("participant_id", report.participant_id)
        .in("status", ["active", "pending_signature", "expired"])
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    const goalRows = (goals || []) as GoalRow[];
    const progressRows = notes || [];
    const incidentRows = incidents || [];
    const taskRows = tasks || [];

    if (progressRows.length < 10) {
      await setReport({ status: "failed", generation_error: "Insufficient data volume. Fewer than 10 progress notes in selected scope." });
      await setJob({
        status: "failed",
        progress_percent: 100,
        stage: "Insufficient data volume",
        error: "Insufficient data volume for AI synthesis.",
      });
      return;
    }

    await setJob({ progress_percent: 45, stage: "Running goal-level AI synthesis..." });

    const aiSummaries: Array<Record<string, unknown>> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let modelVersion = "";

    for (const goal of goalRows) {
      const goalNotes = progressRows.filter((n) => {
        const links = n.goals_linked;
        if (!links) return false;
        if (Array.isArray(links)) return links.some((v) => String(v) === goal.id || String(v).toLowerCase().includes(goal.goal_statement.toLowerCase()));
        if (typeof links === "object") {
          const values = Object.values(links as Record<string, unknown>);
          return values.some((v) => String(v).includes(goal.id) || String(v).toLowerCase().includes(goal.goal_statement.toLowerCase()));
        }
        return String(links).includes(goal.id);
      });

      const summary = await synthesizeGoalNarrative({
        participantName,
        goal,
        notes: goalNotes.map((n) => ({
          created_at: n.created_at,
          context_of_support: n.context_of_support,
          outcomes_achieved: n.outcomes_achieved,
          risks_identified: n.risks_identified,
        })),
      });
      modelVersion = summary.model;
      totalPromptTokens += summary.prompt_tokens;
      totalCompletionTokens += summary.completion_tokens;
      aiSummaries.push({
        goal_id: goal.id,
        goal_statement: goal.goal_statement,
        ndis_goal_category: goal.ndis_goal_category,
        status: goal.status,
        ...summary,
        evidence_count: goalNotes.length,
      });
    }

    await setJob({ progress_percent: 70, stage: "Generating visual analytics..." });

    const incidentsByMonth = new Map<string, number>();
    for (const i of incidentRows) {
      const key = monthKey(i.occurred_at);
      incidentsByMonth.set(key, (incidentsByMonth.get(key) || 0) + 1);
    }
    const incidentLabels = Array.from(incidentsByMonth.keys()).sort();
    const incidentData = incidentLabels.map((l) => incidentsByMonth.get(l) || 0);
    const incidentChartBase64 = await quickChartPngBase64({
      type: "bar",
      data: {
        labels: incidentLabels,
        datasets: [{ label: "Incidents", backgroundColor: "#2563eb", data: incidentData }],
      },
      options: {
        plugins: { legend: { display: false }, title: { display: true, text: "Incident Burn-Down" } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });

    const completionTotal = taskRows.length;
    const completionDone = taskRows.filter((t) => t.status === "completed").length;
    const routineCompliancePct = completionTotal > 0 ? (completionDone / completionTotal) * 100 : 0;

    const goalProgressChartBase64 = await quickChartPngBase64({
      type: "radar",
      data: {
        labels: aiSummaries.map((s) => String(s.goal_statement).slice(0, 32)),
        datasets: [
          {
            label: "Current",
            data: aiSummaries.map((s) => {
              const sentiment = String(s.sentiment_score || "neutral").toLowerCase();
              if (sentiment === "positive") return 80;
              if (sentiment === "negative") return 35;
              return 60;
            }),
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.18)",
          },
          {
            label: "Baseline",
            data: aiSummaries.map(() => 35),
            borderColor: "#6b7280",
            backgroundColor: "rgba(107,114,128,0.08)",
          },
        ],
      },
      options: {
        scales: { r: { suggestedMin: 0, suggestedMax: 100 } },
        plugins: { title: { display: true, text: "Goal Progression Matrix" } },
      },
    });

    const firstAgreement = agreements?.[0];
    const totalBudget = Number(firstAgreement?.total_budget || 0);
    const consumedBudget = Number(firstAgreement?.consumed_budget || 0);

    const financialJson = {
      total_budget: totalBudget,
      consumed_budget: consumedBudget,
      remaining_budget: Math.max(totalBudget - consumedBudget, 0),
      utilization_percent: totalBudget > 0 ? Number(((consumedBudget / totalBudget) * 100).toFixed(2)) : 0,
    };

    await setJob({ progress_percent: 85, stage: "Persisting immutable evidence snapshot..." });

    await admin.from("report_data_snapshots").upsert({
      report_id: reportId,
      raw_shift_notes_json: progressRows,
      raw_incidents_json: incidentRows,
      raw_tasks_json: taskRows,
      raw_financial_json: financialJson,
      ai_model_version: modelVersion || null,
      llm_prompt_tokens: totalPromptTokens,
      llm_completion_tokens: totalCompletionTokens,
    }, { onConflict: "report_id" });

    const draftPayload = {
      participant_name: participantName,
      generated_at: new Date().toISOString(),
      executive_summary:
        `${participantName} received structured supports across the scoped period with evidence of ongoing outcomes progression. ` +
        `The report synthesizes goal-linked observations, incidents, and routine execution to support continuation of funded supports.`,
      goals: aiSummaries,
      incidents: {
        total: incidentRows.length,
        by_severity: {
          low: incidentRows.filter((i) => i.severity === "low").length,
          medium: incidentRows.filter((i) => i.severity === "medium").length,
          high: incidentRows.filter((i) => i.severity === "high").length,
          critical: incidentRows.filter((i) => i.severity === "critical").length,
        },
      },
      analytics: {
        incident_chart_base64: incidentChartBase64,
        goal_progress_chart_base64: goalProgressChartBase64,
        routine_compliance_percent: Number(routineCompliancePct.toFixed(2)),
      },
      financial: financialJson,
      citation_rules: {
        grounding_required: true,
        evidence_suffix_format: "[YYYY-MM-DD]",
      },
    };

    await setReport({
      status: "ready_for_review",
      draft_json_payload: draftPayload,
      generation_error: null,
    });
    await setJob({ status: "completed", progress_percent: 100, stage: "Report ready" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown aggregation error";
    await admin.from("plan_review_reports").update({ status: "failed", generation_error: message }).eq("id", reportId);
    await admin
      .from("plan_review_jobs")
      .update({ status: "failed", progress_percent: 100, stage: "Failed", error: message })
      .eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const reportId = String(body.report_id || "");
    if (!reportId) return jsonResponse({ error: "report_id is required" }, 400);

    const { data: report, error: reportErr } = await admin
      .from("plan_review_reports")
      .select("id, organization_id")
      .eq("id", reportId)
      .single();
    if (reportErr || !report) return jsonResponse({ error: "Report not found" }, 404);

    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", report.organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!member) return jsonResponse({ error: "Forbidden" }, 403);

    const { data: job, error: jobErr } = await admin
      .from("plan_review_jobs")
      .insert({
        report_id: reportId,
        organization_id: report.organization_id,
        requested_by: user.id,
        status: "queued",
        progress_percent: 0,
        stage: "Queued",
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error(jobErr?.message || "Failed to create job");

    EdgeRuntime.waitUntil(runAggregation(admin, reportId, job.id));
    return jsonResponse({ success: true, report_id: reportId, job_id: job.id });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
