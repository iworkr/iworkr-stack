"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  ChevronRight,
  Building2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { useOrg } from "@/lib/hooks/use-org";
import { useRouter } from "next/navigation";
import {
  createCareFacilityAction,
  listCareFacilitiesAction,
  listFacilityParticipantsAction,
} from "@/app/actions/care-routines";

/* ── Types ────────────────────────────────────────────── */

type Facility = {
  id: string;
  name: string;
  max_capacity?: number | null;
  address?: Record<string, string> | null;
  participant_profiles?: { count: number }[] | null;
};

type Participant = {
  id: string;
  preferred_name?: string | null;
  facility_id?: string | null;
};

/* ── Helpers ──────────────────────────────────────────── */

function getOccupancy(facility: Facility): number {
  const pp = facility.participant_profiles;
  if (Array.isArray(pp) && pp.length > 0 && typeof pp[0]?.count === "number") return pp[0].count;
  return 0;
}

function getAddress(facility: Facility): string {
  const a = facility.address;
  if (!a) return "";
  // Handle common JSONB shapes: { street, city } or { line1 } or stringified
  if (typeof a === "string") return a;
  const parts = [a.street || a.line1 || a.address || "", a.city || a.suburb || ""].filter(Boolean);
  return parts.join(", ");
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function getOccupancyColor(current: number, max: number | null | undefined): string {
  if (!max || max === 0) return "bg-emerald-500";
  if (current >= max) return "bg-rose-500";
  if (current / max > 0.8) return "bg-amber-500";
  return "bg-emerald-500";
}

/* ── Ghost Badge ──────────────────────────────────────── */

function StatusBadge({ occupancy, capacity }: { occupancy: number; capacity: number | null | undefined }) {
  const isFull = capacity && occupancy >= capacity;
  if (isFull) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
        At Capacity
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
      Active
    </span>
  );
}

/* ── Occupancy Bar ────────────────────────────────────── */

function OccupancyBar({ current, max }: { current: number; max: number | null | undefined }) {
  const maxVal = max || 0;
  const pct = maxVal > 0 ? Math.min(Math.round((current / maxVal) * 100), 100) : 0;
  return (
    <div>
      <span className="font-mono text-xs text-zinc-300">
        {current}/{maxVal || "—"}
      </span>
      {maxVal > 0 && (
        <div className="h-1.5 w-24 bg-zinc-900 rounded-full mt-1 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getOccupancyColor(current, max)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Avatar Stack ─────────────────────────────────────── */

function ActiveStaffStack({ residents }: { residents: Participant[] }) {
  if (residents.length === 0) {
    return <span className="text-xs text-zinc-600 italic">No residents linked</span>;
  }
  const display = residents.slice(0, 5);
  const overflow = residents.length - display.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {display.map((r) => {
          const initials = getInitials(r.preferred_name || "?");
          return (
            <div
              key={r.id}
              className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-[#050505] flex items-center justify-center shrink-0"
              title={r.preferred_name || "Participant"}
            >
              <span className="text-[9px] text-zinc-400 font-medium">{initials}</span>
            </div>
          );
        })}
      </div>
      {overflow > 0 && (
        <span className="ml-2 text-[10px] font-mono text-zinc-500">+{overflow}</span>
      )}
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL = [
  { name: "w-32", addr: "w-40", occ: "w-10", staff: 3 },
  { name: "w-40", addr: "w-28", occ: "w-8", staff: 2 },
  { name: "w-28", addr: "w-36", occ: "w-10", staff: 4 },
  { name: "w-36", addr: "w-32", occ: "w-8", staff: 1 },
  { name: "w-24", addr: "w-44", occ: "w-10", staff: 3 },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SKEL[idx % SKEL.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${s.name} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className={`h-2 ${s.addr} bg-zinc-900/60 rounded-sm animate-pulse`} />
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${s.occ} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className="h-1.5 w-24 bg-zinc-900 rounded-full animate-pulse" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex -space-x-2">
          {Array.from({ length: s.staff }).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse border-2 border-[#050505]" />
          ))}
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <Building2 className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-[15px] text-white font-medium">No SIL facilities found.</p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            Create your first physical location to begin assigning participants and staff.
          </p>
          <button
            onClick={onCreateClick}
            className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            Create Facility
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Create Facility Slide-Over ───────────────────────── */

function CreateFacilitySlideOver({
  open,
  onClose,
  orgId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCareFacilityAction({
        organization_id: orgId,
        name: name.trim(),
        max_capacity: capacity ? Number(capacity) : undefined,
        address: address ? { street: address } : undefined,
      });
      onCreated();
      setName("");
      setCapacity("");
      setAddress("");
      onClose();
    } catch (err) {
      console.error("Failed to create facility:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[400px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-base font-medium text-white">Create New Facility</h2>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-zinc-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Facility Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Oceanview SIL Home"
                  className="w-full h-10 px-3 bg-zinc-900 border border-white/10 rounded-md text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., 123 Coastal Drive, Brisbane"
                  className="w-full h-10 px-3 bg-zinc-900 border border-white/10 rounded-md text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Max Capacity</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g., 4"
                  className="w-full h-10 px-3 bg-zinc-900 border border-white/10 rounded-md text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || saving}
                className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Creating…" : "Save Facility"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CareFacilitiesPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data: facilitiesData, isLoading: loading } = useQuery<{ facilities: Facility[]; participants: Participant[] }>({
    queryKey: queryKeys.care.facilities(orgId ?? ""),
    queryFn: async () => {
      const [f, p] = await Promise.all([
        listCareFacilitiesAction(orgId!),
        listFacilityParticipantsAction(orgId!),
      ]);
      return {
        facilities: (f || []) as Facility[],
        participants: (p || []) as Participant[],
      };
    },
    enabled: !!orgId,
  });

  const facilities = facilitiesData?.facilities ?? [];
  const participants = facilitiesData?.participants ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.care.facilities(orgId ?? "") });

  /* ── Participant map by facility ─────────────────────── */
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

  /* ── Filtered list ───────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!search) return facilities;
    const q = search.toLowerCase();
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (getAddress(f).toLowerCase().includes(q))
    );
  }, [facilities, search]);

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Rostering & Ops
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <span className="text-[10px] tracking-widest uppercase text-white font-medium select-none">
            Facilities / SIL
          </span>
        </div>

        {/* Right: Search + Filter + CTA */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search facilities…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            New Facility
          </button>
        </div>
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Facility</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Status</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Occupancy</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Residents</th>
              <th className="px-4 w-[10%]" />
            </tr>
          </thead>
          <tbody>
            {/* Loading Skeletons */}
            {loading && facilities.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            )}

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
              <EmptyState onCreateClick={() => setCreateOpen(true)} />
            )}

            {/* Data Rows */}
            {!loading && filtered.map((facility) => {
              const occupancy = getOccupancy(facility);
              const addr = getAddress(facility);
              const residents = participantsByFacility.get(facility.id) || [];

              return (
                <tr
                  key={facility.id}
                  onClick={() => router.push(`/dashboard/care/daily-ops?facility=${facility.id}`)}
                  className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                >
                  {/* Col 1: Facility */}
                  <td className="px-8 py-3">
                    <div className="min-w-0">
                      <span className="text-sm text-zinc-100 font-medium truncate block">{facility.name}</span>
                      {addr && (
                        <span className="text-[10px] font-mono text-zinc-500 truncate block">{addr}</span>
                      )}
                    </div>
                  </td>

                  {/* Col 2: Status */}
                  <td className="px-4 py-3">
                    <StatusBadge occupancy={occupancy} capacity={facility.max_capacity} />
                  </td>

                  {/* Col 3: Occupancy */}
                  <td className="px-4 py-3">
                    <OccupancyBar current={occupancy} max={facility.max_capacity} />
                  </td>

                  {/* Col 4: Residents (Avatar Stack) */}
                  <td className="px-4 py-3">
                    <ActiveStaffStack residents={residents} />
                  </td>

                  {/* Col 5: Chevron */}
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Create Slide-Over ────────────────────────────── */}
      <CreateFacilitySlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId ?? ""}
        onCreated={refresh}
      />
    </div>
  );
}
