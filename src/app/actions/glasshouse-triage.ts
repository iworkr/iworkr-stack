/**
 * @module GlasshouseTriage Server Actions
 * @status COMPLETE
 * @description Public booking widget — triage forms, appointment scheduling, availability checks, and booking confirmation
 * @exports createBookingAction, fetchAvailableSlotsAction, updateBookingAction, cancelBookingAction, fetchTriageConfigAction
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
// Glasshouse-Triage — Public Booking Widget System
// ═══════════════════════════════════════════════════════════════

// ── Helper ───────────────────────────────────────────────────

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

// ── Types ────────────────────────────────────────────────────

export type BookingWidget = {
  id: string;
  workspace_id: string;
  name: string;
  is_active: boolean;
  allowed_domains: string[];
  embed_script_token: string;
  branding_config: {
    primary_color: string;
    mode: string;
    logo_url: string | null;
    company_name: string | null;
    welcome_message: string;
  };
  call_out_fee_amount: number;
  scheduling_horizon_days: number;
  minimum_buffer_minutes: number;
  max_travel_radius_km: number;
  slot_window_hours: number;
  required_skills: string[];
  stripe_account_id: string | null;
  created_at: string;
};

export type TriageTree = {
  id: string;
  widget_id: string;
  name: string;
  version: number;
  is_active: boolean;
  tree_graph: {
    nodes: TriageNode[];
    start_node: string;
  };
};

export type TriageNode = {
  id: string;
  type: "QUESTION" | "OUTCOME";
  text?: string;
  icon?: string;
  answers?: { text: string; next_node: string; is_urgent?: boolean }[];
  job_category?: string;
  service_label?: string;
  base_duration_mins?: number;
  priority?: string;
  required_skills?: string[];
  base_estimate_cents?: number;
};

export type BookingIntent = {
  id: string;
  workspace_id: string;
  widget_id: string;
  session_token: string;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  service_address: string | null;
  triage_path: any[];
  triage_outcome: any;
  selected_technician_id: string | null;
  selected_window_start: string | null;
  selected_window_end: string | null;
  estimated_duration_mins: number | null;
  slot_locked_at: string | null;
  slot_lock_expires_at: string | null;
  stripe_payment_intent_id: string | null;
  deposit_amount_cents: number | null;
  payment_status: string;
  status: string;
  converted_job_id: string | null;
  converted_client_id: string | null;
  created_at: string;
};

export type BookingWidgetStats = {
  total_intents: number;
  initiated: number;
  triage_complete: number;
  scheduling_selected: number;
  payment_pending: number;
  converted: number;
  abandoned: number;
  conversion_rate: number;
  total_revenue_cents: number;
};

export type ViableSlot = {
  technician_id: string;
  technician_name: string;
  window_start: string;
  window_end: string;
  travel_minutes: number;
};

// ═══════════════════════════════════════════════════════════════
// 1) getWidgets — List all booking widgets for a workspace
// ═══════════════════════════════════════════════════════════════

export async function getWidgets(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("public_booking_widgets")
      .select("*")
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as BookingWidget[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch widgets" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 2) getWidgetDetail — Get a single booking widget by ID
// ═══════════════════════════════════════════════════════════════

export async function getWidgetDetail(widgetId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("public_booking_widgets")
      .select("*")
      .eq("id", widgetId)
      .eq("workspace_id", orgId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "Widget not found" };
    return { data: data as BookingWidget, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch widget" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3) createWidget — Create a new booking widget + default triage tree
// ═══════════════════════════════════════════════════════════════

export async function createWidget(orgId: string, name: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Insert the widget
    const { data: widget, error: widgetErr } = await (supabase as any)
      .from("public_booking_widgets")
      .insert({
        workspace_id: orgId,
        name,
        is_active: false,
        allowed_domains: [],
        branding_config: {
          primary_color: "#10B981",
          mode: "dark",
          logo_url: null,
          company_name: null,
          welcome_message: "Book a service appointment",
        },
        call_out_fee_amount: 0,
        scheduling_horizon_days: 14,
        minimum_buffer_minutes: 30,
        max_travel_radius_km: 50,
        slot_window_hours: 2,
        required_skills: [],
      })
      .select("*")
      .single();

    if (widgetErr) return { data: null, error: widgetErr.message };

    // Create a default triage tree for the widget
    const defaultTree = {
      nodes: [
        {
          id: "start",
          type: "QUESTION",
          text: "What type of service do you need?",
          icon: "wrench",
          answers: [
            { text: "General Repair", next_node: "outcome_general" },
            { text: "Emergency", next_node: "outcome_emergency", is_urgent: true },
          ],
        },
        {
          id: "outcome_general",
          type: "OUTCOME",
          job_category: "general",
          service_label: "General Repair",
          base_duration_mins: 60,
          priority: "normal",
          required_skills: [],
          base_estimate_cents: 15000,
        },
        {
          id: "outcome_emergency",
          type: "OUTCOME",
          job_category: "emergency",
          service_label: "Emergency Service",
          base_duration_mins: 90,
          priority: "urgent",
          required_skills: [],
          base_estimate_cents: 25000,
        },
      ],
      start_node: "start",
    };

    await (supabase as any).from("triage_trees").insert({
      widget_id: widget.id,
      name: `${name} — Triage`,
      version: 1,
      is_active: true,
      tree_graph: defaultTree,
    });

    revalidatePath("/dashboard/settings/widgets");
    return { data: widget as BookingWidget, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to create widget" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 4) updateWidget — Update booking widget configuration
// ═══════════════════════════════════════════════════════════════

export async function updateWidget(
  widgetId: string,
  orgId: string,
  updates: Partial<BookingWidget>
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Strip fields that shouldn't be updated directly
    const { id: _id, workspace_id: _ws, created_at: _ca, embed_script_token: _tk, ...safeUpdates } = updates as any;

    const { data, error } = await (supabase as any)
      .from("public_booking_widgets")
      .update(safeUpdates)
      .eq("id", widgetId)
      .eq("workspace_id", orgId)
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/settings/widgets");
    return { data: data as BookingWidget, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to update widget" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 5) deleteWidget — Delete a booking widget
// ═══════════════════════════════════════════════════════════════

export async function deleteWidget(widgetId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { error } = await (supabase as any)
      .from("public_booking_widgets")
      .delete()
      .eq("id", widgetId)
      .eq("workspace_id", orgId);

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/settings/widgets");
    return { data: { deleted: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to delete widget" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 6) getTriageTree — Get the active triage tree for a widget
// ═══════════════════════════════════════════════════════════════

export async function getTriageTree(widgetId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("triage_trees")
      .select("*")
      .eq("widget_id", widgetId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "No active triage tree found" };
    return { data: data as TriageTree, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch triage tree" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 7) updateTriageTree — Update the tree_graph JSONB for a tree
// ═══════════════════════════════════════════════════════════════

export async function updateTriageTree(
  treeId: string,
  orgId: string,
  treeGraph: any
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("triage_trees")
      .update({ tree_graph: treeGraph })
      .eq("id", treeId)
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/settings/widgets");
    return { data: data as TriageTree, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to update triage tree" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 8) getBookingIntents — List booking intents for a workspace
// ═══════════════════════════════════════════════════════════════

export async function getBookingIntents(orgId: string, status?: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("booking_intents")
      .select("*")
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: data as BookingIntent[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch booking intents" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 9) getBookingIntentDetail — Get a single booking intent
// ═══════════════════════════════════════════════════════════════

export async function getBookingIntentDetail(intentId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("booking_intents")
      .select("*")
      .eq("id", intentId)
      .eq("workspace_id", orgId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "Booking intent not found" };
    return { data: data as BookingIntent, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch booking intent" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 10) getBookingWidgetStats — Aggregate stats via RPC
// ═══════════════════════════════════════════════════════════════

export async function getBookingWidgetStats(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc(
      "get_booking_widget_stats",
      { p_workspace_id: orgId }
    );

    if (error) return { data: null, error: error.message };
    return { data: data as BookingWidgetStats, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch widget stats" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 11) calculateViableSlots — Spatial-temporal scheduling engine
// ═══════════════════════════════════════════════════════════════

export async function calculateViableSlots(
  orgId: string,
  lat: number,
  lng: number,
  durationMins: number,
  requiredSkills: string[],
  dateStr: string
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // 1. Fetch widget config for radius
    const { data: orgConfig } = await (supabase as any)
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .maybeSingle();

    if (!orgConfig) return { data: null, error: "Organization not found" };

    // 2. Fetch technicians who have the required skills and are within travel radius
    //    Uses PostGIS ST_DWithin on their home_location geography
    const radiusMeters = 50 * 1000; // default 50km, could be parameterized from widget
    const { data: techs, error: techErr } = await (supabase as any).rpc(
      "find_nearby_technicians",
      {
        p_org_id: orgId,
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: radiusMeters,
        p_required_skills: requiredSkills,
      }
    );

    // Fallback: if RPC doesn't exist, query organization_members directly
    let technicians = techs;
    if (techErr) {
      const { data: members, error: memErr } = await (supabase as any)
        .from("organization_members")
        .select("user_id, profiles(full_name, home_lat, home_lng)")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .in("role", ["technician", "field_worker", "admin"]);

      if (memErr) return { data: null, error: memErr.message };

      // Filter by skills if the member has a skills array
      technicians = (members || []).filter((m: any) => {
        if (requiredSkills.length === 0) return true;
        const memberSkills: string[] = m.skills || [];
        return requiredSkills.every((s) => memberSkills.includes(s));
      });
    }

    if (!technicians || technicians.length === 0) {
      return { data: [], error: null };
    }

    // 3. For each technician, get their schedule blocks on the given date
    const dayStart = `${dateStr}T00:00:00`;
    const dayEnd = `${dateStr}T23:59:59`;

    const viableSlots: ViableSlot[] = [];

    for (const tech of technicians) {
      const techId = tech.user_id || tech.technician_id;
      const techName =
        tech.profiles?.full_name || tech.technician_name || "Unknown";
      const techLat = tech.profiles?.home_lat || tech.home_lat || lat;
      const techLng = tech.profiles?.home_lng || tech.home_lng || lng;

      // Fetch existing schedule blocks for this technician on this date
      const { data: blocks } = await (supabase as any)
        .from("schedule_blocks")
        .select("start_time, end_time")
        .eq("user_id", techId)
        .gte("start_time", dayStart)
        .lte("end_time", dayEnd)
        .order("start_time", { ascending: true });

      // Define working hours (8 AM to 6 PM)
      const workStart = new Date(`${dateStr}T08:00:00`);
      const workEnd = new Date(`${dateStr}T18:00:00`);

      // Build list of busy intervals
      const busy: { start: Date; end: Date }[] = (blocks || []).map(
        (b: any) => ({
          start: new Date(b.start_time),
          end: new Date(b.end_time),
        })
      );

      // Sort busy intervals by start time
      busy.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Find free gaps within working hours
      const gaps: { start: Date; end: Date }[] = [];
      let cursor = workStart;

      for (const interval of busy) {
        if (interval.start > cursor) {
          gaps.push({ start: new Date(cursor), end: new Date(interval.start) });
        }
        if (interval.end > cursor) {
          cursor = new Date(interval.end);
        }
      }
      if (cursor < workEnd) {
        gaps.push({ start: new Date(cursor), end: new Date(workEnd) });
      }

      // Estimate travel time (rough: Haversine distance / 40 km/h average)
      const travelMins = estimateTravelMinutes(techLat, techLng, lat, lng);

      // Check each gap for enough room (travel + service duration + buffer)
      const totalNeeded = travelMins + durationMins + 15; // 15 min buffer

      for (const gap of gaps) {
        const gapMins =
          (gap.end.getTime() - gap.start.getTime()) / (1000 * 60);
        if (gapMins >= totalNeeded) {
          // Offer the slot starting after travel time
          const slotStart = new Date(
            gap.start.getTime() + travelMins * 60 * 1000
          );
          const slotEnd = new Date(
            slotStart.getTime() + durationMins * 60 * 1000
          );

          viableSlots.push({
            technician_id: techId,
            technician_name: techName,
            window_start: slotStart.toISOString(),
            window_end: slotEnd.toISOString(),
            travel_minutes: Math.round(travelMins),
          });
        }
      }
    }

    // Sort by earliest window start
    viableSlots.sort(
      (a, b) =>
        new Date(a.window_start).getTime() -
        new Date(b.window_start).getTime()
    );

    return { data: viableSlots, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to calculate slots" };
  }
}

/**
 * Haversine-based travel time estimate.
 * Assumes average speed of 40 km/h for urban/suburban driving.
 */
function estimateTravelMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;

  // Average 40 km/h → minutes = (distKm / 40) * 60
  return (distKm / 40) * 60;
}

// ═══════════════════════════════════════════════════════════════
// 12) createBookingIntent — Insert a new booking intent with PostGIS
// ═══════════════════════════════════════════════════════════════

export async function createBookingIntent(
  workspaceId: string,
  widgetId: string,
  clientDetails: any,
  triagePath: any[],
  triageOutcome: any,
  serviceAddress: string,
  lat: number,
  lng: number
) {
  try {
    const supabase = await createServerSupabaseClient();

    // Generate a unique session token for this booking flow
    const sessionToken = crypto.randomUUID();

    // Use RPC to insert with PostGIS geography point
    const { data, error } = await (supabase as any).rpc(
      "create_booking_intent",
      {
        p_workspace_id: workspaceId,
        p_widget_id: widgetId,
        p_session_token: sessionToken,
        p_client_first_name: clientDetails.firstName || null,
        p_client_last_name: clientDetails.lastName || null,
        p_client_phone: clientDetails.phone || null,
        p_client_email: clientDetails.email || null,
        p_service_address: serviceAddress,
        p_lat: lat,
        p_lng: lng,
        p_triage_path: triagePath,
        p_triage_outcome: triageOutcome,
      }
    );

    if (error) {
      // Fallback: insert without PostGIS using raw columns
      const { data: fallbackData, error: fallbackErr } = await (
        supabase as any
      )
        .from("booking_intents")
        .insert({
          workspace_id: workspaceId,
          widget_id: widgetId,
          session_token: sessionToken,
          client_first_name: clientDetails.firstName || null,
          client_last_name: clientDetails.lastName || null,
          client_phone: clientDetails.phone || null,
          client_email: clientDetails.email || null,
          service_address: serviceAddress,
          service_lat: lat,
          service_lng: lng,
          triage_path: triagePath,
          triage_outcome: triageOutcome,
          status: "initiated",
          payment_status: "none",
        })
        .select("*")
        .single();

      if (fallbackErr) return { data: null, error: fallbackErr.message };
      return { data: fallbackData as BookingIntent, error: null };
    }

    return { data: data as BookingIntent, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to create booking intent" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 13) selectSlotAndLock — Lock a slot for a booking intent
// ═══════════════════════════════════════════════════════════════

export async function selectSlotAndLock(
  intentId: string,
  technicianId: string,
  windowStart: string,
  windowEnd: string,
  durationMins: number
) {
  try {
    const supabase = await createServerSupabaseClient();

    // First, check slot availability via RPC
    const { data: available, error: checkErr } = await (supabase as any).rpc(
      "check_slot_available",
      {
        p_technician_id: technicianId,
        p_window_start: windowStart,
        p_window_end: windowEnd,
      }
    );

    if (checkErr) return { data: null, error: checkErr.message };
    if (!available) {
      return { data: null, error: "Slot is no longer available" };
    }

    const now = new Date();
    const lockExpiry = new Date(now.getTime() + 10 * 60 * 1000); // 10-minute lock

    // Update the booking intent with slot selection
    const { data: intent, error: updateErr } = await (supabase as any)
      .from("booking_intents")
      .update({
        selected_technician_id: technicianId,
        selected_window_start: windowStart,
        selected_window_end: windowEnd,
        estimated_duration_mins: durationMins,
        slot_locked_at: now.toISOString(),
        slot_lock_expires_at: lockExpiry.toISOString(),
        status: "scheduling_selected",
      })
      .eq("id", intentId)
      .select("*")
      .single();

    if (updateErr) return { data: null, error: updateErr.message };

    // Insert a slot reservation to prevent double-booking
    await (supabase as any).from("slot_reservations").insert({
      booking_intent_id: intentId,
      technician_id: technicianId,
      window_start: windowStart,
      window_end: windowEnd,
      locked_at: now.toISOString(),
      expires_at: lockExpiry.toISOString(),
    });

    return { data: intent as BookingIntent, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to lock slot" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 14) convertBookingToJob — Convert a confirmed booking to a job
// ═══════════════════════════════════════════════════════════════

export async function convertBookingToJob(intentId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any).rpc(
      "convert_booking_to_job",
      { p_intent_id: intentId }
    );

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard/schedule");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to convert booking to job" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 15) abandonBookingIntent — Mark a booking intent as abandoned
// ═══════════════════════════════════════════════════════════════

export async function abandonBookingIntent(intentId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("booking_intents")
      .update({ status: "abandoned" })
      .eq("id", intentId)
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as BookingIntent, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to abandon booking intent" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 16) getEmbedCode — Generate the HTML embed snippet for a widget
// ═══════════════════════════════════════════════════════════════

export async function getEmbedCode(widgetId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data: widget, error } = await (supabase as any)
      .from("public_booking_widgets")
      .select("embed_script_token, name")
      .eq("id", widgetId)
      .eq("workspace_id", orgId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!widget) return { data: null, error: "Widget not found" };

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://app.iworkr.com";
    const embedSnippet = `<!-- iWorkr Booking Widget: ${widget.name} -->\n<script\n  src="${baseUrl}/embed/booking-widget.js"\n  data-widget-token="${widget.embed_script_token}"\n  async\n></script>`;

    return { data: { embed_code: embedSnippet }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to generate embed code" };
  }
}
