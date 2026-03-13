"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Billing & Subscription Overrides
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  CreditCard,
  Building2,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  Zap,
  Crown,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import {
  listWorkspaces,
  overrideSubscription,
  updateQuotas,
  getWorkspaceDetail,
} from "@/app/actions/superadmin";

/* ── Plan tiers ──────────────────────────────────────────────── */

const PLANS = [
  { id: "free", label: "Free", price: "$0/mo", color: "text-zinc-500", bg: "bg-zinc-500/10" },
  { id: "starter", label: "Starter", price: "$47/mo", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "standard", label: "Standard", price: "$97/mo", color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "enterprise", label: "Enterprise", price: "$247/mo", color: "text-purple-400", bg: "bg-purple-500/10" },
];

export default function BillingPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Override form
  const [overrideTier, setOverrideTier] = useState("enterprise");
  const [overrideExpiry, setOverrideExpiry] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  // Quotas
  const [quotaStorage, setQuotaStorage] = useState(10);
  const [quotaSms, setQuotaSms] = useState(100);
  const [quotaApi, setQuotaApi] = useState(5000);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listWorkspaces(search || undefined, 50);
      if (result.error) {
        setLoadError(result.error);
        setWorkspaces([]);
      } else if (result.data) {
        setWorkspaces(result.data.rows || []);
      }
    } catch (e: any) {
      setLoadError(e.message || "Failed to load");
    }
    setLoading(false);
  }, [search]);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);

  const selectOrg = useCallback(async (orgId: string) => {
    setSelectedOrg(orgId);
    setDetailLoading(true);
    setFeedback(null);
    const result = await getWorkspaceDetail(orgId);
    if (result.data) {
      setOrgDetail(result.data);
      const f = result.data.features;
      if (f) {
        setOverrideTier(f.manual_tier_override || "enterprise");
        setQuotaStorage(f.max_storage_gb || 10);
        setQuotaSms(f.max_sms_monthly || 100);
        setQuotaApi(f.max_api_calls_daily || 5000);
      }
    }
    setDetailLoading(false);
  }, []);

  const handleOverride = useCallback(async () => {
    if (!selectedOrg || !overrideReason) return;
    const result = await overrideSubscription(
      selectedOrg,
      overrideTier as any,
      overrideExpiry || null,
      overrideReason
    );
    setFeedback(result.error ? `Error: ${result.error}` : `Plan overridden to ${overrideTier}`);
    if (!result.error) selectOrg(selectedOrg);
    setTimeout(() => setFeedback(null), 4000);
  }, [selectedOrg, overrideTier, overrideExpiry, overrideReason, selectOrg]);

  const handleQuotas = useCallback(async () => {
    if (!selectedOrg) return;
    const result = await updateQuotas(selectedOrg, {
      max_storage_gb: quotaStorage,
      max_sms_monthly: quotaSms,
      max_api_calls_daily: quotaApi,
    });
    setFeedback(result.error ? `Error: ${result.error}` : "Quotas updated");
    if (!result.error) selectOrg(selectedOrg);
    setTimeout(() => setFeedback(null), 4000);
  }, [selectedOrg, quotaStorage, quotaSms, quotaApi, selectOrg]);

  return (
    <div className="flex h-full">
      {/* ── Left: Workspace Selector ── */}
      <div className={`flex flex-col ${selectedOrg ? "w-[40%]" : "w-full"} border-r border-white/[0.04]`}>
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div>
            <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">BILLING COMMAND CENTER</span>
            <h2 className="mt-0.5 text-[16px] font-semibold text-white">Subscription Overrides</h2>
          </div>
        </div>

        <div className="relative border-b border-white/[0.04] px-6 py-2">
          <Search size={13} className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find workspace…"
            className="w-full rounded-lg bg-white/[0.02] py-1.5 pl-8 pr-3 text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none border border-transparent focus:border-red-500/20"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadError ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <AlertTriangle size={24} className="text-red-400 mb-2" />
              <p className="text-[12px] text-red-400 font-medium">Failed to load</p>
              <p className="mt-1 text-[10px] text-red-400/60 text-center max-w-[300px] font-mono">{loadError}</p>
              <button onClick={loadWorkspaces} className="mt-3 rounded-md bg-red-500/10 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/15">Retry</button>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-white/[0.02]" />
              ))}
            </div>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => selectOrg(ws.id)}
                className={`flex w-full items-center justify-between border-b px-6 py-2.5 text-left transition-colors ${
                  selectedOrg === ws.id ? "border-red-500/10 bg-red-500/[0.04]" : "border-white/[0.02] hover:bg-white/[0.02]"
                }`}
              >
                <div>
                  <span className="text-[11px] font-medium text-zinc-300">{ws.name}</span>
                  <span className="ml-2 text-[9px] text-zinc-700">{ws.industry_type || "trades"}</span>
                </div>
                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium text-zinc-600">{ws.plan_tier || "free"}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Billing Controls ── */}
      <AnimatePresence>
        {selectedOrg && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex w-[60%] flex-col overflow-y-auto"
          >
            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
              </div>
            ) : (
              <div className="space-y-0">
                <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
                  <div>
                    <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">BILLING OVERRIDE</span>
                    <h3 className="mt-0.5 text-[15px] font-semibold text-white">{orgDetail?.organization?.name}</h3>
                  </div>
                  <button onClick={() => { setSelectedOrg(null); setOrgDetail(null); }} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white/[0.04]">
                    <X size={14} />
                  </button>
                </div>

                {/* Feedback */}
                <AnimatePresence>
                  {feedback && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-b border-white/[0.04] px-6 py-2">
                      <span className={`text-[10px] font-medium ${feedback.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>{feedback}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Current Override Status */}
                {orgDetail?.features?.manual_tier_override && (
                  <div className="border-b border-white/[0.04] px-6 py-3">
                    <div className="flex items-center gap-2 rounded-lg border border-purple-500/15 bg-purple-500/[0.04] px-3 py-2">
                      <Crown size={13} className="text-purple-400" />
                      <div>
                        <span className="text-[10px] font-medium text-purple-300">
                          Active Override: {orgDetail.features.manual_tier_override.toUpperCase()}
                        </span>
                        {orgDetail.features.override_expires_at && (
                          <span className="ml-2 text-[9px] text-purple-400/60">
                            Expires: {new Date(orgDetail.features.override_expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Plan Override Form */}
                <div className="border-b border-white/[0.04] px-6 py-4 space-y-3">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">MANUAL PLAN OVERRIDE</span>
                  <p className="text-[10px] text-zinc-600">Bypass Stripe and manually set the subscription tier.</p>

                  {/* Plan selector */}
                  <div className="grid grid-cols-4 gap-2">
                    {PLANS.map((plan) => (
                      <button
                        key={plan.id}
                        onClick={() => setOverrideTier(plan.id)}
                        className={`flex flex-col items-center rounded-lg border p-2.5 transition-colors ${
                          overrideTier === plan.id
                            ? "border-red-500/30 bg-red-500/[0.06]"
                            : "border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.02]"
                        }`}
                      >
                        <span className={`text-[11px] font-semibold ${plan.color}`}>{plan.label}</span>
                        <span className="text-[9px] text-zinc-600">{plan.price}</span>
                      </button>
                    ))}
                  </div>

                  {/* Expiry */}
                  <div>
                    <label className="text-[10px] text-zinc-600">Override Expires At (optional)</label>
                    <input
                      type="date"
                      value={overrideExpiry}
                      onChange={(e) => setOverrideExpiry(e.target.value)}
                      className="mt-1 w-full rounded-lg bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-300 outline-none border border-white/[0.06] focus:border-red-500/30"
                    />
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="text-[10px] text-zinc-600">Reason (required)</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g., Enterprise demo for 3 months, churn prevention…"
                      rows={2}
                      className="mt-1 w-full rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-300 placeholder:text-zinc-700 outline-none border border-white/[0.06] focus:border-red-500/30 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleOverride}
                    disabled={!overrideReason}
                    className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-30"
                  >
                    <Zap size={12} />
                    Apply Override
                  </button>
                </div>

                {/* Usage Quota Adjustments */}
                <div className="px-6 py-4 space-y-3">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">USAGE QUOTAS</span>

                  {[
                    { label: "Max Storage (GB)", value: quotaStorage, set: setQuotaStorage, min: 1, max: 1000 },
                    { label: "Monthly SMS Limit", value: quotaSms, set: setQuotaSms, min: 0, max: 10000 },
                    { label: "Daily API Calls", value: quotaApi, set: setQuotaApi, min: 100, max: 1000000 },
                  ].map((q) => (
                    <div key={q.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">{q.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={q.min}
                          max={q.max}
                          value={q.value}
                          onChange={(e) => q.set(Number(e.target.value))}
                          className="w-32 accent-red-500 h-1"
                        />
                        <input
                          type="number"
                          value={q.value}
                          onChange={(e) => q.set(Number(e.target.value))}
                          className="w-[70px] rounded bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-300 outline-none border border-white/[0.06] text-right font-mono"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleQuotas}
                    className="flex items-center gap-1.5 rounded-md bg-white/[0.06] px-4 py-2 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.08]"
                  >
                    <SlidersHorizontal size={12} />
                    Save Quotas
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
