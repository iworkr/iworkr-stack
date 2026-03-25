/**
 * @page /portal/c/[slug]/quotes
 * @status COMPLETE
 * @description Trades portal quote listing — pending/approved quotes with one-click accept flow
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Eye, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalQuotes, type PortalQuote } from "@/app/actions/portal-client";

function fmtMoney(n: number) {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalQuotesPage() {
  const tenant = usePortalStore((s) => s.activeTenant);
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const [quotes, setQuotes] = useState<PortalQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!tenant?.workspace_id) return;
    setLoading(true);
    getPortalQuotes(tenant.workspace_id, activeEntityId || undefined).then((result) => {
      setQuotes(result.quotes);
      setLoading(false);
    });
  }, [tenant?.workspace_id, activeEntityId]);

  const filtered = quotes.filter((q) => {
    if (filter === "pending") return ["sent", "viewed"].includes(q.status);
    if (filter === "accepted") return q.status === "accepted";
    if (filter === "rejected") return q.status === "rejected";
    return true;
  });

  const STATUS_ICON: Record<string, React.ReactNode> = {
    sent: <Eye size={12} className="text-sky-400" />,
    viewed: <Eye size={12} className="text-amber-400" />,
    accepted: <Check size={12} className="text-emerald-400" />,
    rejected: <X size={12} className="text-red-400" />,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Quotes</h1>
          <p className="text-[12px] text-zinc-500">Review and approve estimates from {tenant?.name}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "pending", "accepted", "rejected"] as const).map((f) => (
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
          <FileText size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400">No quotes found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quote, i) => (
            <motion.div
              key={quote.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                href={quote.secure_token ? `/portal/view/${quote.secure_token}` : "#"}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5 transition hover:border-white/[0.12]"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${brandColor}12` }}
                  >
                    <FileText size={16} style={{ color: brandColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-zinc-200">{quote.display_id}</p>
                    <p className="truncate text-[12px] text-zinc-500">{quote.title || "Untitled Quote"}</p>
                    <p className="text-[11px] text-zinc-600">Valid until {fmtDate(quote.valid_until)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-semibold tabular-nums" style={{ color: brandColor }}>
                    ${fmtMoney(Number(quote.total))}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 justify-end">
                    {STATUS_ICON[quote.status]}
                    <span className="text-[11px] capitalize text-zinc-500">{quote.status}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
