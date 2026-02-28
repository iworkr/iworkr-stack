/**
 * Shared formatting utilities (testable in isolation).
 */

export function formatCurrency(num: number, locale = "en-AU"): string {
  return `$${num.toLocaleString(locale)}`;
}

// INCOMPLETE:TODO — only has formatCurrency; missing formatDate, formatRelativeTime, formatPhoneNumber, formatAddress which are used inconsistently across components.
