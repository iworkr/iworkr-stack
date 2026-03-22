/**
 * @page /dashboard/finance/sync-errors
 * @status COMPLETE
 * @description Accounting sync error log with retry and resolution actions
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import { getSyncErrors, retrySyncLog, type SyncError } from "@/app/actions/ledger-sync";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const DIRECTION_LABELS: Record<string, string> = {
  OUTBOUND_PUSH: "Outbound Push",
  INBOUND_WEBHOOK: "Inbound Webhook",
};

const ENTITY_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  CONTACT: "Contact",
  PAYROLL: "Payroll",
};

const PROVIDER_COLORS: Record<string, string> = {
  XERO: "#13B5EA",
  MYOB: "#8B5CF6",
};

export default function SyncErrorsPage() {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchErrors = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error: err } = await getSyncErrors(orgId);
    if (err) setError(err);
    else setErrors(data ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  async function handleRetry(logId: string) {
    if (!orgId) return;
    setRetrying(logId);
    startTransition(async () => {
      const { error: err } = await retrySyncLog(orgId, logId);
      if (err) addToast(`Retry failed: ${err}`, undefined, "error");
      else {
        setErrors((prev) => prev.filter((e) => e.id !== logId));
      }
      setRetrying(null);
    });
  }

  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      {/* Command Header */}
      <div className="h-14 border-b border-white/5 flex items-center px-6 gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>FINANCIALS</span>
          <ChevronRight size={12} />
          <span className="text-zinc-300">SYNC ERRORS</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {errors.length > 0 && (
            <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
              {errors.length} failed
            </span>
          )}
          <button
            onClick={fetchErrors}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Telemetry Ribbon */}
      <div className="h-14 bg-zinc-950/30 border-b border-white/5 flex items-center px-6 gap-8 flex-shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Total Failures</span>
          <span className={`font-mono text-xl font-bold leading-none ${errors.length > 0 ? "text-rose-500 animate-pulse" : "text-white"}`}>
            {errors.length}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Invoices Failed</span>
          <span className="font-mono text-xl font-bold leading-none text-white">
            {errors.filter((e) => e.entity_type === "INVOICE").length}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Payroll Failed</span>
          <span className="font-mono text-xl font-bold leading-none text-white">
            {errors.filter((e) => e.entity_type === "PAYROLL").length}
          </span>
        </div>
        <a
          href="/dashboard/settings/integrations"
          className="ml-auto flex items-center gap-2 px-3 py-1.5 border border-white/8 rounded-lg text-[11px] text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
        >
          <Settings size={12} />
          Fix Mappings
        </a>
      </div>

      {/* Grid Header */}
      <div className="h-9 border-b border-white/5 flex items-center px-6 gap-4 flex-shrink-0 bg-zinc-950/20">
        <div className="w-[100px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Provider</div>
        <div className="w-[80px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Type</div>
        <div className="w-[120px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Entity</div>
        <div className="flex-1 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Error</div>
        <div className="w-[80px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">HTTP</div>
        <div className="w-[120px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Time</div>
        <div className="w-[160px] text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Action</div>
      </div>

      {/* Error rows */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border border-zinc-700 border-t-rose-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <AlertTriangle size={20} className="text-rose-500" />
            <p className="text-xs text-zinc-400">{error}</p>
          </div>
        ) : errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ChevronRight size={20} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-white">All clear</p>
            <p className="text-xs text-zinc-500">No sync failures. All invoices and payroll are reconciled.</p>
          </div>
        ) : (
          errors.map((err, i) => {
            const provColor = PROVIDER_COLORS[err.provider] ?? "#71717A";
            const isRetrying = retrying === err.id;

            return (
              <motion.div
                key={err.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group h-16 border-b border-white/5 hover:bg-white/[0.02] transition-colors flex items-center px-6 gap-4 border-l-2 border-l-rose-500/40"
              >
                {/* Provider */}
                <div className="w-[100px]">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ color: provColor, backgroundColor: `${provColor}18` }}
                  >
                    {err.provider}
                  </span>
                </div>

                {/* Type */}
                <div className="w-[80px]">
                  <span className="text-[10px] text-zinc-500">
                    {DIRECTION_LABELS[err.direction] ?? err.direction}
                  </span>
                </div>

                {/* Entity */}
                <div className="w-[120px]">
                  <p className="text-xs font-medium text-white truncate">
                    {err.entity_label ?? "Unknown"}
                  </p>
                  <p className="text-[10px] text-zinc-600">{ENTITY_LABELS[err.entity_type] ?? err.entity_type}</p>
                </div>

                {/* Error message */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1.5">
                    <XCircle size={11} className="text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-300 leading-relaxed line-clamp-2">
                      {err.error_message ?? "Unknown error"}
                    </p>
                  </div>
                  {err.retry_count > 0 && (
                    <p className="text-[10px] text-zinc-600 mt-0.5">
                      Retried {err.retry_count}× previously
                    </p>
                  )}
                </div>

                {/* HTTP Status */}
                <div className="w-[80px]">
                  {err.http_status ? (
                    <span
                      className={`font-mono text-xs ${
                        err.http_status >= 500 ? "text-rose-400" : err.http_status >= 400 ? "text-amber-400" : "text-zinc-400"
                      }`}
                    >
                      {err.http_status}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">—</span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="w-[120px]">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Clock size={9} />
                    <span className="font-mono">{formatDateTime(err.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="w-[160px] flex items-center gap-2">
                  <a
                    href="/dashboard/settings/integrations"
                    className="text-[10px] px-2.5 py-1.5 rounded-lg border border-white/8 text-zinc-400 hover:text-white hover:border-white/20 transition-colors flex items-center gap-1"
                  >
                    <Settings size={10} />
                    Fix Mapping
                  </a>
                  <button
                    onClick={() => handleRetry(err.id)}
                    disabled={isRetrying || isPending}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isRetrying ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <RefreshCw size={10} />
                    )}
                    Retry
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
