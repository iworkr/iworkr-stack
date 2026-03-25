/**
 * @page /portal/c/[slug]/care/shifts
 * @status COMPLETE
 * @description Shift sign-off page — digital signature capture for verifying completed shifts.
 *   Signing triggers VERIFIED_BY_CLIENT status, unblocking the billing pipeline.
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, User, Clock, CheckCircle, Loader2,
  PenTool, X, Check,
} from "lucide-react";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalPendingShifts, signShiftPortal } from "@/app/actions/portal-client";

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

interface PendingShift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  shift_note: string | null;
  client_approved: boolean;
  worker_name: string | null;
  worker_avatar: string | null;
  billable_hours: number | null;
}

export default function PortalShiftSignOffPage() {
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const tenant = usePortalStore((s) => s.activeTenant);
  const [shifts, setShifts] = useState<PendingShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!activeEntityId) return;
    setLoading(true);
    getPortalPendingShifts(activeEntityId).then((result) => {
      setShifts((result.shifts || []) as PendingShift[]);
      setLoading(false);
    });
  }, [activeEntityId]);

  const handleSign = async (signatureData: string) => {
    if (!signingId) return;
    const result = await signShiftPortal(signingId, signatureData, navigator.userAgent);
    if (result.ok) {
      setSignedIds((prev) => new Set([...prev, signingId]));
    }
    setSigningId(null);
  };

  const pendingShifts = shifts.filter((s) => !signedIds.has(s.id));
  const completedCount = signedIds.size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Shift Sign-Off</h1>
        <p className="text-[12px] text-zinc-500">
          Review and approve completed shifts. Your signature verifies that services were delivered.
        </p>
      </div>

      {completedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ backgroundColor: `${brandColor}10`, borderColor: `${brandColor}20`, borderWidth: 1 }}
        >
          <CheckCircle size={18} style={{ color: brandColor }} />
          <p className="text-[13px]" style={{ color: brandColor }}>
            {completedCount} shift{completedCount !== 1 ? "s" : ""} signed off this session
          </p>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : pendingShifts.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-12 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400">All shifts have been signed off</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Completed shifts will appear here for your review and approval.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingShifts.map((shift, i) => (
            <motion.div
              key={shift.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800">
                    {shift.worker_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shift.worker_avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <User size={16} className="text-zinc-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium text-zinc-200">
                      {shift.worker_name || "Support Worker"}
                    </p>
                    <p className="text-[12px] text-zinc-500">{fmtDate(shift.start_time)}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                      <Clock size={10} />
                      {fmtTime(shift.start_time)} — {fmtTime(shift.end_time)}
                      {shift.billable_hours && (
                        <span>({shift.billable_hours}h)</span>
                      )}
                    </div>
                    {shift.shift_note && (
                      <p className="mt-2 rounded-lg bg-zinc-950/50 p-3 text-[12px] text-zinc-400">
                        {shift.shift_note}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSigningId(shift.id)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-black"
                  style={{ backgroundColor: brandColor }}
                >
                  <PenTool size={12} /> Sign Off
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Signature Modal */}
      <AnimatePresence>
        {signingId && (
          <SignatureModal
            onSave={handleSign}
            onCancel={() => setSigningId(null)}
            brandColor={brandColor}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SignatureModal({
  onSave,
  onCancel,
  brandColor,
}: {
  onSave: (data: string) => void;
  onCancel: () => void;
  brandColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    return { x, y };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }, [drawing]);

  const stopDraw = useCallback(() => setDrawing(false), []);

  const clear = () => {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
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
        <h3 className="mb-4 text-[15px] font-medium text-zinc-200">Sign to Verify Shift</h3>
        <p className="mb-4 text-[12px] text-zinc-500">
          Your signature confirms that the service was delivered as described.
        </p>

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
            <button onClick={onCancel} className="rounded-lg px-4 py-2 text-[12px] text-zinc-500 hover:text-zinc-300">
              <X size={12} className="inline mr-1" />Cancel
            </button>
            <button
              onClick={() => {
                if (!hasSignature) return;
                onSave(canvasRef.current!.toDataURL());
              }}
              disabled={!hasSignature}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-black disabled:opacity-40"
              style={{ backgroundColor: brandColor }}
            >
              <Check size={12} /> Verify & Sign
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
