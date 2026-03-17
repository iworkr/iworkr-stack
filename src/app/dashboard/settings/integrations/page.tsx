"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Link2Off,
  Loader2,
  RefreshCw,
  Save,
  Settings,
  X,
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
import { useOrg } from "@/lib/hooks/use-org";

// ── NDIS Categories to map ────────────────────────────────
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
  { id: "OVERTIME_150", label: "Overtime 150%" },
  { id: "OVERTIME_200", label: "Overtime 200%" },
  { id: "ALLOWANCE_SLEEPOVER", label: "Sleepover Allowance" },
  { id: "PUBLIC_HOLIDAY", label: "Public Holiday" },
];

function formatRelative(iso: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ── Account Mapper Slide-Over ─────────────────────────────
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
  const [accounts, setAccounts] = useState<Array<{ code: string; name: string; taxType: string }>>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [taxMappings, setTaxMappings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"ndis" | "payroll">("ndis");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Initialise from existing mappings
    const initMappings: Record<string, string> = {};
    const initTax: Record<string, string> = {};
    for (const m of existingMappings) {
      initMappings[m.iworkr_entity_id] = m.external_account_code;
      initTax[m.iworkr_entity_id] = m.external_tax_type ?? "";
    }
    setMappings(initMappings);
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
    setSaveError(null);

    const currentCategories = activeTab === "ndis" ? NDIS_CATEGORIES : PAY_CATEGORIES;
    const entityType = activeTab === "ndis" ? ("NDIS_CATEGORY" as const) : ("PAY_CATEGORY" as const);

    const rows: Array<{
      iworkr_entity_type: IntegrationEntityType;
      iworkr_entity_id: string;
      iworkr_entity_label?: string;
      external_account_code: string;
      external_account_name?: string;
      external_tax_type?: string;
    }> = currentCategories
      .filter((c) => mappings[c.id])
      .map((c) => ({
        iworkr_entity_type: entityType,
        iworkr_entity_id: c.id,
        iworkr_entity_label: c.label,
        external_account_code: mappings[c.id],
        external_account_name: accounts.find((a) => a.code === mappings[c.id])?.name ?? undefined,
        external_tax_type: taxMappings[c.id] ?? undefined,
      }));

    const { error } = await saveIntegrationMappings(orgId, provider, rows);
    if (error) setSaveError(error);
    else onSaved();
    setSaving(false);
  }

  const displayCategories = activeTab === "ndis" ? NDIS_CATEGORIES : PAY_CATEGORIES;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-y-0 right-0 w-[600px] bg-zinc-950 border-l border-white/5 z-50 flex flex-col"
    >
      {/* Header */}
      <div className="h-14 flex items-center px-5 border-b border-white/5 gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Map Chart of Accounts</h2>
          <p className="text-[10px] text-zinc-500">{provider} · Semantic Mapper</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 py-3 border-b border-white/5">
        {(["ndis", "payroll"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
              activeTab === t ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
            }`}
          >
            {t === "ndis" ? "NDIS Categories" : "Pay Categories"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loadingAccounts ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 size={18} className="animate-spin text-zinc-500" />
          </div>
        ) : accountError ? (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 mb-4">
            <p className="text-xs text-rose-400">{accountError}</p>
            <p className="text-[10px] text-zinc-500 mt-1">Could not fetch live accounts. Ensure Xero is connected and token is valid.</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {displayCategories.map((cat) => {
            const selectedCode = mappings[cat.id] ?? "";
            const selectedAccount = accounts.find((a) => a.code === selectedCode);

            return (
              <div
                key={cat.id}
                className={`p-3 rounded-xl border transition-colors ${
                  selectedCode ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-white/5 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{cat.label}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{cat.id}</p>
                  </div>

                  {/* Account code selector */}
                  <div className="flex items-center gap-2">
                    <ChevronRight size={12} className="text-zinc-600" />
                    <select
                      value={selectedCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setMappings((prev) => ({ ...prev, [cat.id]: code }));
                        const acct = accounts.find((a) => a.code === code);
                        if (acct) setTaxMappings((prev) => ({ ...prev, [cat.id]: acct.taxType }));
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
                </div>

                {selectedAccount && (
                  <div className="mt-1.5 flex items-center gap-3 pl-1">
                    <span className="text-[10px] text-emerald-500 font-mono">
                      <Check size={10} className="inline mr-1" />
                      Mapped → {selectedAccount.code} – {selectedAccount.name}
                    </span>
                    <span className="text-[10px] text-zinc-600">Tax: {selectedAccount.taxType}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-white/5">
        {saveError && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-rose-400">{saveError}</p>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-black text-sm font-semibold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Mappings
        </button>
      </div>
    </motion.div>
  );
}

// ── Provider Card ─────────────────────────────────────────
function IntegrationCard({
  status,
  orgId,
  onConnectClick,
  onDisconnect,
  onMapClick,
}: {
  status: IntegrationStatus;
  orgId: string;
  onConnectClick: (provider: AccountingProvider) => void;
  onDisconnect: (provider: AccountingProvider) => void;
  onMapClick: (provider: AccountingProvider) => void;
}) {
  const [disconnecting, startDisconnect] = useTransition();

  const PROVIDER_META: Record<AccountingProvider, { name: string; description: string; color: string; logo: string }> = {
    XERO: {
      name: "Xero",
      description: "Bidirectional sync for AR invoices, AP payroll, and payment reconciliation.",
      color: "#13B5EA",
      logo: "https://www.vectorlogo.zone/logos/xero/xero-icon.svg",
    },
    MYOB: {
      name: "MYOB AccountRight",
      description: "Push invoices and payroll batches to MYOB for seamless reconciliation.",
      color: "#8B5CF6",
      logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/MYOB_Logo_2020.svg/200px-MYOB_Logo_2020.svg.png",
    },
  };

  const meta = PROVIDER_META[status.provider];

  return (
    <div className="bg-zinc-900/50 border border-white/8 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/12 transition-colors">
      {/* Provider header */}
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${meta.color}18`, border: `1px solid ${meta.color}30` }}
        >
          <img src={meta.logo} alt={meta.name} className="w-7 h-7 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{meta.name}</h3>
            {status.is_connected ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/12 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-zinc-500 bg-zinc-800 border border-white/5 uppercase tracking-wider">
                Disconnected
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{meta.description}</p>
        </div>
      </div>

      {/* Connection details */}
      {status.is_connected && status.external_org_name && (
        <div className="bg-zinc-950/60 rounded-xl p-3 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Organisation</span>
            <span className="text-[11px] font-medium text-white">{status.external_org_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Sync</span>
            <span className="text-[10px] font-mono text-zinc-400">{formatRelative(status.last_sync_at)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Mappings</span>
            <span className="text-[10px] font-mono text-zinc-300">{status.mapping_count} configured</span>
          </div>
          {status.failed_count > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Sync Errors</span>
              <span className="text-[10px] font-mono text-rose-400 font-semibold">{status.failed_count} failed</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto">
        {status.is_connected ? (
          <>
            <button
              onClick={() => onMapClick(status.provider)}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              <Settings size={12} />
              Map Chart of Accounts
            </button>
            <button
              onClick={() => startDisconnect(() => onDisconnect(status.provider))}
              disabled={disconnecting}
              className="p-2 rounded-lg border border-white/8 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
              title="Disconnect"
            >
              {disconnecting ? <Loader2 size={14} className="animate-spin" /> : <Link2Off size={14} />}
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

// ── Main Page ─────────────────────────────────────────────
export default function IntegrationsPage() {
  const { orgId } = useOrg();
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappingProvider, setMappingProvider] = useState<AccountingProvider | null>(null);
  const [existingMappings, setExistingMappings] = useState<IntegrationMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);

  const fetchStatuses = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error: err } = await getIntegrationStatuses(orgId);
    if (err) setError(err);
    else setStatuses(data ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchStatuses();
    // Show success toast if redirected from OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      // Could show a toast here
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatuses]);

  async function handleConnect(provider: AccountingProvider) {
    if (!orgId) return;
    if (provider === "XERO") {
      const url = await getXeroConnectUrl(orgId);
      window.location.href = url;
    } else {
      alert("MYOB integration coming soon. Contact support to enable early access.");
    }
  }

  async function handleDisconnect(provider: AccountingProvider) {
    if (!orgId) return;
    const confirmed = window.confirm(`Disconnect ${provider}? This will remove all stored tokens.`);
    if (!confirmed) return;
    await disconnectIntegration(orgId, provider);
    await fetchStatuses();
  }

  async function handleMapClick(provider: AccountingProvider) {
    if (!orgId) return;
    setLoadingMappings(true);
    const { data } = await getIntegrationMappings(orgId, provider);
    setExistingMappings(data ?? []);
    setMappingProvider(provider);
    setLoadingMappings(false);
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center px-6 gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>SETTINGS</span>
          <ChevronRight size={12} />
          <span className="text-zinc-300">INTEGRATIONS</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={fetchStatuses}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Title block */}
          <div className="mb-8">
            <h1 className="text-xl font-bold text-white mb-1">Financial Integrations</h1>
            <p className="text-sm text-zinc-500">
              Connect iWorkr to your accounting software for zero-touch invoice sync and payment reconciliation.
            </p>
          </div>

          {/* Status ribbon — sync errors alert */}
          {statuses.some((s) => s.failed_count > 0) && (
            <div className="mb-6 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-rose-300 font-medium">
                  {statuses.reduce((t, s) => t + s.failed_count, 0)} sync failures detected.
                </p>
                <p className="text-[10px] text-rose-400/70">Review and retry failed syncs to prevent reconciliation gaps.</p>
              </div>
              <a
                href="/dashboard/finance/sync-errors"
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              >
                View Errors <ExternalLink size={10} />
              </a>
            </div>
          )}

          {/* Provider cards grid */}
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
              {statuses.map((s) => (
                <IntegrationCard
                  key={s.provider}
                  status={s}
                  orgId={orgId ?? ""}
                  onConnectClick={handleConnect}
                  onDisconnect={handleDisconnect}
                  onMapClick={handleMapClick}
                />
              ))}
            </div>
          )}

          {/* Integration info */}
          <div className="mt-8 bg-zinc-900/30 border border-white/5 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-zinc-300 mb-3 uppercase tracking-wider">How it works</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { step: "01", label: "Connect", desc: "Authorise iWorkr via OAuth 2.0 — tokens rotate automatically." },
                { step: "02", label: "Map", desc: "Map your NDIS support categories to Xero account codes once." },
                { step: "03", label: "Sync", desc: "Invoices push on finalisation. Payments reconcile automatically via webhook." },
              ].map((item) => (
                <div key={item.step} className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-mono text-emerald-500">{item.step}</span>
                  <span className="text-xs font-semibold text-white">{item.label}</span>
                  <span className="text-[11px] text-zinc-500 leading-relaxed">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mapping Slide-Over */}
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
                fetchStatuses();
              }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
