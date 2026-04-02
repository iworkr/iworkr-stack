/**
 * @component components/finance/editor/BlockLibrary.tsx
 * @status STABLE
 * @description Moneta invoice canvas — BlockLibrary
 * @lastReview 2026-03-28
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Type,
  FileText,
  CreditCard,
  PenLine,
  Minus,
  ArrowUpDown,
  Table,
  Hash,
  AlignLeft,
  Building2,
  Landmark,
} from "lucide-react";
import type { InvoiceBlockType, BlockContentMap } from "./types";
import { makeBlockId } from "./types";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";

interface BlockOption {
  type: InvoiceBlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultContent: BlockContentMap[InvoiceBlockType];
  category: "content" | "financial" | "interactive" | "layout" | "sector";
}

const BLOCK_OPTIONS: BlockOption[] = [
  {
    type: "text",
    label: "Text Block",
    icon: <Type size={14} />,
    description: "Rich text with variable support",
    defaultContent: { text: "", fontSize: 10 },
    category: "content",
  },
  {
    type: "notes",
    label: "Notes",
    icon: <FileText size={14} />,
    description: "Payment instructions or messages",
    defaultContent: { text: "" },
    category: "content",
  },
  {
    type: "line_items",
    label: "Line Items Table",
    icon: <Table size={14} />,
    description: "Editable table with qty, rate, amounts",
    defaultContent: { items: [], showQty: true, showDiscount: false, showTax: false },
    category: "financial",
  },
  {
    type: "payment_button",
    label: "Payment Button",
    icon: <CreditCard size={14} />,
    description: "Stripe payment CTA (QR in PDF)",
    defaultContent: { gateway: "stripe", label: "Pay Now", fallbackText: "Scan to pay online" },
    category: "interactive",
  },
  {
    type: "signature",
    label: "Signature Field",
    icon: <PenLine size={14} />,
    description: "Client signature capture",
    defaultContent: { label: "Signature", required: false, signatureDataUrl: null },
    category: "interactive",
  },
  {
    type: "divider",
    label: "Divider",
    icon: <Minus size={14} />,
    description: "Horizontal separator line",
    defaultContent: { thickness: 1, color: "#e5e5e5" },
    category: "layout",
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: <ArrowUpDown size={14} />,
    description: "Adjustable vertical space",
    defaultContent: { height: 24 },
    category: "layout",
  },
  {
    type: "progress_claim",
    label: "Progress Claim",
    icon: <Building2 size={14} />,
    description: "Milestone-based billing for trades",
    defaultContent: {
      contractValue: 0,
      milestones: [
        { id: makeBlockId(), label: "Deposit", percentage: 20, completed: false, invoicedAmount: 0 },
        { id: makeBlockId(), label: "Rough-in", percentage: 50, completed: false, invoicedAmount: 0 },
        { id: makeBlockId(), label: "Completion", percentage: 30, completed: false, invoicedAmount: 0 },
      ],
      previouslyClaimed: 0,
      jobId: null,
    },
    category: "sector",
  },
  {
    type: "ndis_line_items",
    label: "NDIS Line Items",
    icon: <Landmark size={14} />,
    description: "NDIS-compliant support item table",
    defaultContent: { items: [], participantNdisNumber: "", planManagedBy: "" },
    category: "sector",
  },
];

const CATEGORIES = [
  { id: "content", label: "Content" },
  { id: "financial", label: "Financial" },
  { id: "interactive", label: "Interactive" },
  { id: "layout", label: "Layout" },
  { id: "sector", label: "Sector-Specific" },
];

export function BlockLibrary() {
  const [open, setOpen] = useState(false);
  const addBlock = useInvoiceEditorStore((s) => s.addBlock);
  const blocks = useInvoiceEditorStore((s) => s.blocks);

  function handleAdd(option: BlockOption) {
    addBlock(option.type, option.defaultContent as any, blocks.length - 1);
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-active)] px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:border-emerald-500/30 hover:bg-white/[0.02] hover:text-zinc-300"
      >
        <Plus size={12} />
        Add Block
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="fixed left-0 top-0 z-50 h-full w-[320px] border-r border-[var(--border-base)] bg-[var(--surface-1)] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-base)]">
                <h3 className="text-sm font-semibold text-zinc-200">Block Library</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-3 space-y-4">
                {CATEGORIES.map((cat) => {
                  const options = BLOCK_OPTIONS.filter((o) => o.category === cat.id);
                  if (options.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <div className="mb-2 font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
                        {cat.label}
                      </div>
                      <div className="space-y-1">
                        {options.map((opt) => (
                          <button
                            key={opt.type}
                            onClick={() => handleAdd(opt)}
                            className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--border-active)] hover:bg-white/[0.03]"
                          >
                            <div className="mt-0.5 shrink-0 text-zinc-500">{opt.icon}</div>
                            <div>
                              <div className="text-[11px] font-medium text-zinc-300">{opt.label}</div>
                              <div className="text-[10px] text-zinc-600">{opt.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
