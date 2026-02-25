"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Check, X, Send, Download, CreditCard, AlertCircle,
  Clock, Shield, ChevronDown, Loader2, CheckCircle, PartyPopper,
} from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getDocumentByToken, approveQuote, rejectQuote } from "@/app/actions/quotes";

/* ── Confetti ──────────────────────────────────────────── */

function ConfettiParticle({ delay, left }: { delay: number; left: number }) {
  const color = useMemo(() => {
    const c = ["#00E676", "#fff", "#00C853", "#A5D6A7", "#69F0AE"];
    return c[Math.floor(Math.random() * c.length)];
  }, []);
  const size = useMemo(() => 4 + Math.random() * 6, []);
  return (
    <motion.div
      initial={{ y: -20, opacity: 1 }}
      animate={{ y: [0, 400], x: [(Math.random() - 0.5) * 200], opacity: [1, 1, 0], rotate: [0, Math.random() * 720] }}
      transition={{ duration: 2 + Math.random(), delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: "absolute", left: `${left}%`, top: 0, width: size, height: size, backgroundColor: color, borderRadius: Math.random() > 0.5 ? "50%" : "2px" }}
    />
  );
}

/* ── Signature Pad ─────────────────────────────────────── */

function SignaturePad({ onSave, onCancel }: { onSave: (data: string, name: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [name, setName] = useState("");

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDrawing(true);
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }, [drawing]);

  const stopDraw = useCallback(() => setDrawing(false), []);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6"
      >
        <h3 className="mb-4 text-[15px] font-medium text-zinc-200">Sign to Approve</h3>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-zinc-500">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-zinc-200 outline-none focus:border-[#00E676]/30"
          />
        </div>

        <label className="mb-1 block text-[11px] text-zinc-500">Signature</label>
        <canvas
          ref={canvasRef}
          width={380}
          height={150}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          className="w-full cursor-crosshair rounded-lg border border-white/10 bg-zinc-950"
          style={{ touchAction: "none" }}
        />

        <div className="mt-4 flex items-center justify-between">
          <button onClick={clear} className="text-[12px] text-zinc-500 hover:text-zinc-300">Clear</button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-lg px-4 py-2 text-[12px] text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button
              onClick={() => {
                if (!hasSignature || !name.trim()) return;
                onSave(canvasRef.current!.toDataURL(), name);
              }}
              disabled={!hasSignature || !name.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#00E676] px-4 py-2 text-[12px] font-medium text-black disabled:opacity-40"
            >
              <Check size={12} /> Approve & Sign
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Portal Page ──────────────────────────────────── */

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<"quote" | "invoice" | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [orgName, setOrgName] = useState("");
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [actionDone, setActionDone] = useState<"approved" | "rejected" | "paid" | null>(null);

  const confettiParticles = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({ id: i, delay: Math.random() * 0.5, left: Math.random() * 100 })), []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const result = await getDocumentByToken(token);
      if (result.error || !result.type) {
        setError(result.error || "Document not found");
      } else {
        setDocType(result.type);
        setDoc(result.data);
        setLineItems(result.lineItems);
        setOrgName(result.orgName);
        setOrgLogo(result.orgLogo);
      }
      setLoading(false);
    })();
  }, [token]);

  // Handle payment success return
  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      setShowConfetti(true);
      setActionDone("paid");
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [searchParams]);

  const handleApprove = async (signatureData: string, signerName: string) => {
    setSubmitting(true);
    setSignatureOpen(false);
    const result = await approveQuote(token, signatureData, signerName);
    if (result.error) {
      setError(result.error);
    } else {
      setActionDone("approved");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      // Reload to show invoice view
      if (result.invoiceToken) {
        setTimeout(() => {
          window.location.href = `/portal/view/${result.invoiceToken}`;
        }, 2500);
      }
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    await rejectQuote(token, rejectReason);
    setActionDone("rejected");
    setRejectOpen(false);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
        <Shield size={32} className="mb-4 text-zinc-700" />
        <h1 className="text-xl font-medium text-zinc-300">Document Not Found</h1>
        <p className="mt-2 text-[13px] text-zinc-600">This link may have expired or is invalid.</p>
      </div>
    );
  }

  const isPaid = doc.status === "paid" || actionDone === "paid";
  const isApproved = doc.status === "accepted" || actionDone === "approved";
  const isRejected = doc.status === "rejected" || actionDone === "rejected";
  const isQuote = docType === "quote";

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#00E676]/30">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
            {confettiParticles.map((p) => (
              <ConfettiParticle key={p.id} delay={p.delay} left={p.left} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            {orgLogo && <img src={orgLogo} alt="" className="h-6 w-6 rounded object-contain" />}
            <span className="text-[13px] text-zinc-400">{orgName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <Shield size={10} /> Secure Document
          </div>
        </div>
      </header>

      {/* Document */}
      <main className="mx-auto max-w-3xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 p-8 backdrop-blur-sm"
        >
          {/* Status + Doc ID */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                {isQuote ? "Estimate" : "Invoice"}
              </p>
              <h1 className="mt-1 text-2xl font-medium tracking-tight text-[#EDEDED]">
                {doc.display_id}
              </h1>
              {doc.title && <p className="mt-1 text-[14px] text-zinc-500">{doc.title}</p>}
            </div>
            <StatusBadge status={isPaid ? "paid" : isApproved ? "accepted" : isRejected ? "rejected" : doc.status} />
          </div>

          {/* Client info */}
          <div className="mb-6 grid grid-cols-2 gap-6 border-b border-white/[0.06] pb-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Bill To</p>
              <p className="mt-1 text-[13px] text-zinc-300">{doc.client_name || "—"}</p>
              {doc.client_email && <p className="text-[12px] text-zinc-500">{doc.client_email}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                {isQuote ? "Valid Until" : "Due Date"}
              </p>
              <p className="mt-1 text-[13px] text-zinc-300">
                {formatDate(isQuote ? doc.valid_until : doc.due_date)}
              </p>
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
            {lineItems.map((item: any) => (
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
                  <span className="tabular-nums text-zinc-300">${Number(doc.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-zinc-500">Tax ({doc.tax_rate}%)</span>
                  <span className="tabular-nums text-zinc-300">${Number(doc.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-white/[0.08] pt-2 text-[15px] font-medium">
                  <span className="text-zinc-300">Total</span>
                  <span className="tabular-nums text-[#00E676]">${Number(doc.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {doc.notes && (
            <div className="mt-6 rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Notes</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{doc.notes}</p>
            </div>
          )}

          {/* Signature (if signed) */}
          {doc.signature_url && (
            <div className="mt-6 border-t border-white/[0.06] pt-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Signed By</p>
              <div className="mt-2 flex items-center gap-4">
                <img src={doc.signature_url} alt="Signature" className="h-12 invert" />
                <div>
                  <p className="text-[12px] text-zinc-300">{doc.signed_by}</p>
                  <p className="text-[10px] text-zinc-600">{formatDate(doc.signed_at)}</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isQuote && !isApproved && !isRejected && (
            <>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-6 py-3 text-[13px] text-zinc-400 transition-all hover:border-red-500/20 hover:text-red-400"
              >
                <X size={14} /> Decline
              </button>
              <button
                onClick={() => setSignatureOpen(true)}
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E676] to-emerald-600 px-8 py-3 text-[14px] font-semibold text-black shadow-[0_0_30px_-5px_rgba(0,230,118,0.3)] transition-all hover:shadow-[0_0_40px_-5px_rgba(0,230,118,0.5)]"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Approve & Sign</>}
              </button>
            </>
          )}

          {!isQuote && !isPaid && doc.status !== "voided" && (
            <button
              onClick={() => {
                window.location.href = `/pay/${doc.id}`;
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00E676] to-emerald-600 px-8 py-3 text-[14px] font-semibold text-black shadow-[0_0_30px_-5px_rgba(0,230,118,0.3)]"
            >
              <CreditCard size={16} /> Pay ${Number(doc.total).toFixed(2)}
            </button>
          )}

          {isPaid && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-xl bg-[rgba(0,230,118,0.08)] px-6 py-3 text-[14px] font-medium text-[#00E676]"
            >
              <CheckCircle size={18} /> Paid {doc.paid_date ? `on ${formatDate(doc.paid_date)}` : ""}
            </motion.div>
          )}

          {isApproved && isQuote && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-xl bg-[rgba(0,230,118,0.08)] px-6 py-3 text-[14px] font-medium text-[#00E676]"
            >
              <CheckCircle size={18} /> Approved — Invoice created
            </motion.div>
          )}

          {isRejected && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/8 px-6 py-3 text-[14px] text-red-400">
              <X size={16} /> Declined
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-zinc-700">
          Powered by iWorkr · This is a secure document portal
        </p>
      </main>

      {/* Signature Modal */}
      <AnimatePresence>
        {signatureOpen && <SignaturePad onSave={handleApprove} onCancel={() => setSignatureOpen(false)} />}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {rejectOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
            onClick={() => setRejectOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] p-6"
            >
              <h3 className="mb-3 text-[15px] font-medium text-zinc-200">Decline Quote</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Optional: reason for declining..."
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-200 outline-none focus:border-red-500/30"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setRejectOpen(false)} className="px-4 py-2 text-[12px] text-zinc-500">Cancel</button>
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-[12px] text-red-400"
                >
                  {submitting ? <Loader2 size={12} className="animate-spin" /> : <><X size={12} /> Decline</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10" },
    sent: { label: "Sent", color: "text-sky-400", bg: "bg-sky-500/10" },
    viewed: { label: "Viewed", color: "text-amber-400", bg: "bg-amber-500/10" },
    accepted: { label: "Approved", color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]" },
    rejected: { label: "Declined", color: "text-red-400", bg: "bg-red-500/10" },
    paid: { label: "Paid", color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]" },
    overdue: { label: "Overdue", color: "text-red-400", bg: "bg-red-500/10" },
    voided: { label: "Voided", color: "text-zinc-500", bg: "bg-zinc-500/10" },
  };
  const c = config[status] || config.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${c.color} ${c.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "paid" || status === "accepted" ? "bg-[#00E676]" : status === "overdue" || status === "rejected" ? "bg-red-400" : "bg-current"}`} />
      {c.label}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
