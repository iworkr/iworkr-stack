/**
 * @page /dashboard/ops/purchase-orders
 * @status COMPLETE
 * @description Purchase order management with status workflow and supplier push
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import {
  getPurchaseOrders,
  getPurchaseOrderDetail,
  updatePurchaseOrderStatus,
  pushPOToSupplier,
} from "@/app/actions/forge-link";
import {
  Package,
  ShoppingCart,
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Send,
  Eye,
  ChevronRight,
  Filter,
  Search,
  X,
  ExternalLink,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface PurchaseOrder {
  id: string;
  display_id: string;
  supplier: string;
  supplier_name: string;
  supplier_account: string | null;
  status: string;
  source_quote_id: string | null;
  source_job_id: string | null;
  delivery_method: string | null;
  delivery_branch: string | null;
  external_order_id: string | null;
  external_status: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  purchase_order_lines: { count: number }[];
}

interface POLine {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  uom: string;
  quantity_received: number;
  received_at: string | null;
}

interface PODetail extends PurchaseOrder {
  lines: POLine[];
  delivery_address: string | null;
  delivery_notes: string | null;
  delivery_branch_id: string | null;
  created_by: string | null;
  approved_by: string | null;
}

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "APPROVED", label: "Approved" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "RECEIVED", label: "Received" },
  { key: "CANCELLED", label: "Cancelled" },
];

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; icon: typeof Clock }
> = {
  DRAFT: {
    bg: "bg-zinc-500/10 border-zinc-500/20",
    text: "text-zinc-400",
    icon: Clock,
  },
  PENDING_APPROVAL: {
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-400",
    icon: Clock,
  },
  APPROVED: {
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-400",
    icon: CheckCircle,
  },
  SUBMITTED: {
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
    icon: Send,
  },
  ACKNOWLEDGED: {
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
    icon: Truck,
  },
  PARTIALLY_RECEIVED: {
    bg: "bg-blue-500/10 border-blue-500/20",
    text: "text-blue-400",
    icon: Package,
  },
  RECEIVED: {
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-400",
    icon: CheckCircle,
  },
  CANCELLED: {
    bg: "bg-rose-500/10 border-rose-500/20",
    text: "text-rose-400",
    icon: X,
  },
};

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
      }).format(v)
    : "—";

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-AU") : "—";

/* ═══════════════════════════════════════════════════════════
   GhostBadge
   ═══════════════════════════════════════════════════════════ */

function GhostBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  const Icon = s.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide border r-badge ${s.bg} ${s.text}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Telemetry Ribbon
   ═══════════════════════════════════════════════════════════ */

function TelemetryRibbon({ orders }: { orders: PurchaseOrder[] }) {
  const stats = [
    {
      label: "Total POs",
      value: orders.length,
      icon: Package,
      color: "text-[var(--text-primary)]",
      bg: "bg-[var(--surface-2)]",
    },
    {
      label: "Draft",
      value: orders.filter((o) => o.status === "DRAFT").length,
      icon: Clock,
      color: "text-zinc-400",
      bg: "bg-zinc-500/10",
    },
    {
      label: "Submitted",
      value: orders.filter(
        (o) => o.status === "SUBMITTED" || o.status === "ACKNOWLEDGED"
      ).length,
      icon: Send,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Received",
      value: orders.filter(
        (o) => o.status === "RECEIVED" || o.status === "PARTIALLY_RECEIVED"
      ).length,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 bg-[var(--surface-1)] border border-[var(--border-base)] r-card px-4 py-3"
        >
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.bg}`}
          >
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
          <div>
            <p className="stealth-overline text-[10px] text-[var(--text-muted)]">
              {stat.label}
            </p>
            <p className="text-lg font-semibold font-mono text-[var(--text-primary)]">
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Push Confirmation Modal
   ═══════════════════════════════════════════════════════════ */

function PushConfirmModal({
  po,
  pushing,
  onConfirm,
  onCancel,
}: {
  po: PODetail;
  pushing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", duration: 0.35 }}
        className="bg-[var(--surface-1)] border border-[var(--border-base)] r-card w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Push to Supplier Portal
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              This will submit the order via B2B API
            </p>
          </div>
        </div>

        <div className="bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">PO</span>
            <span className="font-mono text-[var(--text-primary)]">
              {po.display_id}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Supplier</span>
            <span className="text-[var(--text-primary)]">
              {po.supplier_name}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)]">Items</span>
            <span className="font-mono text-[var(--text-primary)]">
              {po.lines.length}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-[var(--border-base)] pt-2 mt-2">
            <span className="text-[var(--text-muted)] font-medium">Total</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {fmt(po.total)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2 mb-5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            This action cannot be undone. The order will be placed with{" "}
            {po.supplier_name}.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={pushing}
            className="stealth-btn-ghost text-xs px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pushing}
            className="stealth-btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
          >
            {pushing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShoppingCart className="w-3.5 h-3.5" />
            )}
            {pushing ? "Submitting…" : "Confirm & Push"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Detail Slide-Over Panel
   ═══════════════════════════════════════════════════════════ */

function DetailPanel({
  detail,
  loading,
  onClose,
  onApprove,
  onCancel,
  onPush,
  actionLoading,
}: {
  detail: PODetail | null;
  loading: boolean;
  onClose: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onPush: () => void;
  actionLoading: boolean;
}) {
  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-full md:w-[540px] lg:w-[620px] bg-[#0A0A0A] border-l border-[var(--border-base)] z-40 flex flex-col shadow-2xl"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-base)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="stealth-btn-ghost p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
          {detail && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {detail.display_id}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                {detail.supplier_name}
              </p>
            </div>
          )}
        </div>
        {detail && <GhostBadge status={detail.status} />}
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : detail ? (
          <div className="p-5 space-y-6">
            {/* ── PO Info Grid ─────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <InfoCell label="Supplier" value={detail.supplier_name} />
              <InfoCell
                label="Account"
                value={detail.supplier_account || "—"}
                mono
              />
              <InfoCell label="Delivery" value={detail.delivery_method || "—"} />
              <InfoCell
                label="Branch"
                value={detail.delivery_branch || "—"}
              />
              <InfoCell
                label="Created"
                value={fmtDate(detail.created_at)}
              />
              <InfoCell
                label="Submitted"
                value={fmtDate(detail.submitted_at)}
              />
              {detail.source_quote_id && (
                <InfoCell
                  label="Source Quote"
                  value={detail.source_quote_id.slice(0, 8) + "…"}
                  mono
                />
              )}
              {detail.external_order_id && (
                <div className="col-span-2">
                  <p className="stealth-overline text-[10px] text-[var(--text-muted)] mb-1">
                    External Order ID
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-emerald-400 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg inline-flex items-center gap-1.5">
                      <ExternalLink className="w-3 h-3" />
                      {detail.external_order_id}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Financial Summary ────────────────── */}
            <div className="bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[var(--text-muted)]">Subtotal</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {fmt(detail.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[var(--text-muted)]">Tax (GST)</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {fmt(detail.tax)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-[var(--border-base)]">
                <span className="text-[var(--text-primary)]">Total</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {fmt(detail.total)}
                </span>
              </div>
            </div>

            {/* ── Line Items ──────────────────────── */}
            <div>
              <h3 className="stealth-overline text-[10px] text-[var(--text-muted)] mb-3">
                LINE ITEMS ({detail.lines.length})
              </h3>
              <div className="border border-[var(--border-base)] rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[var(--surface-2)]">
                      <th className="text-left px-3 py-2.5 font-medium text-[var(--text-muted)]">
                        SKU
                      </th>
                      <th className="text-left px-3 py-2.5 font-medium text-[var(--text-muted)]">
                        Name
                      </th>
                      <th className="text-right px-3 py-2.5 font-medium text-[var(--text-muted)]">
                        Qty
                      </th>
                      <th className="text-right px-3 py-2.5 font-medium text-[var(--text-muted)]">
                        Unit Cost
                      </th>
                      <th className="text-right px-3 py-2.5 font-medium text-[var(--text-muted)]">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line, i) => (
                      <tr
                        key={line.id}
                        className={`border-t border-[var(--border-base)] ${
                          i % 2 === 0 ? "" : "bg-white/[0.01]"
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-[var(--text-muted)]">
                          {line.sku}
                        </td>
                        <td className="px-3 py-2.5 text-[var(--text-primary)] max-w-[180px] truncate">
                          {line.name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-primary)]">
                          {line.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[var(--text-primary)]">
                          {fmt(line.unit_cost)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium text-[var(--text-primary)]">
                          {fmt(line.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Notes ───────────────────────────── */}
            {detail.notes && (
              <div>
                <h3 className="stealth-overline text-[10px] text-[var(--text-muted)] mb-2">
                  NOTES
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg px-3 py-2.5">
                  {detail.notes}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Panel Footer — Actions */}
      {detail && (
        <div className="px-5 py-4 border-t border-[var(--border-base)]">
          {detail.status === "DRAFT" && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={actionLoading}
                className="stealth-btn-ghost text-xs flex items-center gap-1.5 px-4 py-2 text-rose-400 hover:text-rose-300"
              >
                <X className="w-3.5 h-3.5" />
                Cancel PO
              </button>
              <button
                onClick={onApprove}
                disabled={actionLoading}
                className="stealth-btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
              >
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Approve
              </button>
            </div>
          )}

          {detail.status === "APPROVED" && (
            <div className="flex items-center justify-end">
              <button
                onClick={onPush}
                disabled={actionLoading}
                className="stealth-btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
              >
                {actionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShoppingCart className="w-3.5 h-3.5" />
                )}
                Push to Supplier Portal
              </button>
            </div>
          )}

          {(detail.status === "SUBMITTED" ||
            detail.status === "ACKNOWLEDGED") && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                <span className="text-xs text-emerald-400 font-medium">
                  Order submitted to supplier
                </span>
              </div>
              {detail.external_order_id && (
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  Ref: {detail.external_order_id}
                </span>
              )}
            </div>
          )}

          {detail.status === "RECEIVED" && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">
                Fully received
              </span>
            </div>
          )}

          {detail.status === "CANCELLED" && (
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-rose-400" />
              <span className="text-xs text-rose-400 font-medium">
                Cancelled
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function InfoCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="stealth-overline text-[10px] text-[var(--text-muted)] mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════ */

export default function PurchaseOrdersPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const orgId = org?.id;

  /* ── State ─────────────────────────────────── */
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PODetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Push confirmation modal
  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const [pushing, setPushing] = useState(false);

  /* ── Load Orders ───────────────────────────── */
  const loadOrders = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const result = await getPurchaseOrders(
      orgId,
      statusFilter || undefined
    );
    if (result.data) setOrders(result.data as PurchaseOrder[]);
    setLoading(false);
  }, [orgId, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  /* ── Load Detail ───────────────────────────── */
  const loadDetail = useCallback(
    async (poId: string) => {
      if (!orgId) return;
      setSelectedId(poId);
      setDetailLoading(true);
      const result = await getPurchaseOrderDetail(poId, orgId);
      if (result.data) setDetail(result.data as PODetail);
      setDetailLoading(false);
    },
    [orgId]
  );

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  /* ── Actions ───────────────────────────────── */
  const handleApprove = async () => {
    if (!orgId || !detail) return;
    setActionLoading(true);
    await updatePurchaseOrderStatus(detail.id, orgId, "APPROVED");
    await loadOrders();
    await loadDetail(detail.id);
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!orgId || !detail) return;
    setActionLoading(true);
    await updatePurchaseOrderStatus(detail.id, orgId, "CANCELLED");
    await loadOrders();
    await loadDetail(detail.id);
    setActionLoading(false);
  };

  const handlePushRequest = () => {
    setShowPushConfirm(true);
  };

  const handlePushConfirm = async () => {
    if (!orgId || !detail) return;
    setPushing(true);
    const result = await pushPOToSupplier(detail.id, orgId);
    setPushing(false);
    setShowPushConfirm(false);

    if (!result.error) {
      await loadOrders();
      await loadDetail(detail.id);
    }
  };

  /* ── Filter orders by search ───────────────── */
  const filteredOrders = orders.filter((po) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      po.display_id.toLowerCase().includes(q) ||
      po.supplier_name.toLowerCase().includes(q) ||
      po.supplier.toLowerCase().includes(q) ||
      (po.external_order_id?.toLowerCase().includes(q) ?? false)
    );
  });

  /* ── Render ────────────────────────────────── */
  return (
    <div className="stealth-page-canvas">
      {/* ── Header ──────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-[var(--brand-primary)]" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Purchase Orders
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Forge-Link · Supplier procurement & B2B ordering
            </p>
          </div>
        </div>
      </div>

      {/* ── Telemetry Ribbon ────────────────── */}
      {!loading && <TelemetryRibbon orders={orders} />}

      {/* ── Search + Filter Tabs ────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search POs, suppliers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-[var(--text-muted)] mr-1 flex-shrink-0" />
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`stealth-tab text-xs whitespace-nowrap px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === tab.key
                  ? "text-[var(--text-primary)] bg-[var(--surface-2)] border-b-2 border-[var(--brand-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PO List ─────────────────────────── */}
      <div className="px-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] bg-[var(--surface-1)] border border-[var(--border-base)] r-card animate-[skeleton-shimmer_1.5s_infinite]"
              />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No purchase orders found</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              {search
                ? "Try adjusting your search query"
                : statusFilter
                  ? "No POs with this status yet"
                  : "Purchase orders will appear here when generated from accepted quotes"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block border border-[var(--border-base)] rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface-2)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      PO #
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      Supplier
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      Items
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      Total
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      Created
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)] text-xs">
                      Ext. Order
                    </th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((po, i) => (
                    <motion.tr
                      key={po.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => loadDetail(po.id)}
                      className={`border-t border-[var(--border-base)] cursor-pointer transition-colors hover:bg-[var(--surface-2)] ${
                        selectedId === po.id ? "bg-[var(--surface-2)]" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[var(--text-primary)]">
                        {po.display_id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-[var(--surface-2)] border border-[var(--border-base)] rounded text-[var(--text-muted)]">
                            {po.supplier}
                          </span>
                          <span className="text-xs text-[var(--text-primary)] truncate max-w-[140px]">
                            {po.supplier_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <GhostBadge status={po.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-[var(--text-muted)]">
                        {po.purchase_order_lines?.[0]?.count ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-[var(--text-primary)]">
                        {fmt(po.total)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                        {fmtDate(po.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {po.external_order_id ? (
                          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {po.external_order_id}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {filteredOrders.map((po, i) => (
                <motion.button
                  key={po.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => loadDetail(po.id)}
                  className={`w-full text-left bg-[var(--surface-1)] border border-[var(--border-base)] r-card px-4 py-3 hover:border-[var(--border-active)] transition-colors ${
                    selectedId === po.id
                      ? "border-[var(--brand-primary)]/30"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
                        {po.display_id}
                      </span>
                      <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide bg-[var(--surface-2)] border border-[var(--border-base)] rounded text-[var(--text-muted)]">
                        {po.supplier}
                      </span>
                    </div>
                    <GhostBadge status={po.status} />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)]">
                      {po.supplier_name}
                    </span>
                    <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
                      {fmt(po.total)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {fmtDate(po.created_at)}
                      {po.submitted_at && (
                        <span className="ml-2">
                          · Submitted {fmtDate(po.submitted_at)}
                        </span>
                      )}
                    </span>
                    {po.external_order_id && (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                        <ExternalLink className="w-2.5 h-2.5" />
                        {po.external_order_id}
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Slide-Over ───────────────── */}
      <AnimatePresence>
        {selectedId && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetail}
              className="fixed inset-0 z-30 bg-black/40 md:bg-transparent"
            />
            <DetailPanel
              detail={detail}
              loading={detailLoading}
              onClose={closeDetail}
              onApprove={handleApprove}
              onCancel={handleCancel}
              onPush={handlePushRequest}
              actionLoading={actionLoading}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Push Confirmation Modal ─────────── */}
      <AnimatePresence>
        {showPushConfirm && detail && (
          <PushConfirmModal
            po={detail}
            pushing={pushing}
            onConfirm={handlePushConfirm}
            onCancel={() => setShowPushConfirm(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
