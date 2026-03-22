/**
 * @module get-participant-timeline
 * @status COMPLETE
 * @auth SECURED — Authorization header + auth.getUser() verified
 * @description Returns a merged, chronologically-sorted timeline of progress notes, medication records, and health observations for a participant
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://app.iworkr.com", "https://staging.iworkr.app"];

function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : (Deno.env.get("APP_URL") || ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface TimelineEvent {
  id: string;
  event_type: "note" | "medication" | "observation";
  created_at: string;
  summary: string;
  author_name: string | null;
  metadata: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const participantId = body?.participant_id as string | undefined;
    const limit = Math.min(Number(body?.limit) || 50, 200);
    const filterType = body?.filter as string | undefined; // 'note', 'medication', 'observation', 'prn'

    if (!participantId) {
      return new Response(
        JSON.stringify({ error: "participant_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const timeline: TimelineEvent[] = [];

    // ── 1. Progress / Shift Notes ──────────────────────────────
    if (!filterType || filterType === "note") {
      const { data: notes } = await supabase
        .from("progress_notes")
        .select(
          "id, created_at, content, worker_id, profiles!progress_notes_worker_id_fkey(full_name)",
        )
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      for (const n of notes ?? []) {
        const profile = n.profiles as Record<string, unknown> | null;
        timeline.push({
          id: n.id,
          event_type: "note",
          created_at: n.created_at,
          summary: (n.content as string)?.substring(0, 280) ?? "",
          author_name: (profile?.full_name as string) ?? null,
          metadata: {},
        });
      }
    }

    // ── 2. Medication Administration Records ───────────────────
    if (!filterType || filterType === "medication" || filterType === "prn") {
      let medsQuery = supabase
        .from("medication_administration_records")
        .select(
          "id, administered_at, medication_name, status, is_prn, notes, worker_id, profiles!medication_administration_records_worker_id_fkey(full_name)",
        )
        .eq("participant_id", participantId)
        .order("administered_at", { ascending: false })
        .limit(limit);

      if (filterType === "prn") {
        medsQuery = medsQuery.eq("is_prn", true);
      }

      const { data: meds } = await medsQuery;

      for (const m of meds ?? []) {
        const profile = m.profiles as Record<string, unknown> | null;
        timeline.push({
          id: m.id,
          event_type: "medication",
          created_at: m.administered_at ?? m.id, // fallback
          summary: `${m.medication_name ?? "Unknown"} — ${m.status ?? "recorded"}`,
          author_name: (profile?.full_name as string) ?? null,
          metadata: {
            medication_name: m.medication_name,
            status: m.status,
            is_prn: m.is_prn ?? false,
            notes: m.notes,
          },
        });
      }
    }

    // ── 3. Health Observations ─────────────────────────────────
    if (!filterType || filterType === "observation") {
      const { data: obs } = await supabase
        .from("health_observations")
        .select(
          "id, recorded_at, observation_type, notes, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, blood_glucose, weight, pain_level, mood, worker_id, profiles!health_observations_worker_id_fkey(full_name)",
        )
        .eq("participant_id", participantId)
        .order("recorded_at", { ascending: false })
        .limit(limit);

      for (const o of obs ?? []) {
        const profile = o.profiles as Record<string, unknown> | null;
        const parts: string[] = [];
        if (o.observation_type) parts.push(o.observation_type);
        if (o.blood_pressure_systolic)
          parts.push(
            `BP: ${o.blood_pressure_systolic}/${o.blood_pressure_diastolic}`,
          );
        if (o.heart_rate) parts.push(`HR: ${o.heart_rate}`);
        if (o.temperature) parts.push(`Temp: ${o.temperature}°C`);
        if (o.blood_glucose) parts.push(`BGL: ${o.blood_glucose}`);
        if (o.pain_level) parts.push(`Pain: ${o.pain_level}/10`);
        if (o.mood) parts.push(`Mood: ${o.mood}`);
        if (o.weight) parts.push(`Weight: ${o.weight}kg`);

        timeline.push({
          id: o.id,
          event_type: "observation",
          created_at: o.recorded_at ?? o.id,
          summary: parts.join(" · ") || o.notes?.substring(0, 200) || "Observation logged",
          author_name: (profile?.full_name as string) ?? null,
          metadata: {
            observation_type: o.observation_type,
            notes: o.notes,
          },
        });
      }
    }

    // ── 4. Sort chronologically (most recent first) ────────────
    timeline.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const result = timeline.slice(0, limit);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
