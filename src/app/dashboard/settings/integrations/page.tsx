/**
 * @page /dashboard/settings/integrations
 * @status COMPLETE
 * @description Project Ledger-Bridge — Full integration settings with OAuth connect/disconnect,
 *   GL code mapping, payroll earnings rate mapping, sync queue monitor, entity map viewer,
 *   and connection health dashboard.
 * @dataSource server-action
 * @lastAudit 2026-03-24
 */
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  X,
  Zap,
} from "lucide-react";
import {
  getIntegrationStatuses,
  getIntegrationMappings,
  saveIntegrationMappings,
  disconnectIntegration,
  fetchXeroAccounts,
  getXeroConnectUrl,
  type IntegrationStatus,
  type IntegrationMapping,
  type AccountingProvider,
  type IntegrationEntityType,
} from "@/app/actions/ledger-sync";
import {
  getAccountCodes,
  saveAccountCodes,
  fetchXeroEarningsRates,
  getQueueDashboard,
  getEntityMappings,
  getConnectionHealth,
  retryQueueItem,
  triggerSyncEngine,
  type AccountCode,
  type XeroEarningsRate,
  type QueueDashboard,
  type QueueItem,
  type EntityMapping,
  type ConnectionHealth,
} from "@/app/actions/ledger-bridge";
import { useOrg } from "@/lib/hooks/use-org";
import { useSectorFeatures } from "@/lib/hooks/use-sector-features";
import { useToastStore } from "@/components/app/action-toast";

const NDIS_CATEGORIES = [
  { id: "01_DAILY_ACTIVITIES", label: "01 – Daily Activities (Core)" },
  { id: "04_ASSISTANCE_WITH_SOCIAL", label: "04 – Assistance w/ Social & Civic" },
  { id: "07_SUPPORT_COORDINATION", label: "07 – Support Coordination" },
  { id: "09_IMPROVED_LIVING", label: "09 – Improved Living Arrangements" },
  { id: "11_IMPROVED_HEALTH", label: "11 – Improved Health & Wellbeing" },
  { id: "15_IMPROVED_LEARNING", label: "15 – Improved Learning" },
  { id: "16_EMPLOYMENT", label: "16 – Improved Daily Living Skills" },
];

const PAY_CATEGORIES = [
  { id: "ORDINARY_HOURS", label: "Ordinary Hours (SCHADS)" },
  { id: "EVENING_SHIFT", label: "Evening Shift Penalty" },
  { id: "NIGHT_SHIFT", label: "Night Shift Penalty" },
  { id: "SATURDAY", label: "Saturday Penalty" },
  { id: "SUNDAY", label: "Sunday Penalty" },
  { id: "PUBLIC_HOLIDAY", label: "Public Holiday" },
  { id: "OVERTIME_1_5X", label: "Overtime 150%" },
  { id: "OVERTIME_2_0X", label: "Overtime 200%" },
  { id: "MINIMUM_ENGAGEMENT_PADDING", label: "Min. Engagement Padding" },
  { id: "SLEEPOVER", label: "Sleepover Allowance" },
];

const REVENUE_CODES = [
  { id: "TRADES_LABOUR", label: "Trades — Labour Revenue" },
  { id: "TRADES_MATERIALS", label: "Trades — Materials Revenue" },
  { id: "NDIS_SERVICES", label: "NDIS Services Revenue (GST-Free)" },
  { id: "SUBSCRIPTION_REVENUE", label: "Subscription / Recurring Revenue" },
];

function formatRelative(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-amber-400",
    pending: "bg-amber-400",
    processing: "bg-blue-400 animate-pulse",
    completed: "bg-emerald-400",
    done: "bg-emerald-400",
    failed: "bg-rose-400",
    FAILED_PERMANENTLY: "bg-rose-600",
  };
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full inline-block ${colors[status] || "bg-zinc-500"}`}
    />
  );
}

// ── Payroll Earnings Rate Mapper ──────────────────────────
function PayrollMappingPanel({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const [earningsRates, setEarningsRates] = useState<XeroEarningsRate[]>([]);
  const [existingCodes, setExistingCodes] = useState<AccountCode[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [ratesRes, codesRes] = await Promise.all([
        fetchXeroEarningsRates(orgId),
        getAccountCodes(orgId, "EARNINGS_RATE"),
      ]);

      if (ratesRes.error) setError(ratesRes.error);
      else setEarningsRates(ratesRes.data ?? []);

      const initMappings: Record<string, string> = {};
      for (const code of codesRes.data ?? []) {
        initMappings[code.iworkr_code_key] = code.external_code;
      }
      setMappings(initMappings);
      setExistingCodes(codesRes.data ?? []);
      setLoading(false);
    })();
  }, [orgId]);

  async function handleSave() {
    setSaving(true);
    const codes = PAY_CATEGORIES
      .filter((c) => mappings[c.id])
      .map((c) => {
        const rate = earningsRates.find((r) => r.earningsRateId === mappings[c.id]);
        return {
          iworkr_code_type: "EARNINGS_RATE",
          iworkr_code_key: c.id,
          iworkr_code_label: c.label,
          external_code: mappings[c.id],
          external_name: rate?.name ?? undefined,
          external_category: "PAYROLL",
        };
      });

    const { error: err } = await saveAccountCodes(orgId, codes);
    if (err) setError(err);
    else onClose();
    setSaving(false);
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 w-[640px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
    >
      <div className="h-14 flex items-center px-5 border-b border-white/5 gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Payroll Earnings Rate Mapping</h2>
          <p className="text-[10px] text-zinc-500">
            Map SCHADS pay categories → Xero EarningsRateIDs for STP compliance
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={18} className="animate-spin text-zinc-500" />
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-4">
            <p className="text-xs text-rose-400">{error}</p>
            <p className="text-[10px] text-zinc-500 mt-1">
              Ensure Xero is connected with payroll.employees scope.
            </p>
          </div>
        ) : null}

        {earningsRates.length === 0 && !loading && !error && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
            <p className="text-xs text-amber-400">
              No Xero Earnings Rates found. These are configured in Xero under
              Payroll → Pay Items → Earnings.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {PAY_CATEGORIES.map((cat) => {
            const selectedId = mappings[cat.id] ?? "";
            const selectedRate = earningsRates.find(
              (r) => r.earningsRateId === selectedId
            );

            return (
              <div
                key={cat.id}
                className={`p-3 rounded-xl border transition-colors ${
                  selectedId
                    ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                    : "border-white/5 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {cat.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">{cat.id}</p>
                  </div>
                  <ArrowRight size={12} className="text-zinc-600 flex-shrink-0" />
                  <select
                    value={selectedId}
                    onChange={(e) =>
                      setMappings((p) => ({ ...p, [cat.id]: e.target.value }))
                    }
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 min-w-[200px]"
                  >
                    <option value="">— Select Earnings Rate —</option>
                    {earningsRates.map((r) => (
                      <option key={r.earningsRateId} value={r.earningsRateId}>
                        {r.name} ({r.earningsType})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedRate && (
                  <div className="mt-1.5 pl-1 flex items-center gap-2">
                    <Check size={10} className="text-emerald-500" />
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {selectedRate.name}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      Acct: {selectedRate.accountCode}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-5 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Payroll Mappings
        </button>
      </div>
    </motion.div>
  );
}

// ── GL Revenue Code Mapper ────────────────────────────────
function RevenueMappingPanel({
  orgId,
  accounts,
  onClose,
}: {
  orgId: string;
  accounts: Array<{ code: string; name: string; taxType: string }>;
  onClose: () => void;
}) {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getAccountCodes(orgId, "REVENUE");
      const init: Record<string, string> = {};
      for (const c of data ?? []) init[c.iworkr_code_key] = c.external_code;
      setMappings(init);
    })();
  }, [orgId]);

  async function handleSave() {
    setSaving(true);
    const codes = REVENUE_CODES.filter((c) => mappings[c.id]).map((c) => {
      const acct = accounts.find((a) => a.code === mappings[c.id]);
      return {
        iworkr_code_type: "REVENUE",
        iworkr_code_key: c.id,
        iworkr_code_label: c.label,
        external_code: mappings[c.id],
        external_name: acct?.name,
        external_tax_type: acct?.taxType,
        external_category: "REVENUE",
        is_gst_free: c.id === "NDIS_SERVICES",
      };
    });

    await saveAccountCodes(orgId, codes);
    onClose();
    setSaving(false);
  }

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 w-[600px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
    >
      <div className="h-14 flex items-center px-5 border-b border-white/5 gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">GL Revenue Codes</h2>
          <p className="text-[10px] text-zinc-500">
            Map invoice line item categories to Xero AccountCodes
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {REVENUE_CODES.map((cat) => {
          const sel = mappings[cat.id] ?? "";
          const acct = accounts.find((a) => a.code === sel);
          return (
            <div
              key={cat.id}
              className={`p-3 rounded-xl border transition-colors ${
                sel
                  ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                  : "border-white/5 bg-zinc-900/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{cat.label}</p>
                  {cat.id === "NDIS_SERVICES" && (
                    <p className="text-[10px] text-amber-400 mt-0.5">
                      Must use EXEMPTOUTPUT (0% GST)
                    </p>
                  )}
                </div>
                <ChevronRight size={12} className="text-zinc-600" />
                <select
                  value={sel}
                  onChange={(e) =>
                    setMappings((p) => ({ ...p, [cat.id]: e.target.value }))
                  }
                  className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 min-w-[180px]"
                >
                  <option value="">— Select account —</option>
                  {accounts.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} – {a.name}
                    </option>
                  ))}
                </select>
              </div>
              {acct && (
                <div className="mt-1.5 pl-1 flex items-center gap-2">
                  <Check size={10} className="text-emerald-500" />
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {acct.code} – {acct.name}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    Tax: {acct.taxType}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-5 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save GL Mappings
        </button>
      </div>
    </motion.div>
  );
}

// ── NDIS/Pay Category Mapper (existing) ───────────────────
function MappingSlideOver({
  orgId,
  provider,
  existingMappings,
  onClose,
  onSaved,
}: {
  orgId: string;
  provider: AccountingProvider;
  existingMappings: IntegrationMapping[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accounts, setAccounts] = useState<
    Array<{ code: string; name: string; taxType: string }>
  >([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [taxMappings, setTaxMappings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"ndis" | "payroll">("ndis");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, string> = {};
    const initTax: Record<string, string> = {};
    for (const m of existingMappings) {
      init[m.iworkr_entity_id] = m.external_account_code;
      initTax[m.iworkr_entity_id] = m.external_tax_type ?? "";
    }
    setMappings(init);
    setTaxMappings(initTax);
  }, [existingMappings]);

  useEffect(() => {
    if (provider !== "XERO") {
      setLoadingAccounts(false);
      return;
    }
    (async () => {
      const { data, error } = await fetchXeroAccounts(orgId);
      if (error) setAccountError(error);
      else setAccounts(data ?? []);
      setLoadingAccounts(false);
    })();
  }, [orgId, provider]);

  async function handleSave() {
    setSaving(true);
    const cats = activeTab === "ndis" ? NDIS_CATEGORIES : PAY_CATEGORIES;
    const entityType: IntegrationEntityType =
      activeTab === "ndis" ? "NDIS_CATEGORY" : "PAY_CATEGORY";

    const rows = cats
      .filter((c) => mappings[c.id])
      .map((c) => ({
        iworkr_entity_type: entityType,
        iworkr_entity_id: c.id,
        iworkr_entity_label: c.label,
        external_account_code: mappings[c.id],
        external_account_name:
          accounts.find((a) => a.code === mappings[c.id])?.name ?? undefined,
        external_tax_type: taxMappings[c.id] ?? undefined,
      }));

    await saveIntegrationMappings(orgId, provider, rows);
    onSaved();
    setSaving(false);
  }

  const cats = activeTab === "ndis" ? NDIS_CATEGORIES : PAY_CATEGORIES;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 w-[600px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
    >
      <div className="h-14 flex items-center px-5 border-b border-white/5 gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">
            Map Chart of Accounts
          </h2>
          <p className="text-[10px] text-zinc-500">
            {provider} · Semantic Mapper
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 px-5 py-3 border-b border-white/5">
        {(["ndis", "payroll"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
              activeTab === t
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            {t === "ndis" ? "NDIS Categories" : "Pay Categories"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loadingAccounts ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={18} className="animate-spin text-zinc-500" />
          </div>
        ) : accountError ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-4">
            <p className="text-xs text-rose-400">{accountError}</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {cats.map((cat) => {
            const sel = mappings[cat.id] ?? "";
            const acct = accounts.find((a) => a.code === sel);
            return (
              <div
                key={cat.id}
                className={`p-3 rounded-xl border transition-colors ${
                  sel
                    ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                    : "border-white/5 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {cat.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {cat.id}
                    </p>
                  </div>
                  <ChevronRight size={12} className="text-zinc-600" />
                  <select
                    value={sel}
                    onChange={(e) => {
                      const code = e.target.value;
                      setMappings((p) => ({ ...p, [cat.id]: code }));
                      const a = accounts.find((a) => a.code === code);
                      if (a)
                        setTaxMappings((p) => ({ ...p, [cat.id]: a.taxType }));
                    }}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 min-w-[180px]"
                  >
                    <option value="">— Select account —</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} – {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                {acct && (
                  <div className="mt-1.5 flex items-center gap-3 pl-1">
                    <span className="text-[10px] text-emerald-500 font-mono">
                      <Check size={10} className="inline mr-1" />
                      {acct.code} – {acct.name}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      Tax: {acct.taxType}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-5 border-t border-white/5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Mappings
        </button>
      </div>
    </motion.div>
  );
}

// ── Provider Card ─────────────────────────────────────────
function IntegrationCard({
  status,
  health,
  orgId,
  onConnectClick,
  onDisconnect,
  onMapClick,
  onPayrollMap,
  onRevenueMap,
  showNDISMapping = true,
}: {
  status: IntegrationStatus;
  health: ConnectionHealth | null;
  orgId: string;
  onConnectClick: (p: AccountingProvider) => void;
  onDisconnect: (p: AccountingProvider) => void;
  onMapClick: (p: AccountingProvider) => void;
  onPayrollMap: () => void;
  onRevenueMap: () => void;
  showNDISMapping?: boolean;
}) {
  const [disconnecting, startDisconnect] = useTransition();

  const META: Record<
    AccountingProvider,
    { name: string; desc: string; color: string }
  > = {
    XERO: {
      name: "Xero",
      desc: "Two-way sync for invoices, payments, payroll timesheets, and GL reconciliation.",
      color: "#13B5EA",
    },
    MYOB: {
      name: "MYOB AccountRight",
      desc: "Push invoices and payroll batches to MYOB for reconciliation.",
      color: "#8B5CF6",
    },
  };

  const meta = META[status.provider];
  const isDisconnected = health?.connection_status === "DISCONNECTED";

  return (
    <div className="bg-zinc-900/50 border border-white/8 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/12 transition-colors">
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold"
          style={{
            backgroundColor: `${meta.color}18`,
            border: `1px solid ${meta.color}30`,
            color: meta.color,
          }}
        >
          {meta.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{meta.name}</h3>
            {isDisconnected ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-rose-400 bg-rose-400/12 border border-rose-500/20 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle size={10} />
                Disconnected
              </span>
            ) : status.is_connected ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/12 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-zinc-500 bg-zinc-800 border border-white/5 uppercase tracking-wider">
                Not Connected
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
            {meta.desc}
          </p>
        </div>
      </div>

      {isDisconnected && health?.disconnect_reason && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
          <p className="text-[11px] text-rose-300">{health.disconnect_reason}</p>
          <p className="text-[10px] text-rose-400/60 mt-1">
            Reconnect to resume syncing. Queued items will retry automatically.
          </p>
        </div>
      )}

      {(status.is_connected || isDisconnected) && (
        <div className="bg-zinc-950/60 rounded-xl p-3 flex flex-col gap-1.5">
          {status.external_org_name && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Organisation
              </span>
              <span className="text-[11px] font-medium text-white">
                {status.external_org_name}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Last Sync
            </span>
            <span className="text-[10px] font-mono text-zinc-400">
              {formatRelative(status.last_sync_at)}
            </span>
          </div>
          {health && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Entities Mapped
                </span>
                <span className="text-[10px] font-mono text-zinc-300">
                  {health.entity_count}
                </span>
              </div>
              {health.queue_pending > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Queue Pending
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">
                    {health.queue_pending}
                  </span>
                </div>
              )}
              {health.queue_failed > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Queue Failed
                  </span>
                  <span className="text-[10px] font-mono text-rose-400 font-semibold">
                    {health.queue_failed}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-auto">
        {status.is_connected ? (
          <>
            {showNDISMapping && (
              <button
                onClick={() => onMapClick(status.provider)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
              >
                <Settings size={12} />
                NDIS / Pay Mapping
              </button>
            )}
            <button
              onClick={onRevenueMap}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/5 transition-colors"
            >
              GL Codes
            </button>
            <button
              onClick={onPayrollMap}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/5 transition-colors"
            >
              Payroll
            </button>
            <button
              onClick={() =>
                startDisconnect(() => onDisconnect(status.provider))
              }
              disabled={disconnecting}
              className="p-2 rounded-lg border border-white/8 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
              title="Disconnect"
            >
              {disconnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Link2Off size={14} />
              )}
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnectClick(status.provider)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-white/10 text-white text-xs font-semibold rounded-lg hover:bg-white/5 transition-colors"
          >
            <Link2 size={12} />
            Connect to {meta.name}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Queue Monitor ─────────────────────────────────────────
function QueueMonitor({ orgId }: { orgId: string }) {
  const [dashboard, setDashboard] = useState<QueueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { addToast } = useToastStore();

  const fetchQueue = useCallback(async () => {
    const { data } = await getQueueDashboard(orgId);
    setDashboard(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleTriggerSync() {
    setSyncing(true);
    const { ok, processed, failed, error } = await triggerSyncEngine();
    if (ok) {
      addToast(
        `Sync complete: ${processed} processed, ${failed} failed`,
        undefined,
        processed > 0 ? "success" : "info"
      );
    } else {
      addToast(error || "Sync failed", undefined, "error");
    }
    await fetchQueue();
    setSyncing(false);
  }

  async function handleRetry(itemId: string) {
    await retryQueueItem(orgId, itemId);
    await fetchQueue();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 size={18} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Sync Queue Monitor
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchQueue}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Run Sync Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Queued",
            value: dashboard.total_queued,
            color: "text-amber-400",
          },
          {
            label: "Processing",
            value: dashboard.total_processing,
            color: "text-blue-400",
          },
          {
            label: "Completed",
            value: dashboard.total_completed,
            color: "text-emerald-400",
          },
          {
            label: "Failed",
            value: dashboard.total_failed,
            color: "text-rose-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-center"
          >
            <p className={`text-lg font-bold font-mono ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {dashboard.recent_items.length > 0 && (
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Recent Queue Items
            </p>
          </div>
          <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto">
            {dashboard.recent_items.map((item) => (
              <div
                key={item.id}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
              >
                <StatusDot status={item.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white font-medium">
                      {item.entity_type}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {item.action}
                    </span>
                    {item.attempt_count > 1 && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        ×{item.attempt_count}
                      </span>
                    )}
                  </div>
                  {item.last_error && (
                    <p className="text-[10px] text-rose-400 truncate mt-0.5">
                      {item.last_error}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">
                  {formatRelative(item.created_at)}
                </span>
                {(item.status === "failed" ||
                  item.status === "FAILED_PERMANENTLY") && (
                  <button
                    onClick={() => handleRetry(item.id)}
                    className="p-1 rounded text-zinc-500 hover:text-emerald-400 transition-colors"
                    title="Retry"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Entity Map Viewer ─────────────────────────────────────
function EntityMapViewer({ orgId }: { orgId: string }) {
  const [mappings, setMappings] = useState<EntityMapping[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await getEntityMappings(
        orgId,
        filter || undefined
      );
      setMappings(data ?? []);
      setLoading(false);
    })();
  }, [orgId, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Entity Identity Map
        </h3>
        <div className="flex items-center gap-2">
          {["", "CONTACT", "INVOICE", "PAYMENT", "EMPLOYEE"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setLoading(true);
              }}
              className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
                filter === f
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {f || "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-16">
          <Loader2 size={14} className="animate-spin text-zinc-500" />
        </div>
      ) : mappings.length === 0 ? (
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-6 text-center">
          <p className="text-xs text-zinc-500">
            No entity mappings yet. Synced entities will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/30 border border-white/5 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5 max-h-[240px] overflow-y-auto">
            {mappings.map((m) => (
              <div
                key={m.id}
                className="px-4 py-2.5 flex items-center gap-3"
              >
                <span className="text-[10px] text-zinc-500 font-mono w-16">
                  {m.entity_type}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono flex-1 truncate">
                  {m.iworkr_id}
                </span>
                <ArrowRight size={10} className="text-zinc-600" />
                <span className="text-[10px] text-emerald-400 font-mono flex-1 truncate">
                  {m.external_id}
                </span>
                <span
                  className={`text-[10px] font-mono ${
                    m.sync_status === "SYNCED"
                      ? "text-emerald-500"
                      : "text-rose-400"
                  }`}
                >
                  {m.sync_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function IntegrationsPage() {
  const { orgId } = useOrg();
  const { showNDIS } = useSectorFeatures();
  const { addToast } = useToastStore();
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [health, setHealth] = useState<ConnectionHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "providers" | "queue" | "entities"
  >("providers");

  const [mappingProvider, setMappingProvider] =
    useState<AccountingProvider | null>(null);
  const [existingMappings, setExistingMappings] = useState<
    IntegrationMapping[]
  >([]);
  const [showPayrollMap, setShowPayrollMap] = useState(false);
  const [showRevenueMap, setShowRevenueMap] = useState(false);
  const [xeroAccounts, setXeroAccounts] = useState<
    Array<{ code: string; name: string; taxType: string }>
  >([]);

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [statusRes, healthRes] = await Promise.all([
      getIntegrationStatuses(orgId),
      getConnectionHealth(orgId),
    ]);
    if (statusRes.error) setError(statusRes.error);
    else setStatuses(statusRes.data ?? []);
    setHealth(healthRes.data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchAll();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      addToast("Xero connected successfully!", undefined, "success");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchAll, addToast]);

  async function handleConnect(provider: AccountingProvider) {
    if (!orgId) return;
    if (provider === "XERO") {
      const url = await getXeroConnectUrl(orgId);
      window.location.href = url;
    } else {
      addToast(
        "MYOB integration coming soon.",
        undefined,
        "info"
      );
    }
  }

  async function handleDisconnect(provider: AccountingProvider) {
    if (!orgId) return;
    if (!window.confirm(`Disconnect ${provider}? Queued syncs will be paused.`))
      return;
    await disconnectIntegration(orgId, provider);
    await fetchAll();
  }

  async function handleMapClick(provider: AccountingProvider) {
    if (!orgId) return;
    const { data } = await getIntegrationMappings(orgId, provider);
    setExistingMappings(data ?? []);
    setMappingProvider(provider);
  }

  async function handleRevenueMap() {
    if (!orgId) return;
    const { data } = await fetchXeroAccounts(orgId);
    setXeroAccounts(data ?? []);
    setShowRevenueMap(true);
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      <div className="h-14 border-b border-white/5 flex items-center px-6 gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>SETTINGS</span>
          <ChevronRight size={12} />
          <span className="text-zinc-300">INTEGRATIONS</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-white/5 px-6 flex items-center gap-1">
        {(
          [
            { id: "providers", label: "Connections" },
            { id: "queue", label: "Sync Queue" },
            { id: "entities", label: "Entity Map" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-emerald-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {activeTab === "providers" && (
            <>
              <div className="mb-8">
                <h1 className="text-xl font-bold text-white mb-1">
                  Financial Integrations
                </h1>
                <p className="text-sm text-zinc-500">
                  Connect iWorkr to accounting software for zero-touch invoice
                  sync, payment reconciliation, and STP-compliant payroll
                  export.
                </p>
              </div>

              {statuses?.some((s) => s.failed_count > 0) && (
                <div className="mb-6 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                  <AlertTriangle
                    size={16}
                    className="text-rose-400 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-xs text-rose-300 font-medium">
                      {statuses?.reduce((t, s) => t + (s.failed_count ?? 0), 0) ?? 0} sync
                      failures detected.
                    </p>
                    <p className="text-[10px] text-rose-400/70">
                      Switch to the Sync Queue tab to review and retry.
                    </p>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : error ? (
                <div className="flex items-center gap-3 bg-zinc-900 rounded-xl p-4">
                  <AlertTriangle size={16} className="text-rose-400" />
                  <p className="text-sm text-zinc-400">{error}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statuses?.map((s) => (
                    <IntegrationCard
                      key={s.provider}
                      status={s}
                      health={
                        s.provider === "XERO" ? health : null
                      }
                      orgId={orgId ?? ""}
                      onConnectClick={handleConnect}
                      onDisconnect={handleDisconnect}
                      onMapClick={handleMapClick}
                      onPayrollMap={() => setShowPayrollMap(true)}
                      onRevenueMap={handleRevenueMap}
                      showNDISMapping={showNDIS}
                    />
                  ))}
                </div>
              )}

              {/* How it works */}
              <div className="mt-8 bg-zinc-900/30 border border-white/5 rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-zinc-300 mb-3 uppercase tracking-wider">
                  The Ledger-Bridge Pipeline
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    {
                      step: "01",
                      label: "Connect",
                      desc: "Authorise via OAuth 2.0 — tokens rotate automatically with advisory locks.",
                    },
                    {
                      step: "02",
                      label: "Map",
                      desc: "Map GL codes, NDIS categories, and payroll earnings rates to Xero entities.",
                    },
                    {
                      step: "03",
                      label: "Queue",
                      desc: "Invoices, payments, and timesheets are queued with exponential backoff.",
                    },
                    {
                      step: "04",
                      label: "Reconcile",
                      desc: "Xero webhooks update iWorkr in real-time when invoices are paid externally.",
                    },
                  ].map((item) => (
                    <div key={item.step} className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-mono text-emerald-500">
                        {item.step}
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-zinc-500 leading-relaxed">
                        {item.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === "queue" && orgId && (
            <QueueMonitor orgId={orgId} />
          )}

          {activeTab === "entities" && orgId && (
            <EntityMapViewer orgId={orgId} />
          )}
        </div>
      </div>

      {/* Slide-overs */}
      <AnimatePresence>
        {mappingProvider && orgId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setMappingProvider(null)}
            />
            <MappingSlideOver
              orgId={orgId}
              provider={mappingProvider}
              existingMappings={existingMappings}
              onClose={() => setMappingProvider(null)}
              onSaved={() => {
                setMappingProvider(null);
                fetchAll();
              }}
            />
          </>
        )}

        {showPayrollMap && orgId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setShowPayrollMap(false)}
            />
            <PayrollMappingPanel
              orgId={orgId}
              onClose={() => {
                setShowPayrollMap(false);
                fetchAll();
              }}
            />
          </>
        )}

        {showRevenueMap && orgId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setShowRevenueMap(false)}
            />
            <RevenueMappingPanel
              orgId={orgId}
              accounts={xeroAccounts}
              onClose={() => {
                setShowRevenueMap(false);
                fetchAll();
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
