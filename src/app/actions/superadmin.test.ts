/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ═══════════════════════════════════════════════════════════════════
   Superadmin Server Actions — Unit Tests
   All Supabase calls are mocked so tests run without a database.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Mock builder ────────────────────────────────────────────────── */

function chainable(overrides: Record<string, any> = {}): any {
  const self: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop in overrides) return overrides[prop];
        // Terminal methods that resolve to a Supabase-style result
        if (["maybeSingle", "single"].includes(prop)) {
          return () => Promise.resolve({ data: null, error: null, count: 0 });
        }
        // Default: return a function that keeps the chain going
        return (..._args: any[]) => self;
      },
    }
  );
  return self;
}

/* ── Create mock clients ─────────────────────────────────────────── */

const mockAdminFrom = vi.fn((_table: string) => chainable());
const mockAdminAuth = {
  admin: {
    signOut: vi.fn(),
    updateUserById: vi.fn(),
    generateLink: vi.fn(),
  },
};

const mockAdminClient = {
  from: mockAdminFrom,
  auth: mockAdminAuth,
};

const mockServerAuth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: "user-1", email: "theo@iworkrapp.com" } },
  }),
  resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
};

const mockServerClient = {
  auth: mockServerAuth,
  from: vi.fn((_table: string) => chainable()),
};

/* ── Register mocks before module import ─────────────────────────── */

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => mockAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => Promise.resolve(mockServerClient),
}));

/* ── Import the module under test (after mocks) ─────────────────── */

import {
  listTables,
  getSystemStats,
  listWorkspaces,
  listUsers,
  getWorkspaceDetail,
  updateWorkspace,
  deleteWorkspace,
  toggleFreezeWorkspace,
  sendPasswordReset,
  forceLogoutUser,
  readTableRows,
  updateTableRow,
  deleteTableRow,
  insertTableRow,
  getAuditLogs,
  overrideSubscription,
  toggleFeatureFlag,
  updateQuotas,
  impersonateUser,
  getUserDetail,
} from "./superadmin";

/* ── Test setup ──────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();

  // Default: verifySuperAdmin succeeds (server client returns super admin user)
  mockServerAuth.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "theo@iworkrapp.com" } },
  });

  // Default: admin profile lookup succeeds
  mockAdminFrom.mockImplementation((_table: string) => {
    if (_table === "profiles") {
      return chainable({
        maybeSingle: () =>
          Promise.resolve({
            data: { id: "user-1", email: "theo@iworkrapp.com", is_super_admin: true },
            error: null,
          }),
      });
    }
    // Audit log insert — fire-and-forget, just resolve
    if (_table === "super_admin_audit_logs") {
      return chainable();
    }
    return chainable();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MODULE: listTables
   ═══════════════════════════════════════════════════════════════════ */

describe("listTables", () => {
  it("returns data with no error when authorized", async () => {
    const result = await listTables();
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });

  it("returns an array of table names", async () => {
    const result = await listTables();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('contains the "organizations" table', async () => {
    const result = await listTables();
    expect(result.data).toContain("organizations");
  });

  it('contains the "profiles" table', async () => {
    const result = await listTables();
    expect(result.data).toContain("profiles");
  });

  it('contains the "jobs" table', async () => {
    const result = await listTables();
    expect(result.data).toContain("jobs");
  });

  it('contains the "clients" table', async () => {
    const result = await listTables();
    expect(result.data).toContain("clients");
  });

  it('contains the "shifts" table equivalent (schedule_events)', async () => {
    const result = await listTables();
    expect(result.data).toContain("schedule_events");
  });

  it('contains the "invoices" table', async () => {
    const result = await listTables();
    expect(result.data).toContain("invoices");
  });

  it('contains the "timesheets" table', async () => {
    const result = await listTables();
    expect(result.data).toContain("timesheets");
  });

  it("returns Unauthorized when user is not a super admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-2", email: "nobody@example.com" } },
    });
    mockAdminFrom.mockImplementation((_table: string) => {
      if (_table === "profiles") {
        return chainable({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: "user-2", email: "nobody@example.com", is_super_admin: false },
              error: null,
            }),
        });
      }
      return chainable();
    });

    const result = await listTables();
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MODULE: getSystemStats
   ═══════════════════════════════════════════════════════════════════ */

describe("getSystemStats", () => {
  beforeEach(() => {
    // getSystemStats calls:
    //   admin.from("organizations").select("id", { count: "exact", head: true })
    //   admin.from("profiles").select("id", { count: "exact", head: true })
    //   admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("status", "active")
    //   admin.from("jobs").select("id", { count: "exact", head: true })
    //
    // verifySuperAdmin also calls admin.from("profiles").select(...).eq(...).maybeSingle()
    //
    // We track call order for "profiles" since it's called twice.
    let profileCallCount = 0;

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        profileCallCount++;
        if (profileCallCount === 1) {
          // First profiles call → verifySuperAdmin
          return chainable({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: "user-1", email: "theo@iworkrapp.com", is_super_admin: true },
                error: null,
              }),
          });
        }
        // Second profiles call → getSystemStats head query
        return { select: () => ({ data: null, error: null, count: 10 }) };
      }

      if (table === "super_admin_audit_logs") {
        return chainable();
      }

      // organizations, organization_members, jobs → head queries
      // organization_members also chains .eq("status", "active")
      return {
        select: () => {
          const result = { data: null, error: null, count: 42 };
          return { ...result, eq: () => result };
        },
      };
    });
  });

  it("returns data with no error when authorized", async () => {
    const result = await getSystemStats();
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });

  it("returns an object with total_workspaces key", async () => {
    const result = await getSystemStats();
    expect(result.data).toHaveProperty("total_workspaces");
  });

  it("returns an object with total_users key", async () => {
    const result = await getSystemStats();
    expect(result.data).toHaveProperty("total_users");
  });

  it("returns an object with active_memberships key", async () => {
    const result = await getSystemStats();
    expect(result.data).toHaveProperty("active_memberships");
  });

  it("returns an object with total_jobs key", async () => {
    const result = await getSystemStats();
    expect(result.data).toHaveProperty("total_jobs");
  });

  it("returns numeric values for all stat fields", async () => {
    const result = await getSystemStats();
    expect(typeof result.data.total_workspaces).toBe("number");
    expect(typeof result.data.total_users).toBe("number");
    expect(typeof result.data.active_memberships).toBe("number");
    expect(typeof result.data.total_jobs).toBe("number");
  });

  it("returns Unauthorized when user is not a super admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-2", email: "nobody@example.com" } },
    });
    mockAdminFrom.mockImplementation((_table: string) => {
      if (_table === "profiles") {
        return chainable({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: "user-2", email: "nobody@example.com", is_super_admin: false },
              error: null,
            }),
        });
      }
      return chainable();
    });

    const result = await getSystemStats();
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MODULE: Error handling
   ═══════════════════════════════════════════════════════════════════ */

describe("error handling", () => {
  it("listTables returns error when auth throws", async () => {
    mockServerAuth.getUser.mockRejectedValueOnce(new Error("Network error"));

    const result = await listTables();
    // verifySuperAdmin catches and returns null → "Unauthorized"
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getSystemStats returns error when auth throws", async () => {
    mockServerAuth.getUser.mockRejectedValueOnce(new Error("Network error"));

    const result = await getSystemStats();
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("listWorkspaces returns error when no user session", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const result = await listWorkspaces();
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("listUsers returns error when not authorized", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
    });

    const result = await listUsers();
    expect(result.error).toBe("Unauthorized");
  });

  it("getWorkspaceDetail returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-2", email: "nobody@example.com" } },
    });
    mockAdminFrom.mockImplementation((_table: string) => {
      if (_table === "profiles") {
        return chainable({
          maybeSingle: () =>
            Promise.resolve({
              data: { id: "user-2", email: "nobody@example.com", is_super_admin: false },
              error: null,
            }),
        });
      }
      return chainable();
    });

    const result = await getWorkspaceDetail("org-1");
    expect(result.error).toBe("Unauthorized");
  });

  it("updateWorkspace returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await updateWorkspace("org-1", { name: "New Name" });
    expect(result.error).toBe("Unauthorized");
  });

  it("deleteWorkspace returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await deleteWorkspace("org-1", "Test Org");
    expect(result.error).toBe("Unauthorized");
  });

  it("toggleFreezeWorkspace returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await toggleFreezeWorkspace("org-1", true);
    expect(result.error).toBe("Unauthorized");
  });

  it("sendPasswordReset returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await sendPasswordReset("test@example.com");
    expect(result.error).toBe("Unauthorized");
  });

  it("forceLogoutUser returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await forceLogoutUser("user-123");
    expect(result.error).toBe("Unauthorized");
  });

  it("impersonateUser returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await impersonateUser("user-123");
    expect(result.error).toBe("Unauthorized");
  });

  it("getUserDetail returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getUserDetail("user-123");
    expect(result.error).toBe("Unauthorized");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MODULE: Table validation
   ═══════════════════════════════════════════════════════════════════ */

describe("table name validation", () => {
  it("readTableRows rejects invalid table names", async () => {
    const result = await readTableRows("DROP TABLE users;--");
    expect(result.error).toBe("Invalid table name");
  });

  it("updateTableRow rejects invalid table names", async () => {
    const result = await updateTableRow("bad-table!", "rec-1", { name: "x" });
    expect(result.error).toBe("Invalid table name");
  });

  it("deleteTableRow rejects invalid table names", async () => {
    const result = await deleteTableRow("123invalid", "rec-1");
    expect(result.error).toBe("Invalid table name");
  });

  it("insertTableRow rejects invalid table names", async () => {
    const result = await insertTableRow("has spaces", { name: "x" });
    expect(result.error).toBe("Invalid table name");
  });

  it("deleteTableRow prevents deleting audit logs", async () => {
    const result = await deleteTableRow("super_admin_audit_logs", "rec-1");
    expect(result.error).toBe("Cannot delete audit logs");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MODULE: Billing & Features
   ═══════════════════════════════════════════════════════════════════ */

describe("billing and feature actions", () => {
  it("overrideSubscription returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await overrideSubscription("org-1", "enterprise", null, "testing");
    expect(result.error).toBe("Unauthorized");
  });

  it("toggleFeatureFlag returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await toggleFeatureFlag("org-1", "feature_x", true);
    expect(result.error).toBe("Unauthorized");
  });

  it("updateQuotas returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await updateQuotas("org-1", { max_storage_gb: 100 });
    expect(result.error).toBe("Unauthorized");
  });

  it("getAuditLogs returns Unauthorized for non-admin", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getAuditLogs();
    expect(result.error).toBe("Unauthorized");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   MODULE: Return shape consistency
   ═══════════════════════════════════════════════════════════════════ */

describe("return shape consistency", () => {
  it("all error responses have { data: null, error: string }", async () => {
    mockServerAuth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await listTables();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result.data).toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("successful listTables has { data: array, error: null }", async () => {
    const result = await listTables();
    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
  });
});
