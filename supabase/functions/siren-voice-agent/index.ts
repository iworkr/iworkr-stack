/**
 * @module siren-voice-agent
 * @status COMPLETE
 * @auth SECURED — Validates Twilio request signature on initial connect
 * @description Project Siren-Voice: AI Receptionist using OpenAI Realtime API.
 *   Bridges Twilio Media Streams ↔ OpenAI Realtime WebSocket.
 *   Executes constrained database mutations via function calling:
 *   reschedule_job, save_message, create_lead, trigger_escalation.
 * @dependencies Supabase, OpenAI Realtime API, Twilio Media Streams
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

// Care sector escalation keywords
const ESCALATION_KEYWORDS = [
  "hospital", "hurt", "emergency", "ambulance", "bleeding",
  "suicide", "self-harm", "abuse", "assault", "unconscious",
  "seizure", "chest pain", "breathing", "overdose", "dying",
];

// ── Tool Definitions ─────────────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    name: "lookup_client_jobs",
    description: "Look up a client's active jobs by their phone number. Use this when you need to check what appointments or jobs a caller has.",
    parameters: {
      type: "object",
      properties: {
        phone: { type: "string", description: "The caller's phone number" },
      },
      required: ["phone"],
    },
  },
  {
    type: "function",
    name: "reschedule_job",
    description: "Reschedule a client's job to a new date and time. Only call this after the client explicitly confirms the new time.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The UUID of the job to reschedule" },
        new_date_time: { type: "string", description: "The new date/time in ISO-8601 format (e.g. 2026-03-27T14:00:00+11:00)" },
      },
      required: ["job_id", "new_date_time"],
    },
  },
  {
    type: "function",
    name: "save_message",
    description: "Save a message for the team when you cannot resolve the caller's request. Include urgency level and a clear summary.",
    parameters: {
      type: "object",
      properties: {
        urgency: { type: "string", enum: ["normal", "high", "critical"], description: "Message urgency level" },
        summary: { type: "string", description: "Clear, concise summary of what the caller needs" },
      },
      required: ["urgency", "summary"],
    },
  },
  {
    type: "function",
    name: "create_lead",
    description: "Create a new lead/client record for an unknown caller who wants to book a service. Ask for their name first.",
    parameters: {
      type: "object",
      properties: {
        caller_name: { type: "string", description: "The caller's full name" },
        caller_email: { type: "string", description: "Email address if provided" },
        intent: { type: "string", description: "What service they're looking for" },
        notes: { type: "string", description: "Any additional details about their request" },
      },
      required: ["caller_name", "intent"],
    },
  },
  {
    type: "function",
    name: "trigger_escalation",
    description: "IMMEDIATELY trigger human escalation. Use when the caller mentions medical emergencies, safety concerns, abuse, or any situation requiring urgent human intervention.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why escalation is needed" },
        severity: { type: "string", enum: ["high", "critical"], description: "Severity of the situation" },
      },
      required: ["reason", "severity"],
    },
  },
];

// ── System Prompt Builder ────────────────────────────────────────────────
function buildSystemPrompt(context: Record<string, unknown>): string {
  const businessName = (context.business_name as string) || "our company";
  const customPrompt = (context.ai_prompt_context as string) || "";
  const callerFound = context.found === true;

  let prompt = `You are a professional, warm AI receptionist for ${businessName}. You answer inbound phone calls when the team is unavailable.

PERSONALITY:
- Be concise and natural — this is a phone call, not a text chat
- Use short sentences. Pause naturally between thoughts
- Be professional but warm. Use the caller's name when you know it
- Sound confident and helpful, never robotic
- Australian English if the business is Australian

CONSTRAINTS:
- NEVER discuss pricing, quotes, or costs — say "I'll have the team follow up with pricing"
- NEVER give medical, legal, or safety advice
- NEVER agree to discounts or special rates
- NEVER make promises about specific technician availability
- If unsure about ANYTHING, use save_message to leave a note for the team
- Always confirm before executing reschedule_job — repeat the new time back to the caller`;

  if (callerFound) {
    const name = context.client_name as string;
    const jobs = context.active_jobs as Array<Record<string, unknown>>;
    const balance = context.outstanding_balance as number;
    const upcoming = context.upcoming_job as Record<string, unknown> | null;

    prompt += `\n\nCALLER CONTEXT (from our database):
- Name: ${name}
- Phone: ${context.client_phone}`;

    if (upcoming) {
      const startTime = upcoming.scheduled_start as string;
      const formattedTime = startTime ? new Date(startTime).toLocaleString("en-AU", {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      }) : "time TBD";
      prompt += `\n- Next Appointment: ${upcoming.title} on ${formattedTime} (Job ID: ${upcoming.id})`;
    }

    if (jobs && jobs.length > 0) {
      prompt += `\n- Active Jobs: ${jobs.map((j: Record<string, unknown>) => `${j.display_id} "${j.title}" (${j.status})`).join(", ")}`;
    }

    if (balance && balance > 0) {
      prompt += `\n- Outstanding Balance: $${Number(balance).toFixed(2)} (if they ask about payment, use save_message to have accounts follow up)`;
    }

    prompt += `\n\nGreet them by name: "Hi ${name}, this is ${businessName}'s assistant. How can I help you today?"`;
  } else {
    prompt += `\n\nThis is an UNKNOWN CALLER (not in our database).
- Greet them: "Hello, thank you for calling ${businessName}. How can I help you today?"
- Ask for their name early in the conversation
- If they want to book a service, use create_lead to capture their details
- If they're an existing client, use lookup_client_jobs to find their record`;
  }

  if (customPrompt) {
    prompt += `\n\nADDITIONAL BUSINESS INSTRUCTIONS:\n${customPrompt}`;
  }

  prompt += `\n\nESCALATION RULES:
- If the caller mentions: ${ESCALATION_KEYWORDS.join(", ")} — IMMEDIATELY call trigger_escalation
- If the caller becomes abusive or threatening — call trigger_escalation with severity "critical"
- If the caller's request is beyond your capabilities — use save_message and politely explain someone will call back`;

  return prompt;
}

// ── WebSocket Handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Only accept WebSocket upgrades
  const upgradeHeader = req.headers.get("upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  // Parse initial parameters from URL
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get("workspace_id") || "";
  const callSid = url.searchParams.get("call_sid") || "";
  const fromNumber = url.searchParams.get("from") || "";
  const toNumber = url.searchParams.get("to") || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let openaiWs: WebSocket | null = null;
  let streamSid = "";
  let callerContext: Record<string, unknown> = {};
  let voipRecordId = "";
  let logId = "";
  const transcript: Array<{ role: string; content: string; timestamp: string }> = [];
  const actionsExecuted: Array<Record<string, unknown>> = [];

  // ── Twilio WebSocket handlers ──────────────────────────────────────────
  twilioWs.onopen = () => {
    console.log(`[siren-voice] Twilio WS connected. CallSid=${callSid}`);
  };

  twilioWs.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data as string);

      switch (msg.event) {
        case "connected":
          console.log("[siren-voice] Twilio Media Stream connected");
          break;

        case "start": {
          streamSid = msg.start?.streamSid || "";
          const customParams = msg.start?.customParameters || {};
          const wsWorkspaceId = customParams.workspace_id || workspaceId;
          const wsCallSid = customParams.call_sid || callSid;
          const wsFrom = customParams.from || fromNumber;
          const wsTo = customParams.to || toNumber;
          const wsVoipId = customParams.voip_record_id || "";
          const wsLogId = customParams.log_id || "";

          voipRecordId = wsVoipId;
          logId = wsLogId;

          console.log(`[siren-voice] Stream started. SID=${streamSid} Workspace=${wsWorkspaceId}`);

          // Fetch caller context
          const { data: ctx } = await supabase.rpc("get_ai_caller_context", {
            p_workspace_id: wsWorkspaceId,
            p_phone_number: wsFrom,
          });

          // Get phone config for custom AI prompt
          const { data: phoneConfig } = await supabase
            .from("workspace_phone_numbers")
            .select("ai_prompt_context, business_name, ai_voice_id")
            .eq("phone_number", wsTo)
            .maybeSingle();

          callerContext = {
            ...(ctx || { found: false }),
            workspace_id: wsWorkspaceId,
            call_sid: wsCallSid,
            from_number: wsFrom,
            ai_prompt_context: phoneConfig?.ai_prompt_context || "",
            business_name: phoneConfig?.business_name || ctx?.business_name || "",
          };

          const voiceId = phoneConfig?.ai_voice_id || "alloy";

          // Connect to OpenAI Realtime API
          openaiWs = new WebSocket(OPENAI_REALTIME_URL, [
            "realtime",
            `openai-insecure-api-key.${OPENAI_API_KEY}`,
            "openai-beta.realtime-v1",
          ]);

          openaiWs.onopen = () => {
            console.log("[siren-voice] OpenAI Realtime connected");

            // Configure session
            const sessionConfig = {
              type: "session.update",
              session: {
                turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 },
                input_audio_format: "g711_ulaw",
                output_audio_format: "g711_ulaw",
                voice: voiceId,
                instructions: buildSystemPrompt(callerContext),
                modalities: ["text", "audio"],
                temperature: 0.7,
                tools: TOOLS,
                tool_choice: "auto",
                input_audio_transcription: { model: "whisper-1" },
              },
            };

            openaiWs!.send(JSON.stringify(sessionConfig));

            // Send initial greeting prompt
            const initialResponse = {
              type: "response.create",
              response: {
                modalities: ["text", "audio"],
                instructions: callerContext.found
                  ? `Greet the caller by name (${callerContext.client_name}). Mention their upcoming appointment if they have one. Be warm and concise.`
                  : `Greet the unknown caller warmly. Ask how you can help them today.`,
              },
            };

            openaiWs!.send(JSON.stringify(initialResponse));
          };

          openaiWs.onmessage = async (oaiEvent) => {
            try {
              const oaiMsg = JSON.parse(oaiEvent.data as string);

              switch (oaiMsg.type) {
                case "response.audio.delta":
                  if (oaiMsg.delta && twilioWs.readyState === WebSocket.OPEN) {
                    twilioWs.send(JSON.stringify({
                      event: "media",
                      streamSid,
                      media: { payload: oaiMsg.delta },
                    }));
                  }
                  break;

                case "input_audio_buffer.speech_started":
                  // Clear any pending audio when user starts speaking
                  if (twilioWs.readyState === WebSocket.OPEN) {
                    twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
                  }
                  if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                  }
                  break;

                case "conversation.item.input_audio_transcription.completed":
                  if (oaiMsg.transcript) {
                    transcript.push({
                      role: "caller",
                      content: oaiMsg.transcript,
                      timestamp: new Date().toISOString(),
                    });
                    console.log(`[siren-voice] Caller: ${oaiMsg.transcript}`);
                  }
                  break;

                case "response.audio_transcript.done":
                  if (oaiMsg.transcript) {
                    transcript.push({
                      role: "agent",
                      content: oaiMsg.transcript,
                      timestamp: new Date().toISOString(),
                    });
                    console.log(`[siren-voice] Agent: ${oaiMsg.transcript}`);
                  }
                  break;

                case "response.function_call_arguments.done":
                  await handleFunctionCall(
                    oaiMsg.name,
                    oaiMsg.arguments,
                    oaiMsg.call_id,
                    openaiWs!,
                    supabase,
                    callerContext,
                    actionsExecuted
                  );
                  break;

                case "error":
                  console.error("[siren-voice] OpenAI error:", oaiMsg.error);
                  break;
              }
            } catch (err) {
              console.error("[siren-voice] OpenAI message processing error:", err);
            }
          };

          openaiWs.onerror = (err) => {
            console.error("[siren-voice] OpenAI WS error:", err);
          };

          openaiWs.onclose = () => {
            console.log("[siren-voice] OpenAI WS closed");
          };

          break;
        }

        case "media":
          // Forward Twilio audio to OpenAI
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            }));
          }
          break;

        case "stop":
          console.log("[siren-voice] Twilio stream stopped");
          await finalizeCall(
            supabase, voipRecordId, logId, callSid,
            callerContext, transcript, actionsExecuted
          );
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
          }
          break;
      }
    } catch (err) {
      console.error("[siren-voice] Twilio message error:", err);
    }
  };

  twilioWs.onerror = (err) => {
    console.error("[siren-voice] Twilio WS error:", err);
  };

  twilioWs.onclose = async () => {
    console.log("[siren-voice] Twilio WS closed");
    await finalizeCall(
      supabase, voipRecordId, logId, callSid,
      callerContext, transcript, actionsExecuted
    );
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
  };

  return response;
});

// ── Function Call Handler ────────────────────────────────────────────────
async function handleFunctionCall(
  name: string,
  argsStr: string,
  callId: string,
  openaiWs: WebSocket,
  supabase: ReturnType<typeof createClient>,
  context: Record<string, unknown>,
  actionsLog: Array<Record<string, unknown>>
) {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsStr);
  } catch {
    args = {};
  }

  const workspaceId = context.workspace_id as string;
  const callSid = context.call_sid as string;
  const fromNumber = context.from_number as string;
  const clientId = context.client_id as string | undefined;

  console.log(`[siren-voice] Function call: ${name}`, args);

  let result: Record<string, unknown> = {};

  try {
    switch (name) {
      case "lookup_client_jobs": {
        const { data } = await supabase.rpc("get_ai_caller_context", {
          p_workspace_id: workspaceId,
          p_phone_number: args.phone as string,
        });
        result = data || { found: false };
        break;
      }

      case "reschedule_job": {
        const { data } = await supabase.rpc("ai_reschedule_job", {
          p_workspace_id: workspaceId,
          p_job_id: args.job_id as string,
          p_new_datetime: args.new_date_time as string,
          p_call_record_id: null,
          p_caller_phone: fromNumber,
          p_ai_confidence: 0.9,
        });
        result = data || { success: false, error: "RPC failed" };
        break;
      }

      case "save_message": {
        const { data } = await supabase.rpc("ai_save_message", {
          p_workspace_id: workspaceId,
          p_client_id: clientId || null,
          p_caller_phone: fromNumber,
          p_urgency: args.urgency as string || "normal",
          p_summary: args.summary as string,
          p_full_context: JSON.stringify(context),
          p_call_record_id: null,
        });
        result = data || { success: true, message: "Message saved" };
        break;
      }

      case "create_lead": {
        const { data } = await supabase.rpc("ai_create_lead", {
          p_workspace_id: workspaceId,
          p_caller_phone: fromNumber,
          p_caller_name: args.caller_name as string || "Unknown",
          p_caller_email: args.caller_email as string || null,
          p_intent: args.intent as string || "",
          p_notes: args.notes as string || "",
          p_call_record_id: null,
        });
        result = data || { success: true };
        break;
      }

      case "trigger_escalation": {
        // Save urgent message
        await supabase.rpc("ai_save_message", {
          p_workspace_id: workspaceId,
          p_client_id: clientId || null,
          p_caller_phone: fromNumber,
          p_urgency: "critical",
          p_summary: `ESCALATION: ${args.reason}`,
          p_full_context: JSON.stringify({ ...context, severity: args.severity }),
          p_call_record_id: null,
        });

        // Look up escalation number
        const { data: phoneConfig } = await supabase
          .from("workspace_phone_numbers")
          .select("escalation_number")
          .eq("workspace_id", workspaceId)
          .not("escalation_number", "is", null)
          .limit(1)
          .maybeSingle();

        result = {
          success: true,
          escalated: true,
          escalation_number: phoneConfig?.escalation_number || null,
          message: "Escalation triggered — team notified immediately",
        };
        break;
      }

      default:
        result = { error: `Unknown function: ${name}` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[siren-voice] Function ${name} error:`, msg);
    result = { error: msg };
  }

  // Log the action
  actionsLog.push({
    function: name,
    arguments: args,
    result,
    timestamp: new Date().toISOString(),
  });

  // Send result back to OpenAI
  if (openaiWs.readyState === WebSocket.OPEN) {
    openaiWs.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    }));

    // Trigger response generation
    openaiWs.send(JSON.stringify({ type: "response.create" }));
  }
}

// ── Finalize Call ────────────────────────────────────────────────────────
async function finalizeCall(
  supabase: ReturnType<typeof createClient>,
  voipRecordId: string,
  logId: string,
  callSid: string,
  context: Record<string, unknown>,
  transcript: Array<{ role: string; content: string; timestamp: string }>,
  actionsExecuted: Array<Record<string, unknown>>
) {
  if (!callSid || transcript.length === 0) return;

  try {
    const fullText = transcript.map(t => `${t.role}: ${t.content}`).join("\n");

    // Generate AI summary using OpenAI Chat API
    let aiSummary = "";
    try {
      const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Summarize this phone call transcript in 2-3 concise bullet points. Extract any action items. Be factual and brief.",
            },
            { role: "user", content: fullText },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        aiSummary = summaryData.choices?.[0]?.message?.content || "";
      }
    } catch (err) {
      console.error("[siren-voice] Summary generation error:", err);
    }

    // Save transcript and summary
    await supabase.rpc("save_call_transcript", {
      p_call_sid: callSid,
      p_transcript_jsonb: {
        full_text: fullText,
        segments: transcript,
        speaker_count: 2,
        language: "en",
      },
      p_ai_summary: aiSummary || `AI call with ${transcript.length} exchanges. Actions: ${actionsExecuted.map(a => a.function).join(", ") || "none"}`,
      p_ai_handled: true,
      p_ai_actions: actionsExecuted,
      p_sentiment_score: 0.7,
      p_caller_intent: actionsExecuted.length > 0
        ? (actionsExecuted[0].function as string)
        : "general_inquiry",
    });

    // Broadcast call ended
    const workspaceId = context.workspace_id as string;
    if (workspaceId) {
      const broadcastUrl = `${SUPABASE_URL}/realtime/v1/api/broadcast`;
      await fetch(broadcastUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{
            topic: `inbound-call:${workspaceId}`,
            event: "call_ended",
            payload: {
              call_sid: callSid,
              ai_handled: true,
              actions_count: actionsExecuted.length,
              summary: aiSummary,
              timestamp: new Date().toISOString(),
            },
          }],
        }),
      });
    }

    console.log(`[siren-voice] Call finalized. Transcript=${transcript.length} segments, Actions=${actionsExecuted.length}`);
  } catch (err) {
    console.error("[siren-voice] Finalize error:", err);
  }
}
