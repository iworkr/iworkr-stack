/**
 * @page /dashboard/finance/accounts-payable
 * @status COMPLETE
 * @description Accounts payable with receipt OCR, verification workflow, and Xero push
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import {
  getSupplierReceipts,
  getReceiptDetail,
  verifyReceipt,
  rejectReceipt,
  pushReceiptToXero,
  getAPDashboardStats,
} from "@/app/actions/aegis-spend";
import {
  Receipt,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Search,
  Filter,
  ExternalLink,
  Camera,
  FileText,
  DollarSign,
  Clock,
  Zap,
  X,
  ChevronRight,
  Upload,
  ShieldCheck,
  Brain,
  TrendingUp,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface SupplierReceipt {
  id: string;
  organization_id: string;
  po_id: string | null;
  job_id: string | null;
  worker_id: string | null;
  receipt_image_url: string | null;
  receipt_storage_path: string | null;
  supplier_name_extracted: string | null;
  supplier_invoice_number: string | null;
  actual_total_amount: number | null;
  actual_tax_amount: number | null;
  actual_subtotal: number | null;
  extracted_date: string | null;
  extracted_po_number: string | null;
  ai_raw_response: any;
  ai_model_used: string | null;
  ai_confidence: number | null;
  po_variance_amount: number | null;
  po_variance_pct: number | null;
  match_status: string;
  xero_bill_id: string | null;
  xero_synced_at: string | null;
  cogs_account_code: string | null;
  status: string;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface APStats {
  pending_ai: number;
  needs_review: number;
  verified: number;
  synced: number;
  total_pending_value: number;
  pending_po_approvals: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PENDING_AI_PARSE: { label: "AI Processing", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Brain },
  NEEDS_REVIEW: { label: "Needs Review", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Eye },
  VERIFIED: { label: "Verified", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: ShieldCheck },
  SYNCED_TO_ACCOUNTING: { label: "Synced to Xero", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", icon: ExternalLink },
  REJECTED: { label: "Rejected", color: "text-rose-400 bg-rose-500/10 border-rose-500/20", icon: XCircle },
};

const filterTabs = [
  { key: "all", label: "All Receipts" },
  { key: "PENDING_AI_PARSE", label: "AI Processing" },
  { key: "NEEDS_REVIEW", label: "Needs Review" },
  { key: "VERIFIED", label: "Verified" },
  { key: "SYNCED_TO_ACCOUNTING", label: "Synced" },
  { key: "REJECTED", label: "Rejected" },
];

/* ═══════════════════════════════════════════════════════════
   AP TRIAGE PAGE
   ═══════════════════════════════════════════════════════════ */

export default function AccountsPayablePage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);
  const [receipts, setReceipts] = useState<SupplierReceipt[]>([]);
  const [stats, setStats] = useState<APStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<SupplierReceipt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [receiptRes, statsRes] = await Promise.all([
      getSupplierReceipts(orgId, activeFilter !== "all" ? { status: activeFilter } : undefined),
      getAPDashboardStats(orgId),
    ]);
    setReceipts(receiptRes.data as any);
    setStats(statsRes.data);
    setLoading(false);
  }, [orgId, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (receipt: SupplierReceipt) => {
    setDetailLoading(true);
    setSelectedReceipt(receipt);
    if (orgId) {
      const { data } = await getReceiptDetail(receipt.id, orgId);
      if (data) setSelectedReceipt(data as any);
    }
    setDetailLoading(false);
  };

  const handleVerify = async () => {
    if (!selectedReceipt || !orgId) return;
    setActionLoading("verify");
    await verifyReceipt(selectedReceipt.id, orgId);
    setSelectedReceipt(null);
    await load();
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!selectedReceipt || !orgId) return;
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    setActionLoading("reject");
    await rejectReceipt(selectedReceipt.id, orgId, reason);
    setSelectedReceipt(null);
    await load();
    setActionLoading(null);
  };

  const handlePushToXero = async () => {
    if (!selectedReceipt || !orgId) return;
    setActionLoading("xero");
    await pushReceiptToXero(selectedReceipt.id, orgId);
    setSelectedReceipt(null);
    await load();
    setActionLoading(null);
  };

  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.supplier_name_extracted?.toLowerCase().includes(q) ||
      r.supplier_invoice_number?.toLowerCase().includes(q) ||
      r.extracted_po_number?.toLowerCase().includes(q)
    );
  });

  const fmt = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Accounts Payable
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            AI-powered receipt triage · Three-way matching · Xero sync
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">
            <Upload className="w-4 h-4" />
            Upload Receipt
          </button>
        </div>
      </div>

      {/* ── Telemetry Ribbon ─────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { label: "AI Processing", value: stats.pending_ai, icon: Brain, color: "text-blue-400" },
            { label: "Needs Review", value: stats.needs_review, icon: Eye, color: "text-amber-400", pulse: stats.needs_review > 0 },
            { label: "Verified", value: stats.verified, icon: ShieldCheck, color: "text-emerald-400" },
            { label: "Synced to Xero", value: stats.synced, icon: ExternalLink, color: "text-cyan-400" },
            { label: "Pending Value", value: fmt(stats.total_pending_value), icon: DollarSign, color: "text-white", isMoney: true },
            { label: "PO Approvals", value: stats.pending_po_approvals, icon: Clock, color: "text-rose-400", pulse: stats.pending_po_approvals > 0 },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`h-16 flex items-center gap-3 px-4 rounded-xl bg-zinc-950/30 border border-zinc-800/50 ${
                (stat as any).pulse ? "animate-pulse" : ""
              }`}
            >
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <div>
                <p className="font-mono text-sm font-bold text-white">
                  {(stat as any).isMoney ? stat.value : stat.value}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Filter Tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-6 mb-6 border-b border-zinc-800/50 pb-3">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`text-sm pb-2 border-b-2 transition-all ${
              activeFilter === tab.key
                ? "border-emerald-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-1.5 border border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search receipts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-white outline-none w-48 placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* ── Receipt Grid ────────────────────────────────────── */}
      <div className="flex gap-6">
        {/* Left: List */}
        <div className="flex-1 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-20">
              <Receipt className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 text-sm">No receipts found</p>
              <p className="text-zinc-600 text-xs mt-1">
                Upload a receipt or snap one from the mobile app
              </p>
            </div>
          ) : (
            filteredReceipts.map((r) => {
              const cfg = statusConfig[r.status] || statusConfig.NEEDS_REVIEW;
              const StatusIcon = cfg.icon;
              const isSelected = selectedReceipt?.id === r.id;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => openDetail(r)}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "bg-zinc-800/40 border-emerald-500/30"
                      : "bg-zinc-950/40 border-zinc-800/30 hover:bg-zinc-900/50 hover:border-zinc-700/40"
                  }`}
                >
                  {/* Receipt thumbnail */}
                  <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {r.receipt_image_url ? (
                      <img
                        src={r.receipt_image_url}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {r.supplier_name_extracted || "Unknown Supplier"}
                      </p>
                      {r.extracted_po_number && (
                        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
                          {r.extracted_po_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-zinc-500">
                        {r.supplier_invoice_number || "No inv #"}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {r.created_at
                          ? new Date(r.created_at).toLocaleDateString("en-AU")
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-bold text-white">
                      {fmt(r.actual_total_amount)}
                    </p>
                    {r.po_variance_pct != null && Math.abs(r.po_variance_pct) > 0 && (
                      <p
                        className={`text-[10px] font-mono ${
                          Math.abs(r.po_variance_pct) <= 10
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {r.po_variance_pct > 0 ? "+" : ""}
                        {r.po_variance_pct.toFixed(1)}% vs PO
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium ${cfg.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </div>

                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </motion.div>
              );
            })
          )}
        </div>

        {/* Right: Detail Slide-Over */}
        <AnimatePresence>
          {selectedReceipt && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="w-[480px] flex-shrink-0 bg-zinc-950/60 border border-zinc-800/50 rounded-2xl p-6 overflow-y-auto max-h-[calc(100vh-200px)]"
            >
              {/* Close */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Receipt Detail</h3>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>

              {detailLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                </div>
              ) : (
                <>
                  {/* Receipt Image */}
                  {selectedReceipt.receipt_image_url && (
                    <div className="mb-6 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900">
                      <img
                        src={selectedReceipt.receipt_image_url}
                        alt="Receipt"
                        className="w-full max-h-[300px] object-contain"
                      />
                    </div>
                  )}

                  {/* AI Extraction Data */}
                  <div className="space-y-4 mb-6">
                    <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                      AI Extraction
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50">
                        <p className="text-[10px] uppercase text-zinc-500">Supplier</p>
                        <p className="text-sm font-medium text-white mt-0.5">
                          {selectedReceipt.supplier_name_extracted || "—"}
                        </p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50">
                        <p className="text-[10px] uppercase text-zinc-500">Invoice #</p>
                        <p className="text-sm font-mono text-white mt-0.5">
                          {selectedReceipt.supplier_invoice_number || "—"}
                        </p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50">
                        <p className="text-[10px] uppercase text-zinc-500">Subtotal</p>
                        <p className="text-sm font-mono font-bold text-white mt-0.5">
                          {fmt(selectedReceipt.actual_subtotal)}
                        </p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/50">
                        <p className="text-[10px] uppercase text-zinc-500">GST</p>
                        <p className="text-sm font-mono font-bold text-white mt-0.5">
                          {fmt(selectedReceipt.actual_tax_amount)}
                        </p>
                      </div>
                    </div>

                    {/* Total with prominence */}
                    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase text-zinc-500">Total (Inc GST)</p>
                        {selectedReceipt.ai_confidence != null && (
                          <div
                            className={`flex items-center gap-1 text-[10px] font-mono ${
                              selectedReceipt.ai_confidence >= 0.8
                                ? "text-emerald-400"
                                : selectedReceipt.ai_confidence >= 0.6
                                ? "text-amber-400"
                                : "text-rose-400"
                            }`}
                          >
                            <Brain className="w-3 h-3" />
                            {(selectedReceipt.ai_confidence * 100).toFixed(0)}% confidence
                          </div>
                        )}
                      </div>
                      <p className="text-2xl font-mono font-bold text-white mt-1">
                        {fmt(selectedReceipt.actual_total_amount)}
                      </p>
                    </div>

                    {/* PO Match */}
                    {selectedReceipt.extracted_po_number && (
                      <div
                        className={`rounded-lg p-3 border ${
                          selectedReceipt.match_status === "matched"
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : selectedReceipt.match_status === "variance_flagged"
                            ? "bg-amber-500/5 border-amber-500/20"
                            : "bg-zinc-900/50 border-zinc-800/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {selectedReceipt.match_status === "matched" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : selectedReceipt.match_status === "variance_flagged" ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-zinc-500" />
                          )}
                          <span className="text-sm text-white">
                            PO Match: {selectedReceipt.extracted_po_number}
                          </span>
                        </div>
                        {selectedReceipt.po_variance_amount != null && (
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-xs text-zinc-400">
                              Variance:{" "}
                              <span className="font-mono font-bold text-white">
                                {fmt(selectedReceipt.po_variance_amount)}
                              </span>
                            </span>
                            <span
                              className={`text-xs font-mono ${
                                Math.abs(selectedReceipt.po_variance_pct || 0) <= 10
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                              }`}
                            >
                              ({selectedReceipt.po_variance_pct?.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Model */}
                    {selectedReceipt.ai_model_used && (
                      <p className="text-[10px] text-zinc-600">
                        Extracted by: {selectedReceipt.ai_model_used} · Date:{" "}
                        {selectedReceipt.extracted_date || "—"}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-4 border-t border-zinc-800/50">
                    {selectedReceipt.status === "NEEDS_REVIEW" && (
                      <>
                        <button
                          onClick={handleVerify}
                          disabled={actionLoading === "verify"}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all disabled:opacity-50"
                        >
                          {actionLoading === "verify" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                          Approve & Verify Receipt
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={actionLoading === "reject"}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-rose-400 border border-zinc-800 text-sm font-medium hover:bg-rose-500/10 hover:border-rose-500/30 transition-all disabled:opacity-50"
                        >
                          {actionLoading === "reject" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Reject Receipt
                        </button>
                      </>
                    )}

                    {selectedReceipt.status === "VERIFIED" && (
                      <button
                        onClick={handlePushToXero}
                        disabled={actionLoading === "xero"}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-all disabled:opacity-50"
                      >
                        {actionLoading === "xero" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4" />
                        )}
                        Approve & Push to Xero
                      </button>
                    )}

                    {selectedReceipt.status === "SYNCED_TO_ACCOUNTING" && (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Synced to Xero
                        {selectedReceipt.xero_bill_id && (
                          <span className="font-mono text-[10px] ml-auto">
                            {selectedReceipt.xero_bill_id}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
