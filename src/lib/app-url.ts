/**
 * @module AppUrl
 * @status COMPLETE
 * @description Centralized application URL resolution with env-aware fallbacks
 * @lastAudit 2026-03-22
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    return "https://iworkrapp.com";
  }
  return "http://localhost:3000";
}
