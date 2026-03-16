"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  Pill,
  X,
  Clock,
  Shield,
} from "lucide-react";
import {
  useMedicationsStore,
  ROUTE_LABELS,
  FREQUENCY_LABELS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  type ParticipantMedication,
  type MAREntry,
  type MAROutcome,
  type MedicationRoute,
  type MedicationFrequency,
} from "@/lib/medications-store";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Types ────────────────────────────────────────────── */

type TabFilter = "chart" | "prn" | "history";

/* ── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function formatTimeSlots(slots: string[]): string {
  if (!slots || slots.length === 0) return "—";
  return slots.join(", ");
}

function getStatusBadge(med: ParticipantMedication, marEntries: MAREntry[]): { label: string; style: string } {
  // Check if any administration today
  const today = new Date().toDateString();
  const todayEntries = marEntries.filter(
    (e) => e.medication_id === med.id && new Date(e.administered_at).toDateString() === today
  );

  if (todayEntries.length > 0) {
    const last = todayEntries[0];
    if (last.outcome === "given" || last.outcome === "self_administered" || last.outcome === "prn_given") {
      return { label: "Administered", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    }
    if (last.outcome === "refused") {
      return { label: "Refused", style: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
    }
    if (last.outcome === "withheld" || last.outcome === "absent") {
      return { label: "Missed", style: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
    }
  }

  if (med.is_prn) {
    return { label: "PRN", style: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
  }

  // Check if due soon based on time slots
  if (med.time_slots && med.time_slots.length > 0) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const slot of med.time_slots) {
      const [h, m] = slot.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const slotMin = h * 60 + m;
        const diff = slotMin - nowMin;
        if (diff > 0 && diff <= 60) {
          return { label: "Due Soon", style: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
        }
        if (diff < 0 && diff > -120 && todayEntries.length === 0) {
          return { label: "Overdue", style: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
        }
      }
    }
  }

  return { label: "Scheduled", style: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" };
}

function getLastAdmin(med: ParticipantMedication, marEntries: MAREntry[]): { time: string; by: string } | null {
  const entry = marEntries.find((e) => e.medication_id === med.id);
  if (!entry) return null;
  try {
    const d = new Date(entry.administered_at);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const timeStr = d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
    const prefix = isToday ? "Today" : d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
    return { time: `${prefix}, ${timeStr}`, by: entry.worker_name || "Unknown" };
  } catch {
    return null;
  }
}

/* ── Telemetry Metric Node ────────────────────────────── */

function MetricNode({ label, value, danger, pulse }: { label: string; value: string | number; danger?: boolean; pulse?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
        )}
        <span className={`font-mono text-xl leading-none ${danger ? "text-rose-500 font-bold" : "text-white"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL = [
  { p: "w-28", m: "w-36", s: "w-20", l: "w-24" },
  { p: "w-32", m: "w-28", s: "w-16", l: "w-28" },
  { p: "w-24", m: "w-40", s: "w-20", l: "w-20" },
  { p: "w-36", m: "w-32", s: "w-24", l: "w-24" },
  { p: "w-28", m: "w-36", s: "w-16", l: "w-28" },
  { p: "w-32", m: "w-28", s: "w-20", l: "w-20" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SKEL[idx % SKEL.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse" />
          <div className={`h-3 ${s.p} bg-zinc-900 rounded-sm animate-pulse`} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1.5">
          <div className={`h-3 ${s.m} bg-zinc-900 rounded-sm animate-pulse`} />
          <div className="h-2 w-20 bg-zinc-900/60 rounded-sm animate-pulse" />
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${s.s} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.l} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <Pill className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-[15px] text-white font-medium">No active medications found.</p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            This participant currently has no scheduled or PRN medications on their chart.
          </p>
          <button
            onClick={onAddClick}
            className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            + Add Medication
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Medication Detail Slide-Over ─────────────────────── */

function MedicationSlideOver({
  med,
  marEntries,
  onClose,
  onLogAdmin,
}: {
  med: ParticipantMedication | null;
  marEntries: MAREntry[];
  onClose: () => void;
  onLogAdmin: (med: ParticipantMedication) => void;
}) {
  if (!med) return null;

  const history = marEntries
    .filter((e) => e.medication_id === med.id)
    .slice(0, 15);

  return (
    <AnimatePresence>
      {med && (
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
            className="fixed right-0 top-0 bottom-0 z-50 w-[500px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-zinc-800/50 border border-white/5 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-medium text-white truncate">{med.medication_name}</h2>
                  <p className="text-xs text-zinc-500">{med.dosage} · {ROUTE_LABELS[med.route]}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Prescription Details */}
              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">Prescription Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Frequency", value: FREQUENCY_LABELS[med.frequency] },
                    { label: "Route", value: ROUTE_LABELS[med.route] },
                    { label: "Doctor", value: med.prescribing_doctor || "—" },
                    { label: "Pharmacy", value: med.pharmacy || "—" },
                    { label: "Start Date", value: med.start_date || "—" },
                    { label: "End Date", value: med.end_date || "—" },
                  ].map((item) => (
                    <div key={item.label}>
                      <span className="text-[10px] text-zinc-600 uppercase">{item.label}</span>
                      <p className="text-sm text-zinc-200 mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">Schedule</h4>
                <div className="flex flex-wrap gap-2">
                  {med.time_slots && med.time_slots.length > 0 ? (
                    med.time_slots.map((slot) => (
                      <span key={slot} className="px-2.5 py-1 rounded-md bg-zinc-900 border border-white/5 font-mono text-xs text-zinc-300">
                        {slot}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500 italic">{med.is_prn ? "As Needed (PRN)" : "No schedule set"}</span>
                  )}
                </div>
              </div>

              {/* PRN Protocols */}
              {med.is_prn && (
                <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold mb-2">PRN Protocol</h4>
                  {med.prn_reason && <p className="text-sm text-zinc-200 mb-2">{med.prn_reason}</p>}
                  <div className="flex gap-4 text-xs">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(med as any).prn_min_gap_hours && (
                      <span className="text-zinc-400">Min gap: <span className="font-mono text-zinc-200">{(med as any).prn_min_gap_hours}h</span></span>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(med as any).prn_max_doses_24h && (
                      <span className="text-zinc-400">Max 24h: <span className="font-mono text-zinc-200">{(med as any).prn_max_doses_24h} doses</span></span>
                    )}
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              {med.special_instructions && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold mb-2">Special Instructions</h4>
                  <p className="text-sm text-zinc-200 leading-relaxed">{med.special_instructions}</p>
                </div>
              )}

              {/* Administration History */}
              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">Administration History</h4>
                {history.length === 0 ? (
                  <p className="text-sm text-zinc-600 italic">No administrations recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${OUTCOME_COLORS[entry.outcome]}`}>
                              {OUTCOME_LABELS[entry.outcome]}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-500">
                              {new Date(entry.administered_at).toLocaleString("en-AU", {
                                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">by {entry.worker_name || "Unknown"}</p>
                          {entry.notes && <p className="text-xs text-zinc-400 mt-1">{entry.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0">
              <button onClick={() => { onLogAdmin(med); onClose(); }} className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98]">
                Log Administration
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Log Administration Slide-Over ────────────────────── */

function LogAdministrationSlideOver({
  med,
  orgId,
  onClose,
  onSaved,
}: {
  med: ParticipantMedication | null;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const recordAdministration = useMedicationsStore((s) => s.recordAdministration);
  const [outcome, setOutcome] = useState<MAROutcome>("given");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const outcomes: MAROutcome[] = ["given", "refused", "absent", "withheld", "self_administered", "prn_given", "not_available", "other"];

  const handleSubmit = async () => {
    if (!med || !orgId) return;
    setSaving(true);
    setError("");
    try {
      const result = await recordAdministration({
        organization_id: orgId,
        medication_id: med.id,
        participant_id: med.participant_id,
        worker_id: "",
        shift_id: null,
        outcome,
        administered_at: new Date().toISOString(),
        notes: notes.trim() || null,
        prn_effectiveness: null,
        prn_followup_at: null,
        prn_followup_done: false,
        witness_id: null,
      });
      if (!result) throw new Error("Failed to record administration");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to log administration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {med && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-white">Log Administration</h2>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">{med.medication_name} · {med.dosage}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-md border border-white/5 bg-white/[0.03] flex items-center justify-center hover:bg-white/[0.06] transition-colors">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-2">Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  {outcomes.map((o) => (
                    <button
                      key={o}
                      onClick={() => setOutcome(o)}
                      className={`h-10 rounded-md border text-xs font-medium transition-colors ${
                        outcome === o
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border-white/5 bg-zinc-900 text-zinc-400 hover:bg-white/[0.04]"
                      }`}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-2">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations, participant reaction, refusal reason…"
                  rows={4}
                  className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors resize-none"
                />
              </div>

              <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-400/80 font-medium">Administration time: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Record will be timestamped to now. Ensure you are logging at the time of administration.</p>
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Logging…" : "Confirm Administration"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Add Medication Slide-Over ─────────────────────────── */

function AddMedicationSlideOver({
  orgId,
  onClose,
  onSaved,
}: {
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createMedication = useMedicationsStore((s) => s.createMedication);
  const [form, setForm] = useState({
    medication_name: "",
    generic_name: "",
    dosage: "",
    route: "oral" as MedicationRoute,
    frequency: "once_daily" as MedicationFrequency,
    prescribing_doctor: "",
    participant_id: "",
    is_prn: false,
    prn_reason: "",
    special_instructions: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const f = (key: string, val: string | boolean) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!form.medication_name.trim() || !form.dosage.trim() || !form.participant_id.trim()) {
      setError("Medication name, dosage, and participant ID are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await createMedication({
        organization_id: orgId,
        participant_id: form.participant_id,
        medication_name: form.medication_name.trim(),
        generic_name: form.generic_name.trim() || null,
        dosage: form.dosage.trim(),
        route: form.route,
        frequency: form.frequency,
        time_slots: [],
        prescribing_doctor: form.prescribing_doctor.trim() || null,
        pharmacy: null,
        start_date: new Date().toISOString().split("T")[0],
        end_date: null,
        is_prn: form.is_prn,
        prn_reason: form.is_prn ? form.prn_reason.trim() || null : null,
        special_instructions: form.special_instructions.trim() || null,
        is_active: true,
      });
      if (!result) throw new Error("Failed to create medication record");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to add medication. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 h-full w-[500px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Add Medication</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Create a new prescription record</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md border border-white/5 bg-white/[0.03] flex items-center justify-center hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {[
            { label: "Participant ID", key: "participant_id", placeholder: "Participant UUID" },
            { label: "Medication Name", key: "medication_name", placeholder: "e.g. Paracetamol" },
            { label: "Generic Name (optional)", key: "generic_name", placeholder: "e.g. Acetaminophen" },
            { label: "Dosage", key: "dosage", placeholder: "e.g. 500mg twice daily" },
            { label: "Prescribing Doctor (optional)", key: "prescribing_doctor", placeholder: "Dr. Name" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5">{label}</label>
              <input
                value={(form as any)[key]}
                onChange={(e) => f(key, e.target.value)}
                placeholder={placeholder}
                className="w-full h-9 bg-zinc-900 border border-white/5 rounded-md px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5">Route</label>
              <select value={form.route} onChange={(e) => f("route", e.target.value)} className="w-full h-9 bg-zinc-900 border border-white/5 rounded-md px-3 text-sm text-white outline-none focus:border-zinc-700">
                {(Object.keys(ROUTE_LABELS) as MedicationRoute[]).map((r) => (
                  <option key={r} value={r}>{ROUTE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5">Frequency</label>
              <select value={form.frequency} onChange={(e) => f("frequency", e.target.value)} className="w-full h-9 bg-zinc-900 border border-white/5 rounded-md px-3 text-sm text-white outline-none focus:border-zinc-700">
                {(Object.keys(FREQUENCY_LABELS) as MedicationFrequency[]).map((fr) => (
                  <option key={fr} value={fr}>{FREQUENCY_LABELS[fr]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => f("is_prn", !form.is_prn)}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.is_prn ? "bg-emerald-500" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.is_prn ? "translate-x-4" : ""}`} />
            </button>
            <label className="text-sm text-zinc-300 cursor-pointer" onClick={() => f("is_prn", !form.is_prn)}>PRN (As Needed)</label>
          </div>

          {form.is_prn && (
            <div>
              <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5">PRN Reason</label>
              <input
                value={form.prn_reason}
                onChange={(e) => f("prn_reason", e.target.value)}
                placeholder="e.g. Breakthrough pain"
                className="w-full h-9 bg-zinc-900 border border-white/5 rounded-md px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5">Special Instructions (optional)</label>
            <textarea
              value={form.special_instructions}
              onChange={(e) => f("special_instructions", e.target.value)}
              placeholder="e.g. Take with food. Do not crush."
              rows={2}
              className="w-full bg-zinc-900 border border-white/5 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors resize-none"
            />
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 rounded-md border border-white/5 text-sm text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Adding…" : "Add Medication"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function MedicationsPage() {
  const { orgId } = useOrg();
  const medications = useMedicationsStore((s) => s.medications);
  const marEntries = useMedicationsStore((s) => s.marEntries);
  const loading = useMedicationsStore((s) => s.loading);
  const loadMedications = useMedicationsStore((s) => s.loadMedications);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("chart");
  const [selectedMed, setSelectedMed] = useState<ParticipantMedication | null>(null);
  const [logAdmin, setLogAdmin] = useState<ParticipantMedication | null>(null);
  const [showAddMed, setShowAddMed] = useState(false);

  useEffect(() => {
    if (orgId) loadMedications(orgId);
  }, [orgId, loadMedications]);

  /* ── Computed metrics ────────────────────────────────── */
  const metrics = useMemo(() => {
    const active = medications.filter((m) => m.is_active).length;
    const prn = medications.filter((m) => m.is_prn).length;
    const today = new Date().toDateString();
    const todayAdmins = marEntries.filter((e) => new Date(e.administered_at).toDateString() === today).length;
    const missed = marEntries.filter((e) => ["refused", "absent", "withheld"].includes(e.outcome)).length;
    return { active, prn, todayAdmins, missed };
  }, [medications, marEntries]);

  /* ── Filtered list ───────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = medications;
    if (tab === "prn") list = list.filter((m) => m.is_prn);
    if (tab === "chart") list = list.filter((m) => m.is_active);

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.medication_name.toLowerCase().includes(q) ||
          (m.generic_name?.toLowerCase().includes(q)) ||
          (m.prescribing_doctor?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [medications, tab, search]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "chart", label: "Active Chart" },
    { key: "prn", label: "PRN Only" },
    { key: "history", label: "Admin History" },
  ];

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs + Tabs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Clinical & Safety
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
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Filter + Add */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participant, medication…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          <button onClick={() => setShowAddMed(true)} className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95">
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            Add Medication
          </button>
        </div>
      </div>

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="flex items-center h-16 px-8 border-b border-white/5 bg-zinc-950/30 shrink-0 overflow-x-auto gap-0">
        <MetricNode label="Active Prescriptions" value={metrics.active} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="PRN Available" value={metrics.prn} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Today's Admins" value={metrics.todayAdmins} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Missed / Refused" value={metrics.missed} danger={metrics.missed > 0} pulse={metrics.missed > 0} />
      </div>

      {/* ─── Data Grid (eMAR Chart or Admin History) ──────── */}
      <div className="flex-1 overflow-y-auto">
        {tab === "history" ? (
          /* ── Administration History Table ──────────────── */
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 border-b border-white/5">
                <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Medication</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Worker</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Outcome</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Time</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {marEntries.length === 0 && !loading && (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
                      <Clock className="w-8 h-8 text-zinc-800 mb-4" />
                      <p className="text-[15px] text-white font-medium">No administration records yet.</p>
                      <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
                        Administration records will appear here as workers log medications.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {marEntries.map((entry) => (
                <tr key={entry.id} className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors h-14">
                  <td className="px-8 py-3 text-sm text-zinc-100 font-medium">{entry.medication_name || "—"}</td>
                  <td className="px-4 py-3 text-[13px] text-zinc-300">{entry.worker_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${OUTCOME_COLORS[entry.outcome]}`}>
                      {OUTCOME_LABELS[entry.outcome]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {new Date(entry.administered_at).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 truncate max-w-[200px]">{entry.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* ── eMAR Chart Grid ──────────────────────────── */
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 border-b border-white/5">
                <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Participant</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Medication & Dosage</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Schedule</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Status</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Last Admin</th>
                <th className="px-4 w-[5%]" />
              </tr>
            </thead>
            <tbody>
              {/* Loading Skeletons */}
              {loading && medications.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
              }

              {/* Empty State */}
              {!loading && filtered.length === 0 && (
                <EmptyState onAddClick={() => setShowAddMed(true)} />
              )}

              {/* Data Rows */}
              {!loading && filtered.map((med) => {
                const status = getStatusBadge(med, marEntries);
                const lastAdmin = getLastAdmin(med, marEntries);
                const participantId = med.participant_id;
                const shortId = participantId ? participantId.slice(0, 6).toUpperCase() : "";

                return (
                  <tr
                    key={med.id}
                    onClick={() => setSelectedMed(med)}
                    className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                  >
                    {/* Col 1: Participant */}
                    <td className="px-8 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-zinc-400 font-medium">
                            {getInitials(med.medication_name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-zinc-100 font-medium truncate block">
                            {(med as any).participant_name || (med as any).participant_profiles?.preferred_name || (med as any).participant_profiles?.full_name || `Participant`}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 truncate block">
                            ID: {shortId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Medication & Dosage */}
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium truncate">{med.medication_name}</span>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(med as any).is_s8_controlled && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/20">S8</span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400 truncate block">
                          {med.dosage} · Route: {ROUTE_LABELS[med.route]}
                        </span>
                      </div>
                    </td>

                    {/* Col 3: Schedule */}
                    <td className="px-4 py-3">
                      {med.is_prn ? (
                        <span className="text-xs text-purple-400 italic">As Needed (PRN)</span>
                      ) : (
                        <span className="font-mono text-xs text-zinc-300">
                          {formatTimeSlots(med.time_slots)}
                        </span>
                      )}
                    </td>

                    {/* Col 4: Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${status.style}`}>
                        {status.label}
                      </span>
                    </td>

                    {/* Col 5: Last Admin */}
                    <td className="px-4 py-3">
                      {lastAdmin ? (
                        <div>
                          <span className="font-mono text-[11px] text-zinc-300 block">{lastAdmin.time}</span>
                          <span className="text-[11px] text-zinc-500">by {lastAdmin.by}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600 italic">No record</span>
                      )}
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
        )}
      </div>

      {/* ─── Medication Detail Slide-Over ─────────────────── */}
      <MedicationSlideOver
        med={selectedMed}
        marEntries={marEntries}
        onClose={() => setSelectedMed(null)}
        onLogAdmin={(med) => setLogAdmin(med)}
      />

      {/* ─── Log Administration Slide-Over ────────────────── */}
      <LogAdministrationSlideOver
        med={logAdmin}
        orgId={orgId || ""}
        onClose={() => setLogAdmin(null)}
        onSaved={() => { if (orgId) loadMedications(orgId); }}
      />

      {/* ─── Add Medication Slide-Over ─────────────────────── */}
      <AnimatePresence>
        {showAddMed && (
          <AddMedicationSlideOver
            orgId={orgId || ""}
            onClose={() => setShowAddMed(false)}
            onSaved={() => { if (orgId) loadMedications(orgId); setShowAddMed(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
