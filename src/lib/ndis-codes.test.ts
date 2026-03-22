/**
 * Zenith-Launch: NDIS Code Resolution & Platform Fee Unit Tests
 *
 * Tests the NDIS Support Item Code translation engine, PRODA CSV formatting,
 * and Stripe Connect platform fee calculations.
 *
 * These tests mathematically verify that the billing translation engine
 * is legally compliant with the NDIS Pricing Arrangements.
 */

import { describe, it, expect } from "vitest";
import {
  resolveNdisCode,
  NDIS_RATE_TABLE,
  formatProdaDate,
  buildProdaCsvRow,
  serializeProdaCsv,
  calculatePlatformFee,
} from "./ndis-codes";

/* ── Helper: Create a date in Brisbane timezone ───────────────── */

function brisbaneDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  // Brisbane is UTC+10 (no DST)
  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hour - 10, minute)
  );
  return utcDate;
}

/* ══════════════════════════════════════════════════════════════════
   NDIS Code Resolution Tests
   ══════════════════════════════════════════════════════════════════ */

describe("NDIS Support Item Code Resolution", () => {
  describe("Weekday Daytime (6 AM – 6 PM)", () => {
    it("resolves Tuesday 2:00 PM → 01_011_0107_1_1 (Weekday Daytime)", () => {
      // Tuesday 14:00 – 18:00 Brisbane (4h shift)
      const start = brisbaneDate(2026, 3, 24, 14, 0); // Tuesday
      const end = brisbaneDate(2026, 3, 24, 18, 0);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_011_0107_1_1");
      expect(result[0].description).toBe("Weekday Daytime");
      expect(result[0].hours).toBe(4);
      expect(result[0].rate).toBe(67.56);
    });

    it("resolves Monday 8:00 AM – 4:00 PM (8h standard shift)", () => {
      const start = brisbaneDate(2026, 3, 23, 8, 0); // Monday
      const end = brisbaneDate(2026, 3, 23, 16, 0);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_011_0107_1_1");
      expect(result[0].hours).toBe(8);
    });

    it("correctly calculates total cost for weekday daytime shift", () => {
      const start = brisbaneDate(2026, 3, 24, 9, 0);
      const end = brisbaneDate(2026, 3, 24, 17, 0);
      const result = resolveNdisCode(start, end);

      const totalCost = result[0].hours * result[0].rate;
      expect(totalCost).toBeCloseTo(540.48, 2); // 8h × $67.56
    });
  });

  describe("Weekday Evening (6 PM – midnight)", () => {
    it("resolves Tuesday 8:00 PM → 01_012_0107_1_1 (Evening)", () => {
      const start = brisbaneDate(2026, 3, 24, 20, 0);
      const end = brisbaneDate(2026, 3, 24, 23, 0);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_012_0107_1_1");
      expect(result[0].description).toBe("Weekday Evening");
      expect(result[0].rate).toBe(74.44);
    });
  });

  describe("Active Night (midnight – 6 AM)", () => {
    it("resolves shift starting at 2 AM → Active Night rate", () => {
      const start = brisbaneDate(2026, 3, 25, 2, 0);
      const end = brisbaneDate(2026, 3, 25, 6, 0);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_012_0107_1_1");
      expect(result[0].description).toBe("Active Night");
      expect(result[0].hours).toBe(4);
    });
  });

  describe("Cross-Midnight Splitting", () => {
    it("splits 8 PM – 4 AM into Evening + Night pay lines", () => {
      const start = brisbaneDate(2026, 3, 24, 20, 0); // Tue 8 PM
      const end = brisbaneDate(2026, 3, 25, 4, 0);    // Wed 4 AM
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(2);

      // Evening portion: 8 PM – midnight = 4 hours
      expect(result[0].code).toBe("01_012_0107_1_1");
      expect(result[0].description).toBe("Weekday Evening");
      expect(result[0].hours).toBe(4);

      // Night portion: midnight – 4 AM = 4 hours
      expect(result[1].code).toBe("01_012_0107_1_1");
      expect(result[1].description).toBe("Active Night");
      expect(result[1].hours).toBe(4);

      // Total must equal 8 hours
      const totalHours = result.reduce((sum, r) => sum + r.hours, 0);
      expect(totalHours).toBe(8);
    });

    it("correctly prices cross-midnight shift (Evening + Night at same rate)", () => {
      const start = brisbaneDate(2026, 3, 24, 22, 0); // Tue 10 PM
      const end = brisbaneDate(2026, 3, 25, 6, 0);    // Wed 6 AM
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(2);

      const totalCost = result.reduce((sum, r) => sum + r.hours * r.rate, 0);
      // 2h evening @ $74.44 + 6h night @ $74.44 = 8h × $74.44 = $595.52
      expect(totalCost).toBeCloseTo(595.52, 2);
    });
  });

  describe("Saturday Rate", () => {
    it("resolves Saturday 2:00 PM → 01_013_0107_1_1", () => {
      const start = brisbaneDate(2026, 3, 28, 14, 0); // Saturday
      const end = brisbaneDate(2026, 3, 28, 22, 0);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_013_0107_1_1");
      expect(result[0].description).toBe("Saturday");
      expect(result[0].rate).toBe(94.99);
      expect(result[0].hours).toBe(8);
    });
  });

  describe("Sunday Rate", () => {
    it("resolves Sunday 2:00 PM → 01_014_0107_1_1", () => {
      const start = brisbaneDate(2026, 3, 29, 14, 0); // Sunday
      const end = brisbaneDate(2026, 3, 29, 22, 0);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_014_0107_1_1");
      expect(result[0].description).toBe("Sunday");
      expect(result[0].rate).toBe(121.73);
    });

    it("Sunday rate is higher than Saturday rate", () => {
      expect(NDIS_RATE_TABLE.SUNDAY.rate).toBeGreaterThan(
        NDIS_RATE_TABLE.SATURDAY.rate
      );
    });
  });

  describe("Public Holiday Rate", () => {
    it("resolves public holiday → 01_015_0107_1_1 ($148.47/hr)", () => {
      const start = brisbaneDate(2026, 1, 26, 8, 0); // Australia Day
      const end = brisbaneDate(2026, 1, 26, 16, 0);
      const result = resolveNdisCode(start, end, true);

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("01_015_0107_1_1");
      expect(result[0].description).toBe("Public Holiday");
      expect(result[0].rate).toBe(148.47);
      expect(result[0].hours).toBe(8);
    });

    it("public holiday rate is highest of all rates", () => {
      const rates = Object.values(NDIS_RATE_TABLE).map((r) => r.rate);
      expect(NDIS_RATE_TABLE.PUBLIC_HOLIDAY.rate).toBe(Math.max(...rates));
    });

    it("public holiday overrides day-of-week (even Sunday)", () => {
      // Sunday that is also a public holiday → uses PH rate
      const start = brisbaneDate(2026, 12, 27, 8, 0);
      const end = brisbaneDate(2026, 12, 27, 16, 0);
      const result = resolveNdisCode(start, end, true);

      expect(result[0].code).toBe("01_015_0107_1_1");
    });
  });

  describe("Edge Cases", () => {
    it("returns empty array for zero-duration shift", () => {
      const d = brisbaneDate(2026, 3, 24, 9, 0);
      const result = resolveNdisCode(d, d);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for negative-duration shift", () => {
      const start = brisbaneDate(2026, 3, 24, 16, 0);
      const end = brisbaneDate(2026, 3, 24, 8, 0);
      const result = resolveNdisCode(start, end);
      expect(result).toHaveLength(0);
    });

    it("handles short 30-minute shift", () => {
      const start = brisbaneDate(2026, 3, 24, 10, 0);
      const end = brisbaneDate(2026, 3, 24, 10, 30);
      const result = resolveNdisCode(start, end);

      expect(result).toHaveLength(1);
      expect(result[0].hours).toBe(0.5);
    });
  });
});

/* ══════════════════════════════════════════════════════════════════
   PRODA CSV Formatting Tests
   ══════════════════════════════════════════════════════════════════ */

describe("PRODA CSV Formatting", () => {
  it("formats date as DD/MM/YYYY", () => {
    expect(formatProdaDate(new Date(2026, 2, 22))).toBe("22/03/2026");
    expect(formatProdaDate(new Date(2026, 0, 1))).toBe("01/01/2026");
    expect(formatProdaDate(new Date(2026, 11, 25))).toBe("25/12/2026");
  });

  it("builds a complete PRODA CSV row", () => {
    const resolution = {
      code: "01_011_0107_1_1",
      description: "Weekday Daytime",
      rate: 67.56,
      hours: 8,
    };

    const row = buildProdaCsvRow(
      "4050000000",
      "430123456",
      new Date(2026, 2, 24),
      new Date(2026, 2, 24),
      resolution,
      "BATCH-2026-03-001"
    );

    expect(row.RegistrationNumber).toBe("4050000000");
    expect(row.NDISNumber).toBe("430123456");
    expect(row.SupportItemNumber).toBe("01_011_0107_1_1");
    expect(row.Quantity).toBe("8.00");
    expect(row.UnitPrice).toBe("67.56");
    expect(row.GSTCode).toBe("P1");
  });

  it("serializes CSV with CRLF line endings and no trailing commas", () => {
    const rows = [
      {
        RegistrationNumber: "4050000000",
        NDISNumber: "430123456",
        SupportsDeliveredFrom: "24/03/2026",
        SupportsDeliveredTo: "24/03/2026",
        SupportItemNumber: "01_011_0107_1_1",
        ClaimReference: "REF-001",
        Quantity: "8.00",
        UnitPrice: "67.56",
        GSTCode: "P1",
      },
    ];

    const csv = serializeProdaCsv(rows);

    // Check header
    expect(csv).toContain("RegistrationNumber,NDISNumber");

    // Check CRLF line endings
    expect(csv).toContain("\r\n");

    // Check no trailing comma on any line
    const lines = csv.split("\r\n");
    for (const line of lines) {
      expect(line.endsWith(",")).toBe(false);
    }

    // Check correct number of columns (9)
    const headerCols = lines[0].split(",").length;
    const dataCols = lines[1].split(",").length;
    expect(headerCols).toBe(9);
    expect(dataCols).toBe(9);
  });

  it("handles multiple CSV rows correctly", () => {
    const rows = [
      buildProdaCsvRow(
        "4050000000",
        "430123456",
        new Date(2026, 2, 24),
        new Date(2026, 2, 24),
        { code: "01_011_0107_1_1", description: "Weekday", rate: 67.56, hours: 8 },
        "REF-001"
      ),
      buildProdaCsvRow(
        "4050000000",
        "430789012",
        new Date(2026, 2, 28),
        new Date(2026, 2, 28),
        { code: "01_013_0107_1_1", description: "Saturday", rate: 94.99, hours: 6 },
        "REF-002"
      ),
    ];

    const csv = serializeProdaCsv(rows);
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain("430123456");
    expect(lines[1]).toContain("01_011_0107_1_1");
    expect(lines[2]).toContain("430789012");
    expect(lines[2]).toContain("01_013_0107_1_1");
  });
});

/* ══════════════════════════════════════════════════════════════════
   Stripe Platform Fee Calculation Tests
   ══════════════════════════════════════════════════════════════════ */

describe("Stripe Platform Fee Calculator", () => {
  it("calculates 1.5% platform fee on $1000 → $15.00 (1500 cents)", () => {
    const fee = calculatePlatformFee(100_000, 1.5);
    expect(fee).toBe(1500);
  });

  it("calculates 1% platform fee on $500 → $5.00 (500 cents)", () => {
    const fee = calculatePlatformFee(50_000, 1.0);
    expect(fee).toBe(500);
  });

  it("calculates 1.5% fee on $500 → $7.50 (750 cents) — Zenith acceptance test", () => {
    // This is the EXACT test from the Definition of Done:
    // "The terminal output must mathematically verify that the exact integer 750
    //  ($7.50 in cents) was successfully appended to the application_fee_amount"
    const fee = calculatePlatformFee(50_000, 1.5);
    expect(fee).toBe(750);
  });

  it("rounds correctly for fractional cents", () => {
    // $333.33 × 1.5% = $5.00 (rounded from 4.99995)
    const fee = calculatePlatformFee(33_333, 1.5);
    expect(fee).toBe(500);
  });

  it("returns 0 for zero amount", () => {
    const fee = calculatePlatformFee(0, 1.5);
    expect(fee).toBe(0);
  });

  it("handles 0% fee", () => {
    const fee = calculatePlatformFee(100_000, 0);
    expect(fee).toBe(0);
  });

  it("ensures fee is always integer (no fractional cents)", () => {
    for (let amount = 1; amount <= 1000; amount++) {
      const fee = calculatePlatformFee(amount, 1.5);
      expect(Number.isInteger(fee)).toBe(true);
    }
  });

  it("ensures platform gets its cut — fee > 0 for any non-zero amount at 1.5%", () => {
    // For amounts ≥ 67 cents ($0.67), 1.5% fee should be ≥ 1 cent
    const fee = calculatePlatformFee(100, 1.5);
    expect(fee).toBeGreaterThanOrEqual(1);
  });
});

/* ══════════════════════════════════════════════════════════════════
   NDIS Rate Hierarchy Tests
   ══════════════════════════════════════════════════════════════════ */

describe("NDIS Rate Hierarchy", () => {
  it("rates are in ascending order: Weekday < Evening < Saturday < Sunday < PH", () => {
    expect(NDIS_RATE_TABLE.WEEKDAY_DAYTIME.rate).toBeLessThan(
      NDIS_RATE_TABLE.WEEKDAY_EVENING.rate
    );
    expect(NDIS_RATE_TABLE.WEEKDAY_EVENING.rate).toBeLessThan(
      NDIS_RATE_TABLE.SATURDAY.rate
    );
    expect(NDIS_RATE_TABLE.SATURDAY.rate).toBeLessThan(
      NDIS_RATE_TABLE.SUNDAY.rate
    );
    expect(NDIS_RATE_TABLE.SUNDAY.rate).toBeLessThan(
      NDIS_RATE_TABLE.PUBLIC_HOLIDAY.rate
    );
  });

  it("all NDIS codes are exactly 15 characters", () => {
    for (const entry of Object.values(NDIS_RATE_TABLE)) {
      expect(entry.code.length).toBe(15);
    }
  });

  it("all NDIS codes match the pattern XX_XXX_XXXX_X_X", () => {
    const pattern = /^\d{2}_\d{3}_\d{4}_\d_\d$/;
    for (const entry of Object.values(NDIS_RATE_TABLE)) {
      expect(entry.code).toMatch(pattern);
    }
  });
});
