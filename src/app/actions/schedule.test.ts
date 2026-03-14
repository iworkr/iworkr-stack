/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ═══════════════════════════════════════════════════════════════════
   Schedule Server Actions — Unit Tests
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
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

/* ── Import module under test (after mocks) ────────────────────────── */

import {
  getScheduleBlocks,
  createScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
  getOrgTechnicians,
  getScheduleView,
  moveScheduleBlockServer,
  resizeScheduleBlockServer,
  assignJobToSchedule,
  unscheduleJob,
  getBacklogJobs,
  getScheduleEvents,
  createScheduleEvent,
  deleteScheduleEvent,
  checkScheduleConflicts,
} from "./schedule";
import type { CreateScheduleBlockParams } from "./schedule";

/* ── Helpers ───────────────────────────────────────────────────────── */

const TEST_USER = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", email: "test@example.com", user_metadata: { full_name: "Test User" } };
const TEST_ORG_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const TEST_TECH_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const TEST_BLOCK_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

function makeBlockParams(overrides: Partial<CreateScheduleBlockParams> = {}): CreateScheduleBlockParams {
  return {
    organization_id: TEST_ORG_ID,
    technician_id: TEST_TECH_ID,
    title: "Fix plumbing",
    start_time: "2026-03-15T09:00:00.000Z",
    end_time: "2026-03-15T11:00:00.000Z",
    ...overrides,
  };
}

function setupDefaultMocks() {
  mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
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
  it("getScheduleBlocks returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock returns Not authenticated when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    // Validation runs first. Use valid params so it passes, then auth fails.
    const result = await createScheduleBlock(makeBlockParams());
    expect(result.error).toBe("Not authenticated");
    expect(result.data).toBeNull();
  });

  it("updateScheduleBlock returns Not authenticated when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await updateScheduleBlock(TEST_BLOCK_ID, { title: "Updated" });
    expect(result.error).toBe("Not authenticated");
    expect(result.data).toBeNull();
  });

  it("deleteScheduleBlock returns Not authenticated when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await deleteScheduleBlock(TEST_BLOCK_ID);
    expect(result.error).toBe("Not authenticated");
    expect(result.data).toBeNull();
  });

  it("getOrgTechnicians returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getOrgTechnicians(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getScheduleView returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getScheduleView(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("moveScheduleBlockServer returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await moveScheduleBlockServer(
      TEST_BLOCK_ID, TEST_TECH_ID,
      "2026-03-15T09:00:00Z", "2026-03-15T11:00:00Z"
    );
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getBacklogJobs returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getBacklogJobs(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("getScheduleEvents returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getScheduleEvents(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("checkScheduleConflicts returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await checkScheduleConflicts(TEST_ORG_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toEqual([]);
  });

  it("getScheduleBlocks returns Unauthorized when membership is null", async () => {
    mockFrom.mockImplementation((_table: string) => {
      if (_table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock returns Unauthorized when membership is null", async () => {
    mockFrom.mockImplementation((_table: string) => {
      if (_table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await createScheduleBlock(makeBlockParams());
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 2: Conflict Detection (via createScheduleBlock)
   ═══════════════════════════════════════════════════════════════════ */

describe("Conflict detection (createScheduleBlock)", () => {
  let capturedInsert: any = null;

  function setupConflictMock(conflictingBlocks: any[]) {
    capturedInsert = null;
    let sbCallN = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        sbCallN++;
        if (sbCallN === 1) {
          // Conflict check query — chain ends at neq()
          const c: any = new Proxy({}, {
            get(_, p: string) {
              if (p === "then") return undefined;
              if (p === "neq") return () => Promise.resolve({ data: conflictingBlocks, error: null });
              return (..._a: any[]) => c;
            },
          });
          return c;
        }
        // Insert call
        const ic: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "insert") return (d: any) => { capturedInsert = d; return ic; };
            if (p === "select") return () => ic;
            if (p === "single") return () => Promise.resolve({ data: { id: TEST_BLOCK_ID, ...capturedInsert }, error: null });
            return (..._a: any[]) => ic;
          },
        });
        return ic;
      }
      return chainable();
    });
  }

  it("sets is_conflict=true when overlapping blocks exist", async () => {
    setupConflictMock([{ id: "existing-block-1" }]);
    await createScheduleBlock(makeBlockParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.is_conflict).toBe(true);
  });

  it("sets is_conflict=false when no overlapping blocks", async () => {
    setupConflictMock([]);
    await createScheduleBlock(makeBlockParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.is_conflict).toBe(false);
  });

  it("sets is_conflict=true when multiple overlapping blocks exist", async () => {
    setupConflictMock([{ id: "block-a" }, { id: "block-b" }]);
    await createScheduleBlock(makeBlockParams());
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.is_conflict).toBe(true);
  });

  it("returns error when conflict check query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "neq") return () => Promise.resolve({ data: null, error: { message: "Conflict query failed" } });
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      return chainable();
    });

    const result = await createScheduleBlock(makeBlockParams());
    expect(result.error).toBe("Conflict query failed");
    expect(result.data).toBeNull();
  });

  it("preserves block fields when creating with conflict", async () => {
    setupConflictMock([{ id: "existing-1" }]);
    await createScheduleBlock(makeBlockParams({ title: "Emergency repair", notes: "Urgent" }));
    expect(capturedInsert).not.toBeNull();
    expect(capturedInsert.title).toBe("Emergency repair");
    expect(capturedInsert.notes).toBe("Urgent");
    expect(capturedInsert.is_conflict).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 3: Schedule Block Organization (getScheduleBlocks)
   ═══════════════════════════════════════════════════════════════════ */

describe("Schedule block organization (getScheduleBlocks)", () => {
  function setupBlocksMock(mockBlocks: any[]) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        const c: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "order") return () => Promise.resolve({ data: mockBlocks, error: null });
            return (..._a: any[]) => c;
          },
        });
        return c;
      }
      return chainable();
    });
  }

  it("groups blocks by technician_id", async () => {
    setupBlocksMock([
      { id: "block-1", technician_id: "tech-a", start_time: "2026-03-15T09:00:00Z", end_time: "2026-03-15T10:00:00Z", profiles: { full_name: "Alice" } },
      { id: "block-2", technician_id: "tech-a", start_time: "2026-03-15T11:00:00Z", end_time: "2026-03-15T12:00:00Z", profiles: { full_name: "Alice" } },
      { id: "block-3", technician_id: "tech-b", start_time: "2026-03-15T09:00:00Z", end_time: "2026-03-15T10:00:00Z", profiles: { full_name: "Bob" } },
    ]);
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBeNull();
    expect(result.data!["tech-a"]).toHaveLength(2);
    expect(result.data!["tech-b"]).toHaveLength(1);
  });

  it("groups blocks with null technician_id under 'unassigned'", async () => {
    setupBlocksMock([
      { id: "block-1", technician_id: null, start_time: "2026-03-15T09:00:00Z", end_time: "2026-03-15T10:00:00Z", profiles: null },
      { id: "block-2", technician_id: null, start_time: "2026-03-15T11:00:00Z", end_time: "2026-03-15T12:00:00Z", profiles: null },
    ]);
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBeNull();
    expect(result.data!["unassigned"]).toHaveLength(2);
  });

  it("returns empty object when no blocks exist", async () => {
    setupBlocksMock([]);
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBeNull();
    expect(result.data).toEqual({});
  });

  it("maps technician_name from profiles.full_name", async () => {
    setupBlocksMock([
      { id: "block-1", technician_id: "tech-a", start_time: "2026-03-15T09:00:00Z", end_time: "2026-03-15T10:00:00Z", profiles: { full_name: "Alice Smith" } },
    ]);
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.data!["tech-a"][0].technician_name).toBe("Alice Smith");
  });

  it("sets technician_name to null when profiles is null", async () => {
    setupBlocksMock([
      { id: "block-1", technician_id: "tech-x", start_time: "2026-03-15T09:00:00Z", end_time: "2026-03-15T10:00:00Z", profiles: null },
    ]);
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.data!["tech-x"][0].technician_name).toBeNull();
  });

  it("returns error when select query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
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
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBe("DB read error");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 4: Validation (Zod schemas)
   ═══════════════════════════════════════════════════════════════════ */

describe("Validation (Zod schemas)", () => {
  it("createScheduleBlock rejects missing title", async () => {
    const result = await createScheduleBlock(makeBlockParams({ title: "" }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock rejects missing start_time", async () => {
    const result = await createScheduleBlock(makeBlockParams({ start_time: "" }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock rejects missing end_time", async () => {
    const result = await createScheduleBlock(makeBlockParams({ end_time: "" }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock rejects invalid organization_id", async () => {
    const result = await createScheduleBlock(makeBlockParams({ organization_id: "not-a-uuid" }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock rejects title exceeding 200 characters", async () => {
    const result = await createScheduleBlock(makeBlockParams({ title: "a".repeat(201) }));
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("updateScheduleBlock rejects invalid status value", async () => {
    const result = await updateScheduleBlock(TEST_BLOCK_ID, {
      status: "invalid_status" as any,
    });
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("updateScheduleBlock rejects travel_minutes below 0", async () => {
    const result = await updateScheduleBlock(TEST_BLOCK_ID, { travel_minutes: -5 });
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("updateScheduleBlock rejects travel_minutes above 480", async () => {
    const result = await updateScheduleBlock(TEST_BLOCK_ID, { travel_minutes: 500 });
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 5: Error Handling
   ═══════════════════════════════════════════════════════════════════ */

describe("Error handling", () => {
  it("createScheduleBlock returns graceful error when insert fails", async () => {
    let sbCallN = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        sbCallN++;
        if (sbCallN === 1) {
          // Conflict check: no conflicts
          const c: any = new Proxy({}, {
            get(_, p: string) {
              if (p === "then") return undefined;
              if (p === "neq") return () => Promise.resolve({ data: [], error: null });
              return (..._a: any[]) => c;
            },
          });
          return c;
        }
        // Insert fails
        return chainable({
          single: () => Promise.resolve({ data: null, error: { message: "Insert failed" } }),
        });
      }
      return chainable();
    });

    const result = await createScheduleBlock(makeBlockParams());
    expect(result.error).toBe("Insert failed");
    expect(result.data).toBeNull();
  });

  it("deleteScheduleBlock returns error when block not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "schedule_blocks") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await deleteScheduleBlock(TEST_BLOCK_ID);
    expect(result.error).toBe("Block not found");
    expect(result.data).toBeNull();
  });

  it("getScheduleBlocks returns error when auth throws", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Network failure"));
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("createScheduleBlock returns error when auth throws", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Auth service down"));
    const result = await createScheduleBlock(makeBlockParams());
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 6: deleteScheduleBlock
   ═══════════════════════════════════════════════════════════════════ */

describe("deleteScheduleBlock", () => {
  it("returns success on successful deletion", async () => {
    let sbCallN = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        sbCallN++;
        if (sbCallN === 1) {
          // First call: fetch block to get org_id
          return chainable({
            maybeSingle: () =>
              Promise.resolve({ data: { organization_id: TEST_ORG_ID }, error: null }),
          });
        }
        // Second call: delete().eq() → needs to resolve to { error: null }
        const dc: any = new Proxy({}, {
          get(_, p: string) {
            if (p === "then") return undefined;
            if (p === "delete") return () => dc;
            if (p === "eq") return () => Promise.resolve({ data: null, error: null });
            return (..._a: any[]) => dc;
          },
        });
        return dc;
      }
      return chainable();
    });
    const result = await deleteScheduleBlock(TEST_BLOCK_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ success: true });
  });

  it("returns Unauthorized when membership is null", async () => {
    let sbCallN = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        sbCallN++;
        if (sbCallN === 1) {
          return chainable({
            maybeSingle: () =>
              Promise.resolve({ data: { organization_id: TEST_ORG_ID }, error: null }),
          });
        }
        return chainable();
      }
      return chainable();
    });
    const result = await deleteScheduleBlock(TEST_BLOCK_ID);
    expect(result.error).toBe("Unauthorized");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 7: getScheduleView (RPC-backed with fallback)
   ═══════════════════════════════════════════════════════════════════ */

describe("getScheduleView", () => {
  it("returns RPC data on success", async () => {
    const viewData = {
      technicians: [{ id: "tech-1", full_name: "Alice" }],
      blocks: [{ id: "block-1", title: "Fix pipes" }],
      events: [],
      backlog: [],
    };
    mockRpc.mockResolvedValueOnce({ data: viewData, error: null });
    const result = await getScheduleView(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBeNull();
    expect(result.data).toEqual(viewData);
  });

  it("returns Unauthorized when membership is null", async () => {
    mockFrom.mockImplementation((_table: string) => {
      if (_table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await getScheduleView(TEST_ORG_ID, "2026-03-15");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 8: moveScheduleBlockServer
   ═══════════════════════════════════════════════════════════════════ */

describe("moveScheduleBlockServer", () => {
  it("returns error when block not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "schedule_blocks") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await moveScheduleBlockServer(
      TEST_BLOCK_ID, TEST_TECH_ID,
      "2026-03-15T09:00:00Z", "2026-03-15T11:00:00Z"
    );
    expect(result.error).toBe("Block not found");
    expect(result.data).toBeNull();
  });

  it("returns RPC data on success", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      if (table === "schedule_blocks") {
        return chainable({
          maybeSingle: () =>
            Promise.resolve({ data: { organization_id: TEST_ORG_ID }, error: null }),
        });
      }
      return chainable();
    });
    mockRpc.mockResolvedValueOnce({ data: { success: true, conflict: false, block_id: TEST_BLOCK_ID }, error: null });
    const result = await moveScheduleBlockServer(
      TEST_BLOCK_ID, TEST_TECH_ID,
      "2026-03-15T09:00:00Z", "2026-03-15T11:00:00Z"
    );
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ success: true, conflict: false, block_id: TEST_BLOCK_ID });
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 9: resizeScheduleBlockServer
   ═══════════════════════════════════════════════════════════════════ */

describe("resizeScheduleBlockServer", () => {
  it("returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await resizeScheduleBlockServer(TEST_BLOCK_ID, "2026-03-15T12:00:00Z");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("returns error when block not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "schedule_blocks") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await resizeScheduleBlockServer(TEST_BLOCK_ID, "2026-03-15T12:00:00Z");
    expect(result.error).toBe("Block not found");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 10: Schedule Events
   ═══════════════════════════════════════════════════════════════════ */

describe("Schedule events", () => {
  it("createScheduleEvent returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await createScheduleEvent({
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER.id,
      type: "break",
      title: "Lunch",
      start_time: "2026-03-15T12:00:00Z",
      end_time: "2026-03-15T13:00:00Z",
    });
    // Validation runs first with valid params → auth check → Unauthorized
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("createScheduleEvent rejects invalid type", async () => {
    const result = await createScheduleEvent({
      organization_id: TEST_ORG_ID,
      user_id: TEST_USER.id,
      type: "invalid_type" as any,
      title: "Test",
      start_time: "2026-03-15T12:00:00Z",
      end_time: "2026-03-15T13:00:00Z",
    });
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });

  it("deleteScheduleEvent returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await deleteScheduleEvent("event-1");
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("deleteScheduleEvent returns error when event not found", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "schedule_events") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      if (table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: { user_id: TEST_USER.id }, error: null }),
        });
      }
      return chainable();
    });
    const result = await deleteScheduleEvent("nonexistent-id");
    expect(result.error).toBe("Event not found");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 11: checkScheduleConflicts (RPC)
   ═══════════════════════════════════════════════════════════════════ */

describe("checkScheduleConflicts", () => {
  it("returns conflicts from RPC", async () => {
    const conflicts = [{ block_a: "b1", block_b: "b2", overlap_minutes: 30 }];
    mockRpc.mockResolvedValueOnce({ data: conflicts, error: null });
    const result = await checkScheduleConflicts(TEST_ORG_ID);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(conflicts);
  });

  it("returns empty array when RPC fails (graceful degradation)", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "RPC error" } });
    const result = await checkScheduleConflicts(TEST_ORG_ID);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("returns empty array on null RPC data", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await checkScheduleConflicts(TEST_ORG_ID);
    expect(result.data).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 12: unscheduleJob
   ═══════════════════════════════════════════════════════════════════ */

describe("unscheduleJob", () => {
  it("returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await unscheduleJob(TEST_BLOCK_ID);
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 13: assignJobToSchedule
   ═══════════════════════════════════════════════════════════════════ */

describe("assignJobToSchedule", () => {
  it("returns Unauthorized when user is null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await assignJobToSchedule(
      TEST_ORG_ID, "job-1", TEST_TECH_ID,
      "2026-03-15T09:00:00Z", "2026-03-15T11:00:00Z"
    );
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });

  it("returns Unauthorized when membership is null", async () => {
    mockFrom.mockImplementation((_table: string) => {
      if (_table === "organization_members") {
        return chainable({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        });
      }
      return chainable();
    });
    const result = await assignJobToSchedule(
      TEST_ORG_ID, "job-1", TEST_TECH_ID,
      "2026-03-15T09:00:00Z", "2026-03-15T11:00:00Z"
    );
    expect(result.error).toBe("Unauthorized");
    expect(result.data).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Section 14: Return shape consistency
   ═══════════════════════════════════════════════════════════════════ */

describe("Return shape consistency", () => {
  it("error responses always have { data: null|[], error: string }", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result.data).toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("checkScheduleConflicts error has data as empty array", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await checkScheduleConflicts(TEST_ORG_ID);
    expect(result.data).toEqual([]);
    expect(typeof result.error).toBe("string");
  });

  it("getScheduleBlocks returns data and error keys", async () => {
    const r = await getScheduleBlocks(TEST_ORG_ID, "2026-03-15");
    expect(r).toHaveProperty("data");
    expect(r).toHaveProperty("error");
  });

  it("getOrgTechnicians returns data and error keys", async () => {
    const r = await getOrgTechnicians(TEST_ORG_ID);
    expect(r).toHaveProperty("data");
    expect(r).toHaveProperty("error");
  });

  it("getBacklogJobs returns data and error keys", async () => {
    const r = await getBacklogJobs(TEST_ORG_ID);
    expect(r).toHaveProperty("data");
    expect(r).toHaveProperty("error");
  });
});
