"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Send, Copy, Check, Loader2, FileText,
  Eye, ExternalLink, Download, MoreHorizontal, Clock,
  Pen, X,
} from "lucide-react";
import { getQuote, sendQuote, type Quote, type QuoteLineItem } from "@/app/actions/quotes";
import { useToastStore } from "@/components/app/action-toast";
import { ForensicTimeline } from "@/components/finance/forensic-timeline";

/* ── Status config ────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  draft: { label: "Draft", dot: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-600/30" },
  sent: { label: "Sent", dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" },
  viewed: { label: "Viewed", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  accepted: { label: "Approved", dot: "bg-[#00E676]", text: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]", border: "border-[rgba(0,230,118,0.3)]" },
  rejected: { label: "Declined", dot: "bg-red-400", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  expired: { label: "Expired", dot: "bg-zinc-600", text: "text-zinc-600", bg: "bg-zinc-600/10", border: "border-zinc-700/30" },
};

/* ── Page ──────────────────────────────────────────────── */

export default function QuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = params.id as string;
  const { addToast } = useToastStore();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentAnim, setSentAnim] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    getQuote(quoteId).then((res) => {
      if (res.data) setQuote(res.data);
      setLoading(false);
    });
  }, [quoteId]);

  const handleSend = async () => {
    if (!quote || !quote.client_email) {
      addToast("No client email set");
      return;
    }
    setSending(true);
    const result = await sendQuote(quote.id);
    if (result.error) {
      addToast(result.error);
    } else {
      setSentAnim(true);
      setQuote((q) => q ? { ...q, status: "sent" } : q);
      addToast(`${quote.display_id} sent to ${quote.client_email}`);
      setTimeout(() => setSentAnim(false), 2000);
    }
    setSending(false);
  };

  const handleCopyLink = () => {
    if (!quote) return;
    const url = `${window.location.origin}/portal/view/${quote.secure_token}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    addToast("Portal link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <FileText size={24} className="mb-2 text-zinc-700" />
        <p className="text-[13px] text-zinc-500">Quote not found</p>
      </div>
    );
  }

  const sc = statusConfig[quote.status] || statusConfig.draft;
  const lineItems = quote.line_items || [];

  return (
    <div className="flex h-full flex-col">
      {/* Send animation */}
      <AnimatePresence>
        {sentAnim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 1, y: 0, opacity: 1 }}
              animate={{ scale: 0.3, y: -300, x: 300, opacity: 0, rotate: -15 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2 rounded-xl bg-[#00E676]/20 px-6 py-4 text-[#00E676] backdrop-blur-sm"
            >
              <Send size={24} />
              <span className="text-lg font-medium">Sent!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/finance")}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-mono text-[13px] text-zinc-400">{quote.display_id}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${sc.bg} ${sc.text} ${sc.border}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
            {sc.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] px-2.5 py-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {copied ? <Check size={11} className="text-[#00E676]" /> : <Copy size={11} />}
            Copy Link
          </button>
          {quote.status === "draft" && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#00E676] to-emerald-600 px-3 py-1.5 text-[12px] font-medium text-black shadow-[0_0_20px_-5px_rgba(0,230,118,0.3)]"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Send to Client
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main document */}
        <div className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-3xl px-6 py-8"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-8 backdrop-blur-sm">
              {/* Title */}
              {quote.title && (
                <h2 className="mb-1 text-[18px] font-medium tracking-tight text-[#EDEDED]">
                  {quote.title}
                </h2>
              )}

              {/* Client info */}
              <div className="mb-8 grid grid-cols-2 gap-6 border-b border-white/[0.06] pb-6">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Bill To</p>
                  <p className="mt-1 text-[13px] text-zinc-300">{quote.client_name || "—"}</p>
                  {quote.client_email && <p className="text-[12px] text-zinc-500">{quote.client_email}</p>}
                  {quote.client_address && <p className="text-[12px] text-zinc-600">{quote.client_address}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Details</p>
                  <p className="mt-1 text-[12px] text-zinc-400">Issued: {formatDate(quote.issue_date)}</p>
                  <p className="text-[12px] text-zinc-400">Valid Until: {formatDate(quote.valid_until)}</p>
                  <p className="text-[12px] text-zinc-500">Terms: {quote.terms || "Net 14"}</p>
                </div>
              </div>

              {/* Line Items */}
              <div className="mb-6">
                <div className="mb-2 grid grid-cols-12 gap-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {lineItems.map((item: QuoteLineItem) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 border-t border-white/[0.04] py-3 text-[13px]">
                    <div className="col-span-6 text-zinc-300">{item.description}</div>
                    <div className="col-span-2 text-right tabular-nums text-zinc-500">{item.quantity}</div>
                    <div className="col-span-2 text-right tabular-nums text-zinc-500">${Number(item.unit_price).toFixed(2)}</div>
                    <div className="col-span-2 text-right tabular-nums text-zinc-200">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-white/[0.06] pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-zinc-500">Subtotal</span>
                      <span className="tabular-nums text-zinc-300">${Number(quote.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-zinc-500">Tax ({quote.tax_rate}%)</span>
                      <span className="tabular-nums text-zinc-300">${Number(quote.tax).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/[0.08] pt-2 text-[15px] font-medium">
                      <span className="text-zinc-300">Total</span>
                      <span className="tabular-nums text-[#00E676]">${Number(quote.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {quote.notes && (
                <div className="mt-6 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Notes</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{quote.notes}</p>
                </div>
              )}

              {/* Signature (if signed) */}
              {quote.signature_url && (
                <div className="mt-6 border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Client Signature</p>
                  <div className="mt-2 flex items-center gap-4">
                    <img src={quote.signature_url} alt="Signature" className="h-12 invert" />
                    <div>
                      <p className="text-[12px] text-zinc-300">{quote.signed_by}</p>
                      <p className="text-[10px] text-zinc-600">{formatDate(quote.signed_at)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Invoice */}
              {quote.invoice_id && (
                <div className="mt-6 flex items-center gap-2 rounded-lg border border-[rgba(0,230,118,0.15)] bg-[rgba(0,230,118,0.04)] px-4 py-3">
                  <FileText size={14} className="text-[#00E676]" />
                  <span className="text-[12px] text-zinc-300">Invoice created from this quote</span>
                  <button
                    onClick={() => router.push(`/dashboard/finance/invoices/${quote.invoice_id}`)}
                    className="ml-auto flex items-center gap-1 text-[11px] text-[#00E676] transition-colors hover:underline"
                  >
                    View Invoice <ExternalLink size={10} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Forensic Timeline Sidebar */}
        <div className="w-72 shrink-0 overflow-y-auto border-l border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] px-4 py-6">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
            <Eye size={11} />
            Activity Trail
          </div>
          <ForensicTimeline docType="quote" docId={quoteId} />
        </div>
      </div>
    </div>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
