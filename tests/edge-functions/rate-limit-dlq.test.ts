import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * AEGIS-CHAOS Layer 2: Rate Limit & DLQ Exponential Backoff
 * 
 * Tests that Edge Functions correctly handle 429 responses
 * with exponential backoff and DLQ routing.
 */

// Simulate the DLQ retry logic
interface DLQEntry {
  id: string;
  function_name: string;
  payload: any;
  retry_count: number;
  next_retry_at: Date;
  status: "pending" | "retrying" | "dead";
  error_message: string;
}

function calculateBackoff(retryCount: number, baseMs = 1000): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
  const maxBackoff = 32000;
  const delay = Math.min(baseMs * Math.pow(2, retryCount), maxBackoff);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

function processRetry(entry: DLQEntry, maxRetries = 5): DLQEntry {
  if (entry.retry_count >= maxRetries) {
    return { ...entry, status: "dead" };
  }
  const backoff = calculateBackoff(entry.retry_count);
  return {
    ...entry,
    retry_count: entry.retry_count + 1,
    next_retry_at: new Date(Date.now() + backoff),
    status: "retrying",
  };
}

// Simulate external API call with configurable responses
class MockExternalAPI {
  private callCount = 0;
  private responses: Array<{ status: number; body: any }>;

  constructor(responses: Array<{ status: number; body: any }>) {
    this.responses = responses;
  }

  async call(): Promise<{ status: number; body: any }> {
    const idx = Math.min(this.callCount, this.responses.length - 1);
    this.callCount++;
    return this.responses[idx];
  }

  getCallCount(): number {
    return this.callCount;
  }
}

describe("Aegis-Chaos L2: DLQ & Exponential Backoff", () => {
  it("calculates exponential backoff correctly", () => {
    // Without jitter (check base calculation)
    expect(calculateBackoff(0, 1000)).toBeGreaterThanOrEqual(900);
    expect(calculateBackoff(0, 1000)).toBeLessThanOrEqual(1100);
    expect(calculateBackoff(1, 1000)).toBeGreaterThanOrEqual(1800);
    expect(calculateBackoff(1, 1000)).toBeLessThanOrEqual(2200);
    expect(calculateBackoff(2, 1000)).toBeGreaterThanOrEqual(3600);
    expect(calculateBackoff(2, 1000)).toBeLessThanOrEqual(4400);
  });

  it("caps backoff at 32 seconds", () => {
    const backoff = calculateBackoff(10, 1000); // Would be 1024000ms without cap
    expect(backoff).toBeLessThanOrEqual(35200); // 32000 + 10% jitter
  });

  it("moves entry to dead after max retries", () => {
    const entry: DLQEntry = {
      id: "dlq-001",
      function_name: "catalog-nightly-sync",
      payload: { workspace_id: "org-123" },
      retry_count: 5,
      next_retry_at: new Date(),
      status: "retrying",
      error_message: "429 Too Many Requests",
    };

    const result = processRetry(entry, 5);
    expect(result.status).toBe("dead");
  });

  it("increments retry count on each attempt", () => {
    let entry: DLQEntry = {
      id: "dlq-002",
      function_name: "sync-outbound",
      payload: { type: "invoice" },
      retry_count: 0,
      next_retry_at: new Date(),
      status: "pending",
      error_message: "429 Too Many Requests",
    };

    for (let i = 0; i < 4; i++) {
      entry = processRetry(entry, 5);
      expect(entry.retry_count).toBe(i + 1);
      expect(entry.status).toBe("retrying");
    }

    // 5th retry should still succeed
    entry = processRetry(entry, 5);
    expect(entry.retry_count).toBe(5);

    // 6th should die
    entry = processRetry(entry, 5);
    expect(entry.status).toBe("dead");
  });

  it("handles 429 flood with graceful DLQ routing", async () => {
    // Simulate: API returns 429 five times, then 200
    const api = new MockExternalAPI([
      { status: 429, body: { error: "Too Many Requests" } },
      { status: 429, body: { error: "Too Many Requests" } },
      { status: 429, body: { error: "Too Many Requests" } },
      { status: 429, body: { error: "Too Many Requests" } },
      { status: 429, body: { error: "Too Many Requests" } },
      { status: 200, body: { ok: true } },
    ]);

    let entry: DLQEntry = {
      id: "dlq-003",
      function_name: "catalog-nightly-sync",
      payload: { workspace_id: "org-456" },
      retry_count: 0,
      next_retry_at: new Date(),
      status: "pending",
      error_message: "",
    };

    let success = false;
    for (let attempt = 0; attempt <= 5; attempt++) {
      const response = await api.call();
      if (response.status === 200) {
        success = true;
        break;
      }
      entry = processRetry(entry, 5);
    }

    expect(success).toBe(true);
    expect(api.getCallCount()).toBe(6); // 5 failures + 1 success
    expect(entry.retry_count).toBe(5);
  });

  it("never crashes when flooded with 429s", async () => {
    const api = new MockExternalAPI(
      Array.from({ length: 100 }, () => ({ status: 429, body: { error: "Rate limited" } }))
    );

    let entry: DLQEntry = {
      id: "dlq-flood",
      function_name: "catalog-nightly-sync",
      payload: {},
      retry_count: 0,
      next_retry_at: new Date(),
      status: "pending",
      error_message: "",
    };

    // Process all retries — must not throw
    expect(() => {
      for (let i = 0; i < 100; i++) {
        entry = processRetry(entry, 5);
        if (entry.status === "dead") break;
      }
    }).not.toThrow();

    expect(entry.status).toBe("dead");
    expect(entry.retry_count).toBe(5);
  });
});

describe("Aegis-Chaos L2: Token Refresh & Advisory Lock Race", () => {
  it("ensures mutex prevents duplicate token refreshes", async () => {
    let refreshCount = 0;
    let currentToken = "expired-token";
    let lockPromise: Promise<string> | null = null;

    async function getToken(): Promise<string> {
      // If a refresh is already in flight, wait for it (advisory lock yield)
      if (lockPromise) {
        return lockPromise;
      }

      // Acquire the lock — only the first caller creates the refresh promise
      lockPromise = (async () => {
        refreshCount++;
        await new Promise(r => setTimeout(r, 50)); // Simulate API call
        currentToken = `fresh-token-${refreshCount}`;
        return currentToken;
      })();

      const result = await lockPromise;
      lockPromise = null; // Release the lock
      return result;
    }

    // Fire 10 concurrent requests
    const results = await Promise.all(
      Array.from({ length: 10 }, () => getToken())
    );

    // All should get a valid token
    expect(results.every(t => t.startsWith("fresh-token"))).toBe(true);
    // Only 1 actual refresh call should have been made
    // (first one acquires the lock, others yield to its promise)
    expect(refreshCount).toBe(1);
  });
});
