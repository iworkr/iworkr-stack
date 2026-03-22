/**
 * @page /dashboard/finance/supplier-invoices
 * @status COMPLETE
 * @description Supplier invoice inbox with OCR upload, approval, and line mapping
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Search, Upload, CheckCircle2, AlertCircle, Clock,
  XCircle, Eye, ChevronRight, RefreshCw, Bot, ArrowRight,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getSupplierInvoices, getSupplierInvoiceDetail,
  approveSupplierInvoice, rejectSupplierInvoice,
  mapInvoiceLine, uploadSupplierInvoice,
} from "@/app/actions/hephaestus";

/* ── Types ────────────────────────────────────────── */

interface SupplierInvoice {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | null;
  processing_status: string;
  math_check_passed: boolean | null;
  ai_confidence: number | null;
  created_at: string;
  pdf_url: string | null;
}

interface InvoiceLine {
  id: string;
  raw_sku: string | null;
  raw_description: string;
  raw_quantity: number;
  raw_unit_cost: number;
  raw_total: number | null;
  match_status: string;
  matched_inventory_id: string | null;
  match_confidence: number | null;
  match_method: string | null;
  cost_variance_pct: number | null;
  cost_anomaly: boolean;
  inventory_items: {
    id: string;
    name: string;
    sku: string | null;
    moving_average_cost: number;
  } | null;
}

interface InvoiceDetail extends SupplierInvoice {
  lines: InvoiceLine[];
  subtotal_amount: number | null;
  tax_amount: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

/* ── Page ─────────────────────────────────────────── */

export default function SupplierInvoicesPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orgId = org?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const result = await getSupplierInvoices(orgId, {
      status: statusFilter || undefined,
    });
    if (result.data) setInvoices(result.data);
    setLoading(false);
  }, [orgId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = async (invoiceId: string) => {
    if (!orgId) return;
    setDetailLoading(true);
    const result = await getSupplierInvoiceDetail(orgId, invoiceId);
    if (result.data) setSelectedInvoice(result.data as InvoiceDetail);
    setDetailLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadSupplierInvoice(orgId, formData);
    setUploading(false);

    if (!result.error) {
      load();
      if (result.data?.invoice_id) {
        loadDetail(result.data.invoice_id);
      }
    }
  };

  const handleApprove = async () => {
    if (!orgId || !selectedInvoice) return;
    await approveSupplierInvoice(orgId, selectedInvoice.id);
    load();
    setSelectedInvoice(null);
  };

  const handleReject = async () => {
    if (!orgId || !selectedInvoice) return;
    await rejectSupplierInvoice(orgId, selectedInvoice.id);
    load();
    setSelectedInvoice(null);
  };

  const formatMoney = (v: number | null) =>
    v != null
      ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v)
      : "—";

  return (
    <div className="stealth-page-canvas">
      {/* ── Header ─────────────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Supplier Invoice Triage
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              AI-parsed invoices · Review, match, and sync to inventory
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="stealth-btn-primary text-xs flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Processing..." : "Upload Invoice PDF"}
          </button>
        </div>
      </div>

      {/* ── Status Filters ─────────────────────────── */}
      <div className="flex items-center gap-2 px-4 mb-4">
        {["", "NEEDS_REVIEW", "PENDING_AI", "SYNCED", "REJECTED"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`stealth-tab text-xs ${statusFilter === status ? "text-[var(--text-primary)] border-b-2 border-[var(--brand-primary)]" : ""}`}
          >
            {status === "" ? "All" : status.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* ── Split Pane Layout ──────────────────────── */}
      <div className="flex h-[calc(100vh-200px)] px-4 gap-3">
        {/* Left: Invoice List */}
        <div className="w-1/3 border border-[var(--border-base)] r-card overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <Bot className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No supplier invoices</p>
              <p className="text-xs mt-1">Upload a PDF to get started</p>
            </div>
          ) : (
            invoices.map((inv) => (
              <button
                key={inv.id}
                onClick={() => loadDetail(inv.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--border-base)] hover:bg-[var(--surface-2)] transition-colors ${
                  selectedInvoice?.id === inv.id ? "bg-[var(--surface-2)]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {inv.supplier_name || "Unknown Supplier"}
                  </span>
                  <InvoiceStatusPill status={inv.processing_status} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {inv.invoice_number || "No number"}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-primary)]">
                    {formatMoney(inv.total_amount)}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">
                  {new Date(inv.created_at).toLocaleDateString("en-AU")}
                  {inv.ai_confidence != null && (
                    <span className="ml-2">AI: {inv.ai_confidence}%</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Right: Detail / Triage Pane */}
        <div className="flex-1 border border-[var(--border-base)] r-card overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : selectedInvoice ? (
            <div className="p-4">
              {/* Invoice Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {selectedInvoice.supplier_name}
                  </h2>
                  <p className="text-sm text-[var(--text-muted)] font-mono mt-0.5">
                    {selectedInvoice.invoice_number}
                  </p>
                  {!selectedInvoice.math_check_passed && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Math check failed — line items do not sum to total
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">
                    {formatMoney(selectedInvoice.total_amount)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {selectedInvoice.invoice_date && (
                      <span>Dated: {new Date(selectedInvoice.invoice_date).toLocaleDateString("en-AU")}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items Grid */}
              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="stealth-table-header">
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Description</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">SKU</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--text-muted)]">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--text-muted)]">Unit $</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--text-muted)]">Variance</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Matched To</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.lines.map((line) => (
                    <tr
                      key={line.id}
                      className={`stealth-table-row ${
                        line.cost_anomaly ? "bg-rose-500/[0.03]" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <LineMatchPill status={line.match_status} />
                      </td>
                      <td className="px-3 py-2 text-[var(--text-primary)]">
                        {line.raw_description}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                        {line.raw_sku || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--text-primary)]">
                        {line.raw_quantity}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--text-primary)]">
                        {formatMoney(line.raw_unit_cost)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {line.cost_variance_pct != null ? (
                          <span className={
                            Math.abs(line.cost_variance_pct) > 50
                              ? "text-rose-400 font-semibold"
                              : line.cost_variance_pct > 0
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }>
                            {line.cost_variance_pct > 0 ? "+" : ""}
                            {line.cost_variance_pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {line.inventory_items ? (
                          <span className="text-[var(--text-primary)]">
                            {line.inventory_items.name}
                          </span>
                        ) : (
                          <span className="text-amber-400 italic">Needs mapping</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Action Bar */}
              {selectedInvoice.processing_status === "NEEDS_REVIEW" && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-base)]">
                  <button
                    onClick={handleReject}
                    className="stealth-btn-ghost text-xs flex items-center gap-1.5 text-rose-400"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    className="stealth-btn-primary text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve & Update Inventory
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <Eye className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Select an invoice to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────── */

function InvoiceStatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
    PENDING_AI: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", icon: Bot },
    NEEDS_REVIEW: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", icon: AlertCircle },
    SYNCED: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", icon: CheckCircle2 },
    REJECTED: { bg: "bg-rose-500/10 border-rose-500/20", text: "text-rose-400", icon: XCircle },
    FAILED: { bg: "bg-rose-500/10 border-rose-500/20", text: "text-rose-400", icon: XCircle },
  };

  const s = styles[status] || styles.PENDING_AI;
  const Icon = s.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border r-badge ${s.bg} ${s.text}`}>
      <Icon className="w-2.5 h-2.5" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function LineMatchPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    AUTO_MATCHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FUZZY_MATCHED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    CONFIRMED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    NEEDS_MAPPING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium tracking-wide border r-badge ${styles[status] || styles.NEEDS_MAPPING}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
