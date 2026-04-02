/**
 * @component components/finance/editor/templates.ts
 * @status STABLE
 * @description Moneta invoice canvas — templates
 * @lastReview 2026-03-28
 */
import type { InvoiceBlock, InvoiceBlockType, BlockContentMap } from "./types";
import { makeBlockId } from "./types";

function blk<T extends InvoiceBlockType>(
  type: T,
  content: BlockContentMap[T],
  opts?: { locked?: boolean; deletable?: boolean },
): InvoiceBlock<T> {
  return {
    id: makeBlockId(),
    type,
    content,
    locked: opts?.locked,
    deletable: opts?.deletable ?? true,
  };
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function standardTemplate(): InvoiceBlock[] {
  return [
    blk("header", { title: "INVOICE", showLogo: true, showOrgDetails: true }, { locked: true, deletable: false }),
    blk("client_details", { clientId: null, clientName: "", clientEmail: null, clientAddress: null }),
    blk("meta", {
      displayId: "INV-DRAFT",
      issueDate: todayStr(),
      dueDate: addDaysStr(7),
      paidDate: null,
      status: "draft",
      terms: "net_7",
    }),
    blk("line_items", { items: [], showQty: true, showDiscount: false, showTax: false }),
    blk("totals", { showBreakdown: true }, { locked: true, deletable: false }),
    blk("notes", { text: "" }),
    blk("payment_button", {
      gateway: "stripe",
      label: "Pay Now",
      fallbackText: "Scan to pay online",
    }),
  ];
}

export function ndisTemplate(): InvoiceBlock[] {
  return [
    blk("header", { title: "TAX INVOICE", showLogo: true, showOrgDetails: true }, { locked: true, deletable: false }),
    blk("client_details", {
      clientId: null,
      clientName: "",
      clientEmail: null,
      clientAddress: null,
      ndisNumber: "",
    }),
    blk("meta", {
      displayId: "INV-DRAFT",
      issueDate: todayStr(),
      dueDate: addDaysStr(14),
      paidDate: null,
      status: "draft",
      terms: "net_14",
    }),
    blk("ndis_line_items", {
      items: [],
      participantNdisNumber: "",
      planManagedBy: "",
    }),
    blk("totals", { showBreakdown: true }, { locked: true, deletable: false }),
    blk("notes", { text: "Services provided under NDIS funding agreement." }),
    blk("payment_button", {
      gateway: "stripe",
      label: "Pay Now",
      fallbackText: "Scan to pay online",
    }),
  ];
}

export function tradesProgressTemplate(): InvoiceBlock[] {
  return [
    blk("header", { title: "TAX INVOICE", showLogo: true, showOrgDetails: true }, { locked: true, deletable: false }),
    blk("client_details", { clientId: null, clientName: "", clientEmail: null, clientAddress: null }),
    blk("meta", {
      displayId: "INV-DRAFT",
      issueDate: todayStr(),
      dueDate: addDaysStr(14),
      paidDate: null,
      status: "draft",
      terms: "net_14",
    }),
    blk("progress_claim", {
      contractValue: 0,
      milestones: [
        { id: makeBlockId(), label: "Deposit", percentage: 20, completed: false, invoicedAmount: 0 },
        { id: makeBlockId(), label: "Rough-in", percentage: 50, completed: false, invoicedAmount: 0 },
        { id: makeBlockId(), label: "Completion", percentage: 30, completed: false, invoicedAmount: 0 },
      ],
      previouslyClaimed: 0,
      jobId: null,
    }),
    blk("line_items", { items: [], showQty: true, showDiscount: false, showTax: false }),
    blk("totals", { showBreakdown: true }, { locked: true, deletable: false }),
    blk("notes", { text: "" }),
    blk("payment_button", {
      gateway: "stripe",
      label: "Pay Now",
      fallbackText: "Scan to pay online",
    }),
  ];
}

export type TemplateId = "standard" | "ndis" | "trades_progress";

export const TEMPLATE_OPTIONS: { id: TemplateId; label: string; description: string }[] = [
  { id: "standard", label: "Standard Invoice", description: "General purpose invoice for services and products" },
  { id: "ndis", label: "NDIS Compliant", description: "NDIS support items with codes, dates, and claim types" },
  { id: "trades_progress", label: "Progress Payment", description: "Milestone-based progress claims for trades" },
];

export function loadTemplate(id: TemplateId): InvoiceBlock[] {
  switch (id) {
    case "ndis":
      return ndisTemplate();
    case "trades_progress":
      return tradesProgressTemplate();
    default:
      return standardTemplate();
  }
}
