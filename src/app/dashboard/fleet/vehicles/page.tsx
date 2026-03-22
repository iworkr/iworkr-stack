/**
 * @page /dashboard/fleet/vehicles
 * @status COMPLETE
 * @description Vehicle management with bookings, defect reports, and status updates
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/lib/hooks/use-org";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  createFleetVehicleAction,
  createVehicleBookingAction,
  listFleetVehiclesAction,
  listVehicleBookingsAction,
  reportVehicleDefectAction,
  updateFleetVehicleStatusAction,
} from "@/app/actions/fleet-convoy";

export default function FleetVehiclesPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    registration_number: "",
    make: "",
    model: "",
    seating_capacity: 4,
    is_wav: false,
    wav_type: "none",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fleetData } = useQuery<{ vehicles: any[]; bookings: any[] }>({
    queryKey: queryKeys.fleet.vehicles(orgId!),
    queryFn: async () => {
      const [v, b] = await Promise.all([
        listFleetVehiclesAction(orgId!),
        listVehicleBookingsAction({
          organization_id: orgId!,
          from_iso: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          to_iso: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      ]);
      return { vehicles: v, bookings: b };
    },
    enabled: !!orgId,
  });

  const vehicles = fleetData?.vehicles ?? [];
  const bookings = fleetData?.bookings ?? [];

  return (
    <div className="p-5">
      <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">PROJECT CONVOY</p>
      <h1 className="mb-4 text-xl font-semibold text-zinc-100">Fleet Registry & Booking Grid</h1>

      <div className="mb-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
        <p className="mb-2 text-sm text-zinc-300">Provision New Vehicle</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input className={inputClass} placeholder="Vehicle name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className={inputClass} placeholder="Registration" value={form.registration_number} onChange={(e) => setForm((f) => ({ ...f, registration_number: e.target.value }))} />
          <input className={inputClass} placeholder="Make" value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} />
          <input className={inputClass} placeholder="Model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
          <input className={inputClass} type="number" placeholder="Seats" value={form.seating_capacity} onChange={(e) => setForm((f) => ({ ...f, seating_capacity: Number(e.target.value || 4) }))} />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.is_wav} onChange={(e) => setForm((f) => ({ ...f, is_wav: e.target.checked, wav_type: e.target.checked ? "rear_entry" : "none" }))} />
            WAV
          </label>
        </div>
        {form.is_wav && (
          <select className={`${inputClass} mt-2`} value={form.wav_type} onChange={(e) => setForm((f) => ({ ...f, wav_type: e.target.value }))}>
            <option value="rear_entry">Rear Entry</option>
            <option value="side_entry">Side Entry</option>
          </select>
        )}
        <div className="mt-3">
          <button
            disabled={pending || !orgId}
            onClick={() =>
              startTransition(async () => {
                setError("");
                try {
                  await createFleetVehicleAction({
                    organization_id: orgId!,
                    name: form.name,
                    registration_number: form.registration_number,
                    make: form.make,
                    model: form.model,
                    seating_capacity: form.seating_capacity,
                    is_wav: form.is_wav,
                    wav_type: (form.is_wav ? form.wav_type : "none") as "rear_entry" | "side_entry" | "none",
                    wheelchair_capacity: form.is_wav ? 1 : 0,
                  });
                  setForm({ name: "", registration_number: "", make: "", model: "", seating_capacity: 4, is_wav: false, wav_type: "none" });
                  await queryClient.invalidateQueries({ queryKey: queryKeys.fleet.vehicles(orgId!) });
                } catch (e) {
                  setError((e as Error).message);
                }
              })
            }
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Add Vehicle
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-2 text-sm text-zinc-300">Vehicle Registry</p>
          <div className="space-y-2">
            {vehicles.map((v) => (
              <div key={v.id} className="rounded border border-white/[0.06] p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-100">{v.name}</p>
                    <p className="text-xs text-zinc-500">{v.registration_number} · {v.make} {v.model}</p>
                  </div>
                  <select
                    className="rounded border border-white/[0.1] bg-black/30 px-2 py-1 text-xs text-zinc-200"
                    value={v.status}
                    onChange={async (e) => {
                      await updateFleetVehicleStatusAction({
                        vehicle_id: v.id,
                        status: e.target.value as any,
                      });
                      await queryClient.invalidateQueries({ queryKey: queryKeys.fleet.vehicles(orgId!) });
                    }}
                  >
                    <option value="active">active</option>
                    <option value="maintenance">maintenance</option>
                    <option value="out_of_service_defect">out_of_service_defect</option>
                    <option value="out_of_service_compliance">out_of_service_compliance</option>
                  </select>
                </div>
              </div>
            ))}
            {vehicles.length === 0 && <p className="text-sm text-zinc-500">No vehicles yet.</p>}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-2 text-sm text-zinc-300">Booking Control</p>
          <QuickBookingForm
            orgId={orgId}
            vehicles={vehicles}
            onCreate={async (payload) => {
              setError("");
              try {
                await createVehicleBookingAction(payload as any);
                await queryClient.invalidateQueries({ queryKey: queryKeys.fleet.vehicles(orgId!) });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <div className="mt-3 space-y-2">
            {bookings.slice(0, 12).map((b) => (
              <div key={b.id} className="rounded border border-white/[0.06] p-2 text-xs text-zinc-300">
                {b.fleet_vehicles?.name} · {new Date(b.booked_start).toLocaleString()} - {new Date(b.booked_end).toLocaleTimeString()} · {b.status}
                {b.status === "checked_out" && (
                  <button
                    className="ml-2 rounded border border-rose-500/40 px-2 py-0.5 text-rose-300"
                    onClick={async () => {
                      await reportVehicleDefectAction({
                        booking_id: b.id,
                        severity: "major",
                        description: "Manual defect escalation from dashboard triage",
                        photo_urls: [],
                      });
                      await queryClient.invalidateQueries({ queryKey: queryKeys.fleet.vehicles(orgId!) });
                    }}
                  >
                    Escalate Defect
                  </button>
                )}
              </div>
            ))}
            {bookings.length === 0 && <p className="text-sm text-zinc-500">No bookings in range.</p>}
          </div>
        </div>
      </div>
      <FleetTimeline vehicles={vehicles} bookings={bookings} />
    </div>
  );
}

function QuickBookingForm({
  orgId,
  vehicles,
  onCreate,
}: {
  orgId: string | null;
  vehicles: any[];
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <div className="grid grid-cols-1 gap-2">
      <select className={inputClass} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
        <option value="">Select vehicle</option>
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
      <input className={inputClass} placeholder="Shift ID" value={shiftId} onChange={(e) => setShiftId(e.target.value)} />
      <input className={inputClass} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
      <input className={inputClass} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
      <button
        className="rounded border border-white/[0.12] px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50"
        disabled={!orgId || !vehicleId || !shiftId || !start || !end}
        onClick={() => onCreate({
          organization_id: orgId!,
          vehicle_id: vehicleId,
          shift_id: shiftId,
          booked_start: new Date(start).toISOString(),
          booked_end: new Date(end).toISOString(),
        })}
      >
        Create Booking
      </button>
    </div>
  );
}

const inputClass =
  "rounded border border-white/[0.1] bg-black/30 px-2 py-1.5 text-sm text-zinc-200 outline-none";

function FleetTimeline({
  vehicles,
  bookings,
}: {
  vehicles: Array<{ id: string; name: string; registration_number?: string }>;
  bookings: Array<{ id: string; vehicle_id: string; booked_start: string; booked_end: string; status: string; fleet_vehicles?: { name?: string } }>;
}) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const timelineMinutes = 24 * 60;
  const pxPerMinute = 1.2;
  const width = timelineMinutes * pxPerMinute;

  const toMinutes = (iso: string) => {
    const d = new Date(iso);
    return (d.getTime() - dayStart.getTime()) / 60000;
  };

  return (
    <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="mb-3 text-sm text-zinc-300">Fleet Booking Timeline (Today)</p>
      <div className="overflow-x-auto">
        <div style={{ minWidth: width + 220 }}>
          <div className="ml-[220px] relative mb-2 h-6">
            {Array.from({ length: 25 }).map((_, h) => (
              <div
                key={h}
                className="absolute top-0 text-[10px] text-zinc-500"
                style={{ left: h * 60 * pxPerMinute }}
              >
                {`${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {vehicles.map((vehicle) => {
              const rowBookings = bookings.filter((b) => b.vehicle_id === vehicle.id);
              return (
                <div key={vehicle.id} className="flex items-center gap-2">
                  <div className="w-[210px] shrink-0 rounded border border-white/[0.08] bg-black/20 p-2">
                    <p className="text-xs text-zinc-100">{vehicle.name}</p>
                    <p className="text-[10px] text-zinc-500">{vehicle.registration_number || "No rego"}</p>
                  </div>
                  <div className="relative h-10 rounded border border-white/[0.08] bg-black/20" style={{ width }}>
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div
                        key={h}
                        className="absolute top-0 h-full border-l border-white/[0.06]"
                        style={{ left: h * 60 * pxPerMinute }}
                      />
                    ))}
                    {rowBookings.map((booking) => {
                      const startMin = Math.max(0, toMinutes(booking.booked_start));
                      const endMin = Math.min(timelineMinutes, toMinutes(booking.booked_end));
                      if (endMin <= 0 || startMin >= timelineMinutes) return null;
                      return (
                        <div
                          key={booking.id}
                          className="absolute top-1 h-8 rounded border border-emerald-400/40 bg-emerald-500/20 px-1 text-[10px] text-emerald-100"
                          style={{
                            left: startMin * pxPerMinute,
                            width: Math.max(8, (endMin - startMin) * pxPerMinute),
                          }}
                          title={`${new Date(booking.booked_start).toLocaleTimeString()} - ${new Date(booking.booked_end).toLocaleTimeString()} (${booking.status})`}
                        >
                          {booking.status}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {vehicles.length === 0 ? <p className="text-sm text-zinc-500">No vehicles found for timeline rendering.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
