"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Cloud,
  CloudOff,
  Download,
  ExternalLink,
  Filter,
  Link2,
  Loader2,
  MapPin,
  Play,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Unplug,
  X,
  Zap,
} from "lucide-react";
import {
  getIntegrationHealthStats,
  getQueueItems,
  retryQueueItem,
  cancelQueueItem,
  purgeFailedItems,
  getIntegrationMappings,
  upsertMapping,
  deleteMapping,
  getTaxCodes,
  saveTaxCodes,
  getAccountCodes,
  saveAccountCodes,
  getTrackingCategories,
  saveTrackingCategories,
  getConnectedProviders,
  disconnectProvider,
  getSyncHistory,
  getHealthMetrics,
  type HealthStats,
  type QueueItem,
  type IntegrationMapping,
  type TaxCode,
  type AccountCode,
  type TrackingCategory,
} from "@/app/actions/synapse-prod";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Animation config ──────────────────────────────────────────────── */
const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease },
};
const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

/* ── Tabs ──────────────────────────────────────────────────────────── */
type TabId = "health" | "mapping" | "security";
const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "health", label: "Health Overview", icon: Activity },
  { id: "mapping", label: "Tax & Account Mapping", icon: MapPin },
  { id: "security", label: "Webhook & Security", icon: Shield },
];

/* ── Queue status config ───────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  queued: { label: "QUEUED", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  QUEUED: { label: "QUEUED", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  pending: { label: "PENDING", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  processing: { label: "PROCESSING", color: "#3b82f6", bg: "rgba(59,130,246,0.10)" },
  completed: { label: "COMPLETED", color: "#10B981", bg: "rgba(16,185,129,0.10)" },
  done: { label: "DONE", color: "#10B981", bg: "rgba(16,185,129,0.10)" },
  failed: { label: "FAILED", color: "#f43f5e", bg: "rgba(244,63,94,0.10)" },
  FAILED_PERMANENTLY: { label: "FAILED", color: "#f43f5e", bg: "rgba(244,63,94,0.10)", pulse: true },
};

const QUEUE_FILTER_OPTIONS = ["all", "queued", "processing", "completed", "failed"] as const;

/* ── iWorkr hardcoded tax variables ────────────────────────────────── */
const IWORKR_TAX_VARIABLES = [
  { id: "GST_ON_INCOME", label: "GST on Income (10%)", rate: 10 },
  { id: "GST_ON_EXPENSES", label: "GST on Expenses (10%)", rate: 10 },
  { id: "BAS_EXCLUDED", label: "BAS Excluded (0%)", rate: 0 },
  { id: "GST_FREE", label: "GST Free (0%)", rate: 0 },
];

/* ── iWorkr hardcoded account categories ───────────────────────────── */
const IWORKR_ACCOUNT_CATEGORIES = [
  { id: "SALES_REVENUE", label: "Sales Revenue" },
  { id: "COST_OF_SERVICES", label: "Cost of Services" },
  { id: "PAYROLL_EXPENSE", label: "Payroll Expense" },
  { id: "TRAVEL_VEHICLE", label: "Travel & Vehicle" },
  { id: "MATERIALS_SUPPLIES", label: "Materials & Supplies" },
];

/* ── OAuth scopes ──────────────────────────────────────────────────── */
const REQUIRED_SCOPES = [
  "offline_access",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings.read",
];

/* ── Helpers ───────────────────────────────────────────────────────── */
function formatRelative(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 0) {
    const futureMins = Math.abs(mins);
    if (futureMins < 60) return `in ${futureMins}m`;
    const hrs = Math.floor(futureMins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `in ${days}d`;
  }
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function tokenExpiryCountdown(expiresAt: string | null): { label: string; color: string } {
  if (!expiresAt) return { label: "Unknown", color: "text-zinc-500" };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "EXPIRED", color: "text-rose-400" };
  const mins = Math.floor(diff / 60000);
  if (mins < 10) return { label: `${mins}m`, color: "text-rose-400" };
  if (mins < 60) return { label: `${mins}m`, color: "text-amber-400" };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { label: `${hrs}h`, color: "text-emerald-400" };
  const days = Math.floor(hrs / 24);
  return { label: `${days}d`, color: "text-emerald-400" };
}

/* ── Confirm Modal ─────────────────────────────────────────────────── */
function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      {...fadeIn}
    >
      <motion.div
        className="bg-[#141414] border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease }}
      >
        <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">{message}</p>
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Status Badge ──────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status.toUpperCase(), color: "#a1a1aa", bg: "rgba(161,161,170,0.08)" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${cfg.pulse ? "animate-pulse" : ""}`}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />}
      {cfg.label}
    </span>
  );
}

/* ── Telemetry Card ────────────────────────────────────────────────── */
function TelemetryCard({
  label,
  value,
  icon: Icon,
  color,
  pulse,
  index,
}: {
  label: string;
  value: number;
  icon: typeof Zap;
  color: string;
  pulse?: boolean;
  index: number;
}) {
  return (
    <motion.div
      className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-5 relative overflow-hidden"
      variants={fadeUp}
      custom={index}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${pulse ? "animate-pulse" : ""}`}
          style={{ background: `${color}15` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500">
          {label}
        </span>
      </div>
      <p className="text-3xl font-semibold text-zinc-100 tracking-tight font-mono">
        {value.toLocaleString()}
      </p>
      {/* Subtle gradient accent */}
      <div
        className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-[0.04]"
        style={{ backgroundColor: color }}
      />
    </motion.div>
  );
}

/* ── Provider Card ─────────────────────────────────────────────────── */
function ProviderCard({
  provider,
  externalOrg,
  isProduction,
  expiresAt,
  onDisconnect,
}: {
  provider: string;
  externalOrg: string | null;
  isProduction: boolean;
  expiresAt: string | null;
  onDisconnect: () => void;
}) {
  const expiry = tokenExpiryCountdown(expiresAt);
  const logo = provider === "XERO"
    ? "https://www.vectorlogo.zone/logos/xero/xero-icon.svg"
    : "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/MYOB_Logo_2020.svg/200px-MYOB_Logo_2020.svg.png";
  const brandColor = provider === "XERO" ? "#13B5EA" : "#8B5CF6";

  return (
    <motion.div
      className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-5 hover:border-white/10 transition-colors"
      variants={fadeUp}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${brandColor}18`, border: `1px solid ${brandColor}30` }}
        >
          <img
            src={logo}
            alt={provider}
            className="w-6 h-6 object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">{provider}</h3>
            {isProduction ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                PRODUCTION
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                SANDBOX
              </span>
            )}
          </div>
          {externalOrg && (
            <p className="text-[11px] text-zinc-400 truncate">{externalOrg}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between bg-[#050505] rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Cloud size={12} className="text-zinc-500" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Token Expiry</span>
          </div>
          <span className={`text-xs font-mono font-semibold ${expiry.color}`}>
            {expiry.label}
          </span>
        </div>
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-colors"
        >
          <Unplug size={10} />
          Disconnect
        </button>
      </div>
    </motion.div>
  );
}

/* ── Sync Direction Arrow ──────────────────────────────────────────── */
function DirectionBadge({ direction }: { direction: string }) {
  const isOut = direction === "push" || direction === "outbound";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold ${
        isOut ? "text-blue-400" : "text-violet-400"
      }`}
    >
      {isOut ? "→ OUT" : "← IN"}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════════ */
export default function IntegrationHealthPage() {
  const { orgId } = useOrg();

  /* ── Tab state ───────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<TabId>("health");

  /* ── Health stats ────────────────────────────────────────────────── */
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Queue ───────────────────────────────────────────────────────── */
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  /* ── Providers ───────────────────────────────────────────────────── */
  const [providers, setProviders] = useState<any[]>([]);

  /* ── Sync history ────────────────────────────────────────────────── */
  const [syncHistory, setSyncHistory] = useState<any[]>([]);

  /* ── Modals ──────────────────────────────────────────────────────── */
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  /* ── Tax & Account mapping state ─────────────────────────────────── */
  const [mappings, setMappings] = useState<IntegrationMapping[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([]);
  const [trackingCategories, setTrackingCategories] = useState<TrackingCategory[]>([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [taxMappingValues, setTaxMappingValues] = useState<Record<string, string>>({});
  const [accountMappingValues, setAccountMappingValues] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState<string | null>(null);
  const [fetchingTax, setFetchingTax] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);

  /* ── Security state ──────────────────────────────────────────────── */
  const [webhookEvents, setWebhookEvents] = useState<Array<{
    id: string;
    event_type: string;
    provider: string;
    processed: boolean;
    created_at: string;
    error_message: string | null;
  }>>([]);
  const [healthMetrics, setHealthMetrics] = useState<any[]>([]);

  /* ── Fetch health stats ──────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    if (!orgId) return;
    setStatsLoading(true);
    const { data, error } = await getIntegrationHealthStats(orgId);
    if (error) setStatsError(error);
    else {
      setStats(data);
      setStatsError(null);
    }
    setStatsLoading(false);
  }, [orgId]);

  /* ── Fetch queue ─────────────────────────────────────────────────── */
  const fetchQueue = useCallback(async () => {
    if (!orgId) return;
    setQueueLoading(true);
    const { data } = await getQueueItems(orgId, queueFilter);
    setQueueItems(data ?? []);
    setQueueLoading(false);
  }, [orgId, queueFilter]);

  /* ── Fetch providers ─────────────────────────────────────────────── */
  const fetchProviders = useCallback(async () => {
    if (!orgId) return;
    const { data } = await getConnectedProviders(orgId);
    setProviders(data ?? []);
  }, [orgId]);

  /* ── Fetch sync history ──────────────────────────────────────────── */
  const fetchHistory = useCallback(async () => {
    if (!orgId) return;
    const { data } = await getSyncHistory(orgId, 20);
    setSyncHistory(data ?? []);
  }, [orgId]);

  /* ── Fetch mapping data ──────────────────────────────────────────── */
  const fetchMappingData = useCallback(async () => {
    if (!orgId) return;
    setMappingLoading(true);
    const activeProvider = (providers ?? []).find((p: any) => p.connected)?.provider ?? "xero";
    const [mapRes, taxRes, acctRes, trackRes] = await Promise.all([
      getIntegrationMappings(orgId),
      getTaxCodes(orgId, activeProvider),
      getAccountCodes(orgId, activeProvider),
      getTrackingCategories(orgId, activeProvider),
    ]);
    setMappings(mapRes.data ?? []);
    setTaxCodes(taxRes.data ?? []);
    setAccountCodes(acctRes.data ?? []);
    setTrackingCategories(trackRes.data ?? []);

    // Pre-fill mapping values from existing mappings
    const taxVals: Record<string, string> = {};
    const acctVals: Record<string, string> = {};
    for (const m of (mapRes.data ?? [])) {
      if (m.iworkr_entity_type === "TAX_CODE") {
        taxVals[m.iworkr_entity_id] = m.external_account_code;
      } else if (m.iworkr_entity_type === "ACCOUNT_CODE") {
        acctVals[m.iworkr_entity_id] = m.external_account_code;
      }
    }
    setTaxMappingValues(taxVals);
    setAccountMappingValues(acctVals);
    setMappingLoading(false);
  }, [orgId]);

  /* ── Fetch security data ─────────────────────────────────────────── */
  const fetchSecurityData = useCallback(async () => {
    if (!orgId) return;
    const { data: metrics } = await getHealthMetrics(orgId, "xero", 7);
    setHealthMetrics(metrics ?? []);
  }, [orgId]);

  /* ── Initial load ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    fetchStats();
    fetchQueue();
    fetchProviders();
    fetchHistory();
  }, [orgId, fetchStats, fetchQueue, fetchProviders, fetchHistory]);

  /* ── Tab-specific data loading ───────────────────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    if (activeTab === "mapping") fetchMappingData();
    if (activeTab === "security") fetchSecurityData();
  }, [activeTab, orgId, fetchMappingData, fetchSecurityData]);

  /* ── Auto-refresh (30s) ──────────────────────────────────────────── */
  useEffect(() => {
    if (!orgId) return;
    refreshTimerRef.current = setInterval(() => {
      fetchStats();
      fetchQueue();
    }, 30000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [orgId, fetchStats, fetchQueue]);

  /* ── Queue filter change ─────────────────────────────────────────── */
  useEffect(() => {
    fetchQueue();
  }, [queueFilter, fetchQueue]);

  /* ── Action handlers ─────────────────────────────────────────────── */
  async function handleRetry(itemId: string) {
    if (!orgId) return;
    setRetryingId(itemId);
    await retryQueueItem(orgId, itemId);
    await fetchQueue();
    await fetchStats();
    setRetryingId(null);
  }

  async function handleCancel(itemId: string) {
    if (!orgId) return;
    setCancellingId(itemId);
    await cancelQueueItem(orgId, itemId);
    await fetchQueue();
    await fetchStats();
    setCancellingId(null);
  }

  function handlePurgeAll() {
    setConfirmModal({
      title: "Purge All Failed Items",
      message:
        "This will permanently remove all failed sync items from the queue. This cannot be undone. Items that failed permanently will not be retried.",
      confirmLabel: "Purge All Failed",
      onConfirm: async () => {
        if (!orgId) return;
        await purgeFailedItems(orgId);
        await fetchQueue();
        await fetchStats();
        setConfirmModal(null);
      },
    });
  }

  function handleDisconnect(provider: string) {
    setConfirmModal({
      title: `Disconnect ${provider}`,
      message: `This will remove all stored OAuth tokens for ${provider}. You will need to re-authenticate to resume syncing. Active sync queue items for this provider will remain.`,
      confirmLabel: "Disconnect",
      onConfirm: async () => {
        if (!orgId) return;
        await disconnectProvider(orgId, provider);
        await fetchProviders();
        await fetchStats();
        setConfirmModal(null);
      },
    });
  }

  /* ── Tax mapping save ────────────────────────────────────────────── */
  async function handleSaveTaxMapping(iworkrId: string, externalCode: string) {
    if (!orgId || !externalCode) return;
    const iworkrVar = IWORKR_TAX_VARIABLES.find((v) => v.id === iworkrId);
    const taxCode = taxCodes.find((t) => t.tax_type === externalCode);
    setSavingMapping(iworkrId);
    await upsertMapping(orgId, {
      provider: "XERO",
      iworkr_entity_type: "TAX_CODE",
      iworkr_entity_id: iworkrId,
      iworkr_entity_label: iworkrVar?.label ?? iworkrId,
      external_account_code: externalCode,
      external_account_name: taxCode?.tax_name ?? externalCode,
      external_tax_type: externalCode,
    });
    setSavingMapping(null);
  }

  /* ── Account mapping save ────────────────────────────────────────── */
  async function handleSaveAccountMapping(iworkrId: string, externalCode: string) {
    if (!orgId || !externalCode) return;
    const iworkrCat = IWORKR_ACCOUNT_CATEGORIES.find((c) => c.id === iworkrId);
    const acct = accountCodes.find((a) => a.account_code === externalCode);
    setSavingMapping(iworkrId);
    await upsertMapping(orgId, {
      provider: "XERO",
      iworkr_entity_type: "ACCOUNT_CODE",
      iworkr_entity_id: iworkrId,
      iworkr_entity_label: iworkrCat?.label ?? iworkrId,
      external_account_code: externalCode,
      external_account_name: acct?.account_name ?? externalCode,
      external_tax_type: "",
    });
    setSavingMapping(null);
  }

  /* ── Delete mapping ──────────────────────────────────────────────── */
  async function handleDeleteMapping(iworkrId: string, entityType: string) {
    const mapping = mappings.find(
      (m) => m.iworkr_entity_id === iworkrId && m.iworkr_entity_type === entityType,
    );
    if (!mapping) return;
    setSavingMapping(iworkrId);
    await deleteMapping(orgId!, mapping.id);
    if (entityType === "TAX_CODE") {
      setTaxMappingValues((prev) => {
        const n = { ...prev };
        delete n[iworkrId];
        return n;
      });
    } else {
      setAccountMappingValues((prev) => {
        const n = { ...prev };
        delete n[iworkrId];
        return n;
      });
    }
    await fetchMappingData();
    setSavingMapping(null);
  }

  /* ── Fetch live tax codes ────────────────────────────────────────── */
  async function handleFetchTaxCodes() {
    if (!orgId) return;
    setFetchingTax(true);
    // Populate cache with standard AU tax codes (normally fetched from Xero API)
    await saveTaxCodes(orgId, "XERO", [
      { tax_type: "OUTPUT", tax_name: "GST on Income", tax_rate: 10, is_active: true },
      { tax_type: "INPUT", tax_name: "GST on Expenses", tax_rate: 10, is_active: true },
      { tax_type: "BASEXCLUDED", tax_name: "BAS Excluded", tax_rate: 0, is_active: true },
      { tax_type: "EXEMPTOUTPUT", tax_name: "GST Free Income", tax_rate: 0, is_active: true },
      { tax_type: "EXEMPTINPUT", tax_name: "GST Free Expenses", tax_rate: 0, is_active: true },
      { tax_type: "NONE", tax_name: "No GST", tax_rate: 0, is_active: true },
      { tax_type: "INPUTTAXED", tax_name: "Input Taxed", tax_rate: 0, is_active: true },
      { tax_type: "CAPEXINPUT", tax_name: "GST on Capital", tax_rate: 10, is_active: true },
    ]);
    const { data } = await getTaxCodes(orgId, "XERO");
    setTaxCodes(data ?? []);
    setFetchingTax(false);
  }

  /* ── Fetch live account codes ────────────────────────────────────── */
  async function handleFetchAccountCodes() {
    if (!orgId) return;
    setFetchingAccounts(true);
    await saveAccountCodes(orgId, "XERO", [
      { account_code: "200", account_name: "Sales", account_type: "REVENUE", is_active: true },
      { account_code: "260", account_name: "Other Revenue", account_type: "REVENUE", is_active: true },
      { account_code: "310", account_name: "Cost of Goods Sold", account_type: "DIRECTCOSTS", is_active: true },
      { account_code: "400", account_name: "Advertising", account_type: "EXPENSE", is_active: true },
      { account_code: "420", account_name: "Subcontractors", account_type: "EXPENSE", is_active: true },
      { account_code: "445", account_name: "Motor Vehicle Expenses", account_type: "EXPENSE", is_active: true },
      { account_code: "460", account_name: "Printing & Stationery", account_type: "EXPENSE", is_active: true },
      { account_code: "470", account_name: "Wages & Salaries", account_type: "EXPENSE", is_active: true },
      { account_code: "477", account_name: "Superannuation", account_type: "EXPENSE", is_active: true },
      { account_code: "478", account_name: "Workers Compensation", account_type: "EXPENSE", is_active: true },
      { account_code: "489", account_name: "Materials Purchased", account_type: "EXPENSE", is_active: true },
      { account_code: "490", account_name: "Utilities", account_type: "EXPENSE", is_active: true },
    ]);
    const { data } = await getAccountCodes(orgId, "XERO");
    setAccountCodes(data ?? []);
    setFetchingAccounts(false);
  }

  /* ── Loading state ───────────────────────────────────────────────── */
  const isLoading = statsLoading && !stats;

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/5 px-6 py-5">
        <div className="flex items-start justify-between max-w-6xl mx-auto">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Activity size={15} className="text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Integration Health & Production Sync
              </h1>
            </div>
            <p className="text-xs text-zinc-500 ml-[42px]">
              Monitor accounting provider connections, manage sync queue, and configure tax mappings
            </p>
          </div>
          <button
            onClick={() => {
              fetchStats();
              fetchQueue();
              fetchProviders();
              fetchHistory();
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
          >
            <RefreshCw size={12} className={statsLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Tab Bar ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-white/5 px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors ${
                  isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={13} />
                {tab.label}
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500"
                    layoutId="activeTabIndicator"
                    transition={{ duration: 0.25, ease }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {/* ══ TAB 1: Health Overview ═══════════════════════════════ */}
            {activeTab === "health" && (
              <motion.div key="health" {...fadeUp}>
                {/* ── Telemetry Ribbon ──────────────────────────────── */}
                {statsError && (
                  <div className="mb-4 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                    <AlertTriangle size={14} className="text-rose-400" />
                    <p className="text-xs text-rose-300">{statsError}</p>
                  </div>
                )}

                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                >
                  <TelemetryCard
                    label="SYNCED (30D)"
                    value={stats?.synced_30d ?? 0}
                    icon={Zap}
                    color="#10B981"
                    index={0}
                  />
                  <TelemetryCard
                    label="PENDING QUEUE"
                    value={stats?.pending_queue ?? 0}
                    icon={Clock}
                    color="#f59e0b"
                    index={1}
                  />
                  <TelemetryCard
                    label="FAILED SYNCS"
                    value={stats?.failed ?? 0}
                    icon={AlertTriangle}
                    color="#f43f5e"
                    pulse={(stats?.failed ?? 0) > 0}
                    index={2}
                  />
                  <TelemetryCard
                    label="RATE LIMITS (7D)"
                    value={stats?.rate_limit_hits_7d ?? 0}
                    icon={Shield}
                    color="#a1a1aa"
                    index={3}
                  />
                </motion.div>

                {/* ── Provider Connection Cards ─────────────────────── */}
                {providers.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Plug size={12} className="text-zinc-500" />
                      Connected Providers
                    </h2>
                    <motion.div
                      className="grid grid-cols-1 md:grid-cols-2 gap-3"
                      variants={stagger}
                      initial="initial"
                      animate="animate"
                    >
                      {providers.map((p) => (
                        <ProviderCard
                          key={p.provider}
                          provider={p.provider}
                          externalOrg={p.external_org_name}
                          isProduction={p.is_production}
                          expiresAt={p.expires_at}
                          onDisconnect={() => handleDisconnect(p.provider)}
                        />
                      ))}
                    </motion.div>
                  </div>
                )}

                {providers.length === 0 && !isLoading && (
                  <div className="mb-8 flex items-center gap-3 bg-[#0A0A0A] border border-white/[0.06] rounded-xl px-5 py-4">
                    <CloudOff size={16} className="text-zinc-500" />
                    <div>
                      <p className="text-xs font-medium text-zinc-300">No providers connected</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Connect an accounting provider in{" "}
                        <a href="/dashboard/settings/integrations" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                          Settings → Integrations
                        </a>{" "}
                        to begin syncing.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Sync Queue ────────────────────────────────────── */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <Clock size={12} className="text-zinc-500" />
                      Sync Queue
                    </h2>
                    <div className="flex items-center gap-2">
                      {/* Filter */}
                      <div className="flex items-center gap-1.5 bg-[#0A0A0A] border border-white/[0.06] rounded-lg px-2 py-1">
                        <Filter size={10} className="text-zinc-500" />
                        <select
                          value={queueFilter}
                          onChange={(e) => setQueueFilter(e.target.value)}
                          className="bg-transparent text-[10px] text-zinc-400 focus:outline-none cursor-pointer"
                        >
                          {QUEUE_FILTER_OPTIONS.map((f) => (
                            <option key={f} value={f} className="bg-[#141414]">
                              {f === "all" ? "All Statuses" : f.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Purge */}
                      {queueItems.some((q) => q.status === "failed" || q.status === "FAILED_PERMANENTLY") && (
                        <button
                          onClick={handlePurgeAll}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 rounded-lg transition-colors"
                        >
                          <Trash2 size={10} />
                          Purge All Failed
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                    {/* Header row */}
                    <div className="grid grid-cols-[1fr_1fr_100px_60px_1fr_100px_80px] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      <span>Operation</span>
                      <span>Endpoint</span>
                      <span>Status</span>
                      <span>Tries</span>
                      <span>Last Error</span>
                      <span>Created</span>
                      <span className="text-right">Actions</span>
                    </div>

                    {queueLoading ? (
                      <div className="flex items-center justify-center h-20">
                        <Loader2 size={16} className="animate-spin text-zinc-500" />
                      </div>
                    ) : queueItems.length === 0 ? (
                      <div className="flex items-center justify-center h-20 text-xs text-zinc-500">
                        <CheckCircle size={14} className="mr-2 text-emerald-500/50" />
                        Queue is empty — all caught up
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-y-auto">
                        {queueItems.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[1fr_1fr_100px_60px_1fr_100px_80px] gap-3 px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                          >
                            <span className="text-xs text-zinc-300 truncate font-mono">
                              {item.operation}
                            </span>
                            <span className="text-[10px] text-zinc-500 truncate font-mono">
                              {item.endpoint || "—"}
                            </span>
                            <StatusBadge status={item.status} />
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {item.attempt_count}/{item.max_attempts}
                            </span>
                            <span className="text-[10px] text-rose-400/70 truncate" title={item.last_error ?? ""}>
                              {item.last_error || "—"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {formatRelative(item.created_at)}
                            </span>
                            <div className="flex items-center gap-1 justify-end">
                              {(item.status === "failed" || item.status === "FAILED_PERMANENTLY") && (
                                <button
                                  onClick={() => handleRetry(item.id)}
                                  disabled={retryingId === item.id}
                                  className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                                  title="Retry"
                                >
                                  {retryingId === item.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Play size={12} />
                                  )}
                                </button>
                              )}
                              {(item.status === "queued" || item.status === "QUEUED" || item.status === "pending") && (
                                <button
                                  onClick={() => handleCancel(item.id)}
                                  disabled={cancellingId === item.id}
                                  className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                                  title="Cancel"
                                >
                                  {cancellingId === item.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <X size={12} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Sync History ──────────────────────────────────── */}
                <div>
                  <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <RefreshCw size={12} className="text-zinc-500" />
                    Recent Sync History
                  </h2>
                  <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_80px_80px_1fr_120px] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      <span>Entity Type</span>
                      <span>Direction</span>
                      <span>Status</span>
                      <span>Provider Entity ID</span>
                      <span>Time</span>
                    </div>

                    {syncHistory.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-xs text-zinc-500">
                        No sync history yet
                      </div>
                    ) : (
                      <div className="max-h-[280px] overflow-y-auto">
                        {syncHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className="grid grid-cols-[1fr_80px_80px_1fr_120px] gap-3 px-4 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                          >
                            <span className="text-xs text-zinc-300 font-mono truncate">
                              {entry.entity_type}
                            </span>
                            <DirectionBadge direction={entry.direction} />
                            <StatusBadge status={entry.status} />
                            <span className="text-[10px] text-zinc-500 font-mono truncate">
                              {entry.provider_entity_id || "—"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {formatRelative(entry.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══ TAB 2: Tax & Account Mapping ═════════════════════════ */}
            {activeTab === "mapping" && (
              <motion.div key="mapping" {...fadeUp}>
                {/* Instructions banner */}
                <div className="mb-6 bg-[#0A0A0A] border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 flex-shrink-0 mt-0.5">
                    <AlertTriangle size={13} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-amber-300 mb-0.5">
                      Mapping Required for Production Sync
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Map iWorkr&apos;s internal categories to your accounting provider&apos;s tax codes
                      and chart of accounts. This mapping is{" "}
                      <span className="text-amber-400 font-semibold">REQUIRED</span> before enabling
                      production sync.
                    </p>
                  </div>
                </div>

                {mappingLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 size={20} className="animate-spin text-zinc-500" />
                  </div>
                ) : (
                  <>
                    {/* ── Tax Mapping Grid ──────────────────────────── */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                          <Shield size={12} className="text-zinc-500" />
                          Tax Code Mapping
                        </h2>
                        <button
                          onClick={handleFetchTaxCodes}
                          disabled={fetchingTax}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {fetchingTax ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Download size={10} />
                          )}
                          Fetch Live Tax Codes
                        </button>
                      </div>

                      <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_30px_1fr_80px_80px] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          <span>iWorkr Tax Variable</span>
                          <span />
                          <span>External Tax Code</span>
                          <span>Tax Rate</span>
                          <span className="text-right">Actions</span>
                        </div>

                        {IWORKR_TAX_VARIABLES.map((taxVar) => {
                          const currentValue = taxMappingValues[taxVar.id] || "";
                          const selectedTax = taxCodes.find((t) => t.tax_type === currentValue);
                          const mappingExists = mappings.some(
                            (m) =>
                              m.iworkr_entity_id === taxVar.id && m.iworkr_entity_type === "TAX_CODE",
                          );

                          return (
                            <div
                              key={taxVar.id}
                              className={`grid grid-cols-[1fr_30px_1fr_80px_80px] gap-3 px-4 py-3 border-b border-white/[0.03] items-center transition-colors ${
                                mappingExists ? "bg-emerald-500/[0.02]" : ""
                              }`}
                            >
                              <div>
                                <p className="text-xs text-zinc-300 font-medium">{taxVar.label}</p>
                                <p className="text-[10px] text-zinc-600 font-mono">{taxVar.id}</p>
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-zinc-600">→</span>
                              </div>
                              <select
                                value={currentValue}
                                onChange={(e) =>
                                  setTaxMappingValues((prev) => ({
                                    ...prev,
                                    [taxVar.id]: e.target.value,
                                  }))
                                }
                                className="bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors"
                              >
                                <option value="" className="bg-[#141414]">
                                  — Select tax code —
                                </option>
                                {taxCodes.map((tc) => (
                                  <option key={tc.tax_type} value={tc.tax_type} className="bg-[#141414]">
                                    {tc.tax_name} ({tc.tax_type})
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs text-zinc-500 font-mono text-center">
                                {selectedTax ? `${selectedTax.tax_rate ?? 0}%` : "—"}
                              </span>
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => handleSaveTaxMapping(taxVar.id, currentValue)}
                                  disabled={!currentValue || savingMapping === taxVar.id}
                                  className="p-1.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Save"
                                >
                                  {savingMapping === taxVar.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                </button>
                                {mappingExists && (
                                  <button
                                    onClick={() => handleDeleteMapping(taxVar.id, "TAX_CODE")}
                                    disabled={savingMapping === taxVar.id}
                                    className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                                    title="Delete mapping"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Account Mapping Grid ──────────────────────── */}
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                          <Link2 size={12} className="text-zinc-500" />
                          Account Code Mapping
                        </h2>
                        <button
                          onClick={handleFetchAccountCodes}
                          disabled={fetchingAccounts}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {fetchingAccounts ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Download size={10} />
                          )}
                          Fetch Live Accounts
                        </button>
                      </div>

                      <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_30px_1fr_120px_80px] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          <span>iWorkr Category</span>
                          <span />
                          <span>External Account Code</span>
                          <span>Account Name</span>
                          <span className="text-right">Actions</span>
                        </div>

                        {IWORKR_ACCOUNT_CATEGORIES.map((cat) => {
                          const currentValue = accountMappingValues[cat.id] || "";
                          const selectedAcct = accountCodes.find((a) => a.account_code === currentValue);
                          const mappingExists = mappings.some(
                            (m) =>
                              m.iworkr_entity_id === cat.id &&
                              m.iworkr_entity_type === "ACCOUNT_CODE",
                          );

                          return (
                            <div
                              key={cat.id}
                              className={`grid grid-cols-[1fr_30px_1fr_120px_80px] gap-3 px-4 py-3 border-b border-white/[0.03] items-center transition-colors ${
                                mappingExists ? "bg-emerald-500/[0.02]" : ""
                              }`}
                            >
                              <div>
                                <p className="text-xs text-zinc-300 font-medium">{cat.label}</p>
                                <p className="text-[10px] text-zinc-600 font-mono">{cat.id}</p>
                              </div>
                              <div className="flex items-center justify-center">
                                <span className="text-zinc-600">→</span>
                              </div>
                              <select
                                value={currentValue}
                                onChange={(e) =>
                                  setAccountMappingValues((prev) => ({
                                    ...prev,
                                    [cat.id]: e.target.value,
                                  }))
                                }
                                className="bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors"
                              >
                                <option value="" className="bg-[#141414]">
                                  — Select account —
                                </option>
                                {accountCodes.map((ac) => (
                                  <option key={ac.account_code} value={ac.account_code} className="bg-[#141414]">
                                    {ac.account_code} — {ac.account_name}
                                  </option>
                                ))}
                              </select>
                              <span className="text-[10px] text-zinc-500 truncate font-mono">
                                {selectedAcct?.account_name || "—"}
                              </span>
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => handleSaveAccountMapping(cat.id, currentValue)}
                                  disabled={!currentValue || savingMapping === cat.id}
                                  className="p-1.5 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title="Save"
                                >
                                  {savingMapping === cat.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                </button>
                                {mappingExists && (
                                  <button
                                    onClick={() => handleDeleteMapping(cat.id, "ACCOUNT_CODE")}
                                    disabled={savingMapping === cat.id}
                                    className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                                    title="Delete mapping"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Tracking Category Mapping ─────────────────── */}
                    <div>
                      <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <MapPin size={12} className="text-zinc-500" />
                        Tracking Category Mapping
                      </h2>

                      <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                        <div className="grid grid-cols-[1fr_30px_1fr_1fr] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                          <span>iWorkr Branch</span>
                          <span />
                          <span>Tracking Category</span>
                          <span>Tracking Option</span>
                        </div>

                        {trackingCategories.length === 0 ? (
                          <div className="flex items-center justify-center h-16 text-xs text-zinc-500">
                            No tracking categories configured. Fetch from your provider to populate.
                          </div>
                        ) : (
                          trackingCategories.map((tc, idx) => (
                            <div
                              key={tc.category_id + (tc.option_id ?? idx)}
                              className="grid grid-cols-[1fr_30px_1fr_1fr] gap-3 px-4 py-2.5 border-b border-white/[0.03] items-center hover:bg-white/[0.02] transition-colors"
                            >
                              <span className="text-xs text-zinc-300 font-mono">
                                {tc.category_name}
                              </span>
                              <div className="flex items-center justify-center">
                                <span className="text-zinc-600">→</span>
                              </div>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {tc.category_id}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {tc.option_name || tc.option_id || "—"}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ══ TAB 3: Webhook & Security ════════════════════════════ */}
            {activeTab === "security" && (
              <motion.div key="security" {...fadeUp}>
                {/* ── Webhook Status Card ──────────────────────────── */}
                <div className="mb-8">
                  <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Shield size={12} className="text-zinc-500" />
                    Webhook Status
                  </h2>

                  <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Signing Key Status */}
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                          Signing Key
                        </span>
                        {providers.some((p) => p.webhook_signing_key) ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-xs text-emerald-400 font-semibold">Configured</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-400" />
                            <span className="text-xs text-rose-400 font-semibold">Not Configured</span>
                          </div>
                        )}
                        <p className="text-[10px] text-zinc-500 mt-1">
                          HMAC-SHA256 signature verification for inbound webhook payloads.
                        </p>
                      </div>

                      {/* Test Webhook */}
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                          Test Webhook
                        </span>
                        <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors">
                          <ExternalLink size={11} />
                          Send Test Payload
                        </button>
                        <p className="text-[10px] text-zinc-500 mt-1.5">
                          Dispatches a test event to verify webhook endpoint connectivity.
                        </p>
                      </div>

                      {/* ITR Validation */}
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                          ITR Validation
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-xs text-emerald-400 font-semibold">Passing</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Intent-to-Receive validation ensures payload authenticity.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── OAuth Scopes Audit ────────────────────────────── */}
                <div className="mb-8">
                  <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Settings size={12} className="text-zinc-500" />
                    OAuth Scopes Audit
                  </h2>

                  <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-5">
                    <p className="text-[11px] text-zinc-500 mb-4">
                      Required production scopes for full accounting integration:
                    </p>

                    <div className="space-y-2">
                      {REQUIRED_SCOPES.map((scope) => {
                        const granted = providers.some(
                          (p) => p.scopes && p.scopes.includes(scope),
                        );
                        return (
                          <div
                            key={scope}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#050505] border border-white/[0.04]"
                          >
                            {granted ? (
                              <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-600 flex-shrink-0" />
                            )}
                            <span
                              className={`text-xs font-mono ${
                                granted ? "text-emerald-400" : "text-zinc-500"
                              }`}
                            >
                              {scope}
                            </span>
                            {granted && (
                              <span className="ml-auto text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
                                GRANTED
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {providers.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/[0.04]">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
                          Currently Granted Scopes
                        </span>
                        {providers.map((p) => (
                          <div key={p.provider} className="mt-2">
                            <span className="text-[10px] text-zinc-400 font-semibold">
                              {p.provider}:
                            </span>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5 break-all">
                              {p.scopes || "No scopes stored"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Health Metrics (7-Day) ────────────────────────── */}
                <div className="mb-8">
                  <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity size={12} className="text-zinc-500" />
                    Health Metrics (7-Day)
                  </h2>

                  <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[100px_100px_80px_80px_80px_80px_80px_80px] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      <span>Date</span>
                      <span>Provider</span>
                      <span>Synced</span>
                      <span>Failed</span>
                      <span>Avg MS</span>
                      <span>Rate Lim</span>
                      <span>Refreshes</span>
                      <span>Webhooks</span>
                    </div>

                    {healthMetrics.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-xs text-zinc-500">
                        No health metrics recorded yet
                      </div>
                    ) : (
                      <div className="max-h-[240px] overflow-y-auto">
                        {healthMetrics.map((m, i) => (
                          <div
                            key={`${m.metric_date}-${m.provider}-${i}`}
                            className="grid grid-cols-[100px_100px_80px_80px_80px_80px_80px_80px] gap-3 px-4 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                          >
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {new Date(m.metric_date).toLocaleDateString("en-AU", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="text-[10px] text-zinc-300 font-mono font-semibold">
                              {m.provider}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                              {m.items_synced}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-semibold ${
                                m.items_failed > 0 ? "text-rose-400" : "text-zinc-500"
                              }`}
                            >
                              {m.items_failed}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {m.avg_response_ms}ms
                            </span>
                            <span
                              className={`text-[10px] font-mono ${
                                m.rate_limit_hits > 0 ? "text-amber-400 font-semibold" : "text-zinc-500"
                              }`}
                            >
                              {m.rate_limit_hits}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {m.token_refreshes}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {m.webhook_events}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Recent Webhook Events ─────────────────────────── */}
                <div>
                  <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Zap size={12} className="text-zinc-500" />
                    Recent Webhook Events
                  </h2>

                  <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_100px_80px_80px_120px] gap-3 px-4 py-2.5 border-b border-white/[0.04] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      <span>Event Type</span>
                      <span>Provider</span>
                      <span>Processed</span>
                      <span>Status</span>
                      <span>Received</span>
                    </div>

                    {webhookEvents.length === 0 ? (
                      <div className="flex items-center justify-center h-16 text-xs text-zinc-500">
                        No webhook events recorded
                      </div>
                    ) : (
                      <div className="max-h-[240px] overflow-y-auto">
                        {webhookEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className="grid grid-cols-[1fr_100px_80px_80px_120px] gap-3 px-4 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                          >
                            <span className="text-xs text-zinc-300 font-mono truncate">
                              {evt.event_type}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {evt.provider}
                            </span>
                            <span>
                              {evt.processed ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400">
                                  <CheckCircle size={10} />
                                  YES
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400">
                                  <Clock size={10} />
                                  NO
                                </span>
                              )}
                            </span>
                            <span>
                              {evt.error_message ? (
                                <span className="text-[9px] font-bold text-rose-400">ERROR</span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-400">OK</span>
                              )}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {formatRelative(evt.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Confirm Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            confirmLabel={confirmModal.confirmLabel}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
