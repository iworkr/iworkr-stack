/**
 * Shared formatting utilities (testable in isolation).
 */

export function formatCurrency(num: number, locale = "en-AU"): string {
  return `$${num.toLocaleString(locale)}`;
}
