"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Search,
  Send,
  RefreshCw,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Clock,
  ShieldCheck,
  Wifi,
  WifiOff,
  Link2,
  KeyRound,
  Eye,
  RotateCcw,
  Banknote,
  FileCheck,
  XCircle,
  Timer,
  Users,
  Fingerprint,
  Server,
  Activity,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getPaceDashboardStats,
  getPaceClaims,
  getAllPaceLinkages,
  getProdaDevice,
  submitClaimToPace,
  retryFailedClaim,
  checkEndorsementStatus,
  testProdaAuth,
  refreshProdaToken,
  submitAllReadyClaims,
  registerProdaDevice,
  createPaceLinkage,
} from "@/app/actions/nightingale-pace";

/* ── Types ─────────────────────────────────────────────── */

type ClaimStatus = "DRAFT" | "READY" | "SUBMITTED_TO_PACE" | "ACCEPTED" | "REJECTED" | "QUEUED_FOR_PACE" | "PAID" | "REMITTED" | "ERROR";
type EndorsementStatus = "ENDORSED" | "PENDING" | "UNLINKED" | "REVOKED";
type Tab = "claims" | "endorsements" | "proda";

interface PaceClaim {
  id: string;
  claim_reference: string | null;
  ndis_number: string;
  support_item_code: string;
  support_item_name?: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  service_start_date: string;
  service_end_date: string;
  pace_status: string;
  pace_error_code?: string | null;
  pace_error_message?: string | null;
  submitted_at?: string | null;
  date_paid?: string | null;
  created_at: string;
  participant_profiles?: { id: string; ndis_number: string } | null;
}

interface PaceLinkage {
  id: string;
  participant_profile_id: string;
  ndis_number: string;
  pace_status: string;
  endorsed_categories: string[];
  live_balance_cache?: Record<string, number> | null;
  endorsement_checked_at?: string | null;
  created_at: string;
  participant_profiles?: { id: string; ndis_number: string } | null;
}

interface ProdaDeviceInfo {
  id: string;
  organization_id: string;
  device_name: string;
  device_id: string | null;
  proda_org_id: string;
  last_auth_at?: string | null;
  token_expires_at?: string | null;
  status: string;
}

interface DashboardStats {
  total_claims: number;
  submitted: number;
  accepted: number;
  rejected: number;
  queued: number;
  total_claimed: number;
  total_paid: number;
  total_rejected_value: number;
  endorsed_participants: number;
  unlinked_participants: number;
  pending_endorsement: number;
}

/* ── Status Config ─────────────────────────────────────── */

const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:             { label: "Draft",     bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  READY:             { label: "Ready",     bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/20" },
  SUBMITTED_TO_PACE: { label: "Submitted", bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  ACCEPTED:          { label: "Accepted",  bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  REJECTED:          { label: "Rejected",  bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
  QUEUED_FOR_PACE:   { label: "Queued",    bg: "bg-yellow-500/10",  text: "text-yellow-400",  border: "border-yellow-500/20" },
  PAID:              { label: "Paid",      bg: "bg-green-500/10",   text: "text-green-400",   border: "border-green-500/20" },
  REMITTED:          { label: "Remitted",  bg: "bg-green-500/10",   text: "text-green-400",   border: "border-green-500/20" },
  ERROR:             { label: "Error",     bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
};

const ENDORSEMENT_STATUS_CONFIG: Record<EndorsementStatus, { label: string; bg: string; text: string; border: string; pulse?: boolean }> = {
  ENDORSED:  { label: "Endorsed",  bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  PENDING:   { label: "Pending",   bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20", pulse: true },
  UNLINKED:  { label: "Unlinked",  bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  REVOKED:   { label: "Revoked",   bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
};

/* ── Formatters ────────────────────────────────────────── */

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtDateRange = (from: string, to: string) => {
  const f = new Date(from);
  const t = new Date(to);
  if (f.toDateString() === t.toDateString()) return fmtDate(from);
  return `${fmtDate(from)} — ${fmtDate(to)}`;
};

/* ── Framer variants ───────────────────────────────────── */

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

/* ── Claim Status Badge ────────────────────────────────── */

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const c = CLAIM_STATUS_CONFIG[status] ?? CLAIM_STATUS_CONFIG.DRAFT;
  const isRejected = status === "REJECTED";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${c.bg} ${c.text} ${c.border} ${isRejected ? "animate-pulse" : ""}`}
    >
      {status === "ACCEPTED" && <CheckCircle2 size={10} />}
      {status === "REJECTED" && <XCircle size={10} />}
      {status === "QUEUED_FOR_PACE" && <Timer size={10} />}
      {status === "PAID" && <Banknote size={10} />}
      {status === "ERROR" && <AlertTriangle size={10} />}
      {c.label}
    </span>
  );
}

/* ── Endorsement Status Badge ──────────────────────────── */

function EndorsementBadge({ status }: { status: EndorsementStatus }) {
  const c = ENDORSEMENT_STATUS_CONFIG[status] ?? ENDORSEMENT_STATUS_CONFIG.UNLINKED;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${c.bg} ${c.text} ${c.border} ${c.pulse ? "animate-pulse" : ""}`}
    >
      {status === "ENDORSED" && <ShieldCheck size={10} />}
      {status === "PENDING" && <Clock size={10} />}
      {status === "REVOKED" && <XCircle size={10} />}
      {c.label}
    </span>
  );
}

/* ── Telemetry Card ────────────────────────────────────── */

function TelemetryCard({
  label,
  value,
  icon: Icon,
  color,
  isMono = false,
  pulse = false,
  index = 0,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  isMono?: boolean;
  pulse?: boolean;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex h-16 items-center gap-3 overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-950/30 px-4 ${pulse ? "animate-pulse" : ""}`}
    >
      {/* Subtle glow behind icon */}
      <div className={`absolute left-0 top-0 h-full w-1 ${color.replace("text-", "bg-")} opacity-40`} />
      <Icon size={16} className={color} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p>
        <p className={`text-[15px] font-semibold tracking-tight ${color} ${isMono ? "font-mono" : ""}`}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Skeleton Row ──────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-zinc-800/30 px-5 py-4">
      <div className="h-3 w-20 rounded skeleton-shimmer" />
      <div className="h-3 w-24 rounded skeleton-shimmer" />
      <div className="h-3 w-32 rounded skeleton-shimmer" />
      <div className="h-3 w-28 rounded skeleton-shimmer" />
      <div className="h-3 w-24 rounded skeleton-shimmer" />
      <div className="h-4 w-16 rounded skeleton-shimmer" />
      <div className="h-6 w-16 rounded skeleton-shimmer" />
    </div>
  );
}

/* ── Link Participant Modal ────────────────────────────── */

function LinkParticipantModal({
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
  const [ndisNumber, setNdisNumber] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="w-full max-w-md rounded-xl border border-zinc-800/60 bg-[#0A0A0A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/40 px-6 py-4">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Link PACE Participant</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
            <XCircle size={16} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Participant Name
            </label>
            <input
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              NDIS Number
            </label>
            <input
              value={ndisNumber}
              onChange={(e) => setNdisNumber(e.target.value)}
              placeholder="e.g. 431234567"
              className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all"
            />
          </div>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-rose-400">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800/40 px-6 py-4">
          <button
            onClick={onClose}
            className="r-button bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            style={{ borderRadius: "var(--radius-button)" }}
          >
            Cancel
          </button>
          <button
            disabled={!ndisNumber.trim() || !participantName.trim() || submitting}
            onClick={async () => {
              setSubmitting(true);
              setError("");
              try {
                // participantName is used as participant_profile_id for now
                await createPaceLinkage(orgId, participantName.trim(), ndisNumber.trim());
                onCreated();
                onClose();
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : "Failed to create linkage");
              } finally {
                setSubmitting(false);
              }
            }}
            className="r-button bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderRadius: "var(--radius-button)" }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            {submitting ? "Linking..." : "Link Participant"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function PACEClaimsPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);

  /* ── State ─── */
  const [tab, setTab] = useState<Tab>("claims");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [claims, setClaims] = useState<PaceClaim[]>([]);
  const [linkages, setLinkages] = useState<PaceLinkage[]>([]);
  const [prodaDevice, setProdaDevice] = useState<ProdaDeviceInfo | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  // Actions
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [checkingEndorsement, setCheckingEndorsement] = useState<string | null>(null);
  const [submitAllLoading, setSubmitAllLoading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  // PRODA
  const [prodaFormOrgId, setProdaFormOrgId] = useState("");
  const [prodaFormDeviceName, setProdaFormDeviceName] = useState("");
  const [prodaFormDeviceId, setProdaFormDeviceId] = useState("");
  const [prodaRegistering, setProdaRegistering] = useState(false);
  const [prodaTesting, setProdaTesting] = useState(false);
  const [prodaRefreshing, setProdaRefreshing] = useState(false);
  const [prodaMessage, setProdaMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  /* ── Data fetching ─── */
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [statsRes, claimsRes, linkageRes, deviceRes] = await Promise.all([
        getPaceDashboardStats(orgId),
        getPaceClaims(orgId),
        getAllPaceLinkages(orgId),
        getProdaDevice(orgId),
      ]);
      if (statsRes.data) setStats(statsRes.data as DashboardStats);
      setClaims((claimsRes.data as PaceClaim[]) ?? []);
      setLinkages((linkageRes.data as PaceLinkage[]) ?? []);
      setProdaDevice((deviceRes.data as ProdaDeviceInfo) ?? null);
    } catch (err) {
      console.error("Failed to load PACE data:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Filtered claims ─── */
  const filteredClaims = useMemo(() => {
    let list = claims;
    if (statusFilter !== "ALL") {
      list = list.filter((c) => c.pace_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.ndis_number.toLowerCase().includes(q) ||
          (c.claim_reference?.toLowerCase().includes(q) ?? false) ||
          c.support_item_code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [claims, statusFilter, search]);

  /* ── Claim actions ─── */
  const handleSubmitClaim = useCallback(
    async (claimId: string) => {
      if (!orgId) return;
      setSubmittingId(claimId);
      try {
        await submitClaimToPace(orgId, claimId);
        await loadData();
      } catch (err) {
        console.error("Submit failed:", err);
      } finally {
        setSubmittingId(null);
      }
    },
    [orgId, loadData]
  );

  const handleRetryClaim = useCallback(
    async (claimId: string) => {
      if (!orgId) return;
      setRetryingId(claimId);
      try {
        await retryFailedClaim(orgId, claimId);
        await loadData();
      } catch (err) {
        console.error("Retry failed:", err);
      } finally {
        setRetryingId(null);
      }
    },
    [orgId, loadData]
  );

  const handleSubmitAll = useCallback(async () => {
    if (!orgId) return;
    setSubmitAllLoading(true);
    try {
      await submitAllReadyClaims(orgId);
      await loadData();
    } catch (err) {
      console.error("Submit all failed:", err);
    } finally {
      setSubmitAllLoading(false);
    }
  }, [orgId, loadData]);

  const handleCheckEndorsement = useCallback(
    async (linkageId: string) => {
      if (!orgId) return;
      setCheckingEndorsement(linkageId);
      try {
        // linkageId is actually the participant_profile_id for the server action
        const linkage = linkages.find(l => l.id === linkageId);
        if (linkage) {
          await checkEndorsementStatus(orgId, linkage.participant_profile_id);
        }
        await loadData();
      } catch (err) {
        console.error("Check endorsement failed:", err);
      } finally {
        setCheckingEndorsement(null);
      }
    },
    [orgId, loadData]
  );

  /* ── PRODA actions ─── */
  const handleRegisterDevice = useCallback(async () => {
    if (!orgId) return;
    setProdaRegistering(true);
    setProdaMessage(null);
    try {
      await registerProdaDevice(orgId, {
        proda_org_id: prodaFormOrgId.trim(),
        device_name: prodaFormDeviceName.trim(),
        device_id: prodaFormDeviceId.trim(),
      });
      setProdaMessage({ type: "success", text: "PRODA device registered successfully" });
      await loadData();
    } catch (err) {
      setProdaMessage({ type: "error", text: err instanceof Error ? err.message : "Registration failed" });
    } finally {
      setProdaRegistering(false);
    }
  }, [orgId, prodaFormOrgId, prodaFormDeviceName, prodaFormDeviceId, loadData]);

  const handleTestAuth = useCallback(async () => {
    if (!orgId) return;
    setProdaTesting(true);
    setProdaMessage(null);
    try {
      await testProdaAuth(orgId);
      setProdaMessage({ type: "success", text: "PRODA authentication successful — token is valid" });
    } catch (err) {
      setProdaMessage({ type: "error", text: err instanceof Error ? err.message : "Authentication test failed" });
    } finally {
      setProdaTesting(false);
    }
  }, [orgId]);

  const handleRefreshToken = useCallback(async () => {
    if (!orgId) return;
    setProdaRefreshing(true);
    setProdaMessage(null);
    try {
      await refreshProdaToken(orgId);
      setProdaMessage({ type: "success", text: "PRODA token refreshed successfully" });
      await loadData();
    } catch (err) {
      setProdaMessage({ type: "error", text: err instanceof Error ? err.message : "Token refresh failed" });
    } finally {
      setProdaRefreshing(false);
    }
  }, [orgId, loadData]);

  /* ── Computed ─── */
  const readyCount = useMemo(() => claims.filter((c) => c.pace_status === "READY").length, [claims]);

  /* ══ Render ══════════════════════════════════════════════ */

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[#050505]">
      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Radial glow */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-72"
        style={{ background: "radial-gradient(ellipse at center top, rgba(16,185,129,0.03) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 mx-auto max-w-[1440px] space-y-6 px-6 py-8">
        {/* ── Header ────────────────────────────────────── */}
        <motion.div {...fadeUp} className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Zap size={18} className="text-emerald-400" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">
                PACE ENGINE
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">PACE Claims Engine</h1>
            <p className="mt-1 text-sm text-zinc-500">Real-time NDIA claim submission &amp; tracking</p>
          </div>
          {readyCount > 0 && (
            <button
              onClick={handleSubmitAll}
              disabled={submitAllLoading}
              className="r-button flex items-center gap-2 bg-emerald-500 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
              style={{ borderRadius: "var(--radius-button)" }}
            >
              {submitAllLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit All Ready ({readyCount})
            </button>
          )}
        </motion.div>

        {/* ── PACE API Status Banner ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {stats && stats.queued > 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <AlertTriangle size={16} className="shrink-0 text-amber-400" />
              <span className="text-[13px] font-medium text-amber-300">
                ⚠ PACE API — {stats.queued} claim{stats.queued !== 1 ? "s" : ""} queued for retry
              </span>
              <button
                onClick={loadData}
                className="ml-auto rounded-md p-1 text-amber-400 transition-colors hover:bg-amber-500/10"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          ) : stats ? (
            <div className="flex items-center gap-2 px-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[12px] font-medium text-emerald-400/80">PACE API Connected</span>
            </div>
          ) : !loading ? (
            <div className="flex items-center gap-2 px-1">
              <WifiOff size={12} className="text-zinc-600" />
              <span className="text-[12px] text-zinc-600">PACE API status unavailable</span>
            </div>
          ) : null}
        </motion.div>

        {/* ── Telemetry Ribbon ──────────────────────────── */}
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <TelemetryCard
            label="Total Claimed"
            value={fmtCurrency(stats?.total_claimed ?? 0)}
            icon={DollarSign}
            color="text-emerald-400"
            isMono
            index={0}
          />
          <TelemetryCard
            label="Total Paid"
            value={fmtCurrency(stats?.total_paid ?? 0)}
            icon={Banknote}
            color="text-blue-400"
            isMono
            index={1}
          />
          <TelemetryCard
            label="Submitted"
            value={String(stats?.submitted ?? 0)}
            icon={Send}
            color={(stats?.submitted ?? 0) > 0 ? "text-amber-400" : "text-zinc-500"}
            index={2}
          />
          <TelemetryCard
            label="Accepted"
            value={String(stats?.accepted ?? 0)}
            icon={CheckCircle2}
            color="text-emerald-400"
            index={3}
          />
          <TelemetryCard
            label="Rejected"
            value={String(stats?.rejected ?? 0)}
            icon={XCircle}
            color={(stats?.rejected ?? 0) > 0 ? "text-rose-400" : "text-zinc-500"}
            pulse={(stats?.rejected ?? 0) > 0}
            index={4}
          />
          <TelemetryCard
            label="Queued"
            value={String(stats?.queued ?? 0)}
            icon={Timer}
            color={(stats?.queued ?? 0) > 0 ? "text-amber-400" : "text-zinc-500"}
            index={5}
          />
        </motion.div>

        {/* ── Tab Navigation ───────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-1 border-b border-zinc-800/40"
        >
          {([
            { key: "claims" as Tab, label: "Live Claims", icon: Activity },
            { key: "endorsements" as Tab, label: "Endorsements", icon: ShieldCheck },
            { key: "proda" as Tab, label: "PRODA Device", icon: Fingerprint },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-medium transition-colors ${
                tab === t.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <t.icon size={14} />
              {t.label}
              {tab === t.key && (
                <motion.div
                  layoutId="pace-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* ── Tab Content ──────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ═══ LIVE CLAIMS TAB ═══════════════════════════ */}
          {tab === "claims" && (
            <motion.div
              key="claims"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ClaimStatus | "ALL")}
                    className="appearance-none rounded-lg border border-zinc-800/50 bg-zinc-950/40 py-2 pl-3 pr-8 text-[12px] font-medium text-zinc-300 outline-none transition-colors focus:border-zinc-700 hover:border-zinc-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="READY">Ready</option>
                    <option value="SUBMITTED_TO_PACE">Submitted</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="QUEUED_FOR_PACE">Queued</option>
                    <option value="PAID">Paid</option>
                    <option value="ERROR">Error</option>
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                </div>

                <div className="relative max-w-xs flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by NDIS number, claim ref..."
                    className="w-full rounded-lg border border-zinc-800/50 bg-zinc-950/40 py-2 pl-9 pr-3 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600 transition-colors focus:border-zinc-700"
                  />
                </div>

                <button
                  onClick={loadData}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-800/50 bg-zinc-950/40 px-3 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
              </div>

              {/* Claims grid */}
              <div className="overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-950/30">
                {/* Table header */}
                <div className="grid grid-cols-[100px_110px_160px_180px_140px_90px_100px] gap-3 border-b border-zinc-800/40 px-5 py-3">
                  {["Claim Ref", "NDIS No.", "Support Item", "Amount", "Service Dates", "Status", "Actions"].map((h) => (
                    <span key={h} className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-600">
                      {h}
                    </span>
                  ))}
                </div>

                {/* Loading skeleton */}
                {loading && claims.length === 0 && (
                  <div>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!loading && filteredClaims.length === 0 && (
                  <div className="flex flex-col items-center py-16 text-center">
                    <div className="relative mb-5">
                      <div className="absolute inset-0 animate-[zen-ring_2s_ease-out_infinite] rounded-full border border-zinc-800" />
                      <div className="flex h-12 w-12 animate-[zen-breathe_3s_ease-in-out_infinite] items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
                        <FileCheck size={20} className="text-zinc-600" />
                      </div>
                    </div>
                    <p className="text-[14px] font-medium text-zinc-300">
                      {search || statusFilter !== "ALL" ? "No claims match your filters" : "No PACE claims yet"}
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-600">
                      {search || statusFilter !== "ALL"
                        ? "Try adjusting your search or status filter."
                        : "Claims created from service bookings will appear here."}
                    </p>
                  </div>
                )}

                {/* Claim rows */}
                <AnimatePresence>
                  {filteredClaims.map((claim, idx) => (
                    <motion.div
                      key={claim.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group grid grid-cols-[100px_110px_160px_180px_140px_90px_100px] items-center gap-3 border-b border-zinc-800/20 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                    >
                      {/* Claim Ref */}
                      <span className="truncate font-mono text-[12px] font-medium text-zinc-300">{claim.claim_reference || claim.id.substring(0, 8)}</span>

                      {/* NDIS Number */}
                      <span className="font-mono text-[12px] text-zinc-400">{claim.ndis_number}</span>

                      {/* Support Item */}
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-zinc-300">{claim.support_item_name ?? claim.support_item_code}</p>
                        <p className="font-mono text-[10px] text-zinc-600">{claim.support_item_code}</p>
                      </div>

                      {/* Amount: Qty × Unit = Total */}
                      <div className="font-mono text-[12px]">
                        <span className="text-zinc-500">{claim.quantity} × </span>
                        <span className="text-zinc-400">{fmtCurrency(claim.unit_price)}</span>
                        <span className="text-zinc-500"> = </span>
                        <span className="font-semibold text-zinc-100">{fmtCurrency(claim.total_amount)}</span>
                      </div>

                      {/* Service Dates */}
                      <span className="text-[11px] text-zinc-500">{fmtDateRange(claim.service_start_date, claim.service_end_date)}</span>

                      {/* Status */}
                      <ClaimStatusBadge status={(claim.pace_status || "DRAFT") as ClaimStatus} />

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {claim.pace_status === "READY" && (
                          <button
                            onClick={() => handleSubmitClaim(claim.id)}
                            disabled={submittingId === claim.id}
                            className="flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                            title="Submit to PACE"
                          >
                            {submittingId === claim.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                            Submit
                          </button>
                        )}
                        {(claim.pace_status === "REJECTED" || claim.pace_status === "QUEUED_FOR_PACE" || claim.pace_status === "ERROR") && (
                          <button
                            onClick={() => handleRetryClaim(claim.id)}
                            disabled={retryingId === claim.id}
                            className="flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-50"
                            title="Retry claim"
                          >
                            {retryingId === claim.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                            Retry
                          </button>
                        )}
                        <button
                          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
                          title="View details"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Rejected claim error details (shown inline below rejected rows) */}
                {filteredClaims
                  .filter((c) => (c.pace_status === "REJECTED" || c.pace_status === "ERROR") && (c.pace_error_code || c.pace_error_message))
                  .map((claim) => (
                    <div
                      key={`err-${claim.id}`}
                      className="border-b border-rose-500/10 bg-rose-500/[0.02] px-5 py-2"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0 text-rose-400/70" />
                        <div>
                          {claim.pace_error_code && (
                            <span className="mr-2 font-mono text-[10px] font-semibold text-rose-400">{claim.pace_error_code}</span>
                          )}
                          <span className="text-[11px] text-rose-300/80">{claim.pace_error_message ?? "Unknown error"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Results count */}
              {!loading && (
                <p className="text-[11px] text-zinc-600">
                  {filteredClaims.length} claim{filteredClaims.length !== 1 ? "s" : ""}
                  {statusFilter !== "ALL" && ` · filtered by ${statusFilter}`}
                </p>
              )}
            </motion.div>
          )}

          {/* ═══ ENDORSEMENTS TAB ══════════════════════════ */}
          {tab === "endorsements" && (
            <motion.div
              key="endorsements"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {/* Actions bar */}
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-zinc-400">
                  Participant PACE linkages and endorsement status
                </p>
                <button
                  onClick={() => setLinkModalOpen(true)}
                  className="r-button flex items-center gap-2 bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
                  style={{ borderRadius: "var(--radius-button)" }}
                >
                  <Link2 size={14} />
                  Link Participant
                </button>
              </div>

              {/* Endorsements grid */}
              <div className="overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-950/30">
                {/* Header */}
                <div className="grid grid-cols-[1fr_130px_1fr_160px_120px_100px] gap-3 border-b border-zinc-800/40 px-5 py-3">
                  {["Participant", "Status", "Endorsed Categories", "Balance Cache", "Last Checked", "Actions"].map(
                    (h) => (
                      <span key={h} className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-600">
                        {h}
                      </span>
                    )
                  )}
                </div>

                {/* Loading */}
                {loading && linkages.length === 0 && (
                  <div>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </div>
                )}

                {/* Empty */}
                {!loading && linkages.length === 0 && (
                  <div className="flex flex-col items-center py-16 text-center">
                    <div className="relative mb-5">
                      <div className="absolute inset-0 animate-[zen-ring_2s_ease-out_infinite] rounded-full border border-zinc-800" />
                      <div className="flex h-12 w-12 animate-[zen-breathe_3s_ease-in-out_infinite] items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
                        <Users size={20} className="text-zinc-600" />
                      </div>
                    </div>
                    <p className="text-[14px] font-medium text-zinc-300">No PACE linkages</p>
                    <p className="mt-1 text-[12px] text-zinc-600">
                      Link participants to check endorsement status and balance.
                    </p>
                  </div>
                )}

                {/* Rows */}
                <AnimatePresence>
                  {linkages.map((linkage, idx) => (
                    <motion.div
                      key={linkage.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.04 }}
                      className="group grid grid-cols-[1fr_130px_1fr_160px_120px_100px] items-center gap-3 border-b border-zinc-800/20 px-5 py-3.5 transition-colors last:border-b-0 hover:bg-white/[0.015]"
                    >
                      {/* Participant */}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-zinc-200">{linkage.ndis_number}</p>
                        <p className="font-mono text-[11px] text-zinc-500">{linkage.participant_profile_id.substring(0, 8)}</p>
                      </div>

                      {/* Status */}
                      <EndorsementBadge status={(linkage.pace_status || "UNLINKED").replace("PENDING_ENDORSEMENT", "PENDING") as EndorsementStatus} />

                      {/* Categories */}
                      <div className="flex flex-wrap gap-1">
                        {(linkage.endorsed_categories || []).length > 0 ? (
                          (linkage.endorsed_categories || []).map((cat: string) => (
                            <span
                              key={cat}
                              className="rounded border border-zinc-800/50 bg-zinc-900/50 px-1.5 py-0.5 text-[10px] text-zinc-400"
                            >
                              {cat}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-zinc-600">—</span>
                        )}
                      </div>

                      {/* Balance Cache */}
                      <div className="min-w-0">
                        {linkage.live_balance_cache && Object.keys(linkage.live_balance_cache).length > 0 ? (
                          <div className="space-y-0.5">
                            {Object.entries(linkage.live_balance_cache).slice(0, 2).map(([cat, val]) => (
                              <div key={cat} className="flex items-center justify-between">
                                <span className="text-[10px] text-zinc-600 truncate max-w-[60px]">{cat}</span>
                                <span className="font-mono text-[11px] font-medium text-emerald-400">
                                  {fmtCurrency(val as number)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-600">No data</span>
                        )}
                      </div>

                      {/* Last Checked */}
                      <span className="text-[11px] text-zinc-500">
                        {linkage.endorsement_checked_at ? fmtDateTime(linkage.endorsement_checked_at) : "Never"}
                      </span>

                      {/* Actions */}
                      <button
                        onClick={() => handleCheckEndorsement(linkage.id)}
                        disabled={checkingEndorsement === linkage.id}
                        className="flex items-center gap-1 rounded-md border border-zinc-800/50 bg-zinc-900/40 px-2 py-1 text-[10px] font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                      >
                        {checkingEndorsement === linkage.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <RefreshCw size={10} />
                        )}
                        Check Status
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ═══ PRODA DEVICE TAB ══════════════════════════ */}
          {tab === "proda" && (
            <motion.div
              key="proda"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="grid gap-6 lg:grid-cols-2"
            >
              {/* Left: Device Registration Form */}
              <div className="space-y-5 rounded-xl border border-zinc-800/40 bg-zinc-950/30 p-6">
                <div className="flex items-center gap-2">
                  <Server size={16} className="text-emerald-400" />
                  <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">Device Registration</h3>
                </div>
                <p className="text-[12px] leading-relaxed text-zinc-500">
                  Register your PRODA device to authenticate with the NDIA PACE API. You&apos;ll need your
                  organisation&apos;s PRODA credentials.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      PRODA Organisation ID
                    </label>
                    <input
                      value={prodaFormOrgId}
                      onChange={(e) => setProdaFormOrgId(e.target.value)}
                      placeholder="e.g. 4050000000"
                      className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Device Name
                    </label>
                    <input
                      value={prodaFormDeviceName}
                      onChange={(e) => setProdaFormDeviceName(e.target.value)}
                      placeholder="e.g. iWorkr Production Server"
                      className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      Device ID
                    </label>
                    <input
                      value={prodaFormDeviceId}
                      onChange={(e) => setProdaFormDeviceId(e.target.value)}
                      placeholder="e.g. iworkr-device-001"
                      className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] transition-all"
                    />
                  </div>

                  <button
                    onClick={handleRegisterDevice}
                    disabled={prodaRegistering || !prodaFormOrgId.trim() || !prodaFormDeviceName.trim() || !prodaFormDeviceId.trim()}
                    className="r-button flex w-full items-center justify-center gap-2 bg-white px-4 py-2.5 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderRadius: "var(--radius-button)" }}
                  >
                    {prodaRegistering ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                    {prodaRegistering ? "Registering..." : "Register Device"}
                  </button>
                </div>

                {/* Message */}
                <AnimatePresence>
                  {prodaMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                        prodaMessage.type === "success"
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                          : "border-rose-500/20 bg-rose-500/5 text-rose-400"
                      }`}
                    >
                      {prodaMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      {prodaMessage.text}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right: Token Status & Controls */}
              <div className="space-y-5 rounded-xl border border-zinc-800/40 bg-zinc-950/30 p-6">
                <div className="flex items-center gap-2">
                  <KeyRound size={16} className="text-emerald-400" />
                  <h3 className="text-[15px] font-semibold tracking-tight text-zinc-100">Token Status</h3>
                </div>

                {prodaDevice ? (
                  <div className="space-y-4">
                    {/* Device info grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <InfoField label="PRODA Org ID" value={prodaDevice.proda_org_id} mono />
                      <InfoField label="Device Name" value={prodaDevice.device_name} />
                      <InfoField label="Device ID" value={prodaDevice.device_id || "Not assigned"} mono />
                      <InfoField
                        label="Status"
                        value={
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                              prodaDevice.status === "ACTIVE"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                : prodaDevice.status === "EXPIRED"
                                  ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                                  : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                            }`}
                          >
                            {prodaDevice.status === "ACTIVE" && <Wifi size={10} />}
                            {prodaDevice.status === "EXPIRED" && <WifiOff size={10} />}
                            {prodaDevice.status}
                          </span>
                        }
                      />
                    </div>

                    {/* Auth timestamps */}
                    <div className="rounded-lg border border-zinc-800/30 bg-zinc-950/50 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-600">Last Authenticated</p>
                          <p className="mt-1 font-mono text-[12px] text-zinc-300">
                            {prodaDevice.last_auth_at ? fmtDateTime(prodaDevice.last_auth_at) : "Never"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-600">Token Expires</p>
                          <p
                            className={`mt-1 font-mono text-[12px] ${
                              prodaDevice.token_expires_at && new Date(prodaDevice.token_expires_at) < new Date()
                                ? "text-rose-400"
                                : "text-zinc-300"
                            }`}
                          >
                            {prodaDevice.token_expires_at ? fmtDateTime(prodaDevice.token_expires_at) : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTestAuth}
                        disabled={prodaTesting}
                        className="r-button flex flex-1 items-center justify-center gap-2 border border-zinc-800/50 bg-zinc-900/40 px-4 py-2.5 text-[13px] font-medium text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800/40 active:scale-[0.98] disabled:opacity-50"
                        style={{ borderRadius: "var(--radius-button)" }}
                      >
                        {prodaTesting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        {prodaTesting ? "Testing..." : "Test Authentication"}
                      </button>
                      <button
                        onClick={handleRefreshToken}
                        disabled={prodaRefreshing}
                        className="r-button flex flex-1 items-center justify-center gap-2 bg-emerald-500 px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
                        style={{ borderRadius: "var(--radius-button)" }}
                      >
                        {prodaRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        {prodaRefreshing ? "Refreshing..." : "Refresh Token"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="relative mb-5">
                      <div className="absolute inset-0 animate-[zen-ring_2s_ease-out_infinite] rounded-full border border-zinc-800" />
                      <div className="flex h-12 w-12 animate-[zen-breathe_3s_ease-in-out_infinite] items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
                        <Fingerprint size={20} className="text-zinc-600" />
                      </div>
                    </div>
                    <p className="text-[14px] font-medium text-zinc-300">No PRODA device registered</p>
                    <p className="mt-1 max-w-[280px] text-[12px] text-zinc-600">
                      Register a device using the form to begin authenticating with the PACE API.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Link Participant Modal */}
      <AnimatePresence>
        {linkModalOpen && (
          <LinkParticipantModal
            open={linkModalOpen}
            onClose={() => setLinkModalOpen(false)}
            orgId={orgId ?? ""}
            onCreated={loadData}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Info Field Helper ─────────────────────────────────── */

function InfoField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-600">{label}</p>
      {typeof value === "string" ? (
        <p className={`mt-1 text-[13px] text-zinc-300 ${mono ? "font-mono" : ""}`}>{value}</p>
      ) : (
        <div className="mt-1">{value}</div>
      )}
    </div>
  );
}
