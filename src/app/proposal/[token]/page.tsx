"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Star,
  Shield,
  ChevronDown,
  ChevronUp,
  FileText,
  PenLine,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
} from "lucide-react";

import {
  getProposalByToken,
  acceptQuoteTier,
  type ProposalData,
  type QuoteTierLine,
} from "@/app/actions/forge-proposals";

// ═══════════════════════════════════════════════════════════════
// /proposal/[token] — Interactive Multi-Tier Proposal Page
// Public — No authentication required
// ═══════════════════════════════════════════════════════════════

type PageState = "loading" | "error" | "active" | "accepted";

// ── Animation variants ──────────────────────────────────────
const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } } as any;
const scaleIn = { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 } } as any;

// ── Helpers ─────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
}

export default function ProposalPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorType, setErrorType] = useState<string>("not_found");

  // Addon toggle state: { [tierId]: { [lineId]: boolean } }
  const [addonState, setAddonState] = useState<Record<string, Record<string, boolean>>>({});

  // Signature modal
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Canvas signature
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Accepted result
  const [acceptResult, setAcceptResult] = useState<any>(null);

  // ── Fetch proposal ────────────────────────────────────────
  const fetchProposal = useCallback(async () => {
    if (!token) return;
    const res = await getProposalByToken(token);
    if (res.error) {
      setErrorMsg(res.error);
      setErrorType("error");
      setPageState("error");
      return;
    }
    const d = res.data;
    if (!d) { setErrorMsg("Not found"); setPageState("error"); return; }
    if (d.error === "not_found") { setErrorMsg("Proposal not found"); setErrorType("not_found"); setPageState("error"); return; }
    if (d.error === "expired") { setErrorMsg("This proposal has expired"); setErrorType("expired"); setPageState("error"); return; }
    if (d.error === "already_accepted") { setErrorMsg("This proposal has already been accepted"); setErrorType("already_accepted"); setPageState("error"); return; }

    setProposal(d);

    // Initialize addon states from server data
    const init: Record<string, Record<string, boolean>> = {};
    (d.tiers ?? []).forEach((t: any) => {
      init[t.id] = {};
      (t.lines ?? []).forEach((l: QuoteTierLine) => {
        if (l.is_optional_addon) init[t.id][l.id] = l.is_included;
      });
    });
    setAddonState(init);
    setPageState("active");
  }, [token]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  // ── Calculate tier total with addon overrides ─────────────
  function calcTierTotal(tier: any) {
    const lines: QuoteTierLine[] = tier.lines ?? [];
    let subtotal = 0;
    lines.forEach((l) => {
      const included = l.is_optional_addon
        ? (addonState[tier.id]?.[l.id] ?? l.is_included)
        : true;
      if (included) subtotal += l.quantity * l.unit_sell;
    });
    const tax = subtotal * 0.1;
    return { subtotal, tax, total: subtotal + tax };
  }

  // ── Toggle addon ──────────────────────────────────────────
  function toggleAddon(tierId: string, lineId: string) {
    setAddonState((prev) => ({
      ...prev,
      [tierId]: {
        ...prev[tierId],
        [lineId]: !(prev[tierId]?.[lineId] ?? false),
      },
    }));
  }

  // ── Canvas drawing ────────────────────────────────────────
  function getCanvasPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasSigned(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function endDraw() { setIsDrawing(false); }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasSigned(false);
  }

  // ── Accept proposal ──────────────────────────────────────
  async function handleAccept() {
    if (!proposal || !selectedTierId || !signerName || !agreedTerms) return;
    setSubmitting(true);
    const sigData = canvasRef.current?.toDataURL("image/png") ?? "";
    const res = await acceptQuoteTier({
      quote_id: proposal.quote_id,
      tier_id: selectedTierId,
      signer_name: signerName,
      signer_email: signerEmail || undefined,
      signature_data: sigData,
    });
    setSubmitting(false);
    if (res.error) { alert(res.error); return; }
    setAcceptResult(res.data);
    setSignModalOpen(false);
    setPageState("accepted");
  }

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  // ── LOADING ─────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div {...(fadeUp as any)} className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-emerald-500/50 animate-pulse" />
            <FileText className="absolute inset-4 w-8 h-8 text-emerald-500" />
          </div>
          <p className="text-zinc-400 text-sm">Loading your proposal…</p>
        </motion.div>
      </div>
    );
  }

  // ── ERROR ───────────────────────────────────────────────
  if (pageState === "error") {
    const Icon = errorType === "expired" ? Clock : errorType === "already_accepted" ? CheckCircle2 : AlertTriangle;
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <motion.div {...(fadeUp as any)} className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-zinc-900 flex items-center justify-center">
            <Icon className="w-8 h-8 text-zinc-500" />
          </div>
          <h1 className="text-xl font-semibold text-white">{errorMsg}</h1>
          <p className="text-zinc-500 text-sm">
            {errorType === "expired" ? "This proposal is no longer valid. Please contact the business for a new quote." :
             errorType === "already_accepted" ? "This proposal has already been signed and accepted." :
             "The proposal you're looking for doesn't exist or the link is invalid."}
          </p>
        </motion.div>
      </div>
    );
  }

  // ── ACCEPTED ────────────────────────────────────────────
  if (pageState === "accepted") {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 relative overflow-hidden">
        {/* Confetti */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                backgroundColor: i % 3 === 0 ? "#10B981" : i % 3 === 1 ? "#34D399" : "#6EE7B7",
                animation: `confetti-fall ${2 + Math.random() * 3}s ease-in ${Math.random() * 2}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }`}</style>
        <motion.div {...(scaleIn as any)} transition={{ type: "spring", stiffness: 200 }} className="text-center space-y-6 max-w-md relative z-10">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Proposal Accepted!</h1>
          <div className="bg-zinc-900/60 rounded-xl border border-white/10 p-6 space-y-3">
            {acceptResult && (
              <>
                <p className="text-zinc-400 text-sm">Option: <span className="text-white font-semibold">{acceptResult.tier_name}</span></p>
                <p className="text-3xl font-mono font-bold text-emerald-500">{formatCurrency(acceptResult.total ?? 0)}</p>
                <p className="text-zinc-500 text-xs">Signed by {acceptResult.signer}</p>
              </>
            )}
            <p className="text-zinc-500 text-sm mt-4">A job has been created and your invoice is being prepared.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── ACTIVE ──────────────────────────────────────────────
  if (!proposal) return null;
  const tiers = proposal.tiers ?? [];

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <motion.header {...(fadeUp as any)} className="border-b border-white/5 px-4 py-8 md:px-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          {proposal.organization_name && (
            <p className="text-emerald-500 font-semibold text-sm tracking-widest uppercase">{proposal.organization_name}</p>
          )}
          <h1 className="text-2xl md:text-3xl font-bold">
            Proposal <span className="text-zinc-500">{proposal.display_id}</span>
          </h1>
          {proposal.client_name && <p className="text-zinc-400">Prepared for <span className="text-white font-medium">{proposal.client_name}</span></p>}
          <div className="flex gap-4 text-xs text-zinc-500">
            {proposal.issue_date && <span>Issued: {proposal.issue_date}</span>}
            {proposal.valid_until && <span>Valid until: {proposal.valid_until}</span>}
          </div>
        </div>
      </motion.header>

      {/* Tier Cards */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className={`grid gap-6 ${tiers.length >= 3 ? "grid-cols-1 lg:grid-cols-3" : tiers.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-lg mx-auto"}`}>
          {tiers.map((tier: any, idx: number) => {
            const totals = calcTierTotal(tier);
            const lines: QuoteTierLine[] = tier.lines ?? [];
            const coreLines = lines.filter((l: QuoteTierLine) => !l.is_optional_addon);
            const addonLines = lines.filter((l: QuoteTierLine) => l.is_optional_addon);
            const isRecommended = tier.is_recommended;

            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 } as any}
                className={`rounded-2xl border overflow-hidden flex flex-col ${
                  isRecommended
                    ? "border-emerald-500/30 bg-zinc-900/80 lg:scale-[1.03] shadow-lg shadow-emerald-500/5 relative z-10"
                    : "border-white/10 bg-zinc-900/40"
                }`}
              >
                {/* Tier Header */}
                <div className={`p-6 pb-4 ${isRecommended ? "bg-emerald-500/5" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold">{tier.tier_name}</h2>
                    {isRecommended && (
                      <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <Star className="w-3 h-3" /> Recommended
                      </span>
                    )}
                  </div>
                  {tier.tier_description && <p className="text-zinc-500 text-sm">{tier.tier_description}</p>}
                </div>

                {/* Core Lines */}
                <div className="px-6 flex-1">
                  <div className="space-y-2 mb-4">
                    {coreLines.map((line: QuoteTierLine) => (
                      <div key={line.id} className="flex justify-between text-sm">
                        <span className="text-zinc-300 truncate mr-2">
                          {line.description}
                          {line.quantity > 1 && <span className="text-zinc-600 ml-1">×{line.quantity}</span>}
                        </span>
                        <span className="text-zinc-400 font-mono text-xs whitespace-nowrap">
                          {formatCurrency(line.quantity * line.unit_sell)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Optional Add-ons */}
                  {addonLines.length > 0 && (
                    <div className="border-t border-white/5 pt-3 mb-4">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Optional Add-ons</p>
                      <div className="space-y-2">
                        {addonLines.map((line: QuoteTierLine) => {
                          const isOn = addonState[tier.id]?.[line.id] ?? line.is_included;
                          return (
                            <button
                              key={line.id}
                              onClick={() => toggleAddon(tier.id, line.id)}
                              className="flex items-center justify-between w-full text-sm group"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-5 rounded-full transition-colors flex items-center ${
                                  isOn ? "bg-emerald-500 justify-end" : "bg-zinc-700 justify-start"
                                }`}>
                                  <motion.div
                                    layout
                                    className="w-4 h-4 rounded-full bg-white mx-0.5"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 } as any}
                                  />
                                </div>
                                <span className={isOn ? "text-white" : "text-zinc-500"}>{line.description}</span>
                              </div>
                              <span className="text-emerald-500 font-mono text-xs">
                                +{formatCurrency(line.quantity * line.unit_sell)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Footer */}
                <div className="p-6 pt-4 border-t border-white/5 bg-zinc-950/50 space-y-2">
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>GST (10%)</span>
                    <span className="font-mono">{formatCurrency(totals.tax)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                    <span className="text-sm font-medium">Total</span>
                    <motion.span
                      key={totals.total}
                      initial={{ scale: 1.1, color: "#10B981" }}
                      animate={{ scale: 1, color: "#FFFFFF" }}
                      transition={{ type: "spring", stiffness: 300 } as any}
                      className="text-2xl font-bold font-mono"
                    >
                      {formatCurrency(totals.total)}
                    </motion.span>
                  </div>
                  <button
                    onClick={() => { setSelectedTierId(tier.id); setSignModalOpen(true); }}
                    className={`w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-colors ${
                      isRecommended
                        ? "bg-emerald-500 text-black hover:bg-emerald-400"
                        : "bg-zinc-800 text-white hover:bg-zinc-700 border border-white/10"
                    }`}
                  >
                    Accept &lsquo;{tier.tier_name}&rsquo; Option
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Terms & Notes */}
        {(proposal.terms || proposal.notes) && (
          <div className="mt-10 max-w-2xl mx-auto space-y-4 text-sm text-zinc-500">
            {proposal.terms && (
              <div>
                <h3 className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Terms & Conditions</h3>
                <p className="whitespace-pre-line">{proposal.terms}</p>
              </div>
            )}
            {proposal.notes && (
              <div>
                <h3 className="text-xs text-zinc-600 uppercase tracking-wider mb-1">Notes</h3>
                <p className="whitespace-pre-line">{proposal.notes}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Signature Modal */}
      <AnimatePresence>
        {signModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
            onClick={() => setSignModalOpen(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25 } as any}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-white/10 rounded-t-2xl md:rounded-2xl w-full max-w-lg p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-bold text-white">Sign & Accept</h2>
                </div>
                <button onClick={() => setSignModalOpen(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Signer name */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Your Name *</label>
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Signer email */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Email (optional)</label>
                <input
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Signature Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-zinc-500">Signature</label>
                  <button onClick={clearCanvas} className="text-xs text-zinc-600 hover:text-zinc-400">Clear</button>
                </div>
                <div className="bg-zinc-950 border border-white/10 rounded-lg overflow-hidden relative">
                  <canvas
                    ref={canvasRef}
                    width={440}
                    height={120}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  {!hasSigned && (
                    <p className="absolute inset-0 flex items-center justify-center text-zinc-700 text-sm pointer-events-none">
                      Draw your signature here
                    </p>
                  )}
                </div>
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span className="text-xs text-zinc-400">
                  I agree to the Terms of Trade and authorize commencement of work.
                </span>
              </label>

              {/* Submit */}
              <button
                onClick={handleAccept}
                disabled={!signerName || !agreedTerms || submitting}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {submitting ? "Processing…" : "Confirm & Accept"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center">
        <p className="text-zinc-600 text-xs flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" /> Powered by iWorkr
        </p>
      </footer>
    </div>
  );
}
