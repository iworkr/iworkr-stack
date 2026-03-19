"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Plus,
  Save,
  Trash2,
  Activity,
  CloudLightning,
  Users,
  Gauge,
  Loader2,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";
import {
  getYieldProfiles,
  upsertYieldProfile,
  getYieldAnalytics,
} from "@/app/actions/oracle-yield";

/* ── Types ────────────────────────────────────────────── */

interface YieldProfile {
  id?: string;
  profile_name: string;
  trade_category?: string;
  base_margin: number;
  min_margin_floor: number;
  max_margin_ceiling: number;
  sensitivity_weight_fleet: number;
  sensitivity_weight_weather: number;
  sensitivity_weight_client: number;
  is_active: boolean;
  created_at?: string;
}

interface Analytics {
  total_calculations: number;
  avg_margin: number;
  override_rate: number;
  clamp_rate: number;
}

const EMPTY_PROFILE: YieldProfile = {
  profile_name: "",
  trade_category: "",
  base_margin: 0.4,
  min_margin_floor: 0.25,
  max_margin_ceiling: 0.65,
  sensitivity_weight_fleet: 0.4,
  sensitivity_weight_weather: 0.3,
  sensitivity_weight_client: 0.3,
  is_active: true,
};

/* ── Main Component ──────────────────────────────────── */

export default function YieldProfilesPage() {
  const { orgId } = useOrg();
  const toast = useToastStore();
  const [profiles, setProfiles] = useState<YieldProfile[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [editing, setEditing] = useState<YieldProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [profRes, analyticsRes] = await Promise.all([
      getYieldProfiles(orgId),
      getYieldAnalytics(orgId),
    ]);
    setProfiles((profRes.data ?? []) as YieldProfile[]);
    setAnalytics(analyticsRes.data as Analytics | null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(async () => {
    if (!orgId || !editing) return;
    setSaving(true);
    const res = await upsertYieldProfile(orgId, editing);
    if (res.error) {
      toast.addToast(res.error, undefined, "error");
    } else {
      toast.addToast("Yield profile saved successfully");
      setEditing(null);
      await load();
    }
    setSaving(false);
  }, [orgId, editing, toast, load]);

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* ── Header ─────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Dynamic Yield Profiles
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Set AI pricing boundaries per trade — the engine cannot exceed these limits
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditing({ ...EMPTY_PROFILE })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </button>
        </div>

        {/* ── Analytics Cards ──────────────────────── */}
        {analytics && (
          <div className="grid grid-cols-4 gap-3 mt-5">
            <MiniStat
              label="Calculations"
              value={analytics.total_calculations.toLocaleString()}
              icon={<Activity className="w-3.5 h-3.5 text-sky-400" />}
            />
            <MiniStat
              label="Avg Margin"
              value={`${(analytics.avg_margin * 100).toFixed(1)}%`}
              icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
            />
            <MiniStat
              label="Override Rate"
              value={`${(analytics.override_rate * 100).toFixed(1)}%`}
              icon={<Users className="w-3.5 h-3.5 text-amber-400" />}
            />
            <MiniStat
              label="Clamp Rate"
              value={`${(analytics.clamp_rate * 100).toFixed(1)}%`}
              icon={<AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            />
          </div>
        )}
      </div>

      {/* ── Profiles Grid ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-zinc-500 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading profiles...
          </div>
        ) : profiles.length === 0 && !editing ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
            <Brain className="w-10 h-10 mb-3 text-emerald-500/20" />
            <p className="text-sm font-medium text-zinc-400">No yield profiles configured</p>
            <p className="text-xs mt-1">Create a profile to enable dynamic pricing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} onEdit={() => setEditing({ ...p })} />
            ))}
          </div>
        )}

        {/* ── Editor Modal ───────────────────────── */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setEditing(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-2xl"
              >
                <div className="p-6 border-b border-white/[0.06]">
                  <h2 className="text-base font-semibold text-white">
                    {editing.id ? "Edit" : "New"} Yield Profile
                  </h2>
                </div>
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  <Field label="Profile Name">
                    <input
                      value={editing.profile_name}
                      onChange={(e) => setEditing({ ...editing, profile_name: e.target.value })}
                      placeholder="Standard Emergency Plumbing"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                    />
                  </Field>
                  <Field label="Trade Category">
                    <input
                      value={editing.trade_category ?? ""}
                      onChange={(e) => setEditing({ ...editing, trade_category: e.target.value })}
                      placeholder="e.g. Electrical, Plumbing, HVAC"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
                    />
                  </Field>

                  <div className="grid grid-cols-3 gap-3">
                    <MarginField
                      label="Base Margin"
                      value={editing.base_margin}
                      onChange={(v) => setEditing({ ...editing, base_margin: v })}
                      color="emerald"
                    />
                    <MarginField
                      label="Floor (Min)"
                      value={editing.min_margin_floor}
                      onChange={(v) => setEditing({ ...editing, min_margin_floor: v })}
                      color="sky"
                    />
                    <MarginField
                      label="Ceiling (Max)"
                      value={editing.max_margin_ceiling}
                      onChange={(v) => setEditing({ ...editing, max_margin_ceiling: v })}
                      color="rose"
                    />
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" />
                      Sensitivity Weights
                    </p>
                    <div className="space-y-3">
                      <SliderField
                        label="Fleet Utilization"
                        icon={<Activity className="w-3 h-3 text-sky-400" />}
                        value={editing.sensitivity_weight_fleet}
                        onChange={(v) => setEditing({ ...editing, sensitivity_weight_fleet: v })}
                      />
                      <SliderField
                        label="Weather Severity"
                        icon={<CloudLightning className="w-3 h-3 text-amber-400" />}
                        value={editing.sensitivity_weight_weather}
                        onChange={(v) => setEditing({ ...editing, sensitivity_weight_weather: v })}
                      />
                      <SliderField
                        label="Client Elasticity"
                        icon={<Users className="w-3 h-3 text-emerald-400" />}
                        value={editing.sensitivity_weight_client}
                        onChange={(v) => setEditing({ ...editing, sensitivity_weight_client: v })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <span className="text-xs text-zinc-400">Active</span>
                    <button
                      onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                      className="text-emerald-400"
                    >
                      {editing.is_active ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-zinc-600" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-6 border-t border-white/[0.06] flex items-center justify-end gap-3">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editing.profile_name}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Profile
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Sub-Components ──────────────────────────────────── */

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

function ProfileCard({ profile, onEdit }: { profile: YieldProfile; onEdit: () => void }) {
  return (
    <motion.button
      onClick={onEdit}
      whileHover={{ scale: 1.01 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 text-left hover:bg-white/[0.04] transition-colors w-full"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{profile.profile_name}</h3>
          {profile.trade_category && (
            <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">{profile.trade_category}</p>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          profile.is_active
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-zinc-500/10 text-zinc-500"
        }`}>
          {profile.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Base</p>
          <p className="text-sm font-mono text-emerald-400">{(profile.base_margin * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Floor</p>
          <p className="text-sm font-mono text-sky-400">{(profile.min_margin_floor * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 mb-0.5">Ceiling</p>
          <p className="text-sm font-mono text-rose-400">{(profile.max_margin_ceiling * 100).toFixed(0)}%</p>
        </div>
      </div>

      <div className="flex gap-4 mt-3 pt-3 border-t border-white/[0.04]">
        <span className="text-[10px] text-zinc-500">
          <Activity className="w-3 h-3 inline mr-1 text-sky-400/50" />
          Fleet: {(profile.sensitivity_weight_fleet * 100).toFixed(0)}%
        </span>
        <span className="text-[10px] text-zinc-500">
          <CloudLightning className="w-3 h-3 inline mr-1 text-amber-400/50" />
          Weather: {(profile.sensitivity_weight_weather * 100).toFixed(0)}%
        </span>
        <span className="text-[10px] text-zinc-500">
          <Users className="w-3 h-3 inline mr-1 text-emerald-400/50" />
          Client: {(profile.sensitivity_weight_client * 100).toFixed(0)}%
        </span>
      </div>
    </motion.button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function MarginField({
  label, value, onChange, color,
}: {
  label: string; value: number; onChange: (v: number) => void; color: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-${color}-400 font-mono focus:outline-none focus:border-${color}-500/40`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function SliderField({
  label, icon, value, onChange,
}: {
  label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-xs text-zinc-400 w-28">{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-emerald-500 h-1"
      />
      <span className="text-xs font-mono text-zinc-300 w-10 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}
