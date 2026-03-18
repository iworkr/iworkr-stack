"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Edit2,
  Lock,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Shield,
  Clock,
  Activity,
  Key,
  MessageSquare,
  Save,
  X,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  FileText,
  Upload,
  RefreshCw,
  UserCog,
  ShieldAlert,
  Unlock,
  RotateCcw,
  Smartphone,
  Globe,
  EyeOff,
  Eye,
  ChevronDown,
  Briefcase,
  BarChart3,
  Users,
  Ban,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getWorkerDossier,
  getWorkerCredentials,
  getWorkerActivity,
  updateStaffBanking,
  updateWorkerAvailability,
  updateWorkerSkills,
  updateWorkerRole,
  toggleWorkerSuspension,
  type WorkerCredential,
  type WorkerActivity as WorkerActivityType,
} from "@/app/actions/workforce-dossier";
import {
  upsertStaffProfile,
  getSchadsRates,
  type SchadsRate,
} from "@/app/actions/staff-profiles";
import { careSkillDefinitions, skillDefinitions } from "@/lib/team-data";
import { useIndustryLexicon } from "@/lib/industry-lexicon";

/* ── Constants ────────────────────────────────────────── */

type DossierTab = "employment" | "compliance" | "rostering" | "activity" | "security";

const TABS: { id: DossierTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "employment", label: "Employment & Payroll", icon: DollarSign },
  { id: "compliance", label: "Compliance & Vault", icon: Shield },
  { id: "rostering", label: "Rostering Physics", icon: Clock },
  { id: "activity", label: "Activity & Audit", icon: Activity },
  { id: "security", label: "Security & Access", icon: Key },
];

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "casual", label: "Casual" },
];

const AWARD_OPTIONS = [
  { value: "SCHADS", label: "SCHADS Award 2010" },
  { value: "NURSES", label: "Nurses Award 2020" },
  { value: "FLAT_RATE", label: "Flat Rate Agreement" },
];

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

const ROLE_OPTIONS = [
  { value: "technician", label: "Worker (Mobile App only)" },
  { value: "manager", label: "Dispatcher (Roster access)" },
  { value: "admin", label: "Admin (Full access)" },
  { value: "owner", label: "Owner" },
];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  manager: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  technician: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const CREDENTIAL_LABELS: Record<string, string> = {
  NDIS_SCREENING: "NDIS Worker Screening",
  WWCC: "Working With Children Check",
  FIRST_AID: "First Aid & CPR",
  MANUAL_HANDLING: "Manual Handling",
  MEDICATION_COMPETENCY: "Medication Competency",
  CPR: "CPR Certification",
  DRIVERS_LICENSE: "Driver's License",
  POLICE_CHECK: "Police Check",
  OTHER: "Other",
};

const CREDENTIAL_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  NDIS_SCREENING: ShieldAlert,
  WWCC: Users,
  FIRST_AID: Activity,
  DRIVERS_LICENSE: Globe,
  POLICE_CHECK: Shield,
  MANUAL_HANDLING: BarChart3,
  MEDICATION_COMPETENCY: Briefcase,
  CPR: Activity,
  OTHER: FileText,
};

const ease = [0.16, 1, 0.3, 1] as const;

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(dateStr);
}

/* ── Main Page ────────────────────────────────────────── */

export default function WorkerDossierPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { orgId, loading: orgLoading } = useOrg();
  const { isCare } = useIndustryLexicon();

  // Core state
  const [dossier, setDossier] = useState<any>(null);
  const [schadsRates, setSchadsRates] = useState<SchadsRate[]>([]);
  const [credentials, setCredentials] = useState<WorkerCredential[]>([]);
  const [activities, setActivities] = useState<WorkerActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DossierTab>("employment");
  const [saving, setSaving] = useState(false);

  // Tab 1: Employment form state
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [empType, setEmpType] = useState("casual");
  const [award, setAward] = useState("SCHADS");
  const [schadsLevel, setSchadsLevel] = useState("");
  const [schadsPaypoint, setSchadsPaypoint] = useState("1");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankBsb, setBankBsb] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [superFund, setSuperFund] = useState("");
  const [superUsi, setSuperUsi] = useState("");
  const [superMember, setSuperMember] = useState("");
  const [tfnMask, setTfnMask] = useState("");
  const [showTfn, setShowTfn] = useState(false);

  // Tab 3: Rostering state
  const [editingRostering, setEditingRostering] = useState(false);
  const [maxHours, setMaxHours] = useState(38);
  const [availabilityDays, setAvailabilityDays] = useState<Record<string, { available: boolean; start: string; end: string }>>({});
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [editRegions, setEditRegions] = useState<string[]>([]);

  // Tab 5: Security state
  const [roleChangeTarget, setRoleChangeTarget] = useState("");
  const [roleConfirmation, setRoleConfirmation] = useState("");
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);

  /* ── Data Loading ── */

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [dossierData, ratesData] = await Promise.all([
        getWorkerDossier(userId, orgId),
        getSchadsRates(),
      ]);

      setDossier(dossierData);
      setSchadsRates(ratesData);

      if (dossierData) {
        // Populate employment form
        setEmpType(dossierData.employment_type || "casual");
        const levelCode = dossierData.schads_level || "";
        setSchadsLevel(levelCode.includes(".") ? levelCode.split(".")[0] : levelCode);
        setSchadsPaypoint(levelCode.includes(".") ? levelCode.split(".")[1] : "1");
        setBankAccountName(dossierData.bank_account_name || "");
        setBankBsb(dossierData.bank_bsb || "");
        setBankAccountNumber(dossierData.bank_account_number || "");
        setSuperFund(dossierData.super_fund_name || dossierData.superannuation_fund || "");
        setSuperUsi(dossierData.super_usi || "");
        setSuperMember(dossierData.super_member_number || dossierData.superannuation_number || "");
        setTfnMask(dossierData.tfn_hash ? "••• ••• " + (dossierData.tfn_hash.slice(-3) || "***") : "");
        setMaxHours(dossierData.max_weekly_hours || 38);
        setEditSkills(dossierData.qualifications || []);
        setEditRegions(dossierData.skills || []);
        setRoleChangeTarget(dossierData.role || "technician");

        // Build availability state
        const avail: Record<string, { available: boolean; start: string; end: string }> = {};
        for (const day of DAYS) {
          const slots = (dossierData.availability || {})[day];
          if (slots && slots.length > 0) {
            avail[day] = { available: true, start: slots[0].start || "06:00", end: slots[0].end || "18:00" };
          } else {
            avail[day] = { available: false, start: "06:00", end: "18:00" };
          }
        }
        setAvailabilityDays(avail);
      }
    } catch (err) {
      console.error("Failed to load dossier:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Lazy load tab data
  useEffect(() => {
    if (!orgId) return;
    if (activeTab === "compliance" && credentials.length === 0) {
      getWorkerCredentials(userId, orgId).then(setCredentials);
    }
    if (activeTab === "activity" && activities.length === 0) {
      getWorkerActivity(userId, orgId).then(setActivities);
    }
  }, [activeTab, orgId, userId, credentials.length, activities.length]);

  /* ── SCHADS Rate Calculation ── */

  const levelCode = `${schadsLevel}.${schadsPaypoint}`;

  const calculatedRate = useMemo(() => {
    const rate = schadsRates.find((r) => r.level_code === levelCode);
    if (!rate) {
      // Try matching just the level
      const fallback = schadsRates.find((r) => r.level_code.startsWith(schadsLevel + "."));
      if (fallback) {
        const base = fallback.base_rate;
        const isCasual = empType === "casual";
        return {
          base,
          effective: isCasual ? Math.round(base * 1.25 * 100) / 100 : base,
          casualLoading: isCasual,
          description: fallback.description,
        };
      }
      return null;
    }
    const base = rate.base_rate;
    const isCasual = empType === "casual";
    return {
      base,
      effective: isCasual ? Math.round(base * 1.25 * 100) / 100 : base,
      casualLoading: isCasual,
      description: rate.description,
    };
  }, [schadsRates, levelCode, schadsLevel, empType]);

  // Unique SCHADS levels for dropdown
  const uniqueLevels = useMemo(() => {
    const levels = new Set<string>();
    schadsRates.forEach((r) => {
      const l = r.level_code.split(".")[0];
      levels.add(l);
    });
    return Array.from(levels).sort((a, b) => parseInt(a) - parseInt(b));
  }, [schadsRates]);

  // Paypoints for the selected level
  const paypoints = useMemo(() => {
    return schadsRates
      .filter((r) => r.level_code.startsWith(schadsLevel + "."))
      .map((r) => r.level_code.split(".")[1] || "1")
      .sort((a, b) => parseInt(a) - parseInt(b));
  }, [schadsRates, schadsLevel]);

  /* ── Save Handlers ── */

  async function handleSaveEmployment() {
    if (!orgId) return;
    setSaving(true);
    try {
      const effectiveRate = calculatedRate?.effective || 0;
      await upsertStaffProfile({
        user_id: userId,
        organization_id: orgId,
        employment_type: empType,
        schads_level: levelCode,
        base_hourly_rate: effectiveRate,
        max_weekly_hours: maxHours,
      });
      await updateStaffBanking({
        user_id: userId,
        organization_id: orgId,
        bank_account_name: bankAccountName || null,
        bank_bsb: bankBsb || null,
        bank_account_number: bankAccountNumber || null,
        super_fund_name: superFund || null,
        super_usi: superUsi || null,
        super_member_number: superMember || null,
      });
      setEditingEmployment(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save employment:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRostering() {
    if (!orgId) return;
    setSaving(true);
    try {
      const availabilityPayload: Record<string, { start: string; end: string; available: boolean }[]> = {};
      for (const [day, slot] of Object.entries(availabilityDays)) {
        availabilityPayload[day] = [slot];
      }
      await updateWorkerAvailability({
        user_id: userId,
        organization_id: orgId,
        availability: availabilityPayload,
        max_weekly_hours: maxHours,
      });
      await updateWorkerSkills({
        user_id: userId,
        organization_id: orgId,
        qualifications: editSkills,
        service_regions: editRegions,
      });
      setEditingRostering(false);
      await loadData();
    } catch (err) {
      console.error("Failed to save rostering:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange() {
    if (!orgId) return;
    setSaving(true);
    try {
      const result = await updateWorkerRole({
        target_user_id: userId,
        organization_id: orgId,
        new_role: roleChangeTarget,
        confirmation: roleConfirmation,
      });
      if (!result.success) {
        alert(result.error || "Failed to update role");
      } else {
        setShowRoleConfirm(false);
        setRoleConfirmation("");
        await loadData();
      }
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSuspendToggle() {
    if (!orgId || !dossier) return;
    setSaving(true);
    try {
      await toggleWorkerSuspension({
        user_id: userId,
        organization_id: orgId,
        action: dossier.status === "suspended" ? "reactivate" : "suspend",
      });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle suspension:", err);
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ── */

  if (orgLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] gap-4">
        <p className="text-zinc-500">Worker not found</p>
        <button onClick={() => router.push("/dashboard/workforce/team")} className="text-[12px] text-zinc-400 underline">
          Back to Team Directory
        </button>
      </div>
    );
  }

  const creds = dossier.credential_summary;
  const skills = isCare ? careSkillDefinitions : skillDefinitions;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[var(--background)]">
      {/* ═══════════════════════════════════════════════════
          DOSSIER HEADER (h-32)
         ═══════════════════════════════════════════════════ */}
      <div className="border-b border-white/[0.05] bg-[#050505]">
        {/* Breadcrumb */}
        <div className="flex h-10 items-center gap-2 px-8 border-b border-white/[0.03]">
          <button
            onClick={() => router.push("/dashboard/workforce/team")}
            className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={12} />
            WORKFORCE
          </button>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className="text-[11px] font-mono text-zinc-600">TEAM DIRECTORY</span>
          <ChevronRight size={10} className="text-zinc-700" />
          <span className="text-[11px] font-mono font-medium text-zinc-300">{dossier.full_name?.toUpperCase()}</span>
        </div>

        {/* Main Header */}
        <div className="flex items-center justify-between px-8 py-5">
          {/* Identity Cluster */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-zinc-800 text-xl font-semibold text-zinc-300 ring-2 ring-white/[0.08] overflow-hidden">
                {dossier.avatar_url ? (
                  <img src={dossier.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  dossier.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?"
                )}
              </div>
              <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-[#050505] ${
                dossier.status === "active" ? "bg-emerald-500" : dossier.status === "suspended" ? "bg-rose-500" : "bg-zinc-600"
              }`} />
            </div>

            <div>
              <h1 className="text-[28px] font-medium tracking-tight text-white">{dossier.full_name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  ROLE_COLORS[dossier.role] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                }`}>
                  {dossier.role?.replace(/_/g, " ")}
                </span>
                {dossier.status === "suspended" && (
                  <span className="inline-flex items-center rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                    Suspended
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta Cluster */}
          <div className="hidden lg:flex items-center gap-8">
            {[
              { label: "PHONE", value: dossier.phone || "—", icon: Phone },
              { label: "EMAIL", value: dossier.email || "—", icon: Mail },
              { label: "BRANCH", value: dossier.branch || "HQ", icon: MapPin },
              { label: "JOINED", value: fmtDate(dossier.joined_at), icon: Calendar },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">{item.label}</p>
                <p className="text-[13px] text-zinc-300 truncate max-w-[160px]">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Action Cluster */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <MessageSquare size={14} />
              Message
            </button>
            <button
              onClick={handleSuspendToggle}
              disabled={saving}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[12px] transition-colors ${
                dossier.status === "suspended"
                  ? "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/[0.06]"
                  : "border-rose-500/20 text-rose-400 hover:bg-rose-500/[0.06]"
              }`}
            >
              {dossier.status === "suspended" ? <Unlock size={14} /> : <Lock size={14} />}
              {dossier.status === "suspended" ? "Reactivate" : "Suspend"}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TAB NAVIGATION
         ═══════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-10 border-b border-white/[0.05] bg-[var(--background)]/90 backdrop-blur-xl">
        <div className="flex items-center px-8">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-5 py-3 text-[12px] font-medium transition-all ${
                  active
                    ? "border-white text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TAB CONTENT
         ═══════════════════════════════════════════════════ */}
      <div className="p-8">
        <AnimatePresence mode="wait">
          {/* ──────────────────────────────────────────────
              TAB 1: Employment & Payroll
             ────────────────────────────────────────────── */}
          {activeTab === "employment" && (
            <motion.div key="employment" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
              {/* Edit toggle */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Financial Classification</h2>
                {editingEmployment ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingEmployment(false); loadData(); }} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200">
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={handleSaveEmployment} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-[12px] font-semibold text-black hover:brightness-110 disabled:opacity-40">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditingEmployment(true)} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.1]">
                    <Edit2 size={14} /> Edit Employment
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-12">
                {/* LEFT: Award & Classification */}
                <div className="space-y-5">
                  {/* Employment Type */}
                  <div>
                    <label className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Employment Type</label>
                    {editingEmployment ? (
                      <div className="grid grid-cols-3 gap-2">
                        {EMPLOYMENT_TYPES.map((et) => (
                          <button key={et.value} onClick={() => setEmpType(et.value)}
                            className={`rounded-lg border px-3 py-2.5 text-[12px] font-medium transition-all ${
                              empType === et.value ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.08] text-[var(--brand)]" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"
                            }`}>
                            {et.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[14px] text-zinc-200 capitalize">{empType.replace(/_/g, " ")}</p>
                    )}
                  </div>

                  {/* Award */}
                  <div>
                    <label className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Industrial Instrument</label>
                    {editingEmployment ? (
                      <select value={award} onChange={(e) => setAward(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.2]">
                        {AWARD_OPTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    ) : (
                      <p className="text-[14px] text-zinc-200">{AWARD_OPTIONS.find((a) => a.value === award)?.label || award}</p>
                    )}
                  </div>

                  {/* SCHADS Level */}
                  <div>
                    <label className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">SCHADS Level</label>
                    {editingEmployment ? (
                      <select value={schadsLevel} onChange={(e) => { setSchadsLevel(e.target.value); setSchadsPaypoint("1"); }}
                        className="w-full rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.2]">
                        <option value="">Select level...</option>
                        {uniqueLevels.map((l) => <option key={l} value={l}>Level {l}</option>)}
                      </select>
                    ) : (
                      <p className="text-[14px] text-zinc-200">Level {schadsLevel || "—"}</p>
                    )}
                  </div>

                  {/* SCHADS Paypoint */}
                  <div>
                    <label className="mb-2 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">SCHADS Paypoint</label>
                    {editingEmployment ? (
                      <select value={schadsPaypoint} onChange={(e) => setSchadsPaypoint(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.2]">
                        {(paypoints.length > 0 ? paypoints : ["1", "2", "3", "4"]).map((p) => (
                          <option key={p} value={p}>Paypoint {p}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[14px] text-zinc-200">Paypoint {schadsPaypoint}</p>
                    )}
                  </div>

                  {/* Live Calculated Rate Card */}
                  <motion.div
                    layout
                    className={`mt-4 rounded-xl border p-5 ${
                      calculatedRate ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2">
                      Calculated Base Rate (Ordinary Hours)
                    </p>
                    <p className="font-mono text-[28px] font-bold tracking-tight tabular-nums text-emerald-400">
                      {calculatedRate ? fmtCurrency(calculatedRate.effective) : "—"}
                      <span className="text-[14px] font-normal text-zinc-500 ml-1">/ hr</span>
                    </p>
                    {calculatedRate && (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {calculatedRate.casualLoading && "Includes 25% casual loading. "}
                        Matches SCHADS [MA000100] L{schadsLevel}P{schadsPaypoint}.
                      </p>
                    )}
                  </motion.div>
                </div>

                {/* RIGHT: Financial Routing & Super */}
                <div className="space-y-5">
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-3">Bank Details</h3>

                  {/* Bank fields */}
                  {[
                    { label: "Account Name", value: bankAccountName, setter: setBankAccountName, type: "text" },
                    { label: "BSB", value: bankBsb, setter: setBankBsb, type: "text", maxLength: 7, placeholder: "000-000" },
                    { label: "Account Number", value: bankAccountNumber, setter: setBankAccountNumber, type: "text" },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">{field.label}</label>
                      {editingEmployment ? (
                        <input type={field.type} value={field.value} onChange={(e) => field.setter(e.target.value)}
                          maxLength={field.maxLength} placeholder={field.placeholder}
                          className="w-full rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.2] font-mono" />
                      ) : (
                        <p className="text-[14px] text-zinc-300 font-mono">{field.value || "—"}</p>
                      )}
                    </div>
                  ))}

                  <div className="h-px bg-white/[0.05] my-5" />

                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-3">Superannuation</h3>

                  {[
                    { label: "Fund Name", value: superFund, setter: setSuperFund },
                    { label: "USI (Unique Superannuation Identifier)", value: superUsi, setter: setSuperUsi },
                    { label: "Member Number", value: superMember, setter: setSuperMember },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">{field.label}</label>
                      {editingEmployment ? (
                        <input type="text" value={field.value} onChange={(e) => field.setter(e.target.value)}
                          className="w-full rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-2.5 text-[13px] text-white outline-none focus:border-white/[0.2]" />
                      ) : (
                        <p className="text-[14px] text-zinc-300">{field.value || "—"}</p>
                      )}
                    </div>
                  ))}

                  {/* TFN */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Tax File Number (TFN)</label>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] text-zinc-300 font-mono">{tfnMask || "Not provided"}</p>
                      <button onClick={() => setShowTfn((p) => !p)} className="text-zinc-600 hover:text-zinc-400">
                        {showTfn ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────
              TAB 2: Compliance & Vault
             ────────────────────────────────────────────── */}
          {activeTab === "compliance" && (
            <motion.div key="compliance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
              {/* Summary */}
              <div className="flex items-center gap-6 mb-6">
                {[
                  { label: "Total", value: creds.total, color: "text-zinc-300" },
                  { label: "Verified", value: creds.verified, icon: CheckCircle2, color: "text-emerald-400" },
                  { label: "Pending", value: creds.pending, icon: AlertCircle, color: "text-amber-400" },
                  { label: "Expired", value: creds.expired, icon: XCircle, color: "text-rose-400" },
                  { label: "Expiring Soon", value: creds.expiring_soon, icon: AlertTriangle, color: "text-amber-400" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2">
                    {stat.icon && <stat.icon size={14} className={stat.color} />}
                    <div>
                      <p className="text-[10px] font-mono uppercase text-zinc-600">{stat.label}</p>
                      <p className={`font-mono text-[18px] font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Credentials Grid */}
              <div className="space-y-3">
                {credentials.length === 0 ? (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01]">
                    <div className="text-center">
                      <Shield size={24} className="mx-auto mb-2 text-zinc-700" />
                      <p className="text-[13px] text-zinc-500">No credentials uploaded yet</p>
                      <p className="text-[11px] text-zinc-600 mt-1">Upload worker documentation to track compliance</p>
                    </div>
                  </div>
                ) : (
                  credentials.map((cred, i) => {
                    const today = new Date().toISOString().split("T")[0];
                    const days = daysUntil(cred.expiry_date);
                    const isExpired = cred.verification_status === "expired" || (cred.expiry_date && cred.expiry_date < today);
                    const isExpiring = !isExpired && days !== null && days <= 30 && days > 0;
                    const isValid = cred.verification_status === "verified" && !isExpired && !isExpiring;
                    const CredIcon = CREDENTIAL_ICONS[cred.credential_type] || FileText;

                    return (
                      <motion.div
                        key={cred.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * i, duration: 0.3, ease }}
                        className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-zinc-950 p-4 hover:border-white/[0.08] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            isValid ? "bg-emerald-500/10" : isExpiring ? "bg-amber-500/10" : isExpired ? "bg-rose-500/10" : "bg-zinc-800"
                          }`}>
                            <CredIcon size={18} className={
                              isValid ? "text-emerald-400" : isExpiring ? "text-amber-400" : isExpired ? "text-rose-400" : "text-zinc-500"
                            } />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-zinc-200">
                              {CREDENTIAL_LABELS[cred.credential_type] || cred.credential_type}
                            </p>
                            {cred.credential_name && (
                              <p className="text-[11px] text-zinc-500 mt-0.5">{cred.credential_name}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Expiry info */}
                          {cred.expiry_date && (
                            <p className="text-[11px] text-zinc-500 font-mono">
                              Expires {fmtDate(cred.expiry_date)}
                            </p>
                          )}

                          {/* Status Badge */}
                          {isValid && (
                            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                              Valid till {fmtDate(cred.expiry_date)}
                            </span>
                          )}
                          {isExpiring && (
                            <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">
                              Expiring {days} Days
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-400 animate-pulse">
                              EXPIRED
                            </span>
                          )}
                          {!isValid && !isExpiring && !isExpired && (
                            <span className="inline-flex items-center rounded-md bg-zinc-500/10 px-2.5 py-1 text-[10px] font-semibold text-zinc-400">
                              {cred.verification_status}
                            </span>
                          )}

                          {/* View document */}
                          {cred.document_url && (
                            <a href={cred.document_url} target="_blank" rel="noopener noreferrer"
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-colors">
                              <FileText size={12} />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────
              TAB 3: Rostering Physics
             ────────────────────────────────────────────── */}
          {activeTab === "rostering" && (
            <motion.div key="rostering" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
              {/* Edit toggle */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Scheduling Constraints</h2>
                {editingRostering ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setEditingRostering(false); loadData(); }} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-200">
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={handleSaveRostering} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-4 py-2 text-[12px] font-semibold text-black hover:brightness-110 disabled:opacity-40">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? "Saving..." : "Save Constraints"}
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditingRostering(true)} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/[0.1]">
                    <Edit2 size={14} /> Edit Rostering
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-12">
                {/* LEFT: Temporal Boundaries */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Temporal Boundaries</h3>

                  {/* Max Hours */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">Maximum Hours Per Week</label>
                    {editingRostering ? (
                      <input type="number" value={maxHours} onChange={(e) => setMaxHours(parseInt(e.target.value) || 0)}
                        className="w-32 rounded-lg border border-white/[0.1] bg-zinc-900 px-3 py-2.5 text-[16px] font-mono font-bold text-white outline-none focus:border-white/[0.2]" />
                    ) : (
                      <p className="font-mono text-[24px] font-bold text-zinc-200 tabular-nums">{maxHours}<span className="text-[12px] text-zinc-600 font-normal ml-1">hrs/wk</span></p>
                    )}
                    <p className="mt-1 text-[10px] text-zinc-600">The roster will block assignments beyond this limit.</p>
                  </div>

                  {/* Weekly Utilization */}
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="text-[10px] font-mono uppercase text-zinc-500 mb-1">Current Week Utilization</p>
                    <div className="flex items-end gap-2">
                      <span className="font-mono text-[20px] font-bold text-zinc-200 tabular-nums">{dossier.weekly_hours_scheduled}</span>
                      <span className="text-[12px] text-zinc-600 mb-0.5">/ {maxHours} hrs</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((dossier.weekly_hours_scheduled / maxHours) * 100, 100)}%` }}
                        transition={{ duration: 0.6, ease }}
                        className={`h-full rounded-full ${
                          dossier.weekly_hours_scheduled / maxHours > 0.9 ? "bg-rose-500" : dossier.weekly_hours_scheduled / maxHours > 0.7 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                      />
                    </div>
                  </div>

                  {/* Availability Grid */}
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 pt-2">Availability Matrix</h3>
                  <div className="space-y-2">
                    {DAYS.map((day) => {
                      const slot = availabilityDays[day] || { available: false, start: "06:00", end: "18:00" };
                      return (
                        <div key={day} className="flex items-center gap-3">
                          <span className="w-20 text-[12px] text-zinc-500">{DAY_LABELS[day]}</span>
                          {editingRostering ? (
                            <>
                              <button
                                onClick={() => setAvailabilityDays((prev) => ({ ...prev, [day]: { ...slot, available: !slot.available } }))}
                                className={`flex h-7 w-12 items-center rounded-full border transition-colors ${
                                  slot.available ? "border-emerald-500/30 bg-emerald-500/20 justify-end" : "border-white/[0.1] bg-zinc-900 justify-start"
                                }`}
                              >
                                <div className={`h-5 w-5 rounded-full mx-1 transition-colors ${slot.available ? "bg-emerald-500" : "bg-zinc-600"}`} />
                              </button>
                              {slot.available && (
                                <>
                                  <input type="time" value={slot.start}
                                    onChange={(e) => setAvailabilityDays((prev) => ({ ...prev, [day]: { ...slot, start: e.target.value } }))}
                                    className="rounded border border-white/[0.1] bg-zinc-900 px-2 py-1 text-[11px] font-mono text-zinc-300 outline-none" />
                                  <span className="text-[11px] text-zinc-600">to</span>
                                  <input type="time" value={slot.end}
                                    onChange={(e) => setAvailabilityDays((prev) => ({ ...prev, [day]: { ...slot, end: e.target.value } }))}
                                    className="rounded border border-white/[0.1] bg-zinc-900 px-2 py-1 text-[11px] font-mono text-zinc-300 outline-none" />
                                </>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${slot.available ? "bg-emerald-500" : "bg-zinc-700"}`} />
                              {slot.available ? (
                                <span className="font-mono text-[11px] text-zinc-400">{slot.start} — {slot.end}</span>
                              ) : (
                                <span className="text-[11px] text-zinc-600">Unavailable</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT: Skills & Regions */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Clinical Skills & Qualifications</h3>

                  <div className="grid grid-cols-2 gap-2">
                    {skills.map((skill) => {
                      const active = editSkills.includes(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => {
                            if (!editingRostering) return;
                            setEditSkills((prev) => active ? prev.filter((s) => s !== skill.id) : [...prev, skill.id]);
                          }}
                          disabled={!editingRostering}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] transition-all text-left ${
                            active
                              ? "border-[var(--brand)]/30 bg-[var(--brand)]/[0.06] text-[var(--brand)]"
                              : editingRostering
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

                  {/* Service Regions */}
                  <div className="pt-4">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-3">Service Regions</h3>
                    <div className="flex flex-wrap gap-2">
                      {(dossier.skills || []).map((region: string) => (
                        <span key={region} className="inline-flex items-center rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-400">
                          {region}
                        </span>
                      ))}
                      {(!dossier.skills || dossier.skills.length === 0) && (
                        <p className="text-[11px] text-zinc-600">No service regions assigned</p>
                      )}
                    </div>
                  </div>

                  {/* Participant Exclusions */}
                  <div className="pt-4">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-1">Do Not Roster With</h3>
                    <p className="text-[10px] text-zinc-600 mb-3">If a personality clash or past incident exists, excluded participants will never be paired with this worker.</p>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                      <Ban size={18} className="mx-auto mb-2 text-zinc-700" />
                      <p className="text-[11px] text-zinc-600">No exclusions configured</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────
              TAB 4: Activity & Audit
             ────────────────────────────────────────────── */}
          {activeTab === "activity" && (
            <motion.div key="activity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-6">Chronological Audit Trail</h2>

              {activities.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01]">
                  <div className="text-center">
                    <Activity size={24} className="mx-auto mb-2 text-zinc-700" />
                    <p className="text-[13px] text-zinc-500">No activity recorded yet</p>
                  </div>
                </div>
              ) : (
                <div className="relative pl-6">
                  {/* Timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-white/[0.06]" />

                  <div className="space-y-4">
                    {activities.map((act, i) => {
                      const typeColors: Record<string, string> = {
                        system: "bg-zinc-600",
                        hr: "bg-blue-500",
                        shift: "bg-emerald-500",
                        compliance: "bg-amber-500",
                        security: "bg-rose-500",
                      };

                      return (
                        <motion.div
                          key={act.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.02 * i, duration: 0.3, ease }}
                          className="relative flex gap-4"
                        >
                          {/* Timeline node */}
                          <div className={`absolute -left-4 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--background)] ${typeColors[act.type] || "bg-zinc-600"}`} />

                          <div className="flex-1 rounded-lg border border-white/[0.04] bg-white/[0.015] p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  act.type === "system" ? "bg-zinc-500/10 text-zinc-400" :
                                  act.type === "hr" ? "bg-blue-500/10 text-blue-400" :
                                  act.type === "shift" ? "bg-emerald-500/10 text-emerald-400" :
                                  act.type === "compliance" ? "bg-amber-500/10 text-amber-400" :
                                  "bg-rose-500/10 text-rose-400"
                                }`}>
                                  {act.type}
                                </span>
                                {act.actor_name && (
                                  <span className="text-[11px] text-zinc-500">by {act.actor_name}</span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-600">{timeAgo(act.created_at)}</span>
                            </div>
                            <p className={`text-[12px] ${act.type === "system" ? "font-mono text-[10px] text-zinc-500" : "text-zinc-300"}`}>
                              {act.description}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ──────────────────────────────────────────────
              TAB 5: Security & Access
             ────────────────────────────────────────────── */}
          {activeTab === "security" && (
            <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease }}>
              <div className="max-w-2xl space-y-8">
                {/* Platform Access Toggle */}
                <div>
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-4">Platform Access</h3>
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                    <div>
                      <p className="text-[14px] font-medium text-zinc-200">Allow Login</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Disabling this instantly invalidates the worker&apos;s session.</p>
                    </div>
                    <button
                      onClick={handleSuspendToggle}
                      disabled={saving}
                      className={`flex h-8 w-14 items-center rounded-full border transition-all ${
                        dossier.status === "active"
                          ? "border-emerald-500/30 bg-emerald-500/20 justify-end"
                          : "border-white/[0.1] bg-zinc-900 justify-start"
                      }`}
                    >
                      <div className={`h-6 w-6 rounded-full mx-1 transition-colors ${dossier.status === "active" ? "bg-emerald-500" : "bg-zinc-600"}`} />
                    </button>
                  </div>
                </div>

                {/* Role Assignment */}
                <div>
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-4">Role Assignment</h3>
                  <div className="space-y-3">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => {
                          if (role.value === "admin" || role.value === "owner") {
                            setRoleChangeTarget(role.value);
                            setShowRoleConfirm(true);
                          } else {
                            setRoleChangeTarget(role.value);
                            updateWorkerRole({
                              target_user_id: userId,
                              organization_id: orgId!,
                              new_role: role.value,
                            }).then(() => loadData());
                          }
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                          dossier.role === role.value
                            ? "border-white/[0.15] bg-white/[0.04]"
                            : "border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1]"
                        }`}
                      >
                        <div>
                          <p className="text-[13px] font-medium text-zinc-200">{role.value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                          <p className="text-[11px] text-zinc-500">{role.label}</p>
                        </div>
                        {dossier.role === role.value && (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin Confirmation Modal */}
                <AnimatePresence>
                  {showRoleConfirm && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-5"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert size={16} className="text-rose-400" />
                        <p className="text-[13px] font-semibold text-rose-300">Privilege Escalation Warning</p>
                      </div>
                      <p className="text-[12px] text-zinc-400 mb-4">
                        You are about to grant <span className="text-white font-medium">{roleChangeTarget.toUpperCase()}</span> access to{" "}
                        <span className="text-white font-medium">{dossier.full_name}</span>.
                        Type <code className="px-1 py-0.5 rounded bg-zinc-800 text-rose-400 font-mono text-[11px]">GRANT ADMIN</code> to confirm.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={roleConfirmation}
                          onChange={(e) => setRoleConfirmation(e.target.value)}
                          placeholder="Type GRANT ADMIN"
                          className="flex-1 rounded-lg border border-rose-500/20 bg-zinc-900 px-3 py-2 text-[13px] font-mono text-white outline-none focus:border-rose-500/40"
                        />
                        <button
                          onClick={handleRoleChange}
                          disabled={saving || roleConfirmation !== "GRANT ADMIN"}
                          className="rounded-lg bg-rose-600 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-30"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => { setShowRoleConfirm(false); setRoleConfirmation(""); }}
                          className="rounded-lg border border-white/[0.08] px-3 py-2 text-[12px] text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Authentication Actions */}
                <div>
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-4">Authentication</h3>
                  <div className="flex gap-3">
                    <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors">
                      <RefreshCw size={14} />
                      Send Password Reset Email
                    </button>
                    <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2.5 text-[12px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors">
                      <Smartphone size={14} />
                      Force MFA Re-enrollment
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
