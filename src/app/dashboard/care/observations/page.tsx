"use client";

import { motion } from "framer-motion";
import {
  Search,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Scale,
  Brain,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────── */

type ObservationType = "blood_pressure" | "blood_glucose" | "heart_rate" | "temperature" | "weight" | "oxygen_saturation" | "respiration_rate" | "seizure" | "pain_level" | "bowel_movement" | "fluid_intake" | "food_intake" | "sleep_quality" | "mood" | "other";

interface HealthObservation {
  id: string;
  organization_id: string;
  participant_id: string;
  worker_id: string;
  shift_id: string | null;
  observation_type: ObservationType;
  value_numeric: number | null;
  value_text: string | null;
  value_systolic: number | null;
  value_diastolic: number | null;
  unit: string | null;
  is_abnormal: boolean;
  notes: string | null;
  observed_at: string;
  created_at: string;
  // Joined
  worker_name?: string;
  participant_name?: string;
}

/* ── Helpers ─────────────────────────────────────────── */

const OBS_CONFIG: Record<ObservationType, { label: string; icon: typeof Activity; color: string; unit: string }> = {
  blood_pressure: { label: "Blood Pressure", icon: Heart, color: "text-rose-400", unit: "mmHg" },
  blood_glucose: { label: "Blood Glucose", icon: Droplets, color: "text-amber-400", unit: "mmol/L" },
  heart_rate: { label: "Heart Rate", icon: Heart, color: "text-rose-400", unit: "bpm" },
  temperature: { label: "Temperature", icon: Thermometer, color: "text-orange-400", unit: "°C" },
  weight: { label: "Weight", icon: Scale, color: "text-sky-400", unit: "kg" },
  oxygen_saturation: { label: "SpO2", icon: Activity, color: "text-emerald-400", unit: "%" },
  respiration_rate: { label: "Respiration Rate", icon: Activity, color: "text-sky-400", unit: "/min" },
  seizure: { label: "Seizure", icon: AlertCircle, color: "text-rose-400", unit: "" },
  pain_level: { label: "Pain Level", icon: AlertCircle, color: "text-amber-400", unit: "/10" },
  bowel_movement: { label: "Bowel Movement", icon: Activity, color: "text-zinc-400", unit: "" },
  fluid_intake: { label: "Fluid Intake", icon: Droplets, color: "text-sky-400", unit: "mL" },
  food_intake: { label: "Food Intake", icon: Activity, color: "text-emerald-400", unit: "" },
  sleep_quality: { label: "Sleep Quality", icon: Brain, color: "text-purple-400", unit: "/10" },
  mood: { label: "Mood", icon: Brain, color: "text-purple-400", unit: "" },
  other: { label: "Other", icon: Activity, color: "text-zinc-400", unit: "" },
};

function formatObsValue(obs: HealthObservation): string {
  if (obs.observation_type === "blood_pressure" && obs.value_systolic != null && obs.value_diastolic != null) {
    return `${obs.value_systolic}/${obs.value_diastolic}`;
  }
  if (obs.value_numeric != null) {
    const config = OBS_CONFIG[obs.observation_type];
    return `${obs.value_numeric}${config.unit ? ` ${config.unit}` : ""}`;
  }
  return obs.value_text || "—";
}

/* ── Main Page ────────────────────────────────────────── */

export default function ObservationsPage() {
  const { orgId } = useOrg();
  const [observations, setObservations] = useState<HealthObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ObservationType | "all">("all");

  // Load observations
  useState(() => {
    if (!orgId) return;
    setLoading(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("health_observations")
      .select("*, profiles!worker_id ( full_name )")
      .eq("organization_id", orgId)
      .order("observed_at", { ascending: false })
      .limit(200)
      .then(({ data, error }: { data: unknown[]; error: unknown }) => {
        if (!error && data) {
          setObservations(
            (data as Record<string, unknown>[]).map((row) => {
              const profile = row.profiles as Record<string, unknown> | null;
              return { ...row, worker_name: (profile?.full_name as string) ?? null } as HealthObservation;
            })
          );
        }
        setLoading(false);
      });
  });

  const filtered = useMemo(() => {
    let result = observations;
    if (typeFilter !== "all") result = result.filter((o) => o.observation_type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        OBS_CONFIG[o.observation_type].label.toLowerCase().includes(q) ||
        (o.notes?.toLowerCase().includes(q)) ||
        (o.worker_name?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [observations, typeFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: observations.length,
    abnormal: observations.filter((o) => o.is_abnormal).length,
    today: observations.filter((o) => new Date(o.observed_at).toDateString() === new Date().toDateString()).length,
    types: new Set(observations.map((o) => o.observation_type)).size,
  }), [observations]);

  return (
    <div className="stealth-noise min-h-screen">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <p className="stealth-overline mb-1">CLINICAL</p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Health Observations</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Vital signs, health telemetry, and trend tracking for participants.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: stats.total, icon: Activity, color: "text-[var(--text-primary)]" },
            { label: "Abnormal", value: stats.abnormal, icon: AlertCircle, color: "text-rose-400" },
            { label: "Today", value: stats.today, icon: Activity, color: "text-emerald-400" },
            { label: "Types Tracked", value: stats.types, icon: Heart, color: "text-purple-400" },
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search observations..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ObservationType | "all")}
            className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none">
            <option value="all">All Types</option>
            {Object.entries(OBS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_140px_100px_1fr] gap-4 px-5 py-3 border-b border-[var(--card-border)] text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            <span>Observation</span>
            <span>Value</span>
            <span>Recorded By</span>
            <span>Status</span>
            <span>Notes</span>
          </div>

          {loading && (
            <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Loading observations...</div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="px-5 py-16 text-center">
              <Activity className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">No observations found</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Health observations are recorded by support workers during shifts.
              </p>
            </div>
          )}

          {filtered.map((obs, idx) => {
            const config = OBS_CONFIG[obs.observation_type];
            const Icon = config.icon;
            return (
              <motion.div
                key={obs.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.015 }}
                className="grid grid-cols-[1fr_140px_140px_100px_1fr] gap-4 px-5 py-3 items-center border-b border-[var(--card-border)] last:border-b-0 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{config.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(obs.observed_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${obs.is_abnormal ? "text-rose-400" : "text-[var(--text-primary)]"}`}>
                  {formatObsValue(obs)}
                </span>
                <span className="text-sm text-[var(--text-secondary)] truncate">{obs.worker_name ?? "—"}</span>
                <span>
                  {obs.is_abnormal ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      Abnormal
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">Normal</span>
                  )}
                </span>
                <span className="text-xs text-[var(--text-muted)] truncate">{obs.notes ?? "—"}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
