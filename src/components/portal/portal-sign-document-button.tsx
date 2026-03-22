/**
 * @component PortalSignDocumentButton
 * @status COMPLETE
 * @description Canvas-based signature capture button for signing portal documents
 * @lastAudit 2026-03-22
 */
"use client";

import { useRef, useState, useTransition } from "react";
import { signPortalDocument } from "@/app/actions/portal-family";

export function PortalSignDocumentButton({ documentId }: { documentId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const xy = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
      >
        Sign Document
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-700 bg-[#090909] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-100">Digital Signature</h3>
            <p className="mt-1 text-sm text-zinc-400">Sign below to approve this document.</p>
            <canvas
              ref={canvasRef}
              width={560}
              height={180}
              className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950"
              style={{ touchAction: "none" }}
              onMouseDown={(e) => {
                const c = canvasRef.current;
                if (!c) return;
                const p = xy(e);
                const ctx = c.getContext("2d");
                if (!ctx) return;
                setDrawing(true);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
              }}
              onMouseMove={(e) => {
                if (!drawing) return;
                const c = canvasRef.current;
                if (!c) return;
                const p = xy(e);
                const ctx = c.getContext("2d");
                if (!ctx) return;
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                ctx.strokeStyle = "#ffffff";
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                setHasInk(true);
              }}
              onMouseUp={() => setDrawing(false)}
              onMouseLeave={() => setDrawing(false)}
              onTouchStart={(e) => {
                const c = canvasRef.current;
                if (!c) return;
                const p = xy(e);
                const ctx = c.getContext("2d");
                if (!ctx) return;
                setDrawing(true);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
              }}
              onTouchMove={(e) => {
                if (!drawing) return;
                const c = canvasRef.current;
                if (!c) return;
                const p = xy(e);
                const ctx = c.getContext("2d");
                if (!ctx) return;
                ctx.lineWidth = 2;
                ctx.lineCap = "round";
                ctx.strokeStyle = "#ffffff";
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                setHasInk(true);
              }}
              onTouchEnd={() => setDrawing(false)}
            />
            {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  const c = canvasRef.current;
                  if (!c) return;
                  const ctx = c.getContext("2d");
                  if (!ctx) return;
                  ctx.clearRect(0, 0, c.width, c.height);
                  setHasInk(false);
                }}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                Clear
              </button>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                  Cancel
                </button>
                <button
                  disabled={!hasInk || pending}
                  onClick={() =>
                    startTransition(async () => {
                      const c = canvasRef.current;
                      if (!c) return;
                      const result = await signPortalDocument({
                        document_id: documentId,
                        signature_base64: c.toDataURL("image/png"),
                      });
                      if (!result.success) {
                        setError(result.error || "Signing failed.");
                        return;
                      }
                      setOpen(false);
                      window.location.reload();
                    })
                  }
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Sign & Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
