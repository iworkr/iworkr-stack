/**
 * Centralized application URL resolution.
 * Uses NEXT_PUBLIC_APP_URL in production, falls back to localhost in development.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    return "https://iworkrapp.com";
  }
  return "http://localhost:3000";
}
