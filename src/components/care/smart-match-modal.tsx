/**
 * @component SmartMatchModal
 * @status COMPLETE
 * @description AI-powered modal for matching participants to optimal support workers
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  Clock,
  MapPin,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  X,
  Loader2,
  Zap,
  DollarSign,
} from "lucide-react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { ObsidianModal, ObsidianModalHeader } from "@/components/ui/obsidian-modal";
import {
  getEligibleWorkers,
  type EligibleWorker,
} from "@/app/actions/staff-profiles";
import { evaluateShiftRevenue } from "@/app/actions/shift-cost";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ── Types ────────────────────────────────────────────── */

interface SmartMatchModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (workerId: string, data: AssignmentData) => void;
  organizationId: string;
  participants: { id: string; name: string; lat?: number; lng?: number }[];
  ndisItems: { number: string; name: string }[];
}

interface AssignmentData {
  participant_id: string;
  ndis_line_item: string;
  shift_start: string;
  shift_end: string;
  worker_id: string;
}

type Step = "demand" | "filter" | "recommend";

const ease = [0.16, 1, 0.3, 1] as const;

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

/* ── Step Indicator ───────────────────────────────────── */

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
            i < current ? "bg-[var(--brand)] text-black"
            : i === current ? "bg-white/[0.1] text-white border border-white/[0.2]"
            : "bg-white/[0.03] text-zinc-600 border border-white/[0.06]"
          }`}>
            {i < current ? <CheckCircle2 size={12} /> : i + 1}
          </div>
          <span className={`text-[11px] ${i <= current ? "text-zinc-300" : "text-zinc-600"}`}>{label}</span>
          {i < steps.length - 1 && <ChevronRight size={12} className="text-zinc-700 mx-1" />}
        </div>
      ))}
    </div>
  );
}

/* ── Worker Card ──────────────────────────────────────── */

function WorkerCard({
  worker,
  revenuePerHour,
  hours,
  selected,
  onSelect,
}: {
  worker: EligibleWorker;
  revenuePerHour: number;
  hours: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const margin = revenuePerHour - worker.projected_cost_per_hour;
  const marginPct = revenuePerHour > 0 ? Math.round((margin / revenuePerHour) * 100) : 0;
  const hoursUsed = worker.weekly_hours;
  const hoursMax = worker.max_weekly_hours;
  const hoursPct = Math.min(Math.round((hoursUsed / hoursMax) * 100), 100);

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? "border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] ring-1 ring-[var(--brand)]/20"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <LetterAvatar name={worker.full_name || "?"} src={worker.avatar_url} size={36} variant="rounded" ring />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-zinc-200 truncate">{worker.full_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-500 font-mono">Level {worker.schads_level}</span>
            {worker.credential_status === "compliant" ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400">
                <Shield size={8} /> Compliant
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-400">
                <XCircle size={8} /> Non-compliant
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {worker.distance_km !== null && (
          <div>
            <p className="text-[9px] text-zinc-600 font-mono uppercase">Distance</p>
            <p className="text-[12px] text-zinc-300 font-mono tabular-nums">{worker.distance_km}km</p>
          </div>
        )}
        <div>
          <p className="text-[9px] text-zinc-600 font-mono uppercase">Cost/hr</p>
          <p className="text-[12px] text-zinc-300 font-mono tabular-nums">{fmtCurrency(worker.projected_cost_per_hour)}</p>
        </div>
        <div>
          <p className="text-[9px] text-zinc-600 font-mono uppercase">Margin</p>
          <p className={`text-[12px] font-mono tabular-nums font-medium ${
            marginPct >= 30 ? "text-emerald-400" : marginPct >= 15 ? "text-amber-400" : "text-rose-400"
          }`}>
            {marginPct}%
          </p>
        </div>
      </div>

      {/* Hours bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-zinc-600 font-mono">{hoursUsed}h / {hoursMax}h this week</span>
          {!worker.fatigue_compliant && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-400">
              <AlertTriangle size={8} /> Fatigue
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              hoursPct >= 90 ? "bg-rose-500" : hoursPct >= 75 ? "bg-amber-500" : "bg-[var(--brand)]"
            }`}
            style={{ width: `${hoursPct}%` }}
          />
        </div>
      </div>
    </motion.button>
  );
}

/* ── Main Modal ───────────────────────────────────────── */

export function SmartMatchModal({
  open,
  onClose,
  onAssign,
  organizationId,
  participants,
  ndisItems,
}: SmartMatchModalProps) {
  const [step, setStep] = useState<Step>("demand");
  const [loading, setLoading] = useState(false);

  // Step 1: Demand
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [selectedNdisItem, setSelectedNdisItem] = useState("");
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [shiftStartTime, setShiftStartTime] = useState("08:00");
  const [shiftEndTime, setShiftEndTime] = useState("12:00");
  const [participantSearch, setParticipantSearch] = useState("");
  const [ndisSearch, setNdisSearch] = useState("");

  // Step 2/3: Results
  const [eligibleWorkers, setEligibleWorkers] = useState<EligibleWorker[]>([]);
  const [revenuePerHour, setRevenuePerHour] = useState(0);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [filterStats, setFilterStats] = useState({ total: 0, afterGeo: 0, afterCred: 0, afterFatigue: 0, final: 0 });

  // Derived
  const shiftStart = `${shiftDate}T${shiftStartTime}:00`;
  const shiftEnd = `${shiftDate}T${shiftEndTime}:00`;
  const shiftHours = useMemo(() => {
    const start = new Date(shiftStart);
    const end = new Date(shiftEnd);
    return Math.max(0, (end.getTime() - start.getTime()) / 3600000);
  }, [shiftStart, shiftEnd]);

  const filteredParticipants = useMemo(() => {
    if (!participantSearch) return participants.slice(0, 20);
    const q = participantSearch.toLowerCase();
    return participants.filter(p => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [participants, participantSearch]);

  const filteredNdisItems = useMemo(() => {
    if (!ndisSearch) return ndisItems.slice(0, 20);
    const q = ndisSearch.toLowerCase();
    return ndisItems.filter(n => n.number.toLowerCase().includes(q) || n.name.toLowerCase().includes(q)).slice(0, 20);
  }, [ndisItems, ndisSearch]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("demand");
      setSelectedParticipant("");
      setSelectedNdisItem("");
      setSelectedWorker(null);
      setEligibleWorkers([]);
    }
  }, [open]);

  const handleRunFilter = useCallback(async () => {
    if (!selectedParticipant || !selectedNdisItem) return;
    setLoading(true);
    setStep("filter");

    try {
      const participant = participants.find(p => p.id === selectedParticipant);

      const [workers, revenue] = await Promise.all([
        getEligibleWorkers({
          organization_id: organizationId,
          participant_id: selectedParticipant,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          participant_lat: participant?.lat,
          participant_lng: participant?.lng,
          max_distance_km: 50,
        }),
        evaluateShiftRevenue(selectedNdisItem, shiftHours),
      ]);

      setEligibleWorkers(workers);
      setRevenuePerHour(revenue.rate);

      // Calculate filter stats
      const total = workers.length;
      const compliant = workers.filter(w => w.credential_status === "compliant");
      const fatigueOk = compliant.filter(w => w.fatigue_compliant);

      setFilterStats({
        total,
        afterGeo: total,
        afterCred: compliant.length,
        afterFatigue: fatigueOk.length,
        final: fatigueOk.length,
      });

      // Auto-advance to recommend
      setTimeout(() => setStep("recommend"), 600);
    } catch (err) {
      console.error("Smart match failed:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedParticipant, selectedNdisItem, shiftStart, shiftEnd, shiftHours, organizationId, participants]);

  const handleAssign = useCallback(() => {
    if (!selectedWorker) return;
    onAssign(selectedWorker, {
      participant_id: selectedParticipant,
      ndis_line_item: selectedNdisItem,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      worker_id: selectedWorker,
    });
    onClose();
  }, [selectedWorker, selectedParticipant, selectedNdisItem, shiftStart, shiftEnd, onAssign, onClose]);

  const topWorkers = useMemo(() => {
    return eligibleWorkers
      .filter(w => w.credential_status === "compliant" && w.fatigue_compliant)
      .slice(0, 6);
  }, [eligibleWorkers]);

  const stepIndex = step === "demand" ? 0 : step === "filter" ? 1 : 2;

  return (
    <ObsidianModal open={open} onClose={onClose} maxWidth="2xl">
      <ObsidianModalHeader title="Smart Match — Shift Assignment" onClose={onClose} />

      <div className="px-6 py-5">
        <StepIndicator current={stepIndex} steps={["Service Demand", "Worker Filter", "Recommended"]} />

        <AnimatePresence mode="wait">
          {/* ── Step 1: Demand ── */}
          {step === "demand" && (
            <motion.div
              key="demand"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Participant */}
              <div>
                <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Participant
                </label>
                <select
                  value={selectedParticipant}
                  onChange={(e) => setSelectedParticipant(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
                >
                  <option value="">Select participant...</option>
                  {filteredParticipants.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* NDIS Line Item */}
              <div>
                <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  NDIS Support Line Item
                </label>
                <select
                  value={selectedNdisItem}
                  onChange={(e) => setSelectedNdisItem(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
                >
                  <option value="">Select NDIS item...</option>
                  {filteredNdisItems.map((n) => (
                    <option key={n.number} value={n.number}>{n.number} — {n.name}</option>
                  ))}
                </select>
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Date</label>
                  <input
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Start</label>
                  <input
                    type="time"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">End</label>
                  <input
                    type="time"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
                  />
                </div>
              </div>

              {shiftHours > 0 && (
                <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                  <Clock size={12} />
                  <span>{shiftHours} hours</span>
                </div>
              )}

              <div className="pt-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRunFilter}
                  disabled={!selectedParticipant || !selectedNdisItem || shiftHours <= 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2.5 text-[13px] font-semibold text-black transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <Zap size={14} />
                  Run Smart Match
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Filter (brief animation) ── */}
          {step === "filter" && (
            <motion.div
              key="filter"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-12"
            >
              <Loader2 size={32} className="animate-spin text-[var(--brand)] mb-4" />
              <p className="text-[14px] text-zinc-300 font-medium">Running compliance filters...</p>
              <p className="text-[12px] text-zinc-500 mt-1">
                Checking credentials, fatigue rules, and qualifications
              </p>
            </motion.div>
          )}

          {/* ── Step 3: Recommend ── */}
          {step === "recommend" && (
            <motion.div
              key="recommend"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Filter funnel summary */}
              <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Users size={12} className="text-zinc-500" />
                  <span className="text-zinc-400">{filterStats.total} total</span>
                </div>
                <ChevronRight size={10} className="text-zinc-700" />
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Shield size={12} className="text-emerald-500" />
                  <span className="text-zinc-400">{filterStats.afterCred} compliant</span>
                </div>
                <ChevronRight size={10} className="text-zinc-700" />
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Clock size={12} className="text-blue-400" />
                  <span className="text-zinc-400">{filterStats.afterFatigue} fatigue-safe</span>
                </div>
              </div>

              {/* Revenue display */}
              {revenuePerHour > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <DollarSign size={14} className="text-emerald-400" />
                  <span className="text-[12px] text-zinc-400">
                    NDIS Rate: <strong className="text-emerald-400">{fmtCurrency(revenuePerHour)}/hr</strong>
                    {" "} × {shiftHours}h = <strong className="text-emerald-300">{fmtCurrency(revenuePerHour * shiftHours)}</strong>
                  </span>
                </div>
              )}

              {/* Worker cards */}
              {topWorkers.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto scrollbar-none">
                  {topWorkers.map((worker, i) => (
                    <WorkerCard
                      key={worker.user_id}
                      worker={worker}
                      revenuePerHour={revenuePerHour}
                      hours={shiftHours}
                      selected={selectedWorker === worker.user_id}
                      onSelect={() => setSelectedWorker(worker.user_id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12">
                  <AlertTriangle size={24} className="text-amber-400 mb-3" />
                  <p className="text-[14px] text-zinc-300">No eligible workers found</p>
                  <p className="text-[12px] text-zinc-500 mt-1 text-center max-w-sm">
                    All available workers are either non-compliant, in a fatigue window, or outside the service area.
                  </p>
                  <button
                    onClick={() => setStep("demand")}
                    className="mt-4 text-[12px] text-[var(--brand)] hover:underline"
                  >
                    Adjust search parameters
                  </button>
                </div>
              )}

              {/* Action buttons */}
              {topWorkers.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setStep("demand")}
                    className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Back to search
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAssign}
                    disabled={!selectedWorker}
                    className="flex items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-[13px] font-semibold text-black transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    <CheckCircle2 size={14} />
                    Assign Worker
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ObsidianModal>
  );
}
