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
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────── */

type ObservationType =
  | "blood_pressure" | "blood_glucose" | "heart_rate" | "temperature"
  | "weight" | "oxygen_saturation" | "respiration_rate" | "seizure"
  | "pain_level" | "bowel_movement" | "fluid_intake" | "food_intake"
  | "sleep_quality" | "mood" | "other";

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
  worker_name?: string;
  participant_name?: string;
}

/* ── Config ───────────────────────────────────────────── */

const OBS_CONFIG: Record<ObservationType, { label: string; icon: typeof Activity; color: string; unit: string }> = {
  blood_pressure: { label: "Blood Pressure", icon: Heart, color: "text-rose-400", unit: "mmHg" },
  blood_glucose: { label: "Blood Glucose", icon: Droplets, color: "text-amber-400", unit: "mmol/L" },
  heart_rate: { label: "Heart Rate", icon: Heart, color: "text-rose-400", unit: "bpm" },
  temperature: { label: "Temperature", icon: Thermometer, color: "text-orange-400", unit: "°C" },
  weight: { label: "Weight", icon: Scale, color: "text-zinc-400", unit: "kg" },
  oxygen_saturation: { label: "SpO2", icon: Activity, color: "text-emerald-400", unit: "%" },
  respiration_rate: { label: "Respiration Rate", icon: Activity, color: "text-zinc-400", unit: "/min" },
  seizure: { label: "Seizure", icon: AlertCircle, color: "text-rose-400", unit: "" },
  pain_level: { label: "Pain Level", icon: AlertCircle, color: "text-amber-400", unit: "/10" },
  bowel_movement: { label: "Bowel Movement", icon: Activity, color: "text-zinc-400", unit: "" },
  fluid_intake: { label: "Fluid Intake", icon: Droplets, color: "text-zinc-400", unit: "mL" },
  food_intake: { label: "Food Intake", icon: Activity, color: "text-emerald-400", unit: "" },
  sleep_quality: { label: "Sleep Quality", icon: Brain, color: "text-purple-400", unit: "/10" },
  mood: { label: "Mood", icon: Brain, color: "text-purple-400", unit: "" },
  other: { label: "Other", icon: Activity, color: "text-zinc-400", unit: "" },
};

type TabKey = "all" | "vitals" | "metabolic" | "wellbeing" | "abnormal";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "vitals", label: "Vitals" },
  { key: "metabolic", label: "Metabolic" },
  { key: "wellbeing", label: "Wellbeing" },
  { key: "abnormal", label: "Abnormal Only" },
];

const VITALS: ObservationType[] = ["blood_pressure", "heart_rate", "oxygen_saturation", "temperature"];
const METABOLIC: ObservationType[] = ["blood_glucose", "weight"];
const WELLBEING: ObservationType[] = ["pain_level", "sleep_quality", "mood"];

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabKey>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── Data fetch ─────────────────────────────────────── */
  const loadObservations = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("health_observations")
      .select("*, profiles!worker_id ( full_name )")
      .eq("organization_id", orgId)
      .order("observed_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      setObservations(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any[]).map((row: any) => ({
          ...row,
          worker_name: row.profiles?.full_name ?? null,
        })) as HealthObservation[]
      );
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadObservations(); }, [loadObservations]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  /* ── Filtering ──────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = observations;
    if (selectedTab === "vitals") result = result.filter((o) => VITALS.includes(o.observation_type));
    else if (selectedTab === "metabolic") result = result.filter((o) => METABOLIC.includes(o.observation_type));
    else if (selectedTab === "wellbeing") result = result.filter((o) => WELLBEING.includes(o.observation_type));
    else if (selectedTab === "abnormal") result = result.filter((o) => o.is_abnormal);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((o) =>
        OBS_CONFIG[o.observation_type].label.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q) ||
        o.worker_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [observations, selectedTab, search]);

  const tabCounts = useMemo(() => ({
    all: observations.length,
    vitals: observations.filter((o) => VITALS.includes(o.observation_type)).length,
    metabolic: observations.filter((o) => METABOLIC.includes(o.observation_type)).length,
    wellbeing: observations.filter((o) => WELLBEING.includes(o.observation_type)).length,
    abnormal: observations.filter((o) => o.is_abnormal).length,
  }), [observations]);

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Sticky Header ──────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
              HEALTH OBSERVATIONS
            </span>
            <div className="ml-4 flex items-center gap-0.5">
              {TABS.map((tab) => {
                const isActive = selectedTab === tab.key;
                const count = tabCounts[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedTab(tab.key)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="obs-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                        isActive ? "bg-white/[0.06] text-zinc-300" : "text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stealth Search */}
          <div className="relative flex items-center gap-2">
            <motion.div
              className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
              initial={false}
              animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            />
            <div className="flex items-center gap-2 pl-2">
              <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search observations…"
                className="w-48 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
              />
              {!searchFocused && !search && (
                <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                  <span className="text-[10px]">⌘</span>F
                </kbd>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Column Headers ─────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
        <div className="w-56 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Type</div>
        <div className="w-36 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Value</div>
        <div className="w-36 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Worker</div>
        <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
        <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Notes</div>
      </div>

      {/* ── Rows ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Skeleton loader */}
        {loading && observations.length === 0 && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.02] animate-pulse">
            <div className="w-56 px-2"><div className="w-32 h-3 bg-zinc-800 rounded" /></div>
            <div className="w-36 px-2"><div className="w-16 h-3 bg-zinc-800 rounded" /></div>
            <div className="w-36 px-2"><div className="w-20 h-3 bg-zinc-800/60 rounded" /></div>
            <div className="w-24 px-2"><div className="w-14 h-4 bg-zinc-800/40 rounded-full" /></div>
            <div className="min-w-0 flex-1 px-2"><div className="w-40 h-3 bg-zinc-800/40 rounded" /></div>
          </div>
        ))}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[60px]" />
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02]">
              <Activity size={32} className="text-zinc-600" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-200">
              {search || selectedTab !== "all" ? "No observations match your filters" : "No observations recorded"}
            </h3>
            <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-zinc-600">
              {search || selectedTab !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Health observations are recorded by support workers during shifts."}
            </p>
          </motion.div>
        )}

        {/* Data rows */}
        {filtered.map((obs, idx) => {
          const config = OBS_CONFIG[obs.observation_type];
          const Icon = config.icon;
          return (
            <motion.div
              key={obs.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(idx * 0.015, 0.2), duration: 0.2 }}
              className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] transition-colors duration-100 hover:bg-white/[0.02]"
            >
              {/* Type + datetime */}
              <div className="w-56 px-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={14} className={`${config.color} shrink-0`} />
                  <div className="min-w-0">
                    <span className="text-sm text-zinc-200 truncate block group-hover:text-white transition-colors">
                      {config.label}
                    </span>
                    <span className="text-[10px] text-zinc-700 font-mono">
                      {new Date(obs.observed_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Value */}
              <div className="w-36 px-2">
                <span className={`text-sm font-semibold font-mono ${obs.is_abnormal ? "text-rose-400" : "text-zinc-300"}`}>
                  {formatObsValue(obs)}
                </span>
              </div>

              {/* Worker */}
              <div className="w-36 px-2">
                <span className="text-xs text-zinc-500 truncate block">{obs.worker_name ?? "—"}</span>
              </div>

              {/* Status */}
              <div className="w-24 px-2">
                {obs.is_abnormal ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Abnormal
                  </span>
                ) : (
                  <span className="text-xs text-zinc-700">Normal</span>
                )}
              </div>

              {/* Notes */}
              <div className="min-w-0 flex-1 px-2">
                <span className="text-xs text-zinc-500 truncate block">
                  {obs.notes ? (obs.notes.length > 60 ? obs.notes.slice(0, 60) + "…" : obs.notes) : "—"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
            <div className="flex items-center gap-1.5">
              <Activity size={10} />
              <span>{filtered.length} observations</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <AlertCircle size={10} className="text-rose-500/50" />
              <span>{tabCounts.abnormal} abnormal</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
            <span>↑↓ Navigate</span>
            <span className="text-zinc-800">·</span>
            <span>⌘F Search</span>
          </div>
        </div>
      )}
    </div>
  );
}
