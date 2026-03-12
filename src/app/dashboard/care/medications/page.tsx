"use client";

import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Pill,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ChevronDown,
  User,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useMedicationsStore,
  ROUTE_LABELS,
  FREQUENCY_LABELS,
  OUTCOME_LABELS,
  OUTCOME_COLORS,
  type MedicationRoute,
  type MedicationFrequency,
  type MAROutcome,
  type ParticipantMedication,
} from "@/lib/medications-store";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Frequency Badge ─────────────────────────────────── */

function FrequencyBadge({ frequency, isPrn }: { frequency: MedicationFrequency; isPrn: boolean }) {
  if (isPrn) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
        PRN
      </span>
    );
  }
  return (
    <span className="text-xs text-[var(--text-muted)]">{FREQUENCY_LABELS[frequency]}</span>
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
  const [tab, setTab] = useState<"chart" | "history">("chart");

  // Load medications on mount
  useEffect(() => {
    if (orgId) loadMedications(orgId);
  }, [orgId, loadMedications]);

  const searched = useMemo(() => {
    if (!search) return medications;
    const q = search.toLowerCase();
    return medications.filter(
      (m) =>
        m.medication_name.toLowerCase().includes(q) ||
        (m.generic_name?.toLowerCase().includes(q)) ||
        (m.prescribing_doctor?.toLowerCase().includes(q))
    );
  }, [medications, search]);

  // Group by participant
  const grouped = useMemo(() => {
    const map = new Map<string, ParticipantMedication[]>();
    for (const med of searched) {
      const key = med.participant_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(med);
    }
    return Array.from(map.entries());
  }, [searched]);

  return (
    <div className="relative min-h-screen bg-[var(--background)]">
      <div className="stealth-noise" />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="stealth-overline mb-1">CLINICAL</p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Medication Management</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              eMAR — Electronic Medication Administration Record
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Medications", value: medications.filter((m) => m.is_active).length, icon: Pill, color: "text-sky-400" },
            { label: "PRN Medications", value: medications.filter((m) => m.is_prn).length, icon: AlertTriangle, color: "text-purple-400" },
            { label: "Today's Administrations", value: marEntries.filter((e) => new Date(e.administered_at).toDateString() === new Date().toDateString()).length, icon: CheckCircle2, color: "text-sky-400" },
            { label: "Missed/Refused", value: marEntries.filter((e) => ["refused", "absent", "withheld"].includes(e.outcome)).length, icon: XCircle, color: "text-rose-400" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{card.label}</span>
                </div>
                <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[var(--subtle-bg)] rounded-lg p-1 w-fit">
          {(["chart", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-[var(--card-bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
            >
              {t === "chart" ? "Medication Chart" : "Administration History"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medications..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
        </div>

        {tab === "chart" ? (
          /* ── Medication Chart ─────────────────────────── */
          <div className="space-y-4">
            {loading && medications.length === 0 && (
              <div className="text-center py-12 text-sm text-[var(--text-muted)]">Loading medications...</div>
            )}
            {!loading && medications.length === 0 && (
              <div className="text-center py-16">
                <Pill className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No medications recorded</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Add participant medications from their profile to begin eMAR tracking.
                </p>
              </div>
            )}

            {searched.map((med) => (
              <motion.div
                key={med.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-sky-400" />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{med.medication_name}</h3>
                      <FrequencyBadge frequency={med.frequency} isPrn={med.is_prn} />
                    </div>
                    {med.generic_name && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 ml-6">{med.generic_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{ROUTE_LABELS[med.route]}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Dosage</span>
                    <p className="text-[var(--text-primary)] font-medium mt-0.5">{med.dosage}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Frequency</span>
                    <p className="text-[var(--text-primary)] font-medium mt-0.5">{FREQUENCY_LABELS[med.frequency]}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Doctor</span>
                    <p className="text-[var(--text-primary)] font-medium mt-0.5">{med.prescribing_doctor || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">Time Slots</span>
                    <p className="text-[var(--text-primary)] font-medium mt-0.5">
                      {med.time_slots.length > 0 ? med.time_slots.join(", ") : "—"}
                    </p>
                  </div>
                </div>

                {med.special_instructions && (
                  <div className="mt-3 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                    <p className="text-xs text-amber-400">⚠ {med.special_instructions}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          /* ── Administration History ────────────────────── */
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_120px_100px_1fr] gap-4 px-5 py-3 border-b border-[var(--card-border)] text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              <span>Medication</span>
              <span>Worker</span>
              <span>Outcome</span>
              <span>Time</span>
              <span>Notes</span>
            </div>
            {marEntries.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">
                No administration records yet.
              </div>
            )}
            {marEntries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_1fr_120px_100px_1fr] gap-4 px-5 py-3 items-center border-b border-[var(--card-border)] last:border-b-0 hover:bg-white/[0.02]"
              >
                <span className="text-sm text-[var(--text-primary)]">{entry.medication_name ?? "—"}</span>
                <span className="text-sm text-[var(--text-secondary)]">{entry.worker_name ?? "—"}</span>
                <span className={`text-xs font-medium ${OUTCOME_COLORS[entry.outcome]}`}>
                  {OUTCOME_LABELS[entry.outcome]}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(entry.administered_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-xs text-[var(--text-muted)] truncate">{entry.notes ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
