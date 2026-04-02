/**
 * @component components/finance/editor/blocks/ProgressClaimBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — ProgressClaimBlock
 * @lastReview 2026-03-28
 */
"use client";

import { CheckCircle, Circle } from "lucide-react";
import type { BlockRendererProps, ProgressClaimContent, ProgressClaimMilestone } from "../types";

function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ProgressClaimBlock({
  block,
  isActive,
  isEditing,
  settings,
  onContentChange,
}: BlockRendererProps<"progress_claim">) {
  const c = block.content as ProgressClaimContent;
  const accent = settings.brandColor;
  const cur = settings.currency || "AUD";

  const claimableTotal = c.milestones
    .filter((m) => m.completed)
    .reduce((sum, m) => sum + r2(c.contractValue * (m.percentage / 100)), 0);

  const thisClaimAmount = r2(Math.max(0, claimableTotal - c.previouslyClaimed));

  function toggleMilestone(id: string) {
    if (!isEditing) return;
    onContentChange({
      milestones: c.milestones.map((m) =>
        m.id === id ? { ...m, completed: !m.completed } : m,
      ),
    });
  }

  return (
    <div className="px-10 py-3">
      <div className="font-mono text-[7px] tracking-[2px] text-gray-400 mb-3 uppercase">
        Progress Claim
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        {/* Contract summary */}
        <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
          <span className="text-[9px] text-gray-500">Contract Value</span>
          <span className="font-mono text-[11px] font-bold text-gray-800">
            {fmtCurrency(c.contractValue, cur)}
          </span>
        </div>

        {/* Milestones */}
        {c.milestones.map((ms) => {
          const value = r2(c.contractValue * (ms.percentage / 100));
          return (
            <div
              key={ms.id}
              className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 hover:bg-gray-50/50 transition-colors"
              onClick={() => toggleMilestone(ms.id)}
              role={isEditing ? "button" : undefined}
            >
              {ms.completed ? (
                <CheckCircle size={14} style={{ color: accent }} />
              ) : (
                <Circle size={14} className="text-gray-300" />
              )}
              <div className="flex-1">
                <div className="text-[10px] text-gray-700 font-medium">{ms.label}</div>
                <div className="text-[8px] text-gray-400">{ms.percentage}% of contract</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] text-gray-600">{fmtCurrency(value, cur)}</div>
                {ms.invoicedAmount > 0 && (
                  <div className="font-mono text-[8px] text-gray-400">
                    Prev: {fmtCurrency(ms.invoicedAmount, cur)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div className="border-t-2 border-gray-200 px-4 py-2 flex justify-between items-center bg-gray-50">
          <div>
            <div className="text-[8px] text-gray-400">Previously Claimed</div>
            <div className="font-mono text-[9px] text-gray-500">{fmtCurrency(c.previouslyClaimed, cur)}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] text-gray-400">This Claim</div>
            <div className="font-mono text-[12px] font-bold" style={{ color: accent }}>
              {fmtCurrency(thisClaimAmount, cur)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
