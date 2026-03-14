import { describe, it, expect } from "vitest";
import {
  validateEmail,
  sanitize,
  validate,
  uuidSchema,
  emailSchema,
  phoneSchema,
  companyNameSchema,
  inviteEmailSchema,
  jobStatusSchema,
  jobPrioritySchema,
  createJobSchema,
  updateJobSchema,
  createClientSchema,
  createInvoiceSchema,
  createScheduleBlockSchema,
  createFlowSchema,
} from "./validation";

/* ── Helpers ──────────────────────────────────────────── */

const VALID_UUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const VALID_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/* ── validateEmail ────────────────────────────────────── */

describe("validateEmail", () => {
  it("returns true for standard email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("returns true for tagged email", () => {
    expect(validateEmail("test+tag@company.co.uk")).toBe(true);
  });

  it("returns true for email with dots in local part", () => {
    expect(validateEmail("first.last@domain.org")).toBe(true);
  });

  it("returns true for email with hyphens in domain", () => {
    expect(validateEmail("user@my-company.com")).toBe(true);
  });

  it("returns true for email with subdomain", () => {
    expect(validateEmail("admin@mail.server.co")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(validateEmail("")).toBe(false);
  });

  it("returns false for missing @", () => {
    expect(validateEmail("no-at-sign")).toBe(false);
  });

  it("returns false for missing domain", () => {
    expect(validateEmail("@nodomain.com")).toBe(false);
  });

  it("returns false for spaces in email", () => {
    expect(validateEmail("spaces in@email.com")).toBe(false);
  });

  it("returns false for double @", () => {
    expect(validateEmail("user@@example.com")).toBe(false);
  });

  it("returns false for trailing dot in domain", () => {
    expect(validateEmail("user@example.com.")).toBe(false);
  });
});

/* ── sanitize ─────────────────────────────────────────── */

describe("sanitize", () => {
  it("replaces < with &lt;", () => {
    expect(sanitize("<")).toBe("&lt;");
  });

  it("replaces > with &gt;", () => {
    expect(sanitize(">")).toBe("&gt;");
  });

  it('replaces " with &quot;', () => {
    expect(sanitize('"')).toBe("&quot;");
  });

  it("replaces ' with &#x27;", () => {
    expect(sanitize("'")).toBe("&#x27;");
  });

  it("replaces / with &#x2F;", () => {
    expect(sanitize("/")).toBe("&#x2F;");
  });

  it("returns clean string unchanged", () => {
    expect(sanitize("Hello World 123")).toBe("Hello World 123");
  });

  it("returns empty string for empty input", () => {
    expect(sanitize("")).toBe("");
  });

  it("handles combined XSS injection", () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
  });

  it("handles multiple occurrences", () => {
    expect(sanitize("<<>>")).toBe("&lt;&lt;&gt;&gt;");
  });

  it("handles mixed content", () => {
    expect(sanitize("Hello <b>World</b>")).toBe(
      "Hello &lt;b&gt;World&lt;&#x2F;b&gt;"
    );
  });
});

/* ── validate ─────────────────────────────────────────── */

describe("validate", () => {
  it("returns data and null error for valid input", () => {
    const result = validate(emailSchema, "user@example.com");
    expect(result.data).toBe("user@example.com");
    expect(result.error).toBeNull();
  });

  it("returns null data and error string for invalid input", () => {
    const result = validate(emailSchema, "not-an-email");
    expect(result.data).toBeNull();
    expect(result.error).toBeTypeOf("string");
    expect(result.error!.length).toBeGreaterThan(0);
  });

  it("error message includes path information", () => {
    const result = validate(createJobSchema, { organization_id: "bad-uuid" });
    expect(result.error).toContain("organization_id");
  });

  it("joins multiple errors with semicolons", () => {
    const result = validate(createJobSchema, {});
    expect(result.error).toContain(";");
  });
});

/* ── uuidSchema ───────────────────────────────────────── */

describe("uuidSchema", () => {
  it("accepts a valid UUID", () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(uuidSchema.safeParse("").success).toBe(false);
  });
});

/* ── companyNameSchema ────────────────────────────────── */

describe("companyNameSchema", () => {
  it("accepts a valid company name", () => {
    expect(companyNameSchema.safeParse("Acme Corp").success).toBe(true);
  });

  it("accepts name with punctuation", () => {
    expect(companyNameSchema.safeParse("O'Brien & Sons, Ltd.").success).toBe(true);
  });

  it("accepts name with numbers", () => {
    expect(companyNameSchema.safeParse("Studio 42").success).toBe(true);
  });

  it("rejects single character (min 2)", () => {
    expect(companyNameSchema.safeParse("A").success).toBe(false);
  });

  it("accepts exactly 2 characters", () => {
    expect(companyNameSchema.safeParse("AB").success).toBe(true);
  });

  it("rejects name over 50 characters", () => {
    expect(companyNameSchema.safeParse("A".repeat(51)).success).toBe(false);
  });

  it("accepts exactly 50 characters", () => {
    expect(companyNameSchema.safeParse("A".repeat(50)).success).toBe(true);
  });

  it("rejects special characters like @", () => {
    expect(companyNameSchema.safeParse("Test@Corp").success).toBe(false);
  });

  it("rejects special characters like #", () => {
    expect(companyNameSchema.safeParse("Test#Corp").success).toBe(false);
  });

  it("rejects special characters like !", () => {
    expect(companyNameSchema.safeParse("Test!").success).toBe(false);
  });
});

/* ── phoneSchema ──────────────────────────────────────── */

describe("phoneSchema", () => {
  it("accepts a simple number", () => {
    expect(phoneSchema.safeParse("0412345678").success).toBe(true);
  });

  it("accepts number with spaces", () => {
    expect(phoneSchema.safeParse("0412 345 678").success).toBe(true);
  });

  it("accepts number with international prefix", () => {
    expect(phoneSchema.safeParse("+61 412 345 678").success).toBe(true);
  });

  it("accepts number with parentheses and dashes", () => {
    expect(phoneSchema.safeParse("(02) 9876-5432").success).toBe(true);
  });

  it("accepts empty string", () => {
    expect(phoneSchema.safeParse("").success).toBe(true);
  });

  it("accepts undefined (optional)", () => {
    expect(phoneSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejects strings with letters", () => {
    expect(phoneSchema.safeParse("0412abc678").success).toBe(false);
  });

  it("rejects strings over 30 characters", () => {
    expect(phoneSchema.safeParse("1".repeat(31)).success).toBe(false);
  });
});

/* ── inviteEmailSchema ────────────────────────────────── */

describe("inviteEmailSchema", () => {
  it("accepts a real email address", () => {
    expect(inviteEmailSchema.safeParse("user@company.com").success).toBe(true);
  });

  it("rejects @example.com domain", () => {
    const result = inviteEmailSchema.safeParse("test@example.com");
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    expect(inviteEmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("accepts example.org (only .com is blocked)", () => {
    expect(inviteEmailSchema.safeParse("user@example.org").success).toBe(true);
  });
});

/* ── jobStatusSchema ──────────────────────────────────── */

describe("jobStatusSchema", () => {
  const validStatuses = ["backlog", "todo", "in_progress", "done", "cancelled"];

  validStatuses.forEach((status) => {
    it(`accepts "${status}"`, () => {
      expect(jobStatusSchema.safeParse(status).success).toBe(true);
    });
  });

  it("rejects invalid status", () => {
    expect(jobStatusSchema.safeParse("archived").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(jobStatusSchema.safeParse("").success).toBe(false);
  });

  it("rejects number", () => {
    expect(jobStatusSchema.safeParse(1).success).toBe(false);
  });
});

/* ── jobPrioritySchema ────────────────────────────────── */

describe("jobPrioritySchema", () => {
  const validPriorities = ["urgent", "high", "medium", "low", "none"];

  validPriorities.forEach((priority) => {
    it(`accepts "${priority}"`, () => {
      expect(jobPrioritySchema.safeParse(priority).success).toBe(true);
    });
  });

  it("rejects invalid priority", () => {
    expect(jobPrioritySchema.safeParse("critical").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(jobPrioritySchema.safeParse("").success).toBe(false);
  });
});

/* ── createJobSchema ──────────────────────────────────── */

describe("createJobSchema", () => {
  const minimalJob = {
    organization_id: VALID_ORG_ID,
    title: "Fix leaking tap",
  };

  const fullJob = {
    ...minimalJob,
    description: "Customer reports a dripping kitchen tap",
    status: "todo" as const,
    priority: "high" as const,
    client_id: VALID_UUID,
    assignee_id: VALID_UUID,
    due_date: "2026-04-01",
    location: "123 Main St, Sydney",
    location_lat: -33.8688,
    location_lng: 151.2093,
    labels: ["plumbing", "urgent"],
    revenue: 250,
    cost: 80,
    estimated_hours: 2,
    actual_hours: 1.5,
  };

  it("accepts a full job with all fields", () => {
    const result = createJobSchema.safeParse(fullJob);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal job (org_id + title only)", () => {
    const result = createJobSchema.safeParse(minimalJob);
    expect(result.success).toBe(true);
  });

  it("defaults status to backlog when omitted", () => {
    const result = createJobSchema.safeParse(minimalJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("backlog");
    }
  });

  it("defaults priority to none when omitted", () => {
    const result = createJobSchema.safeParse(minimalJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("none");
    }
  });

  it("defaults labels to empty array when omitted", () => {
    const result = createJobSchema.safeParse(minimalJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.labels).toEqual([]);
    }
  });

  it("rejects missing organization_id", () => {
    const result = createJobSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = createJobSchema.safeParse({ organization_id: VALID_ORG_ID });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 characters", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects latitude below -90", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lat: -91 });
    expect(result.success).toBe(false);
  });

  it("rejects latitude above 90", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lat: 91 });
    expect(result.success).toBe(false);
  });

  it("accepts latitude at boundary -90", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lat: -90 });
    expect(result.success).toBe(true);
  });

  it("accepts latitude at boundary 90", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lat: 90 });
    expect(result.success).toBe(true);
  });

  it("rejects longitude below -180", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lng: -181 });
    expect(result.success).toBe(false);
  });

  it("rejects longitude above 180", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lng: 181 });
    expect(result.success).toBe(false);
  });

  it("accepts longitude at boundary -180", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lng: -180 });
    expect(result.success).toBe(true);
  });

  it("accepts longitude at boundary 180", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, location_lng: 180 });
    expect(result.success).toBe(true);
  });

  it("rejects negative revenue", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, revenue: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid organization_id format", () => {
    const result = createJobSchema.safeParse({ ...minimalJob, organization_id: "bad" });
    expect(result.success).toBe(false);
  });
});

/* ── createClientSchema ───────────────────────────────── */

describe("createClientSchema", () => {
  const validClient = {
    organization_id: VALID_ORG_ID,
    name: "John Smith",
  };

  it("accepts a valid client with minimal fields", () => {
    expect(createClientSchema.safeParse(validClient).success).toBe(true);
  });

  it("accepts client with all optional fields", () => {
    const full = {
      ...validClient,
      email: "john@example.com",
      phone: "0412345678",
      status: "active" as const,
      type: "commercial" as const,
      address: "456 George St",
      address_lat: -33.87,
      address_lng: 151.21,
      tags: ["vip"],
      notes: "Good customer",
    };
    expect(createClientSchema.safeParse(full).success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createClientSchema.safeParse({ organization_id: VALID_ORG_ID });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createClientSchema.safeParse({ ...validClient, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing organization_id", () => {
    const result = createClientSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("defaults status to lead", () => {
    const result = createClientSchema.safeParse(validClient);
    if (result.success) {
      expect(result.data.status).toBe("lead");
    }
  });

  it("defaults type to residential", () => {
    const result = createClientSchema.safeParse(validClient);
    if (result.success) {
      expect(result.data.type).toBe("residential");
    }
  });

  it("accepts empty string for email", () => {
    const result = createClientSchema.safeParse({ ...validClient, email: "" });
    expect(result.success).toBe(true);
  });
});

/* ── createInvoiceSchema ──────────────────────────────── */

describe("createInvoiceSchema", () => {
  const validInvoice = {
    organization_id: VALID_ORG_ID,
    due_date: "2026-04-30",
    line_items: [
      { description: "Labour - Plumbing", quantity: 2, unit_price: 85 },
    ],
  };

  it("accepts a valid invoice", () => {
    expect(createInvoiceSchema.safeParse(validInvoice).success).toBe(true);
  });

  it("accepts invoice with multiple line items", () => {
    const invoice = {
      ...validInvoice,
      line_items: [
        { description: "Labour", quantity: 2, unit_price: 85 },
        { description: "Materials", quantity: 1, unit_price: 45 },
      ],
    };
    expect(createInvoiceSchema.safeParse(invoice).success).toBe(true);
  });

  it("rejects empty line_items array", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, line_items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing due_date", () => {
    const result = createInvoiceSchema.safeParse({
      organization_id: VALID_ORG_ID,
      line_items: validInvoice.line_items,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty due_date", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, due_date: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing organization_id", () => {
    const result = createInvoiceSchema.safeParse({
      due_date: "2026-04-30",
      line_items: validInvoice.line_items,
    });
    expect(result.success).toBe(false);
  });

  it("defaults tax_rate to 10", () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    if (result.success) {
      expect(result.data.tax_rate).toBe(10);
    }
  });

  it("rejects line item with zero quantity", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      line_items: [{ description: "Test", quantity: 0, unit_price: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects line item with empty description", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      line_items: [{ description: "", quantity: 1, unit_price: 10 }],
    });
    expect(result.success).toBe(false);
  });
});

/* ── createScheduleBlockSchema ────────────────────────── */

describe("createScheduleBlockSchema", () => {
  const validBlock = {
    organization_id: VALID_ORG_ID,
    technician_id: VALID_UUID,
    title: "Install water heater",
    start_time: "2026-04-01T09:00:00Z",
    end_time: "2026-04-01T11:00:00Z",
  };

  it("accepts a valid schedule block", () => {
    expect(createScheduleBlockSchema.safeParse(validBlock).success).toBe(true);
  });

  it("rejects missing start_time", () => {
    const { start_time: _, ...rest } = validBlock;
    expect(createScheduleBlockSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing end_time", () => {
    const { end_time: _, ...rest } = validBlock;
    expect(createScheduleBlockSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing technician_id", () => {
    const { technician_id: _, ...rest } = validBlock;
    expect(createScheduleBlockSchema.safeParse(rest).success).toBe(false);
  });
});

/* ── createFlowSchema ─────────────────────────────────── */

describe("createFlowSchema", () => {
  const validFlow = {
    organization_id: VALID_ORG_ID,
    name: "New lead follow-up",
  };

  it("accepts a valid flow with minimal fields", () => {
    expect(createFlowSchema.safeParse(validFlow).success).toBe(true);
  });

  it("defaults category to operations", () => {
    const result = createFlowSchema.safeParse(validFlow);
    if (result.success) {
      expect(result.data.category).toBe("operations");
    }
  });

  it("accepts valid category values", () => {
    for (const cat of ["marketing", "billing", "operations"]) {
      expect(createFlowSchema.safeParse({ ...validFlow, category: cat }).success).toBe(true);
    }
  });

  it("rejects invalid category", () => {
    expect(createFlowSchema.safeParse({ ...validFlow, category: "other" }).success).toBe(false);
  });

  it("rejects missing name", () => {
    expect(createFlowSchema.safeParse({ organization_id: VALID_ORG_ID }).success).toBe(false);
  });
});
