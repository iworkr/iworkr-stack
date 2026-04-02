/**
 * @component components/finance/editor/panels/PaymentPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — PaymentPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { PaymentButtonContent } from "../types";

export function PaymentPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "payment_button") return null;
  const c = block.content as PaymentButtonContent;

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Payment Button
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Button Label</label>
        <input
          value={c.label}
          onChange={(e) => update(blockId, { label: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">PDF Fallback Text</label>
        <input
          value={c.fallbackText}
          onChange={(e) => update(blockId, { fallbackText: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Gateway</label>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">
          Stripe (Connect)
        </div>
      </div>

      <p className="text-[10px] text-zinc-600">
        On the digital invoice, the client sees an interactive payment button. In the PDF, this renders as a QR code linking to the payment portal.
      </p>
    </div>
  );
}
