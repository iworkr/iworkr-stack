import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFresh } from "./cache-utils";
import {
  type Invoice,
  type InvoiceStatus,
  type LineItem,
  type Payout,
  type DailyRevenue,
} from "./data";
import {
  getInvoices,
  getInvoice,
  getPayouts,
  getRevenueStats,
  getFinanceOverview,
  createInvoiceFull,
  updateInvoiceStatus as updateInvoiceStatusServer,
  addLineItem as addLineItemServer,
  removeLineItem as removeLineItemServer,
  updateLineItem as updateLineItemServer,
  deleteInvoice as deleteInvoiceAction,
  type CreateInvoiceParams,
  type FinanceOverview,
} from "@/app/actions/finance";

/* ── Types ────────────────────────────────────────────── */

export type FinanceTab = "overview" | "invoices" | "quotes" | "payouts";

/* ── Store ────────────────────────────────────────────── */

interface FinanceState {
  invoices: Invoice[];
  payouts: Payout[];
  dailyRevenue: DailyRevenue[];
  overview: FinanceOverview | null;
  loaded: boolean;
  loading: boolean;
  activeTab: FinanceTab;
  focusedIndex: number;
  orgId: string | null;

  _stale: boolean;
  _lastFetchedAt: number | null;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
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

  /** Server-synced create — persists to DB and updates local state */
  createInvoiceServer: (params: CreateInvoiceParams) => Promise<{ success: boolean; displayId?: string; invoiceId?: string; error?: string }>;

  /** Server-synced status update — persists to DB */
  updateInvoiceStatusServer: (invoiceId: string, dbId: string, status: InvoiceStatus) => Promise<void>;

  /** Server-synced delete — soft-deletes in DB */
  deleteInvoiceServer: (invoiceId: string, dbId: string) => Promise<void>;

  /** Handle realtime update */
  handleRealtimeUpdate: () => void;

  /* Recalculate totals from line items */
  recalcInvoice: (id: string) => void;

  /** Sync a single line-item edit to the server */
  syncLineItemToServer: (invoiceId: string, lineItemId: string, patch: Partial<LineItem>) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
  invoices: [],
  payouts: [],
  dailyRevenue: [],
  overview: null,
  loaded: false,
  loading: false,
  activeTab: "overview",
  focusedIndex: 0,
  orgId: null,
  _stale: true,
  _lastFetchedAt: null,

  loadFromServer: async (orgId: string) => {
    const state = get();
    if (state.loading) return;
    if (isFresh(state._lastFetchedAt) && state.orgId === orgId) return;

    const hasCache = state.invoices.length > 0 && state.orgId === orgId;
    set({ loading: !hasCache, orgId });
    try {
      const [invoicesResult, payoutsResult, revenueResult, overviewResult] = await Promise.all([
        getInvoices(orgId),
        getPayouts(orgId),
        getRevenueStats(orgId),
        getFinanceOverview(orgId),
      ]);

      const mappedInvoices: Invoice[] = [];
      if (invoicesResult.data && invoicesResult.data.length > 0) {
        // Fetch full invoice details with line items and events for each invoice
        const invoicePromises = invoicesResult.data.map((inv: any) => getInvoice(inv.id));
        const invoiceResults = await Promise.all(invoicePromises);
        
        for (const result of invoiceResults) {
          if (result.data) {
            const fullInvoice = result.data;
            mappedInvoices.push({
              id: fullInvoice.display_id || fullInvoice.id,
              dbId: fullInvoice.id,
              clientId: fullInvoice.client_id || "",
              clientName: fullInvoice.client_name || "",
              clientEmail: fullInvoice.client_email || "",
              clientAddress: fullInvoice.client_address || "",
              status: fullInvoice.status,
              issueDate: fullInvoice.issue_date
                ? new Date(fullInvoice.issue_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "",
              dueDate: fullInvoice.due_date
                ? new Date(fullInvoice.due_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "",
              paidDate: fullInvoice.paid_date
                ? new Date(fullInvoice.paid_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : undefined,
              lineItems: (fullInvoice.invoice_line_items || []).map((li: any) => ({
                id: li.id,
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unit_price,
              })),
              subtotal: fullInvoice.subtotal,
              tax: fullInvoice.tax,
              total: fullInvoice.total,
              paymentLink: fullInvoice.payment_link || undefined,
              events: (fullInvoice.invoice_events || []).map((ev: any) => ({
                id: ev.id,
                type: ev.type,
                text: ev.text || "",
                time: new Date(ev.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }),
              })),
              notes: fullInvoice.notes || undefined,
            });
          }
        }
      }

      const mappedPayouts: Payout[] = [];
      if (payoutsResult.data && payoutsResult.data.length > 0) {
        mappedPayouts.push(
          ...payoutsResult.data.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            date: p.payout_date
              ? new Date(p.payout_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "",
            bank: p.bank || "",
            invoiceIds: p.invoice_ids || [],
            status: p.status,
          }))
        );
      }

      const mappedRevenue: DailyRevenue[] = [];
      if (revenueResult.data && revenueResult.data.length > 0) {
        mappedRevenue.push(
          ...revenueResult.data.map((r: any) => ({
            date: new Date(r.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            amount: r.total_amount || r.revenue || 0,
            invoiceCount: r.invoice_count || 0,
          }))
        );
      }

      set({
        invoices: mappedInvoices,
        payouts: mappedPayouts,
        dailyRevenue: mappedRevenue,
        overview: overviewResult.data || null,
        loaded: true,
        loading: false,
        _stale: false,
        _lastFetchedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to load finance data:", error);
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;
    try {
      const [invoicesResult, payoutsResult, overviewResult] = await Promise.all([
        getInvoices(orgId),
        getPayouts(orgId),
        getFinanceOverview(orgId),
      ]);

      const mappedInvoices: Invoice[] = [];
      if (invoicesResult.data && invoicesResult.data.length > 0) {
        const invoicePromises = invoicesResult.data.map((inv: any) => getInvoice(inv.id));
        const invoiceResults = await Promise.all(invoicePromises);
        for (const result of invoiceResults) {
          if (result.data) {
            const fi = result.data;
            mappedInvoices.push({
              id: fi.display_id || fi.id,
              dbId: fi.id,
              clientId: fi.client_id || "",
              clientName: fi.client_name || "",
              clientEmail: fi.client_email || "",
              clientAddress: fi.client_address || "",
              status: fi.status,
              issueDate: fi.issue_date ? new Date(fi.issue_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
              dueDate: fi.due_date ? new Date(fi.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
              paidDate: fi.paid_date ? new Date(fi.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : undefined,
              lineItems: (fi.invoice_line_items || []).map((li: any) => ({ id: li.id, description: li.description, quantity: li.quantity, unitPrice: li.unit_price })),
              subtotal: fi.subtotal,
              tax: fi.tax,
              total: fi.total,
              paymentLink: fi.payment_link || undefined,
              events: (fi.invoice_events || []).map((ev: any) => ({ id: ev.id, type: ev.type, text: ev.text || "", time: new Date(ev.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) })),
              notes: fi.notes || undefined,
            });
          }
        }
      }

      const mappedPayouts: Payout[] = (payoutsResult.data || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        date: p.payout_date ? new Date(p.payout_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
        bank: p.bank || "",
        invoiceIds: p.invoice_ids || [],
        status: p.status,
      }));

      set({
        invoices: mappedInvoices,
        payouts: mappedPayouts,
        overview: overviewResult.data || get().overview,
        _lastFetchedAt: Date.now(),
        _stale: false,
      });
    } catch {
      // silent refresh failure
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setFocusedIndex: (i) => set({ focusedIndex: i }),

  updateInvoice: (id, patch) =>
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...patch } : inv
      ),
    })),

  updateLineItem: (invoiceId, lineItemId, patch) => {
    // Optimistic update
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
    }));
    // Server sync deferred to recalcInvoice via saveEdit flow
  },

  addLineItem: async (invoiceId, item) => {
    // Optimistic update
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, lineItems: [...inv.lineItems, item] }
          : inv
      ),
    }));

    // Server sync
    const inv = get().invoices.find((i) => i.id === invoiceId);
    if (inv?.dbId) {
      try {
        const result = await addLineItemServer(inv.dbId, {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        });
        if (result.data) {
          // Update the line item with the real server ID
          set((s) => ({
            invoices: s.invoices.map((i) =>
              i.id === invoiceId
                ? {
                    ...i,
                    lineItems: i.lineItems.map((li) =>
                      li.id === item.id ? { ...li, id: result.data.id } : li
                    ),
                  }
                : i
            ),
          }));
        }
        // Refresh to get accurate totals from server
        get().refresh();
      } catch (err) {
        console.error("Failed to add line item to server:", err);
      }
    }
  },

  removeLineItem: async (invoiceId, lineItemId) => {
    // Optimistic update
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, lineItems: inv.lineItems.filter((li) => li.id !== lineItemId) }
          : inv
      ),
    }));

    // Server sync — lineItemId is a real UUID from the DB
    if (lineItemId && !lineItemId.startsWith("li-")) {
      try {
        await removeLineItemServer(lineItemId);
        get().refresh();
      } catch (err) {
        console.error("Failed to remove line item from server:", err);
      }
    }
  },

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

  deleteInvoiceServer: async (invoiceId: string, dbId: string) => {
    // Optimistic removal from local state
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== invoiceId) }));
    // Server soft-delete
    try {
      await deleteInvoiceAction(dbId);
    } catch (err) {
      console.error("Failed to delete invoice on server:", err);
      await get().refresh();
    }
  },

  restoreInvoice: (invoice) =>
    set((s) => ({ invoices: [invoice, ...s.invoices].sort((a, b) => b.id.localeCompare(a.id)) })),

  recalcInvoice: (id) => {
    const inv = get().invoices.find((i) => i.id === id);
    if (!inv) return;
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
    }));
    // Persist recalculated totals — refresh from server after a short debounce
    const updated = get().invoices.find((i) => i.id === id);
    if (updated?.dbId) {
      get().refresh().catch(() => {});
    }
  },

  /** Sync a single line-item edit to the server (call after recalcInvoice) */
  syncLineItemToServer: async (invoiceId: string, lineItemId: string, patch: Partial<LineItem>) => {
    const inv = get().invoices.find((i) => i.id === invoiceId);
    if (!inv?.dbId) return;
    if (!lineItemId || lineItemId.startsWith("li-")) return;

    const serverPatch: Record<string, unknown> = {};
    if (patch.description !== undefined) serverPatch.description = patch.description;
    if (patch.quantity !== undefined) serverPatch.quantity = patch.quantity;
    if (patch.unitPrice !== undefined) serverPatch.unit_price = patch.unitPrice;

    try {
      await updateLineItemServer(lineItemId, serverPatch as any);
    } catch (err) {
      console.error("Failed to sync line item to server:", err);
    }
  },

  createInvoiceServer: async (params: CreateInvoiceParams) => {
    try {
      const { data, error } = await createInvoiceFull(params);
      if (error || !data) {
        return { success: false, error: error || "Failed to create invoice" };
      }
      // Refresh to get the full mapped invoice
      await get().refresh();
      return { success: true, displayId: data.display_id, invoiceId: data.invoice_id };
    } catch (err: any) {
      return { success: false, error: err.message || "Unexpected error" };
    }
  },

  updateInvoiceStatusServer: async (invoiceId: string, dbId: string, status: InvoiceStatus) => {
    // Optimistic update
    get().updateInvoiceStatus(invoiceId, status);
    // Persist to server
    await updateInvoiceStatusServer(dbId, status);
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },
    }),
    {
      name: "iworkr-finance",
      onRehydrateStorage: () => (state) => {
        if (state && state.invoices && state.invoices.length > 0) {
          state.loaded = true;
        }
      },
      partialize: (state) => ({
        invoices: state.invoices,
        payouts: state.payouts,
        dailyRevenue: state.dailyRevenue,
        overview: state.overview,
        orgId: state.orgId,
        _lastFetchedAt: state._lastFetchedAt,
      }),
    }
  )
);
