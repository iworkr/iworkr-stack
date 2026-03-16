"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VehicleSchema = z.object({
  organization_id: z.string().uuid(),
  assigned_facility_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  registration_number: z.string().min(1).max(24),
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().int().min(1980).max(2100).nullable().optional(),
  vin: z.string().max(64).nullable().optional(),
  is_wav: z.boolean().optional().default(false),
  wav_type: z.enum(["rear_entry", "side_entry", "none"]).optional().default("none"),
  wheelchair_capacity: z.number().int().min(0).max(4).optional().default(0),
  seating_capacity: z.number().int().min(1).max(20),
  fuel_type: z.enum(["petrol", "diesel", "ev", "hybrid"]).nullable().optional(),
  registration_expiry: z.string().nullable().optional(),
  insurance_expiry: z.string().nullable().optional(),
  hoist_service_expiry: z.string().nullable().optional(),
  roadside_provider: z.string().max(120).nullable().optional(),
  roadside_contact: z.string().max(80).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const BookingSchema = z.object({
  organization_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  worker_id: z.string().uuid().nullable().optional(),
  booked_start: z.string(),
  booked_end: z.string(),
});

const CheckoutSchema = z.object({
  booking_id: z.string().uuid(),
  checkout_odometer: z.number().min(0),
  inspection_data: z.record(z.string(), z.unknown()).optional().default({}),
  has_defects: z.boolean().optional().default(false),
  fuel_level_percent: z.number().int().min(0).max(100).nullable().optional(),
});

const CheckinSchema = z.object({
  booking_id: z.string().uuid(),
  checkin_odometer: z.number().min(0),
  inspection_data: z.record(z.string(), z.unknown()).optional().default({}),
  has_defects: z.boolean().optional().default(false),
  fuel_level_percent: z.number().int().min(0).max(100).nullable().optional(),
});

const DefectSchema = z.object({
  booking_id: z.string().uuid(),
  severity: z.enum(["minor", "major", "critical_grounded"]),
  description: z.string().min(1).max(2000),
  photo_urls: z.array(z.string()).optional().default([]),
});

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function listFleetVehiclesAction(organizationId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("fleet_vehicles")
    .select("*, care_facilities(name)")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createFleetVehicleAction(input: z.infer<typeof VehicleSchema>) {
  const payload = VehicleSchema.parse(input);
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("fleet_vehicles")
    .insert({
      ...payload,
      wav_type: payload.is_wav ? payload.wav_type : "none",
      wheelchair_capacity: payload.is_wav ? payload.wheelchair_capacity : 0,
      status: "active",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/fleet/vehicles");
  revalidatePath("/dashboard/fleet/overview");
  return data;
}

export async function updateFleetVehicleStatusAction(input: {
  vehicle_id: string;
  status: "active" | "in_use" | "maintenance" | "out_of_service_defect" | "out_of_service_compliance";
}) {
  const { supabase } = await requireUser();
  const { error } = await (supabase as any)
    .from("fleet_vehicles")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.vehicle_id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/fleet/vehicles");
  revalidatePath("/dashboard/fleet/overview");
  return { success: true };
}

export async function listVehicleBookingsAction(input: {
  organization_id: string;
  from_iso: string;
  to_iso: string;
}) {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("vehicle_bookings")
    .select("*, fleet_vehicles(name, registration_number), schedule_blocks(title, participant_id)")
    .eq("organization_id", input.organization_id)
    .gte("booked_start", input.from_iso)
    .lte("booked_end", input.to_iso)
    .order("booked_start", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getVehicleGpsReplayGeoJsonAction(input: {
  organization_id: string;
  vehicle_id: string;
  from_iso: string;
  to_iso: string;
}) {
  const { supabase } = await requireUser();
  const { data: bookings, error: bookingErr } = await (supabase as any)
    .from("vehicle_bookings")
    .select("shift_id, booked_start, booked_end")
    .eq("organization_id", input.organization_id)
    .eq("vehicle_id", input.vehicle_id)
    .gte("booked_start", input.from_iso)
    .lte("booked_end", input.to_iso)
    .order("booked_start", { ascending: true });
  if (bookingErr) throw new Error(bookingErr.message);

  const shiftIds = (bookings || []).map((b: any) => b.shift_id).filter(Boolean);
  if (shiftIds.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const { data: logs, error: logErr } = await (supabase as any)
    .from("shift_travel_logs")
    .select("id, shift_id, raw_breadcrumbs, start_time, end_time")
    .eq("organization_id", input.organization_id)
    .in("shift_id", shiftIds)
    .order("start_time", { ascending: true });
  if (logErr) throw new Error(logErr.message);

  const features = (logs || [])
    .map((log: any) => {
      const points = Array.isArray(log.raw_breadcrumbs) ? log.raw_breadcrumbs : [];
      const coordinates = points
        .map((p: any) => {
          const lat = Number(p.lat ?? p.latitude);
          const lng = Number(p.lng ?? p.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return [lng, lat];
        })
        .filter(Boolean);
      if (coordinates.length < 2) return null;
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          shift_id: log.shift_id,
          travel_log_id: log.id,
          start_time: log.start_time,
          end_time: log.end_time,
        },
      };
    })
    .filter(Boolean);

  return {
    type: "FeatureCollection",
    features,
  };
}

export async function createVehicleBookingAction(input: z.infer<typeof BookingSchema>) {
  const payload = BookingSchema.parse(input);
  const { supabase } = await requireUser();

  const [{ data: shift, error: shiftErr }, { data: vehicle, error: vehicleErr }] = await Promise.all([
    (supabase as any)
      .from("schedule_blocks")
      .select("id, organization_id, technician_id, participant_id, start_time, end_time")
      .eq("id", payload.shift_id)
      .single(),
    (supabase as any)
      .from("fleet_vehicles")
      .select("id, organization_id, is_wav, wav_type, status")
      .eq("id", payload.vehicle_id)
      .single(),
  ]);
  if (shiftErr) throw new Error(shiftErr.message);
  if (vehicleErr) throw new Error(vehicleErr.message);
  if (shift.organization_id !== payload.organization_id || vehicle.organization_id !== payload.organization_id) {
    throw new Error("Organization mismatch");
  }
  if (!["active", "in_use"].includes(vehicle.status)) {
    throw new Error(`Vehicle unavailable (${vehicle.status})`);
  }

  if (shift.participant_id) {
    const { data: p } = await (supabase as any)
      .from("participant_profiles")
      .select("mobility_requirements, mobility_status, critical_alerts")
      .eq("id", shift.participant_id)
      .maybeSingle();
    const text = `${p?.mobility_requirements || ""} ${p?.mobility_status || ""} ${(p?.critical_alerts || []).join(" ")}`.toLowerCase();
    const requiresWav = text.includes("wheelchair") || text.includes("power chair") || text.includes("hoist");
    if (requiresWav && (!vehicle.is_wav || vehicle.wav_type === "none")) {
      throw new Error("WAV required: participant mobility profile blocks standard vehicle assignment.");
    }
  }

  const { data, error } = await (supabase as any)
    .from("vehicle_bookings")
    .insert({
      organization_id: payload.organization_id,
      vehicle_id: payload.vehicle_id,
      shift_id: payload.shift_id,
      worker_id: payload.worker_id || shift.technician_id || null,
      booked_start: payload.booked_start || shift.start_time,
      booked_end: payload.booked_end || shift.end_time,
      status: "scheduled",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/fleet/vehicles");
  revalidatePath("/dashboard/fleet/overview");
  return data;
}

export async function getShiftVehicleBookingAction(shiftId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("vehicle_bookings")
    .select("*, fleet_vehicles(name, registration_number, status, current_odometer)")
    .eq("shift_id", shiftId)
    .in("status", ["scheduled", "checked_out"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function checkoutVehicleBookingAction(input: z.infer<typeof CheckoutSchema>) {
  const payload = CheckoutSchema.parse(input);
  const { supabase, user } = await requireUser();
  const { data: booking, error: bookingErr } = await (supabase as any)
    .from("vehicle_bookings")
    .select("*, fleet_vehicles(id, current_odometer)")
    .eq("id", payload.booking_id)
    .single();
  if (bookingErr) throw new Error(bookingErr.message);
  if (booking.status !== "scheduled") throw new Error("Booking is not in scheduled state.");
  if (payload.checkout_odometer < Number(booking.fleet_vehicles?.current_odometer || 0)) {
    throw new Error("Checkout odometer cannot be less than previous vehicle odometer.");
  }

  const nowIso = new Date().toISOString();
  const [{ error: bookingUpdateErr }, { error: inspectionErr }, { error: vehicleErr }] = await Promise.all([
    (supabase as any)
      .from("vehicle_bookings")
      .update({
        status: "checked_out",
        checkout_time: nowIso,
        checkout_odometer: payload.checkout_odometer,
        worker_id: booking.worker_id || user.id,
      })
      .eq("id", payload.booking_id),
    (supabase as any).from("vehicle_inspections").insert({
      organization_id: booking.organization_id,
      vehicle_id: booking.vehicle_id,
      booking_id: booking.id,
      worker_id: user.id,
      inspection_type: "checkout",
      inspection_data: payload.inspection_data,
      has_defects: payload.has_defects,
      fuel_level_percent: payload.fuel_level_percent ?? null,
    }),
    (supabase as any)
      .from("fleet_vehicles")
      .update({
        status: payload.has_defects ? "out_of_service_defect" : "in_use",
        current_odometer: payload.checkout_odometer,
        updated_at: nowIso,
      })
      .eq("id", booking.vehicle_id),
  ]);

  if (bookingUpdateErr) throw new Error(bookingUpdateErr.message);
  if (inspectionErr) throw new Error(inspectionErr.message);
  if (vehicleErr) throw new Error(vehicleErr.message);
  revalidatePath("/dashboard/fleet/overview");
  return { success: true };
}

export async function checkinVehicleBookingAction(input: z.infer<typeof CheckinSchema>) {
  const payload = CheckinSchema.parse(input);
  const { supabase, user } = await requireUser();
  const { data: booking, error: bookingErr } = await (supabase as any)
    .from("vehicle_bookings")
    .select("*")
    .eq("id", payload.booking_id)
    .single();
  if (bookingErr) throw new Error(bookingErr.message);
  if (booking.status !== "checked_out") throw new Error("Booking is not checked out.");
  if (payload.checkin_odometer < Number(booking.checkout_odometer || 0)) {
    throw new Error("Check-in odometer cannot be below checkout odometer.");
  }

  const nowIso = new Date().toISOString();
  const [{ error: bookingUpdateErr }, { error: inspectionErr }, { error: vehicleErr }] = await Promise.all([
    (supabase as any)
      .from("vehicle_bookings")
      .update({
        status: "completed",
        checkin_time: nowIso,
        checkin_odometer: payload.checkin_odometer,
        fuel_level_percent: payload.fuel_level_percent ?? null,
      })
      .eq("id", payload.booking_id),
    (supabase as any).from("vehicle_inspections").insert({
      organization_id: booking.organization_id,
      vehicle_id: booking.vehicle_id,
      booking_id: booking.id,
      worker_id: user.id,
      inspection_type: "checkin",
      inspection_data: payload.inspection_data,
      has_defects: payload.has_defects,
      fuel_level_percent: payload.fuel_level_percent ?? null,
    }),
    (supabase as any)
      .from("fleet_vehicles")
      .update({
        status: payload.has_defects ? "out_of_service_defect" : "active",
        current_odometer: payload.checkin_odometer,
        updated_at: nowIso,
      })
      .eq("id", booking.vehicle_id),
  ]);
  if (bookingUpdateErr) throw new Error(bookingUpdateErr.message);
  if (inspectionErr) throw new Error(inspectionErr.message);
  if (vehicleErr) throw new Error(vehicleErr.message);
  revalidatePath("/dashboard/fleet/overview");
  return { success: true };
}

export async function reportVehicleDefectAction(input: z.infer<typeof DefectSchema>) {
  const payload = DefectSchema.parse(input);
  const { supabase } = await requireUser();
  const { data: booking, error: bookingErr } = await (supabase as any)
    .from("vehicle_bookings")
    .select("id, organization_id, vehicle_id, shift_id, booked_start")
    .eq("id", payload.booking_id)
    .single();
  if (bookingErr) throw new Error(bookingErr.message);

  const { data: defect, error: defectErr } = await (supabase as any)
    .from("vehicle_defects")
    .insert({
      organization_id: booking.organization_id,
      vehicle_id: booking.vehicle_id,
      booking_id: booking.id,
      severity: payload.severity,
      description: payload.description,
      photo_urls: payload.photo_urls,
      status: "open",
    })
    .select("*")
    .single();
  if (defectErr) throw new Error(defectErr.message);

  if (payload.severity === "critical_grounded" || payload.severity === "major") {
    await (supabase as any).from("fleet_vehicles").update({ status: "out_of_service_defect" }).eq("id", booking.vehicle_id);
    await (supabase as any)
      .from("vehicle_bookings")
      .update({ status: "cancelled", metadata: { triage_queue: "drop_and_cover", reason: "vehicle_defect" } })
      .eq("vehicle_id", booking.vehicle_id)
      .in("status", ["scheduled"])
      .gt("booked_start", new Date().toISOString());
  }

  await supabase.functions.invoke("send-push", {
    body: {
      record: {
        title: "Fleet Defect Escalation",
        body: `${payload.severity.toUpperCase()} defect reported: ${payload.description.slice(0, 80)}`,
        type: "fleet_defect",
      },
    },
  });

  revalidatePath("/dashboard/fleet/overview");
  return defect;
}

export async function getFleetOverviewAction(organizationId: string) {
  const { supabase } = await requireUser();
  const [{ data: vehicles }, { data: upcoming }, { data: bookings }, { data: defects }] = await Promise.all([
    (supabase as any)
      .from("fleet_vehicles")
      .select("id, status, assigned_facility_id, registration_expiry, insurance_expiry, hoist_service_expiry, current_odometer")
      .eq("organization_id", organizationId),
    (supabase as any)
      .from("fleet_vehicles")
      .select("id, name, registration_number, registration_expiry, insurance_expiry, hoist_service_expiry")
      .eq("organization_id", organizationId)
      .or(`registration_expiry.lte.${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},insurance_expiry.lte.${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},hoist_service_expiry.lte.${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`),
    (supabase as any)
      .from("vehicle_bookings")
      .select("id, status, booked_start, booked_end, vehicle_id")
      .eq("organization_id", organizationId)
      .gte("booked_start", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    (supabase as any)
      .from("vehicle_defects")
      .select("id, severity, status")
      .eq("organization_id", organizationId)
      .eq("status", "open"),
  ]);

  const byStatus = {
    active: (vehicles || []).filter((v: any) => v.status === "active").length,
    in_use: (vehicles || []).filter((v: any) => v.status === "in_use").length,
    maintenance: (vehicles || []).filter((v: any) => v.status === "maintenance").length,
    out_of_service_defect: (vehicles || []).filter((v: any) => v.status === "out_of_service_defect").length,
    out_of_service_compliance: (vehicles || []).filter((v: any) => v.status === "out_of_service_compliance").length,
  };

  const now = Date.now();
  const minutesBooked = (bookings || []).reduce((sum: number, b: any) => {
    const start = new Date(b.booked_start).getTime();
    const end = new Date(b.booked_end).getTime();
    return sum + Math.max(0, (end - start) / 60000);
  }, 0);
  const vehicleCount = Math.max((vehicles || []).length, 1);
  const minutesAvailable = vehicleCount * 30 * 24 * 60;
  const utilizationPercent = Number(((minutesBooked / minutesAvailable) * 100).toFixed(2));

  const vacancySignals: Array<{ facility_id: string; facility_name: string; capacity: number; active_count: number; waitlist_count: number }> = [];
  const { data: facilities } = await (supabase as any)
    .from("care_facilities")
    .select("id, name, max_capacity")
    .eq("organization_id", organizationId);
  for (const f of facilities || []) {
    const [{ count: activeCount }, { count: waitlistCount }] = await Promise.all([
      (supabase as any)
        .from("participant_profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("facility_id", f.id),
      (supabase as any)
        .from("intake_waitlist_entries")
        .select("id", { count: "exact", head: true })
        .eq("target_facility_id", f.id),
    ]);
    const cap = Number(f.max_capacity || 0);
    if (cap > 0 && Number(activeCount || 0) < cap && Number(waitlistCount || 0) > 0) {
      vacancySignals.push({
        facility_id: f.id,
        facility_name: f.name,
        capacity: cap,
        active_count: Number(activeCount || 0),
        waitlist_count: Number(waitlistCount || 0),
      });
    }
  }

  return {
    status_totals: byStatus,
    utilization_percent_30d: utilizationPercent,
    open_defects: defects || [],
    upcoming_expiries: upcoming || [],
    vacancy_signals: vacancySignals,
    computed_at: new Date(now).toISOString(),
  };
}

export async function runConvoyDailyGroundingAction() {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any).rpc("convoy_ground_expired_vehicles");
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/fleet/overview");
  return { grounded_count: Number(data || 0) };
}
