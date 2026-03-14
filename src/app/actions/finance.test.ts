/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ═══════════════════════════════════════════════════════════════════
   Finance Server Actions — Unit Tests
   All Supabase calls are mocked so tests run without a database.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Chainable mock builder (Proxy-based, matches Supabase client) ── */

function chainable(overrides: Record<string, any> = {}): any {
  const self: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop in overrides) return overrides[prop];
        if (prop === "then") return undefined; // prevent Promise-like
        if (["maybeSingle", "single"].includes(prop)) {
          return () => Promise.resolve({ data: null, error: null });
        }
        return (..._args: any[]) => self;
      },
    }
  );
  return self;
}

/* ── Supabase mock setup ───────────────────────────────────────────── */

const { mockGetUser, mockFrom, mockRpc } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
    })
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/automation", () => ({
  Events: {
    invoiceCreated: vi.fn((...a: any[]) => ({ type: "invoiceCreated", a })),
    invoiceSent: vi.fn((...a: any[]) => ({ type: "invoiceSent", a })),
    invoicePaid: vi.fn((...a: any[]) => ({ type: "invoicePaid", a })),
    invoiceOverdue: vi.fn((...a: any[]) => ({ type: "invoiceOverdue", a })),
  },
  dispatch: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

/* ── Import module under test (after mocks) ────────────────────────── */

import {
  getOrgSettings,
  getInvoices,
  getInvoice,
  createInvoice,
  deleteInvoice,
  updateInvoice,
  updateInvoiceStatus,
  addLineItem,
  updateLineItem,
  removeLineItem,
  getPayouts,
  getRevenueStats,
  getFinanceOverview,
  createInvoiceFull,
  getInvoiceDetail,
  runOverdueWatchdog,
} from "./finance";
import type { CreateInvoiceParams } from "./finance";

/* ── Helpers ───────────────────────────────────────────────────────── */

const TEST_USER = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", email: "test@example.com" };
const TEST_ORG_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const TEST_INVOICE_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

function makeInvoiceParams(overrides: Partial<CreateInvoiceParams> = {}): CreateInvoiceParams {
  return {
    organization_id: TEST_ORG_ID,
    due_date: "2026-04-01",
    line_items: [
      { description: "Service A", quantity: 2, unit_price: 100 },
      { description: "Part B", quantity: 1, unit_price: 50 },
    ],
    ...overrides,
  };
}

/** Default mock: membership succeeds, auth succeeds */
function setupDefaultMocks() {
  mockGetUser.mockResolvedValue({
    data: { user: TEST_USER },
  });
  mockFrom.mockImplementation((_table: string) => {
    if (_table === "organization_members") {
      return chainable({
        maybeSingle: () =>
          Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
      });
    }
    return chainable();
  });
  mockRpc.mockResolvedValue({ data: null, error: null });
}

/* ── Test setup ──────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

/* ═══════════════════════════════════════════════════════════════════
   Section 1: Authorization Checks
   ═══════════════════════════════════════════════════════════════════ */

describe("Authorization checks", () => {
  it("getInvoices returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getInvoices(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getInvoice returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getInvoice(TEST_INVOICE_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("createInvoice returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    // createInvoice runs validation first; use valid params so validation passes
    const result = await createInvoice(makeInvoiceParams());
    // Validation passes → auth check → Unauthorized
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getOrgSettings returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getOrgSettings(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("deleteInvoice returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await deleteInvoice(TEST_INVOICE_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("updateInvoice returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await updateInvoice(TEST_INVOICE_ID, { status: "paid" });
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("updateInvoiceStatus returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await updateInvoiceStatus(TEST_INVOICE_ID, "paid");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getPayouts returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getPayouts(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getRevenueStats returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getRevenueStats(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getFinanceOverview returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getFinanceOverview(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("runOverdueWatchdog returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await runOverdueWatchdog(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getOrgSettings returns Unauthorized when membership is null", async () => {
    mockFrom.mockImplementation((_table: string) => {
      if (_table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await getOrgSettings(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getInvoices returns Unauthorized when membership is null", async () => {
    mockFrom.mockImplementation((_table: string) => {
      if (_table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await getInvoices(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 2: Invoice Total Calculation (via createInvoice)
   ═══════════════════════════════════════════════════════════════════ */

describe("Invoice total calculation (via createInvoice)", () => {
  let capturedInsert: any = null;

  function setupCreateInvoiceMocks(maxDisplayId: string | null = null) {
    capturedInsert = null;
    let invoiceCallN = 0;

    const invoiceRow = {
      id: TEST_INVOICE_ID,
      organization_id: TEST_ORG_ID,
      display_id: "INV-0001",
      status: "draft",
      subtotal: 0, tax: 0, total: 0,
      client_id: null, client_name: null, client_email: null,
      created_by: TEST_USER.id,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "invoices") {
        invoiceCallN++;
        if (invoiceCallN === 1) {
          // generateDisplayId — return max display_id
          return chainable({
            maybeSingle: () =>
              Promise.resolve({
                data: maxDisplayId ? { display_id: maxDisplayId } : null,
                error: null,
              }),
          });
        }
        // insert call
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "insert") return (d: any) => { capturedInsert = d; return c; };
            if (p === "select") return () => c;
            if (p === "single") return () => Promise.resolve({ data: invoiceRow, error: null });
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      if (table === "invoice_line_items" || table === "invoice_events") {
        return chainable();
      }
      return chainable();
    });
  }

  beforeEach(() => {
    setupCreateInvoiceMocks();
  });

  it("calculates subtotal, tax (10% default), and total for two line items", async () => {
    await createInvoice(makeInvoiceParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.subtotal).toBe(250);
    expect(capturedInsert.tax).toBe(25);
    expect(capturedInsert.total).toBe(275);
  });

  it("calculates correctly with 0% tax rate", async () => {
    await createInvoice(makeInvoiceParams({ tax_rate: 0 }));
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.subtotal).toBe(250);
    expect(capturedInsert.tax).toBe(0);
    expect(capturedInsert.total).toBe(250);
  });

  it("calculates correctly with 100% tax rate", async () => {
    await createInvoice(makeInvoiceParams({ tax_rate: 100 }));
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.subtotal).toBe(250);
    expect(capturedInsert.tax).toBe(250);
    expect(capturedInsert.total).toBe(500);
  });

  it("calculates correctly with 15% GST", async () => {
    await createInvoice(makeInvoiceParams({ tax_rate: 15 }));
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.subtotal).toBe(250);
    expect(capturedInsert.tax).toBe(37.5);
    expect(capturedInsert.total).toBe(287.5);
  });

  it("calculates correctly with a single line item", async () => {
    await createInvoice(
      makeInvoiceParams({
        line_items: [{ description: "Single Item", quantity: 3, unit_price: 50 }],
      })
    );
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.subtotal).toBe(150);
    expect(capturedInsert.tax).toBe(15);
    expect(capturedInsert.total).toBe(165);
  });

  it("handles fractional quantities correctly", async () => {
    await createInvoice(
      makeInvoiceParams({
        line_items: [{ description: "Hourly Work", quantity: 1.5, unit_price: 80 }],
      })
    );
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.subtotal).toBe(120);
    expect(capturedInsert.tax).toBe(12);
    expect(capturedInsert.total).toBe(132);
  });

  it("uses 10 as default tax rate when tax_rate is not provided", async () => {
    await createInvoice(
      makeInvoiceParams({
        tax_rate: undefined,
        line_items: [{ description: "Test", quantity: 1, unit_price: 100 }],
      })
    );
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.tax_rate).toBe(10);
    expect(capturedInsert.tax).toBe(10);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 3: Validation via Zod (createInvoiceSchema)
   ═══════════════════════════════════════════════════════════════════ */

describe("Zod validation (createInvoice)", () => {
  it("rejects createInvoice with empty line items array", async () => {
    const result = await createInvoice(makeInvoiceParams({ line_items: [] }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("rejects createInvoice with missing due_date", async () => {
    const result = await createInvoice(makeInvoiceParams({ due_date: "" as any }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("rejects createInvoice with invalid organization_id", async () => {
    const result = await createInvoice(makeInvoiceParams({ organization_id: "not-a-uuid" }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("rejects createInvoice with negative quantity", async () => {
    const result = await createInvoice(
      makeInvoiceParams({
        line_items: [{ description: "Bad", quantity: -1, unit_price: 100 }],
      })
    );
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("rejects createInvoice with zero quantity", async () => {
    const result = await createInvoice(
      makeInvoiceParams({
        line_items: [{ description: "Bad", quantity: 0, unit_price: 100 }],
      })
    );
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 4: Display ID Generation (via createInvoice)
   ═══════════════════════════════════════════════════════════════════ */

describe("Display ID generation (via createInvoice)", () => {
  let capturedInsert: any = null;

  function setupDisplayIdMock(maxDisplayId: string | null) {
    capturedInsert = null;
    let invoiceCallN = 0;

    const invoiceRow = {
      id: TEST_INVOICE_ID, organization_id: TEST_ORG_ID,
      display_id: "INV-0001", status: "draft",
      subtotal: 250, tax: 25, total: 275,
      client_id: null, client_name: null, client_email: null,
      created_by: TEST_USER.id,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "invoices") {
        invoiceCallN++;
        if (invoiceCallN === 1) {
          return chainable({
            maybeSingle: () =>
              Promise.resolve({
                data: maxDisplayId ? { display_id: maxDisplayId } : null,
                error: null,
              }),
          });
        }
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "insert") return (d: any) => { capturedInsert = d; return c; };
            if (p === "select") return () => c;
            if (p === "single") return () => Promise.resolve({ data: invoiceRow, error: null });
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      return chainable();
    });
  }

  it("generates INV-0001 when no existing invoices", async () => {
    setupDisplayIdMock(null);
    await createInvoice(makeInvoiceParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.display_id).toBe("INV-0001");
  });

  it("increments from INV-0005 to INV-0006", async () => {
    setupDisplayIdMock("INV-0005");
    await createInvoice(makeInvoiceParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.display_id).toBe("INV-0006");
  });

  it("increments from INV-0099 to INV-0100", async () => {
    setupDisplayIdMock("INV-0099");
    await createInvoice(makeInvoiceParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.display_id).toBe("INV-0100");
  });

  it("increments from INV-9999 to INV-10000", async () => {
    setupDisplayIdMock("INV-9999");
    await createInvoice(makeInvoiceParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.display_id).toBe("INV-10000");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 5: updateInvoiceStatus
   ═══════════════════════════════════════════════════════════════════ */

describe("updateInvoiceStatus", () => {
  let capturedUpdate: any = null;
  let capturedEvent: any = null;

  beforeEach(() => {
    capturedUpdate = null;
    capturedEvent = null;

    const invoiceRow = {
      id: TEST_INVOICE_ID, organization_id: TEST_ORG_ID,
      display_id: "INV-0042", status: "sent", total: 275,
      client_id: "client-1", client_name: "Acme Corp",
      client_email: "billing@acme.com",
    };

    let invoicesN = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "invoices") {
        invoicesN++;
        if (invoicesN === 1) {
          // fetch current invoice
          return chainable({
            maybeSingle: () =>
              Promise.resolve({ data: { display_id: "INV-0042", status: "sent" }, error: null }),
          });
        }
        // update call
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "update") return (d: any) => { capturedUpdate = d; return c; };
            if (p === "select") return () => c;
            if (p === "single") return () => Promise.resolve({ data: invoiceRow, error: null });
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      if (table === "invoice_events") {
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "insert") return (d: any) => { capturedEvent = d; return c; };
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      return chainable();
    });
  });

  it("sets paid_date when status is 'paid'", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "paid");
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate.status).toBe("paid");
    expect(capturedUpdate.paid_date).toBeDefined();
    expect(capturedUpdate.paid_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does NOT set paid_date when status is 'sent'", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "sent");
    expect(capturedUpdate).not.toBeNull();
    expect(capturedUpdate.status).toBe("sent");
    expect(capturedUpdate.paid_date).toBeUndefined();
  });

  it("creates 'paid' event for paid status", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "paid");
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe("paid");
    expect(capturedEvent.text).toContain("INV-0042");
    expect(capturedEvent.text).toContain("paid");
  });

  it("creates 'sent' event for sent status", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "sent");
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe("sent");
    expect(capturedEvent.text).toContain("sent");
  });

  it("creates 'viewed' event for viewed status", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "viewed");
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe("viewed");
  });

  it("creates 'voided' event for voided status", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "voided");
    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent.type).toBe("voided");
    expect(capturedEvent.text).toContain("voided");
  });

  it("stores old_status and new_status in event metadata", async () => {
    await updateInvoiceStatus(TEST_INVOICE_ID, "paid");
    expect(capturedEvent.metadata).toEqual({
      old_status: "sent",
      new_status: "paid",
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 6: Error Handling
   ═══════════════════════════════════════════════════════════════════ */

describe("Error handling", () => {
  it("createInvoice returns graceful error when auth throws", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Network failure"));
    const result = await createInvoice(makeInvoiceParams());
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("getInvoices returns error when select query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "invoices") {
        // order() is the terminal call for getInvoices
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "order") return () => Promise.resolve({ data: null, error: { message: "DB read error" } });
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      return chainable();
    });

    const result = await getInvoices(TEST_ORG_ID);
    expect(result.error).toBe("DB read error");
    expect(result.data).toBeNull();
  });

  it("deleteInvoice returns error when invoice not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "invoices") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });

    const result = await deleteInvoice(TEST_INVOICE_ID);
    expect(result.error).toBe("Invoice not found");
    expect(result.data).toBeNull();
  });

  it("getInvoice returns error when invoice not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "invoices") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });

    const result = await getInvoice(TEST_INVOICE_ID);
    expect(result.error).toBe("Invoice not found");
    expect(result.data).toBeNull();
  });

  it("updateInvoice returns error when invoice not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "invoices") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });

    const result = await updateInvoice(TEST_INVOICE_ID, { status: "paid" });
    expect(result.error).toBe("Invoice not found");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 7: getOrgSettings
   ═══════════════════════════════════════════════════════════════════ */

describe("getOrgSettings", () => {
  it("returns org name and settings on success", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "organizations") {
        return chainable({
          maybeSingle: () =>
            Promise.resolve({
              data: { name: "Test Org", settings: { tax_id: "ABN-123" } },
              error: null,
            }),
        });
      }
      return chainable();
    });

    const result = await getOrgSettings(TEST_ORG_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      name: "Test Org",
      settings: { tax_id: "ABN-123" },
    });
  });

  it("returns empty settings object when settings field is null", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "organizations") {
        return chainable({
          maybeSingle: () =>
            Promise.resolve({
              data: { name: "Test Org", settings: null },
              error: null,
            }),
        });
      }
      return chainable();
    });

    const result = await getOrgSettings(TEST_ORG_ID);
    expect(result.error).toBeNull();
    expect(result.data!.settings).toEqual({});
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 8: getFinanceOverview (RPC-backed)
   ═══════════════════════════════════════════════════════════════════ */

describe("getFinanceOverview", () => {
  it("returns RPC data on success", async () => {
    const overview = {
      revenue_mtd: 5000, revenue_growth: 12.5,
      overdue_amount: 200, overdue_count: 2,
      avg_payout_days: 3, stripe_balance: 1500,
      total_paid_all_time: 50000,
      invoices_sent: 100, invoices_paid: 90,
    };
    mockRpc.mockResolvedValueOnce({ data: overview, error: null });
    const result = await getFinanceOverview(TEST_ORG_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(overview);
  });

  it("returns error when RPC fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });
    const result = await getFinanceOverview(TEST_ORG_ID);
    expect(result.error).toBe("RPC error");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 9: runOverdueWatchdog
   ═══════════════════════════════════════════════════════════════════ */

describe("runOverdueWatchdog", () => {
  it("calls RPC and returns result on success", async () => {
    mockRpc.mockResolvedValueOnce({ data: { marked_overdue: 3 }, error: null });
    const result = await runOverdueWatchdog(TEST_ORG_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ marked_overdue: 3 });
  });

  it("returns error when RPC fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "Watchdog error" } });
    const result = await runOverdueWatchdog(TEST_ORG_ID);
    expect(result.error).toBe("Watchdog error");
    expect(result.data).toBeNull();
  });

  it("passes orgId correctly to RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: { marked_overdue: 0 }, error: null });
    await runOverdueWatchdog(TEST_ORG_ID);
    expect(mockRpc).toHaveBeenCalledWith("mark_overdue_invoices", {
      p_org_id: TEST_ORG_ID,
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 10: createInvoiceFull (RPC-backed with fallback)
   ═══════════════════════════════════════════════════════════════════ */

describe("createInvoiceFull", () => {
  it("returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await createInvoiceFull(makeInvoiceParams());
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("returns RPC data on success", async () => {
    const rpcResult = { invoice_id: TEST_INVOICE_ID, display_id: "INV-0001", total: 275 };
    mockRpc.mockResolvedValueOnce({ data: rpcResult, error: null });
    const result = await createInvoiceFull(makeInvoiceParams());
    expect(result.error).toBeNull();
    expect(result.data).toEqual(rpcResult);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 11: Return shape consistency
   ═══════════════════════════════════════════════════════════════════ */

describe("Return shape consistency", () => {
  it("error responses always have { data: null, error: string }", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getInvoices(TEST_ORG_ID);
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result.data).toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("getOrgSettings returns an object with data and error keys", async () => {
    const r = await getOrgSettings(TEST_ORG_ID);
    expect(r).toHaveProperty("data");
    expect(r).toHaveProperty("error");
  });

  it("getPayouts returns an object with data and error keys", async () => {
    const r = await getPayouts(TEST_ORG_ID);
    expect(r).toHaveProperty("data");
    expect(r).toHaveProperty("error");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 12: Line item operations
   ═══════════════════════════════════════════════════════════════════ */

describe("Line item operations", () => {
  it("addLineItem returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await addLineItem(TEST_INVOICE_ID, {
      description: "Test", quantity: 1, unit_price: 100,
    });
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("updateLineItem returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await updateLineItem("li-1", { description: "Updated" });
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("removeLineItem returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await removeLineItem("li-1");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("removeLineItem returns error when line item not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "invoice_line_items") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await removeLineItem("nonexistent-id");
    expect(result.error).toBe("Line item not found");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 13: getInvoiceDetail (RPC with fallback)
   ═══════════════════════════════════════════════════════════════════ */

describe("getInvoiceDetail", () => {
  it("returns RPC data on success", async () => {
    const detail = {
      id: TEST_INVOICE_ID, display_id: "INV-0042", total: 500,
      line_items: [], events: [],
    };
    mockRpc.mockResolvedValueOnce({ data: detail, error: null });
    const result = await getInvoiceDetail(TEST_INVOICE_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(detail);
  });

  it("falls back to getInvoice when RPC fails", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RPC unavailable" } });
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getInvoiceDetail(TEST_INVOICE_ID);
    expect(result.error).toBe("Unauthorized");
  });
});
