import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatPhoneNumber,
  formatAddress,
} from "./format";

/* ── formatCurrency ───────────────────────────────────── */

describe("formatCurrency", () => {
  it("formats a positive integer", () => {
    expect(formatCurrency(100)).toBe("$100");
  });

  it("formats positive number with decimals", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats negative number", () => {
    expect(formatCurrency(-100)).toBe("$-100");
  });

  it("formats large number with commas", () => {
    expect(formatCurrency(1_000_000)).toBe("$1,000,000");
  });

  it("formats very large number", () => {
    expect(formatCurrency(99_999_999.99)).toBe("$99,999,999.99");
  });

  it("formats small decimal", () => {
    expect(formatCurrency(0.99)).toBe("$0.99");
  });

  it("formats number with many decimal places (locale rounding)", () => {
    // toLocaleString en-AU typically keeps up to 3 fraction digits
    const result = formatCurrency(1.999);
    expect(result).toMatch(/^\$1\.99/);
  });
});

/* ── formatDate ───────────────────────────────────────── */

describe("formatDate", () => {
  it("formats ISO string date", () => {
    const result = formatDate("2026-03-14");
    // en-AU: "14 Mar 2026"
    expect(result).toContain("Mar");
    expect(result).toContain("2026");
    expect(result).toContain("14");
  });

  it("formats Date object", () => {
    const result = formatDate(new Date(2025, 0, 1)); // Jan 1, 2025
    expect(result).toContain("Jan");
    expect(result).toContain("2025");
  });

  it("formats end-of-year date", () => {
    const result = formatDate("2025-12-31");
    expect(result).toContain("Dec");
    expect(result).toContain("2025");
  });

  it("formats leap day", () => {
    const result = formatDate("2024-02-29");
    expect(result).toContain("Feb");
    expect(result).toContain("2024");
  });

  it("formats ISO datetime string", () => {
    const result = formatDate("2026-06-15T14:30:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("2026");
  });
});

/* ── formatRelativeTime ───────────────────────────────── */

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "just now" for date less than 60 seconds ago', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const thirtySecsAgo = new Date(now - 30_000);
    expect(formatRelativeTime(thirtySecsAgo)).toBe("just now");
  });

  it('returns "just now" for date exactly 0 seconds ago', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    expect(formatRelativeTime(new Date(now))).toBe("just now");
  });

  it('returns "Xm ago" for minutes', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const fiveMinAgo = new Date(now - 5 * 60_000);
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it('returns "1m ago" at exactly 60 seconds', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const sixtySecsAgo = new Date(now - 60_000);
    expect(formatRelativeTime(sixtySecsAgo)).toBe("1m ago");
  });

  it('returns "59m ago" at 59 minutes', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const fiftyNineMinAgo = new Date(now - 59 * 60_000);
    expect(formatRelativeTime(fiftyNineMinAgo)).toBe("59m ago");
  });

  it('returns "Xh ago" for hours', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const threeHoursAgo = new Date(now - 3 * 3_600_000);
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it('returns "1h ago" at exactly 60 minutes', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const oneHourAgo = new Date(now - 60 * 60_000);
    expect(formatRelativeTime(oneHourAgo)).toBe("1h ago");
  });

  it('returns "Xd ago" for days', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const threeDaysAgo = new Date(now - 3 * 86_400_000);
    expect(formatRelativeTime(threeDaysAgo)).toBe("3d ago");
  });

  it('returns "1d ago" at exactly 24 hours', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const oneDayAgo = new Date(now - 24 * 3_600_000);
    expect(formatRelativeTime(oneDayAgo)).toBe("1d ago");
  });

  it('returns "6d ago" at 6 days', () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const sixDaysAgo = new Date(now - 6 * 86_400_000);
    expect(formatRelativeTime(sixDaysAgo)).toBe("6d ago");
  });

  it("falls back to formatted date after 7 days", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const eightDaysAgo = new Date(now - 8 * 86_400_000);
    const result = formatRelativeTime(eightDaysAgo);
    // Should not contain "ago" — should be a formatted date
    expect(result).not.toContain("ago");
    expect(result).not.toBe("just now");
  });

  it("works with ISO date string input", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const twoMinAgo = new Date(now - 2 * 60_000).toISOString();
    expect(formatRelativeTime(twoMinAgo)).toBe("2m ago");
  });
});

/* ── formatPhoneNumber ────────────────────────────────── */

describe("formatPhoneNumber", () => {
  it("formats 10-digit AU mobile number", () => {
    expect(formatPhoneNumber("0412345678")).toBe("0412 345 678");
  });

  it("formats 10-digit number with existing spaces", () => {
    expect(formatPhoneNumber("0412 345 678")).toBe("0412 345 678");
  });

  it("formats 10-digit number with dashes", () => {
    expect(formatPhoneNumber("0412-345-678")).toBe("0412 345 678");
  });

  it("formats 11-digit number starting with 61", () => {
    expect(formatPhoneNumber("61412345678")).toBe("+61 412 345 678");
  });

  it("formats 11-digit with + prefix", () => {
    expect(formatPhoneNumber("+61412345678")).toBe("+61 412 345 678");
  });

  it("formats 11-digit with spaces and +", () => {
    expect(formatPhoneNumber("+61 412 345 678")).toBe("+61 412 345 678");
  });

  it("returns other formats as-is", () => {
    expect(formatPhoneNumber("12345")).toBe("12345");
  });

  it("returns empty string as-is", () => {
    expect(formatPhoneNumber("")).toBe("");
  });

  it("returns international number that doesn't start with 61 as-is", () => {
    // 11 digits not starting with 61 → returned as-is
    expect(formatPhoneNumber("+1 555 123 4567")).toBe("+1 555 123 4567");
  });

  it("handles parentheses in number", () => {
    // (02) 9876 5432 → digits "0298765432" = 10 digits
    expect(formatPhoneNumber("(02) 9876 5432")).toBe("0298 765 432");
  });
});

/* ── formatAddress ────────────────────────────────────── */

describe("formatAddress", () => {
  it("formats full address", () => {
    expect(
      formatAddress({
        street: "123 Main St",
        city: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "Australia",
      })
    ).toBe("123 Main St, Sydney, NSW, 2000, Australia");
  });

  it("omits missing fields", () => {
    expect(
      formatAddress({
        street: "123 Main St",
        city: "Sydney",
        state: null,
        postcode: "2000",
        country: null,
      })
    ).toBe("123 Main St, Sydney, 2000");
  });

  it("handles all null/undefined fields", () => {
    expect(
      formatAddress({
        street: null,
        city: null,
        state: null,
        postcode: null,
        country: null,
      })
    ).toBe("");
  });

  it("handles empty object (all undefined)", () => {
    expect(formatAddress({})).toBe("");
  });

  it("handles single field only", () => {
    expect(formatAddress({ city: "Melbourne" })).toBe("Melbourne");
  });

  it("handles only street and postcode", () => {
    expect(formatAddress({ street: "456 Park Ave", postcode: "3000" })).toBe(
      "456 Park Ave, 3000"
    );
  });

  it("skips empty string fields", () => {
    // filter(Boolean) removes empty strings too
    expect(
      formatAddress({
        street: "",
        city: "Perth",
        state: "",
        postcode: "6000",
      })
    ).toBe("Perth, 6000");
  });
});
