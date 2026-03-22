/**
 * @module twilio-llm-negotiator
 * @status COMPLETE
 * @auth UNSECURED — Twilio webhook endpoint; no JWT guard
 * @description LLM-powered SMS negotiation pipeline using GPT-4o function calling for automated schedule mutations and client replies
 * @dependencies Supabase, OpenAI (GPT-4o), Twilio SMS
 * @lastAudit 2026-03-22
 */
// Edge Function: twilio-llm-negotiator
// Project Outrider-Autonomous — LLM-Powered SMS Client Negotiation
// Pipeline: Twilio SMS webhook → GPT-4o Function Calling → Schedule mutation → Auto-reply

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "execute_reschedule",
      description:
        "Call this when the client explicitly agrees to a new date/time. Parse their natural language into an ISO-8601 datetime.",
      parameters: {
        type: "object",
        properties: {
          new_iso_datetime: {
            type: "string",
            description: "The new appointment datetime in ISO-8601 format",
          },
          reply_message_to_client: {
            type: "string",
            description:
              "A polite, professional confirmation message to send to the client",
          },
        },
        required: ["new_iso_datetime", "reply_message_to_client"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "accept_delay",
      description:
        "Call this when the client agrees to wait for the delayed technician at the new ETA.",
      parameters: {
        type: "object",
        properties: {
          reply_message_to_client: {
            type: "string",
            description: "Polite acknowledgment message",
          },
          confirmed_eta: {
            type: "string",
            description: "The confirmed new ETA in ISO-8601 format",
          },
        },
        required: ["reply_message_to_client", "confirmed_eta"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalate_to_human",
      description:
        "Call this IMMEDIATELY if the client is angry, uses profanity, threatens to cancel, requests a refund, mentions a lawyer, or asks a complex question the AI cannot answer. NEVER attempt to resolve anger or cancellation requests.",
      parameters: {
        type: "object",
        properties: {
          sentiment_score: {
            type: "number",
            description:
              "Client sentiment: 0.0 = furious, 0.5 = neutral, 1.0 = happy",
          },
          reason_for_escalation: {
            type: "string",
            description: "Brief description of why human intervention is needed",
          },
          reply_message_to_client: {
            type: "string",
            description:
              "A calming, empathetic message before the human takes over",
          },
        },
        required: [
          "sentiment_score",
          "reason_for_escalation",
          "reply_message_to_client",
        ],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are a polite, professional dispatch assistant for a service company. You are negotiating a schedule change with a client via SMS after their technician experienced a delay.

CRITICAL RULES:
1. If the client agrees to the new delayed time, call accept_delay.
2. If the client proposes a different time (e.g., "tomorrow at 9am", "next Friday at 2pm"), call execute_reschedule with the correct ISO-8601 datetime. Today's date is provided in the context.
3. If the client is angry, uses profanity, ALL CAPS, mentions "cancel", "refund", "lawyer", "ridiculous", or expresses strong frustration, you MUST call escalate_to_human IMMEDIATELY. Do NOT try to calm them down or negotiate further.
4. Keep responses under 160 characters when possible (SMS length).
5. Be empathetic, professional, and concise. Never be defensive.
6. NEVER make up availability or promises about specific workers.`;

async function sendTwilioSms(to: string, body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: body,
    }).toString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    let clientPhone: string;
    let clientMessage: string;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      clientPhone = (formData.get("From") as string) ?? "";
      clientMessage = (formData.get("Body") as string) ?? "";
    } else {
      const body = await req.json();
      clientPhone = body.from ?? body.client_phone ?? "";
      clientMessage = body.message ?? body.body ?? "";
    }

    if (!clientPhone || !clientMessage) {
      return new Response(
        JSON.stringify({ error: "Missing phone or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find active negotiation for this phone number
    const { data: negotiation } = await supabase
      .from("autonomous_negotiations")
      .select("*")
      .eq("client_phone", clientPhone)
      .in("status", ["AWAITING_CLIENT", "NEGOTIATING"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!negotiation) {
      return new Response(
        JSON.stringify({ status: "NO_ACTIVE_NEGOTIATION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const neg = negotiation as Record<string, unknown>;
    const negotiationId = neg.id as string;
    const orgId = neg.organization_id as string;
    const anomalyId = neg.anomaly_id as string;
    const turnCount = (neg.turn_count as number) ?? 0;
    const maxTurns = (neg.max_turns as number) ?? 3;
    const conversationHistory = (neg.conversation_history as Record<string, unknown>[]) ?? [];
    const context = (neg.agent_context as Record<string, unknown>) ?? {};

    // Infinite loop prevention
    if (turnCount >= maxTurns) {
      const escalationMsg =
        "Thank you for your patience. I'm transferring you to our operations team who will contact you shortly to resolve this.";
      await sendTwilioSms(clientPhone, escalationMsg);

      await supabase.from("autonomous_negotiations").update({
        status: "FAILED_ESCALATED",
        escalation_reason: `Max turns (${maxTurns}) exceeded`,
        turn_count: turnCount + 1,
        conversation_history: [
          ...conversationHistory,
          { role: "user", content: clientMessage, timestamp: new Date().toISOString() },
          { role: "assistant", content: escalationMsg, timestamp: new Date().toISOString() },
        ],
        updated_at: new Date().toISOString(),
      }).eq("id", negotiationId);

      await logArbitrationEvent(supabase, orgId, anomalyId, "NEGOTIATION_EXHAUSTED",
        "warning", `SMS negotiation with ${neg.client_name} exhausted (${maxTurns} turns). Escalating to human.`,
        { job_id: neg.job_id as string });

      return new Response(
        JSON.stringify({ status: "ESCALATED", reason: "max_turns" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build conversation for LLM
    const today = new Date().toISOString().split("T")[0];
    const contextStr = `
Context:
- Today's date: ${today}
- Client name: ${neg.client_name}
- Original appointment: ${neg.original_datetime}
- Offered delayed ETA: ${context.offered_eta ?? "unknown"}
- Worker name: ${context.worker_name ?? "your technician"}
- Anomaly type: ${context.anomaly_type ?? "delay"}
- Delay duration: ${context.delay_minutes ?? "unknown"} minutes
- Company name: ${context.org_name ?? "our company"}
- Turn ${turnCount + 1} of ${maxTurns}`;

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT + "\n\n" + contextStr },
      ...conversationHistory.map((m) => ({
        role: (m.role as string) === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content as string,
      })),
      { role: "user" as const, content: clientMessage },
    ];

    // Call GPT-4o
    const llmRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        tools: TOOLS,
        tool_choice: "required",
        temperature: 0.1,
      }),
    });

    if (!llmRes.ok) {
      throw new Error(`OpenAI error: ${await llmRes.text()}`);
    }

    const llmData = await llmRes.json();
    const toolCalls = llmData.choices?.[0]?.message?.tool_calls ?? [];
    const firstCall = toolCalls[0];

    if (!firstCall) {
      throw new Error("LLM did not return a tool call");
    }

    const fnName = firstCall.function?.name;
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(firstCall.function?.arguments ?? "{}");
    } catch {
      args = {};
    }

    let replyMessage = "";
    let newStatus: string = "NEGOTIATING";
    let sentiment = 0.5;

    if (fnName === "execute_reschedule") {
      const newDatetime = args.new_iso_datetime as string;
      replyMessage = args.reply_message_to_client as string;

      // Execute the schedule mutation
      if (neg.job_id) {
        // Hyperion-Vanguard D-06: Fixed duration calculation.
        // Previously: original_start - original_start = 0 (always zero).
        // Now: Look up existing block to get actual duration, fallback to 1 hour.
        const { data: existingBlock } = await supabase
          .from("schedule_blocks")
          .select("start_time, end_time")
          .eq("job_id", neg.job_id as string)
          .eq("organization_id", orgId)
          .neq("status", "cancelled")
          .limit(1)
          .maybeSingle();

        const originalDuration = existingBlock?.start_time && existingBlock?.end_time
          ? new Date(existingBlock.end_time).getTime() - new Date(existingBlock.start_time).getTime()
          : 3600000; // default 1 hour

        await supabase
          .from("schedule_blocks")
          .update({
            start_time: newDatetime,
            end_time: new Date(
              new Date(newDatetime).getTime() + originalDuration
            ).toISOString(),
            metadata: {
              ai_rescheduled: true,
              rescheduled_from: neg.original_datetime,
              rescheduled_at: new Date().toISOString(),
              anomaly_id: anomalyId,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", neg.job_id as string)
          .eq("organization_id", orgId)
          .neq("status", "cancelled");
      }

      newStatus = "SUCCESSFULLY_MOVED";
      sentiment = 0.7;

      await logArbitrationEvent(supabase, orgId, anomalyId, "RESCHEDULE_SUCCESS",
        "success",
        `[SUCCESS] Job rescheduled to ${newDatetime} via client SMS negotiation with ${neg.client_name}.`,
        { job_id: neg.job_id as string });

    } else if (fnName === "accept_delay") {
      replyMessage = args.reply_message_to_client as string;
      newStatus = "SUCCESSFULLY_MOVED";
      sentiment = 0.8;

      await logArbitrationEvent(supabase, orgId, anomalyId, "DELAY_ACCEPTED",
        "success",
        `[SUCCESS] ${neg.client_name} accepted the delayed ETA for Job: ${neg.job_id}.`,
        { job_id: neg.job_id as string });

    } else if (fnName === "escalate_to_human") {
      replyMessage = args.reply_message_to_client as string;
      sentiment = (args.sentiment_score as number) ?? 0.1;
      newStatus = "FAILED_ESCALATED";

      await logArbitrationEvent(supabase, orgId, anomalyId, "SENTIMENT_ESCALATION",
        "error",
        `ALERT: Client ${neg.client_name} escalated to human. Reason: ${args.reason_for_escalation}. Sentiment: ${sentiment.toFixed(2)}.`,
        { job_id: neg.job_id as string, sentiment, reason: args.reason_for_escalation });
    }

    // Send reply SMS
    if (replyMessage) {
      await sendTwilioSms(clientPhone, replyMessage);
    }

    // Update negotiation record
    await supabase.from("autonomous_negotiations").update({
      status: newStatus,
      client_sentiment: sentiment,
      turn_count: turnCount + 1,
      accepted_datetime: fnName === "execute_reschedule" ? (args.new_iso_datetime as string) : null,
      escalation_reason: fnName === "escalate_to_human" ? (args.reason_for_escalation as string) : null,
      llm_model_used: "gpt-4o",
      conversation_history: [
        ...conversationHistory,
        { role: "user", content: clientMessage, timestamp: new Date().toISOString() },
        { role: "assistant", content: replyMessage, tool_call: fnName, timestamp: new Date().toISOString() },
      ],
      updated_at: new Date().toISOString(),
    }).eq("id", negotiationId);

    // Check if all negotiations for this anomaly are resolved
    if (newStatus === "SUCCESSFULLY_MOVED") {
      const { data: pendingNegs } = await supabase
        .from("autonomous_negotiations")
        .select("id")
        .eq("anomaly_id", anomalyId)
        .in("status", ["AWAITING_CLIENT", "NEGOTIATING", "SMS_DISPATCHED"]);

      if (!pendingNegs || pendingNegs.length === 0) {
        await supabase.from("fleet_anomalies").update({
          status: "RESOLVED",
          resolved_by: "AUTOPILOT_SMS",
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", anomalyId);

        await logArbitrationEvent(supabase, orgId, anomalyId, "ANOMALY_RESOLVED",
          "success", "All impacted jobs resolved. Anomaly closed by Autopilot.");
      }
    }

    return new Response(
      JSON.stringify({
        negotiation_id: negotiationId,
        action: fnName,
        status: newStatus,
        sentiment,
        turn: turnCount + 1,
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

async function logArbitrationEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string, anomalyId: string,
  eventType: string, severity: string, message: string,
  meta: Record<string, unknown> = {}
) {
  await supabase.from("arbitration_events").insert({
    organization_id: orgId,
    anomaly_id: anomalyId,
    event_type: eventType,
    severity,
    message,
    job_id: (meta.job_id as string) ?? null,
    worker_id: (meta.worker_id as string) ?? null,
    target_worker_id: (meta.target_worker_id as string) ?? null,
    metadata: meta,
  });
}
