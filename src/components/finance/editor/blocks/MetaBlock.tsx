/**
 * @component components/finance/editor/blocks/MetaBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — MetaBlock
 * @lastReview 2026-03-28
 */
"use client";

import type { BlockRendererProps, MetaContent } from "../types";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:   { bg: "#f0f0f0", color: "#888888", label: "DRAFT" },
  sent:    { bg: "#e8f5e9", color: "#2e7d32", label: "SENT" },
  paid:    { bg: "#e8f5e9", color: "#1b5e20", label: "PAID" },
  overdue: { bg: "#fbe9e7", color: "#c62828", label: "OVERDUE" },
  voided:  { bg: "#f0f0f0", color: "#999999", label: "VOIDED" },
};

function fmtDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const TERMS_LABELS: Record<string, string> = {
  due_receipt: "Due on Receipt",
  net_7: "Net 7",
  net_14: "Net 14",
  net_30: "Net 30",
};

export function MetaBlock({
  block,
  isEditing,
  settings,
  onContentChange,
}: BlockRendererProps<"meta">) {
  const c = block.content as MetaContent;
  const accent = settings.brandColor;
  const status = STATUS_STYLES[c.status] || STATUS_STYLES.draft;

  return (
    <div className="px-10 py-2">
      <div className="flex justify-end">
        <div className="text-right space-y-1">
          <div className="font-mono text-xl font-bold" style={{ color: accent }}>
            {isEditing ? (
              <input
                value={c.displayId}
                onChange={(e) => onContentChange({ displayId: e.target.value })}
                className="bg-transparent text-right font-mono text-xl font-bold outline-none w-[180px]"
                style={{ color: accent }}
              />
            ) : (
              c.displayId
            )}
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span className="font-semibold text-[8px] text-gray-400 w-[50px] text-left">Issued</span>
            {isEditing ? (
              <input
                type="date"
                value={c.issueDate}
                onChange={(e) => onContentChange({ issueDate: e.target.value })}
                className="font-mono text-[9px] text-gray-600 bg-transparent outline-none"
              />
            ) : (
              <span className="font-mono text-[9px] text-gray-600">{fmtDate(c.issueDate)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span className="font-semibold text-[8px] text-gray-400 w-[50px] text-left">Due</span>
            {isEditing ? (
              <input
                type="date"
                value={c.dueDate}
                onChange={(e) => onContentChange({ dueDate: e.target.value })}
                className="font-mono text-[9px] text-gray-600 bg-transparent outline-none"
              />
            ) : (
              <span className="font-mono text-[9px] text-gray-600">{fmtDate(c.dueDate)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span className="font-semibold text-[8px] text-gray-400 w-[50px] text-left">Terms</span>
            <span className="font-mono text-[9px] text-gray-500">
              {TERMS_LABELS[c.terms] || c.terms}
            </span>
          </div>
          {c.paidDate && (
            <div className="flex items-center gap-1 justify-end">
              <span className="font-semibold text-[8px] text-gray-400 w-[50px] text-left">Paid</span>
              <span className="font-mono text-[9px] text-gray-600">{fmtDate(c.paidDate)}</span>
            </div>
          )}
          <div
            className="inline-block mt-1 px-2.5 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </div>
        </div>
      </div>
    </div>
  );
}
