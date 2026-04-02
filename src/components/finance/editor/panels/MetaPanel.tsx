/**
 * @component components/finance/editor/panels/MetaPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — MetaPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { MetaContent } from "../types";

const TERMS_OPTIONS: { value: MetaContent["terms"]; label: string }[] = [
  { value: "due_receipt", label: "Due on Receipt" },
  { value: "net_7", label: "Net 7 Days" },
  { value: "net_14", label: "Net 14 Days" },
  { value: "net_30", label: "Net 30 Days" },
];

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function dueDateFromTerms(issueDate: string, terms: MetaContent["terms"]): string {
  switch (terms) {
    case "due_receipt":
      return issueDate;
    case "net_7":
      return addDays(issueDate, 7);
    case "net_14":
      return addDays(issueDate, 14);
    case "net_30":
      return addDays(issueDate, 30);
    default:
      return issueDate;
  }
}

export function MetaPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  if (!block || block.type !== "meta") return null;
  const c = block.content as MetaContent;

  function handleTermsChange(terms: MetaContent["terms"]) {
    const dueDate = dueDateFromTerms(c.issueDate, terms);
    update(blockId, { terms, dueDate });
  }

  function handleIssueDateChange(issueDate: string) {
    const dueDate = dueDateFromTerms(issueDate, c.terms);
    update(blockId, { issueDate, dueDate });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Invoice Meta
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Invoice Number</label>
        <input
          value={c.displayId}
          onChange={(e) => update(blockId, { displayId: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Issue Date</label>
        <input
          type="date"
          value={c.issueDate}
          onChange={(e) => handleIssueDateChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30 [color-scheme:dark]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Payment Terms</label>
        <select
          value={c.terms}
          onChange={(e) => handleTermsChange(e.target.value as MetaContent["terms"])}
          className="w-full rounded-lg border border-[var(--border-base)] bg-zinc-900 px-3 py-2 text-xs text-zinc-300 outline-none"
        >
          {TERMS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Due Date</label>
        <input
          type="date"
          value={c.dueDate}
          onChange={(e) => update(blockId, { dueDate: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30 [color-scheme:dark]"
        />
        <p className="mt-1 text-[10px] text-zinc-600">
          Auto-calculated from terms, but can be overridden.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Status</label>
        <select
          value={c.status}
          onChange={(e) => update(blockId, { status: e.target.value as MetaContent["status"] })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-zinc-900 px-3 py-2 text-xs text-zinc-300 outline-none"
        >
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="voided">Voided</option>
        </select>
      </div>
    </div>
  );
}
