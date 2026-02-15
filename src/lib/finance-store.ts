import { create } from "zustand";
import {
  invoices as initialInvoices,
  type Invoice,
  type InvoiceStatus,
  type LineItem,
} from "./data";

/* ── Types ────────────────────────────────────────────── */

export type FinanceTab = "overview" | "invoices" | "payouts";

/* ── Store ────────────────────────────────────────────── */

interface FinanceState {
  invoices: Invoice[];
  activeTab: FinanceTab;
  focusedIndex: number;

  setActiveTab: (tab: FinanceTab) => void;
  setFocusedIndex: (i: number) => void;

  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  updateLineItem: (invoiceId: string, lineItemId: string, patch: Partial<LineItem>) => void;
  addLineItem: (invoiceId: string, item: LineItem) => void;
  removeLineItem: (invoiceId: string, lineItemId: string) => void;
  updateInvoiceStatus: (id: string, status: InvoiceStatus) => void;
  addInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  restoreInvoice: (invoice: Invoice) => void;

  /* Recalculate totals from line items */
  recalcInvoice: (id: string) => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  invoices: initialInvoices,
  activeTab: "overview",
  focusedIndex: 0,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setFocusedIndex: (i) => set({ focusedIndex: i }),

  updateInvoice: (id, patch) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...patch } : inv
      ),
    })),

  updateLineItem: (invoiceId, lineItemId, patch) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              lineItems: inv.lineItems.map((li) =>
                li.id === lineItemId ? { ...li, ...patch } : li
              ),
            }
          : inv
      ),
    })),

  addLineItem: (invoiceId, item) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, lineItems: [...inv.lineItems, item] }
          : inv
      ),
    })),

  removeLineItem: (invoiceId, lineItemId) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, lineItems: inv.lineItems.filter((li) => li.id !== lineItemId) }
          : inv
      ),
    })),

  updateInvoiceStatus: (id, status) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              status,
              ...(status === "paid"
                ? { paidDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
                : {}),
              events: [
                ...inv.events,
                {
                  id: `ev-${Date.now()}`,
                  type: status === "paid" ? ("paid" as const) : status === "sent" ? ("sent" as const) : status === "voided" ? ("voided" as const) : ("created" as const),
                  text:
                    status === "paid"
                      ? "Payment received"
                      : status === "sent"
                        ? `Sent to ${inv.clientEmail}`
                        : status === "voided"
                          ? "Invoice voided"
                          : "Status updated",
                  time: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
                },
              ],
            }
          : inv
      ),
    })),

  addInvoice: (invoice) => set((s) => ({ invoices: [invoice, ...s.invoices] })),

  deleteInvoice: (id) =>
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) })),

  restoreInvoice: (invoice) =>
    set((s) => ({ invoices: [invoice, ...s.invoices].sort((a, b) => b.id.localeCompare(a.id)) })),

  recalcInvoice: (id) =>
    set((s) => ({
      invoices: s.invoices.map((inv) => {
        if (inv.id !== id) return inv;
        const subtotal = inv.lineItems.reduce(
          (sum, li) => sum + li.quantity * li.unitPrice,
          0
        );
        const tax = Math.round(subtotal * 0.1);
        return { ...inv, subtotal, tax, total: subtotal + tax };
      }),
    })),
}));
