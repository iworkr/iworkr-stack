/**
 * @module NdisCodes
 * @status COMPLETE
 * @description NDIS Support Item Code resolution engine — temporal context to 15-char code mapping
 * @lastAudit 2026-03-22
 */

/* ── NDIS Rate Table (2024-25 Price Guide) ────────────────────── */

export interface NdisRateEntry {
  code: string;
  description: string;
  rate: number; // AUD per hour (national rate)
}

/** Standard Assistance With Self-Care rates */
export const NDIS_RATE_TABLE: Record<string, NdisRateEntry> = {
  WEEKDAY_DAYTIME: {
    code: "01_011_0107_1_1",
    description: "Weekday Daytime",
    rate: 67.56,
  },
  WEEKDAY_EVENING: {
    code: "01_012_0107_1_1",
    description: "Weekday Evening",
    rate: 74.44,
  },
  SATURDAY: {
    code: "01_013_0107_1_1",
    description: "Saturday",
    rate: 94.99,
  },
  SUNDAY: {
    code: "01_014_0107_1_1",
    description: "Sunday",
    rate: 121.73,
  },
  PUBLIC_HOLIDAY: {
    code: "01_015_0107_1_1",
    description: "Public Holiday",
    rate: 148.47,
  },
  ACTIVE_NIGHT: {
    code: "01_012_0107_1_1",
    description: "Active Night",
    rate: 74.44,
  },
};

/* ── Code Resolution ──────────────────────────────────────────── */

export interface NdisCodeResolution {
  code: string;
  description: string;
  rate: number;
  hours: number;
}

/**
 * Resolve NDIS support item code(s) for a given shift.
 *
 * A shift may produce multiple code lines if it crosses midnight
 * (e.g., Evening portion + Active Night portion).
 *
 * @param shiftStart - Shift start time (ISO string or Date)
 * @param shiftEnd   - Shift end time (ISO string or Date)
 * @param isPublicHoliday - Whether the shift date is a public holiday
 * @returns Array of NDIS code resolutions (1 or 2 items for cross-midnight)
 */
export function resolveNdisCode(
  shiftStart: Date | string,
  shiftEnd: Date | string,
  isPublicHoliday = false
): NdisCodeResolution[] {
  const start = new Date(shiftStart);
  const end = new Date(shiftEnd);

  // Total hours (physical, not wall-clock)
  const totalHoursRaw = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  const totalHours = Math.round(totalHoursRaw * 100) / 100;

  if (totalHours <= 0) return [];

  // ── Convert to Brisbane timezone (UTC+10, no DST) ────────────
  // We add 10 hours to UTC to get Brisbane local time
  const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
  const localStartMs = start.getTime() + BRISBANE_OFFSET_MS;
  const localEndMs = end.getTime() + BRISBANE_OFFSET_MS;
  const localStart = new Date(localStartMs);
  const localEnd = new Date(localEndMs);

  const dayOfWeek = localStart.getUTCDay(); // 0=Sun, 6=Sat (use UTC since we offset)
  const startHour = localStart.getUTCHours();

  // ── Public Holiday ───────────────────────────────────────────
  if (isPublicHoliday) {
    return [{ ...NDIS_RATE_TABLE.PUBLIC_HOLIDAY, hours: totalHours }];
  }

  // ── Sunday ───────────────────────────────────────────────────
  if (dayOfWeek === 0) {
    return [{ ...NDIS_RATE_TABLE.SUNDAY, hours: totalHours }];
  }

  // ── Saturday ─────────────────────────────────────────────────
  if (dayOfWeek === 6) {
    return [{ ...NDIS_RATE_TABLE.SATURDAY, hours: totalHours }];
  }

  // ── Weekday: Check for cross-midnight splitting ──────────────
  // Midnight is when UTC hours = 0 in our offset time
  const midnightMs = Date.UTC(
    localStart.getUTCFullYear(),
    localStart.getUTCMonth(),
    localStart.getUTCDate() + 1,
    0, 0, 0, 0
  );
  const midnightDate = new Date(midnightMs);

  if (localEnd > midnightDate && startHour >= 18) {
    // Cross-midnight: split into evening + night portions
    const eveningMs = midnightDate.getTime() - localStart.getTime();
    const nightMs = localEnd.getTime() - midnightDate.getTime();
    const eveningHours = Math.round((eveningMs / (1000 * 60 * 60)) * 100) / 100;
    const nightHours = Math.round((nightMs / (1000 * 60 * 60)) * 100) / 100;

    const results: NdisCodeResolution[] = [];
    if (eveningHours > 0) {
      results.push({ ...NDIS_RATE_TABLE.WEEKDAY_EVENING, hours: eveningHours });
    }
    if (nightHours > 0) {
      results.push({ ...NDIS_RATE_TABLE.ACTIVE_NIGHT, hours: nightHours });
    }
    return results;
  }

  // ── Evening (6 PM – midnight) ────────────────────────────────
  if (startHour >= 18) {
    return [{ ...NDIS_RATE_TABLE.WEEKDAY_EVENING, hours: totalHours }];
  }

  // ── Early Morning (midnight – 6 AM) ─────────────────────────
  if (startHour < 6) {
    return [{ ...NDIS_RATE_TABLE.ACTIVE_NIGHT, hours: totalHours }];
  }

  // ── Default: Weekday Daytime (6 AM – 6 PM) ──────────────────
  return [{ ...NDIS_RATE_TABLE.WEEKDAY_DAYTIME, hours: totalHours }];
}

/* ── PRODA CSV Formatting ─────────────────────────────────────── */

export interface ProdaCsvRow {
  RegistrationNumber: string;
  NDISNumber: string;
  SupportsDeliveredFrom: string;
  SupportsDeliveredTo: string;
  SupportItemNumber: string;
  ClaimReference: string;
  Quantity: string;
  UnitPrice: string;
  GSTCode: string;
}

/**
 * Format a date as DD/MM/YYYY for PRODA portal.
 */
export function formatProdaDate(date: Date | string): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Build a PRODA CSV row from resolved NDIS code data.
 */
export function buildProdaCsvRow(
  registrationNumber: string,
  ndisNumber: string,
  shiftStart: Date | string,
  shiftEnd: Date | string,
  resolution: NdisCodeResolution,
  claimReference: string
): ProdaCsvRow {
  return {
    RegistrationNumber: registrationNumber,
    NDISNumber: ndisNumber,
    SupportsDeliveredFrom: formatProdaDate(shiftStart),
    SupportsDeliveredTo: formatProdaDate(shiftEnd),
    SupportItemNumber: resolution.code,
    ClaimReference: claimReference,
    Quantity: resolution.hours.toFixed(2),
    UnitPrice: resolution.rate.toFixed(2),
    GSTCode: "P1", // GST-free (NDIS)
  };
}

/**
 * Serialize PRODA CSV rows to a strict CSV string.
 * No trailing commas. CRLF line endings (PRODA requirement).
 */
export function serializeProdaCsv(rows: ProdaCsvRow[]): string {
  const header =
    "RegistrationNumber,NDISNumber,SupportsDeliveredFrom,SupportsDeliveredTo,SupportItemNumber,ClaimReference,Quantity,UnitPrice,GSTCode";
  const dataRows = rows.map((r) =>
    [
      r.RegistrationNumber,
      r.NDISNumber,
      r.SupportsDeliveredFrom,
      r.SupportsDeliveredTo,
      r.SupportItemNumber,
      r.ClaimReference,
      r.Quantity,
      r.UnitPrice,
      r.GSTCode,
    ].join(",")
  );
  return [header, ...dataRows].join("\r\n");
}

/* ── Stripe Platform Fee Calculator ───────────────────────────── */

/**
 * Calculate platform fee in cents (integer) for Stripe Connect.
 *
 * @param amountCents - Total invoice amount in cents
 * @param feePercent  - Platform fee percentage (default 1.5%)
 * @returns Platform fee in cents (integer, rounded)
 */
export function calculatePlatformFee(
  amountCents: number,
  feePercent = 1.5
): number {
  return Math.round(amountCents * (feePercent / 100));
}
