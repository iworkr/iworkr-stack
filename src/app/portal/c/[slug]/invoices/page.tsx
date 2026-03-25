/**
 * @page /portal/c/[slug]/invoices
 * @status COMPLETE
 * @description Trades portal invoice listing with Stripe payment integration.
 *   Embeds payment links and shows real-time status from Stripe Connect.
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Receipt, CreditCard, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalInvoices, type PortalInvoice } from "@/app/actions/portal-client";

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalInvoicesPage() {
  const tenant = usePortalStore((s) => s.activeTenant);
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "outstanding" | "paid">("all");
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!tenant?.workspace_id) return;
    setLoading(true);
    getPortalInvoices(tenant.workspace_id, activeEntityId || undefined).then((result) => {
      setInvoices(result.invoices);
      setLoading(false);
    });
  }, [tenant?.workspace_id, activeEntityId]);

  const filtered = invoices.filter((inv) => {
    if (filter === "outstanding") return ["sent", "overdue", "viewed"].includes(inv.status);
    if (filter === "paid") return inv.status === "paid";
    return true;
  });

  const totalOutstanding = invoices
    .filter((i) => ["sent", "overdue", "viewed"].includes(i.status))
    .reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Invoices</h1>
          <p className="text-[12px] text-zinc-500">
            View and pay invoices from {tenant?.name}
          </p>
        </div>
        {totalOutstanding > 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-zinc-900/50 px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total Outstanding</p>
            <p className="text-lg font-semibold tabular-nums" style={{ color: brandColor }}>
              ${fmtMoney(totalOutstanding)}
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "outstanding", "paid"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition ${
              filter === f
                ? "text-white"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
            style={filter === f ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-12 text-center">
          <Receipt size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv, i) => {
            const isPayable = ["sent", "overdue", "viewed"].includes(inv.status);
            const isPaid = inv.status === "paid";
            const isOverdue = inv.status === "overdue";

            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5 transition hover:border-white/[0.12]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: isPaid ? "rgba(16,185,129,0.1)" : isOverdue ? "rgba(239,68,68,0.1)" : `${brandColor}12` }}
                    >
                      {isPaid ? (
                        <CheckCircle size={16} className="text-emerald-400" />
                      ) : isOverdue ? (
                        <AlertCircle size={16} className="text-red-400" />
                      ) : (
                        <Receipt size={16} style={{ color: brandColor }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-zinc-200">{inv.display_id}</p>
                      <p className="truncate text-[12px] text-zinc-500">{inv.client_name || "Invoice"}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-600">
                        <span>Due {fmtDate(inv.due_date)}</span>
                        {isPaid && inv.paid_date && <span>Paid {fmtDate(inv.paid_date)}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="text-[16px] font-semibold tabular-nums" style={{ color: isPaid ? "#10B981" : isOverdue ? "#EF4444" : brandColor }}>
                      ${fmtMoney(Number(inv.total))}
                    </p>
                    <div className="flex items-center gap-2">
                      {inv.secure_token && (
                        <Link
                          href={`/portal/view/${inv.secure_token}`}
                          className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                        >
                          View
                        </Link>
                      )}
                      {isPayable && (
                        <Link
                          href={`/pay/${inv.id}`}
                          className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-medium text-black"
                          style={{ backgroundColor: brandColor }}
                        >
                          <CreditCard size={12} />
                          Pay Now
                        </Link>
                      )}
                      {isPaid && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                          <CheckCircle size={10} /> Paid
                        </span>
                      )}
                      {isOverdue && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-400">
                          <Clock size={10} /> Overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
