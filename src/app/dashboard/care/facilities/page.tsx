"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, Link2, PlusCircle } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createCareFacilityAction,
  linkParticipantToFacilityAction,
  listCareFacilitiesAction,
  listFacilityParticipantsAction,
} from "@/app/actions/care-routines";

type Facility = {
  id: string;
  name: string;
  max_capacity?: number | null;
};

type Participant = {
  id: string;
  preferred_name?: string | null;
  facility_id?: string | null;
};

export default function CareFacilitiesPage() {
  const { orgId } = useOrg();
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");

  async function refresh() {
    if (!orgId) return;
    const [f, p] = await Promise.all([listCareFacilitiesAction(orgId), listFacilityParticipantsAction(orgId)]);
    setFacilities((f || []) as Facility[]);
    setParticipants((p || []) as Participant[]);
  }

  useEffect(() => {
    refresh();
  }, [orgId]);

  const participantsByFacility = useMemo(() => {
    const m = new Map<string, Participant[]>();
    for (const p of participants) {
      if (!p.facility_id) continue;
      const arr = m.get(p.facility_id) || [];
      arr.push(p);
      m.set(p.facility_id, arr);
    }
    return m;
  }, [participants]);

  function onCreate() {
    if (!orgId || !name.trim()) return;
    startBusy(async () => {
      try {
        await createCareFacilityAction({
          organization_id: orgId,
          name: name.trim(),
          max_capacity: capacity ? Number(capacity) : undefined,
        });
        setName("");
        setCapacity("");
        setMsg("Facility created.");
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to create facility.");
      }
    });
  }

  function onRelink(participantId: string, facilityId: string | null) {
    startBusy(async () => {
      try {
        await linkParticipantToFacilityAction({
          participant_id: participantId,
          facility_id: facilityId,
        });
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to link participant.");
      }
    });
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-4 md:p-6">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Project Choreography</p>
        <h1 className="text-lg font-semibold text-zinc-200">SIL Facilities & House Operations</h1>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="stealth-panel lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <PlusCircle size={16} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Create Facility</h2>
          </div>
          <label className="stealth-label mb-1 block">Facility Name</label>
          <input className="stealth-input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="stealth-label mb-1 block">Max Capacity</label>
          <input
            className="stealth-input mb-3"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <button className="stealth-btn-primary w-full justify-center" disabled={busy || !name.trim()} onClick={onCreate}>
            Create Facility
          </button>
        </section>

        <section className="stealth-panel lg:col-span-8">
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={16} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Facility Dashboard</h2>
          </div>
          <div className="space-y-3">
            {facilities.length === 0 && <p className="text-sm text-zinc-500">No facilities created yet.</p>}
            {facilities.map((facility) => {
              const residents = participantsByFacility.get(facility.id) || [];
              return (
                <div key={facility.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{facility.name}</p>
                      <p className="text-xs text-zinc-500">
                        Capacity {facility.max_capacity || "—"} · {residents.length} linked participant(s)
                      </p>
                    </div>
                    <a
                      className="stealth-btn-secondary"
                      href={`/dashboard/care/daily-ops?facility=${facility.id}`}
                    >
                      Open Ops
                    </a>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {participants.map((participant) => (
                      <div
                        key={`${facility.id}-${participant.id}`}
                        className="flex items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1.5"
                      >
                        <span className="text-xs text-zinc-300">{participant.preferred_name || "Participant"}</span>
                        <button
                          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.03]"
                          onClick={() =>
                            onRelink(
                              participant.id,
                              participant.facility_id === facility.id ? null : facility.id,
                            )
                          }
                          type="button"
                        >
                          <Link2 size={12} />
                          {participant.facility_id === facility.id ? "Unlink" : "Link"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
