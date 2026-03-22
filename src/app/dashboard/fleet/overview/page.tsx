/**
 * @page /dashboard/fleet/overview
 * @status COMPLETE
 * @description Fleet overview with vehicle list, status filters, and detail drawer
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  ChevronRight,
  Car,
  SlidersHorizontal,
  Activity,
  AlertTriangle,
  X,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  listFleetVehiclesAction,
  createFleetVehicleAction,
  getFleetOverviewAction,
  runConvoyDailyGroundingAction,
} from "@/app/actions/fleet-convoy";

/* ── Types ────────────────────────────────────────────── */

type Vehicle = {
  id: string;
  name: string;
  registration_number?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  status?: string | null;
  current_odometer?: number | null;
  seating_capacity?: number | null;
  is_wav?: boolean;
  registration_expiry?: string | null;
  insurance_expiry?: string | null;
  fuel_type?: string | null;
  care_facilities?: { name?: string } | null;
};

type OverviewData = {
  status_totals: Record<string, number>;
  utilization_percent_30d: number;
  upcoming_expiries: Vehicle[];
};

type StatusFilter = "all" | "active" | "maintenance" | "out_of_service";

/* ── Helpers ──────────────────────────────────────────── */

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function complianceColor(dateStr: string | null | undefined): string {
  const d = daysUntil(dateStr);
  if (d === null) return "text-zinc-600";
  if (d < 0) return "text-rose-500 font-bold";
  if (d <= 14) return "text-amber-500";
  if (d <= 30) return "text-amber-400/70";
  return "text-zinc-400";
}

function getVehicleDisplayName(v: Vehicle): string {
  if (v.make && v.model) return `${v.make} ${v.model}${v.year ? ` (${v.year})` : ""}`;
  return v.name;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function matchesFilter(v: Vehicle, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return v.status === "active" || v.status === "in_use";
  if (filter === "maintenance") return v.status === "maintenance";
  if (filter === "out_of_service") return v.status === "out_of_service_defect" || v.status === "out_of_service_compliance";
  return true;
}

/* ── Ghost Badge ──────────────────────────────────────── */

function VehicleStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || "active";
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", label: "Active" },
    in_use: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "In Use" },
    maintenance: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Maintenance" },
    out_of_service_defect: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "OOS – Defect" },
    out_of_service_compliance: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "OOS – Compliance" },
  };
  const cfg = map[s] || map.active;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

/* ── Telemetry Ribbon Node ────────────────────────────── */

function MetricNode({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 whitespace-nowrap">{label}</span>
      <span className={`font-mono text-xl leading-none ${danger ? "text-rose-500" : "text-white"}`}>{value}</span>
    </div>
  );
}

/* ── Compliance Column ────────────────────────────────── */

function ComplianceCell({ rego, insurance }: { rego: string | null | undefined; insurance: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-zinc-600 w-8 shrink-0">REGO</span>
        <span className={`font-mono text-[11px] ${complianceColor(rego)}`}>{formatDate(rego)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-zinc-600 w-8 shrink-0">INS</span>
        <span className={`font-mono text-[11px] ${complianceColor(insurance)}`}>{formatDate(insurance)}</span>
      </div>
    </div>
  );
}

/* ── Utilization Bar ──────────────────────────────────── */

function UtilizationCell({ percent }: { percent: number }) {
  const pct = Math.min(Math.max(percent, 0), 100);
  return (
    <div>
      <span className="font-mono text-xs text-zinc-300">{pct}%</span>
      <div className="h-1.5 w-16 bg-zinc-900 rounded-full mt-1 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Compliance Alert Banner ──────────────────────────── */

function ComplianceAlert({ vehicles }: { vehicles: Vehicle[] }) {
  const expiringSoon = vehicles.filter((v) => {
    const regoDays = daysUntil(v.registration_expiry);
    const insDays = daysUntil(v.insurance_expiry);
    return (regoDays !== null && regoDays <= 14) || (insDays !== null && insDays <= 14);
  });

  const expired = vehicles.filter((v) => {
    const regoDays = daysUntil(v.registration_expiry);
    const insDays = daysUntil(v.insurance_expiry);
    return (regoDays !== null && regoDays < 0) || (insDays !== null && insDays < 0);
  });

  if (expiringSoon.length === 0 && expired.length === 0) return null;

  return (
    <div className="mx-8 mt-4 space-y-2">
      {expired.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 flex items-center">
          <AlertTriangle className="w-4 h-4 text-rose-500 mr-3 shrink-0" />
          <span className="text-[13px] text-rose-500">
            {expired.length} vehicle{expired.length > 1 ? "s" : ""} operating with expired registration or insurance. Ground immediately.
          </span>
        </div>
      )}
      {expiringSoon.length > 0 && expired.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center">
          <AlertTriangle className="w-4 h-4 text-amber-500 mr-3 shrink-0" />
          <span className="text-[13px] text-amber-500">
            {expiringSoon.length} vehicle{expiringSoon.length > 1 ? "s have" : " has"} registrations or insurance expiring within 14 days.
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL = [
  { v: "w-36", a: "w-24", u: "w-10" },
  { v: "w-28", a: "w-32", u: "w-8" },
  { v: "w-40", a: "w-20", u: "w-10" },
  { v: "w-32", a: "w-28", u: "w-12" },
  { v: "w-36", a: "w-24", u: "w-8" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SKEL[idx % SKEL.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 animate-pulse" />
          <div className="space-y-1.5">
            <div className={`h-3 ${s.v} bg-zinc-900 rounded-sm animate-pulse`} />
            <div className="h-2 w-20 bg-zinc-900/60 rounded-sm animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.a} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${s.u} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className="h-1.5 w-16 bg-zinc-900 rounded-full animate-pulse" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1">
          <div className="h-2.5 w-24 bg-zinc-900 rounded-sm animate-pulse" />
          <div className="h-2.5 w-24 bg-zinc-900/60 rounded-sm animate-pulse" />
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
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <Car className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-[15px] text-white font-medium">No fleet assets found.</p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            Add your first vehicle to begin tracking utilization, maintenance, and driver assignments.
          </p>
          <button
            onClick={onCreateClick}
            className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            + Add Vehicle
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Add Vehicle Slide-Over ───────────────────────────── */

function AddVehicleSlideOver({
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
  const [rego, setRego] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [seats, setSeats] = useState("4");
  const [isWav, setIsWav] = useState(false);
  const [wavType, setWavType] = useState<"rear_entry" | "side_entry">("rear_entry");
  const [regoExpiry, setRegoExpiry] = useState("");
  const [insExpiry, setInsExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName("");
    setRego("");
    setMake("");
    setModel("");
    setSeats("4");
    setIsWav(false);
    setWavType("rear_entry");
    setRegoExpiry("");
    setInsExpiry("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !rego.trim()) return;
    setSaving(true);
    try {
      await createFleetVehicleAction({
        organization_id: orgId,
        name: name.trim(),
        registration_number: rego.trim(),
        make: make.trim() || "Unknown",
        model: model.trim() || "Unknown",
        seating_capacity: Number(seats) || 4,
        is_wav: isWav,
        wav_type: isWav ? wavType : "none",
        wheelchair_capacity: isWav ? 1 : 0,
        registration_expiry: regoExpiry || null,
        insurance_expiry: insExpiry || null,
      });
      onCreated();
      resetForm();
      onClose();
    } catch (err) {
      console.error("Failed to create vehicle:", err);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-10 px-3 bg-zinc-900 border border-white/10 rounded-md text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all";

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
              <h2 className="text-base font-medium text-white">Add Vehicle</h2>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-zinc-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Vehicle Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Company Van 01" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Make</label>
                  <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Model</label>
                  <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="HiAce" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Registration</label>
                  <input value={rego} onChange={(e) => setRego(e.target.value)} placeholder="123-ABC" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Seats</label>
                  <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="4" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Rego Expiry</label>
                  <input type="date" value={regoExpiry} onChange={(e) => setRegoExpiry(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">Insurance Expiry</label>
                  <input type="date" value={insExpiry} onChange={(e) => setInsExpiry(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWav}
                    onChange={(e) => setIsWav(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 border border-white/10 rounded-full peer peer-checked:bg-emerald-500/30 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-xs text-zinc-300">Wheelchair Accessible Vehicle (WAV)</span>
              </div>
              {isWav && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">WAV Entry Type</label>
                  <select value={wavType} onChange={(e) => setWavType(e.target.value as "rear_entry" | "side_entry")} className={inputClass}>
                    <option value="rear_entry">Rear Entry</option>
                    <option value="side_entry">Side Entry</option>
                  </select>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !rego.trim() || saving}
                className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Creating…" : "Save Vehicle"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function FleetOverviewPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const [healthCheckPending, startHealthCheck] = useTransition();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: fleetOverviewData, isLoading: loading } = useQuery<{
    vehicles: Vehicle[];
    overview: OverviewData | null;
  }>({
    queryKey: queryKeys.fleet.overview(orgId!),
    queryFn: async () => {
      const [v, o] = await Promise.all([
        listFleetVehiclesAction(orgId!),
        getFleetOverviewAction(orgId!),
      ]);
      return {
        vehicles: ((v || []) as Vehicle[]),
        overview: (o as OverviewData) ?? null,
      };
    },
    enabled: !!orgId,
  });

  const vehicles = fleetOverviewData?.vehicles ?? [];
  const overview = fleetOverviewData?.overview ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.fleet.overview(orgId!) });

  /* ── Derived data ────────────────────────────────────── */
  const statusCounts = useMemo(() => {
    const counts = { all: vehicles.length, active: 0, maintenance: 0, out_of_service: 0 };
    for (const v of vehicles) {
      if (v.status === "active" || v.status === "in_use") counts.active++;
      else if (v.status === "maintenance") counts.maintenance++;
      else if (v.status === "out_of_service_defect" || v.status === "out_of_service_compliance") counts.out_of_service++;
    }
    return counts;
  }, [vehicles]);

  const filtered = useMemo(() => {
    let list = vehicles.filter((v) => matchesFilter(v, tab));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.make || "").toLowerCase().includes(q) ||
          (v.model || "").toLowerCase().includes(q) ||
          (v.registration_number || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, tab, search]);

  const totals = overview?.status_totals || {};
  const inUseCount = totals.in_use ?? 0;
  const maintenanceCount = totals.maintenance ?? 0;
  const criticalOOS = (totals.out_of_service_defect ?? 0) + (totals.out_of_service_compliance ?? 0);
  const utilization = overview?.utilization_percent_30d ?? 0;

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "active", label: "Active", count: statusCounts.active },
    { key: "maintenance", label: "Maintenance", count: statusCounts.maintenance },
    { key: "out_of_service", label: "OOS", count: statusCounts.out_of_service },
  ];

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs + Tabs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Rostering & Ops
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />

          {/* Pill Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  tab === t.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
                <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Health Check + Add */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search make, model, rego…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button
            onClick={() =>
              startHealthCheck(async () => {
                await runConvoyDailyGroundingAction();
                await refresh();
              })
            }
            disabled={healthCheckPending}
            className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors disabled:opacity-50"
          >
            <Activity className="w-3 h-3" />
            {healthCheckPending ? "Running…" : "Health Check"}
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            Add Vehicle
          </button>
        </div>
      </div>

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="flex items-center h-16 px-8 border-b border-white/5 bg-zinc-950/30 shrink-0 overflow-x-auto gap-0">
        <MetricNode label="Total Assets" value={vehicles.length} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="In Use" value={inUseCount} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Maintenance" value={maintenanceCount} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Critical OOS" value={criticalOOS} danger={criticalOOS > 0} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="30-Day Utilization" value={`${utilization}%`} />
      </div>

      {/* ─── Compliance Alert ─────────────────────────────── */}
      <ComplianceAlert vehicles={vehicles} />

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-0 mt-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 border-b border-white/5">
                <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Vehicle</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Status</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Assignment</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Fleet Avg</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Compliance</th>
                <th className="px-4 w-[5%]" />
              </tr>
            </thead>
            <tbody>
              {/* Loading Skeletons */}
              {loading && vehicles.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
              }

              {/* Empty State */}
              {!loading && filtered.length === 0 && (
                <EmptyState onCreateClick={() => setCreateOpen(true)} />
              )}

              {/* Data Rows */}
              {!loading && filtered.map((vehicle) => {
                const displayName = getVehicleDisplayName(vehicle);
                return (
                  <tr
                    key={vehicle.id}
                    onClick={() => router.push(`/dashboard/fleet/vehicles?id=${vehicle.id}`)}
                    className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                  >
                    {/* Col 1: Vehicle */}
                    <td className="px-8 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800/50 border border-white/5 flex items-center justify-center shrink-0">
                          <Car className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-zinc-100 font-medium truncate block">{displayName}</span>
                          {vehicle.registration_number && (
                            <span className="text-[10px] font-mono text-zinc-500 truncate block">
                              REGO: {vehicle.registration_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Status */}
                    <td className="px-4 py-3">
                      <VehicleStatusBadge status={vehicle.status} />
                    </td>

                    {/* Col 3: Assignment */}
                    <td className="px-4 py-3">
                      {vehicle.care_facilities?.name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                            <span className="text-[8px] text-zinc-400 font-medium">
                              {getInitials(vehicle.care_facilities.name)}
                            </span>
                          </div>
                          <span className="text-[13px] text-zinc-300 truncate">{vehicle.care_facilities.name}</span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-zinc-600 italic">Available at Depot</span>
                      )}
                    </td>

                    {/* Col 4: Fleet Avg Utilization */}
                    <td className="px-4 py-3">
                      <UtilizationCell percent={utilization} />
                    </td>

                    {/* Col 5: Compliance */}
                    <td className="px-4 py-3">
                      <ComplianceCell rego={vehicle.registration_expiry} insurance={vehicle.insurance_expiry} />
                    </td>

                    {/* Col 6: Chevron */}
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add Vehicle Slide-Over ───────────────────────── */}
      <AddVehicleSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId ?? ""}
        onCreated={refresh}
      />
    </div>
  );
}
