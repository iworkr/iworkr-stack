/**
 * @component components/finance/editor/panels/ProgressClaimPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — ProgressClaimPanel
 * @lastReview 2026-03-28
 */
"use client";

import { Plus, Trash2 } from "lucide-react";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { makeBlockId } from "../types";
import type { ProgressClaimContent, ProgressClaimMilestone } from "../types";

export function ProgressClaimPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "progress_claim") return null;
  const c = block.content as ProgressClaimContent;

  function updateMilestone(id: string, patch: Partial<ProgressClaimMilestone>) {
    update(blockId, {
      milestones: c.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  }

  function addMilestone() {
    update(blockId, {
      milestones: [
        ...c.milestones,
        { id: makeBlockId(), label: "New Milestone", percentage: 0, completed: false, invoicedAmount: 0 },
      ],
    });
  }

  function removeMilestone(id: string) {
    update(blockId, {
      milestones: c.milestones.filter((m) => m.id !== id),
    });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Progress Claim
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Contract Value ($)</label>
        <input
          type="number"
          value={c.contractValue}
          onChange={(e) => update(blockId, { contractValue: Math.max(0, Number(e.target.value)) })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Previously Claimed ($)</label>
        <input
          type="number"
          value={c.previouslyClaimed}
          onChange={(e) => update(blockId, { previouslyClaimed: Math.max(0, Number(e.target.value)) })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-2 block text-[11px] text-zinc-400">Milestones</label>
        <div className="space-y-2">
          {c.milestones.map((ms) => (
            <div
              key={ms.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-2"
            >
              <input
                value={ms.label}
                onChange={(e) => updateMilestone(ms.id, { label: e.target.value })}
                className="flex-1 bg-transparent text-xs text-zinc-200 outline-none"
              />
              <input
                type="number"
                value={ms.percentage}
                onChange={(e) => updateMilestone(ms.id, { percentage: Math.max(0, Math.min(100, Number(e.target.value))) })}
                className="w-14 bg-transparent text-right font-mono text-xs text-zinc-300 outline-none"
              />
              <span className="text-[10px] text-zinc-600">%</span>
              <button
                onClick={() => removeMilestone(ms.id)}
                className="text-zinc-600 hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addMilestone}
          className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          <Plus size={12} />
          Add Milestone
        </button>
      </div>
    </div>
  );
}
