/* ── NDIS Number Utilities ────────────────────────────── */
/* Pure functions — safe for both client and server use.   */

export function validateNDISNumber(ndis: string): boolean {
  const cleaned = ndis.replace(/\s/g, "");
  if (!/^\d{9}$/.test(cleaned)) return false;
  return true;
}

export function formatNDISNumber(ndis: string): string {
  const cleaned = ndis.replace(/\s/g, "");
  if (cleaned.length !== 9) return ndis;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
}
