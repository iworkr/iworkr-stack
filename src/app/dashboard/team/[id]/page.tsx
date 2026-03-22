/**
 * @page /dashboard/team/[id]
 * @status COMPLETE
 * @description Team member detail with profile, role, pay, training, and activity tabs
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Shield,
  DollarSign,
  GraduationCap,
  Calendar,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Briefcase,
  Hash,
  Edit3,
  Save,
  X,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import {
  getStaffProfile,
  upsertStaffProfile,
  getSchadsRates,
  type StaffProfileWithMeta,
  type SchadsRate,
} from "@/app/actions/staff-profiles";
import { careSkillDefinitions } from "@/lib/team-data";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ── Constants ────────────────────────────────────────── */

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "casual", label: "Casual" },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

const ease = [0.16, 1, 0.3, 1] as const;

/* ── Format Helpers ───────────────────────────────────── */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

/* ── Skeleton ─────────────────────────────────────────── */

function BentoSkeleton({ className }: { className?: string }) {
  return (
    <div className={`r-card border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse ${className || ""}`}>
      <div className="h-3 w-24 rounded bg-white/5 mb-3" />
      <div className="h-6 w-40 rounded bg-white/5 mb-2" />
      <div className="h-3 w-32 rounded bg-white/5" />
    </div>
  );
}

/* ── Compliance Radar Ring ────────────────────────────── */

function ComplianceRing({ verified, total, size = 80 }: { verified: number; total: number; size?: number }) {
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const color = pct === 100 ? "stroke-emerald-500" : pct >= 50 ? "stroke-amber-500" : "stroke-rose-500";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          className={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base font-bold text-zinc-100 tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

/* ── Availability Heatmap ─────────────────────────────── */

function AvailabilityGrid({
  availability,
  scheduledBlocks,
}: {
  availability: Record<string, { start: string; end: string }[]>;
  scheduledBlocks: { start: string; end: string; title: string }[];
}) {
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const slots = availability[day] || [];
        return (
          <div key={day} className="flex items-center gap-3">
            <span className="w-8 text-[11px] font-mono text-zinc-500">{DAY_LABELS[day]}</span>
            <div className="flex-1 h-6 rounded bg-white/[0.03] relative overflow-hidden">
              {/* Available slots — emerald */}
              {slots.map((slot, i) => {
                const startPct = timeToPercent(slot.start);
                const endPct = timeToPercent(slot.end);
                return (
                  <div
                    key={i}
                    className="absolute inset-y-0 rounded bg-emerald-500/20 border border-emerald-500/30"
                    style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                  />
                );
              })}
              {/* Hour markers */}
              {[6, 12, 18].map((h) => (
                <div key={h} className="absolute inset-y-0 w-px bg-white/[0.06]" style={{ left: `${(h / 24) * 100}%` }} />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded bg-emerald-500/20 border border-emerald-500/30" />
          <span className="text-[10px] text-zinc-600">Available</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
          <span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
        </div>
      </div>
    </div>
  );
}

function timeToPercent(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h + (m || 0) / 60) / 24) * 100;
}

/* ── Main Page ────────────────────────────────────────── */

export default function StaffProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { orgId, loading: orgLoading } = useOrg();
  const { isCare } = useIndustryLexicon();

  const [profile, setProfile] = useState<StaffProfileWithMeta | null>(null);
  const [schadsRates, setSchadsRates] = useState<SchadsRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editEmploymentType, setEditEmploymentType] = useState("casual");
  const [editSchadsLevel, setEditSchadsLevel] = useState("2.1");
  const [editBaseRate, setEditBaseRate] = useState(0);
  const [editMaxHours, setEditMaxHours] = useState(38);
  const [editQualifications, setEditQualifications] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [profileData, ratesData] = await Promise.all([
        getStaffProfile(userId, orgId),
        getSchadsRates(),
      ]);
      setProfile(profileData);
      setSchadsRates(ratesData);

      if (profileData) {
        setEditEmploymentType(profileData.employment_type);
        setEditSchadsLevel(profileData.schads_level);
        setEditBaseRate(profileData.base_hourly_rate);
        setEditMaxHours(profileData.max_weekly_hours);
        setEditQualifications(profileData.qualifications || []);
      }
    } catch (err) {
      console.error("Failed to load staff profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-update rate when SCHADS level changes
  const selectedRate = useMemo(() => {
    const rate = schadsRates.find((r) => r.level_code === editSchadsLevel);
    return rate || null;
  }, [schadsRates, editSchadsLevel]);

  useEffect(() => {
    if (selectedRate && editing) {
      const base = selectedRate.base_rate;
      setEditBaseRate(editEmploymentType === "casual" ? Math.round(base * 1.25 * 100) / 100 : base);
    }
  }, [selectedRate, editEmploymentType, editing]);

  // Calculated rates
  const calculatedRates = useMemo(() => {
    const base = editBaseRate;
    return {
      standard: base,
      evening: Math.round(base * 1.125 * 100) / 100,
      night: Math.round(base * 1.15 * 100) / 100,
      saturday: Math.round(base * 1.5 * 100) / 100,
      sunday: Math.round(base * 2.0 * 100) / 100,
      public_holiday: Math.round(base * 2.5 * 100) / 100,
    };
  }, [editBaseRate]);

  async function handleSave() {
    if (!orgId) return;
    setSaving(true);
    try {
      await upsertStaffProfile({
        user_id: userId,
        organization_id: orgId,
        employment_type: editEmploymentType,
        schads_level: editSchadsLevel,
        base_hourly_rate: editBaseRate,
        max_weekly_hours: editMaxHours,
        qualifications: editQualifications,
      });
      setEditing(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save staff profile:", err);
    } finally {
      setSaving(false);
    }
  }

  function toggleQualification(skillId: string) {
    setEditQualifications((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  }

  if (orgLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-6 space-y-4">
        <div className="h-8 w-48 rounded bg-white/5 animate-pulse" />
        <div className="grid grid-cols-12 gap-4">
          <BentoSkeleton className="col-span-4" />
          <BentoSkeleton className="col-span-8" />
          <BentoSkeleton className="col-span-12" />
          <BentoSkeleton className="col-span-6" />
          <BentoSkeleton className="col-span-6" />
        </div>
      </div>
    );
  }

  const p = profile;
  const creds = p?.credential_summary || { total: 0, verified: 0, expired: 0, pending: 0, expiring_soon: 0 };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[var(--background)]">
      {/* Subtle gradient */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-48 z-0 opacity-40"
        style={{ background: "radial-gradient(ellipse at center top, rgba(59,130,246,0.04) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-6 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/team")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <ArrowLeft size={14} />
            </button>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-0.5">
                STAFF PROFILE
              </p>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
                {p?.full_name || "Unknown Worker"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-[12px] font-semibold text-black transition-all hover:brightness-110 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : "Save Profile"}
                </motion.button>
              </>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.1] transition-colors"
              >
                <Edit3 size={14} /> Edit Profile
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-12 gap-4">

          {/* ── Box 1: Identity & Status (col-span-4) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5, ease }}
            className="col-span-4 r-card border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-start gap-4">
              <div className="relative">
                <LetterAvatar name={p?.full_name || "?"} src={p?.avatar_url} size={56} variant="rounded" ring />
                <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-0)] ${
                  p?.status === "active" ? "bg-emerald-500" : p?.status === "suspended" ? "bg-rose-500" : "bg-zinc-600"
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-semibold text-zinc-200 truncate">{p?.full_name}</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-white/[0.06] text-zinc-400 mt-1">
                  {p?.role?.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {p?.email && (
                <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                  <Mail size={12} className="text-zinc-600 shrink-0" />
                  <span className="truncate">{p.email}</span>
                </div>
              )}
              {p?.phone && (
                <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                  <Phone size={12} className="text-zinc-600 shrink-0" />
                  <span>{p.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                <MapPin size={12} className="text-zinc-600 shrink-0" />
                <span>{p?.branch || "HQ"}</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                <Clock size={12} className="text-zinc-600 shrink-0" />
                <span>{p?.weekly_hours_scheduled || 0}h this week / {p?.max_weekly_hours || 38}h max</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-zinc-400">
                <Briefcase size={12} className="text-zinc-600 shrink-0" />
                <span className="capitalize">{p?.employment_type?.replace(/_/g, " ") || "Casual"}</span>
              </div>
            </div>
          </motion.div>

          {/* ── Box 2: Compliance Radar (col-span-8) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease }}
            className="col-span-8 r-card border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield size={14} className="text-zinc-500" />
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Compliance Radar
              </h3>
            </div>

            <div className="flex items-start gap-8">
              <ComplianceRing verified={creds.verified} total={creds.total || 3} />

              <div className="flex-1 grid grid-cols-2 gap-x-8 gap-y-3">
                {[
                  { label: "Verified", value: creds.verified, icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Pending", value: creds.pending, icon: AlertCircle, color: "text-amber-400" },
                  { label: "Expired", value: creds.expired, icon: XCircle, color: "text-rose-400" },
                  { label: "Expiring Soon", value: creds.expiring_soon, icon: AlertTriangle, color: "text-amber-400" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <item.icon size={14} className={item.color} />
                    <div>
                      <p className="text-[11px] text-zinc-400">{item.label}</p>
                      <p className="font-mono text-[16px] font-semibold text-zinc-200 tabular-nums">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {creds.expired > 0 && (
              <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3">
                <p className="text-[11px] text-rose-400">
                  {creds.expired} credential(s) have expired. This worker cannot be assigned to shifts until renewed.
                </p>
              </div>
            )}
          </motion.div>

          {/* ── Box 3: Financial Matrix (col-span-12) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease }}
            className="col-span-12 r-card border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={14} className="text-zinc-500" />
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Financial Matrix — SCHADS Award
              </h3>
            </div>

            <div className="grid grid-cols-12 gap-6">
              {/* Left: Controls */}
              <div className="col-span-5 space-y-4">
                {/* SCHADS Level */}
                <div>
                  <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    SCHADS Classification
                  </label>
                  {editing ? (
                    <select
                      value={editSchadsLevel}
                      onChange={(e) => setEditSchadsLevel(e.target.value)}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-300 outline-none focus:border-[var(--brand)]/30"
                    >
                      {schadsRates.map((r) => (
                        <option key={r.level_code} value={r.level_code}>
                          Level {r.level_code} — {fmtCurrency(r.base_rate)}/hr — {r.description?.split("—")[1]?.trim() || ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[14px] font-medium text-zinc-200">
                      Level {p?.schads_level || "2.1"}
                      <span className="ml-2 text-[11px] text-zinc-500">
                        {selectedRate?.description?.split("—")[1]?.trim() || ""}
                      </span>
                    </p>
                  )}
                </div>

                {/* Employment Type */}
                <div>
                  <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Employment Type
                  </label>
                  {editing ? (
                    <div className="flex gap-2">
                      {EMPLOYMENT_TYPES.map((et) => (
                        <button
                          key={et.value}
                          onClick={() => setEditEmploymentType(et.value)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all ${
                            editEmploymentType === et.value
                              ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.08] text-[var(--brand)]"
                              : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {et.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[14px] font-medium text-zinc-200 capitalize">
                      {p?.employment_type?.replace(/_/g, " ") || "Casual"}
                      {p?.employment_type === "casual" && (
                        <span className="ml-2 text-[11px] text-amber-400">+25% loading</span>
                      )}
                    </p>
                  )}
                </div>

                {/* Base Rate */}
                <div>
                  <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Effective Hourly Rate
                  </label>
                  <p className="font-mono text-[24px] font-bold text-zinc-100 tracking-tight tabular-nums">
                    {fmtCurrency(editBaseRate)}
                    <span className="text-[12px] text-zinc-600 font-normal">/hr</span>
                  </p>
                </div>
              </div>

              {/* Right: Calculated Rates Grid */}
              <div className="col-span-7">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-3">Penalty Rate Matrix</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Standard", rate: calculatedRates.standard, mult: "1.0×", color: "text-zinc-300" },
                    { label: "Evening", rate: calculatedRates.evening, mult: "1.125×", color: "text-blue-400" },
                    { label: "Night", rate: calculatedRates.night, mult: "1.15×", color: "text-indigo-400" },
                    { label: "Saturday", rate: calculatedRates.saturday, mult: "1.5×", color: "text-amber-400" },
                    { label: "Sunday", rate: calculatedRates.sunday, mult: "2.0×", color: "text-orange-400" },
                    { label: "Public Holiday", rate: calculatedRates.public_holiday, mult: "2.5×", color: "text-rose-400" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-zinc-500">{item.label}</span>
                        <span className={`text-[10px] font-mono ${item.color}`}>{item.mult}</span>
                      </div>
                      <p className="font-mono text-[14px] font-semibold text-zinc-200 tabular-nums">
                        {fmtCurrency(item.rate)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Box 4: Qualifications (col-span-6) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease }}
            className="col-span-6 r-card border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap size={14} className="text-zinc-500" />
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Qualifications & Skills
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {careSkillDefinitions.map((skill) => {
                const active = editQualifications.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    onClick={() => editing && toggleQualification(skill.id)}
                    disabled={!editing}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] transition-all text-left ${
                      active
                        ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.06] text-[var(--brand)]"
                        : editing
                          ? "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300 cursor-pointer"
                          : "border-white/[0.04] text-zinc-600"
                    }`}
                  >
                    <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                      active ? "border-[var(--brand)] bg-[var(--brand)]/20" : "border-white/[0.12] bg-white/[0.02]"
                    }`}>
                      {active && <CheckCircle2 size={10} />}
                    </div>
                    {skill.label}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── Box 5: Availability Grid (col-span-6) ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease }}
            className="col-span-6 r-card border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-zinc-500" />
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Availability & Schedule
              </h3>
            </div>

            <AvailabilityGrid
              availability={p?.availability || {}}
              scheduledBlocks={[]}
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-zinc-500 mb-0.5">Contracted Hours</p>
                <p className="font-mono text-[16px] font-semibold text-zinc-200 tabular-nums">
                  {p?.contracted_hours || "—"}<span className="text-[11px] text-zinc-600 font-normal">/wk</span>
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-zinc-500 mb-0.5">Max Weekly Hours</p>
                <p className="font-mono text-[16px] font-semibold text-zinc-200 tabular-nums">
                  {editing ? (
                    <input
                      type="number"
                      value={editMaxHours}
                      onChange={(e) => setEditMaxHours(parseInt(e.target.value) || 38)}
                      className="w-16 bg-transparent border-b border-white/[0.12] outline-none text-center"
                    />
                  ) : (
                    p?.max_weekly_hours || 38
                  )}
                  <span className="text-[11px] text-zinc-600 font-normal">/wk</span>
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  );
}
