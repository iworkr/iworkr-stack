/**
 * @module lib/super-admin
 * @status STABLE
 * @description Bootstrap super-admin email allowlist when `profiles.is_super_admin` / JWT claims are missing or out of sync.
 * @lastReview 2026-03-28
 */

/** Default bootstrap (overridable via SUPER_ADMIN_EMAILS). */
const DEFAULT_SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"] as const;

function parseSuperAdminEmails(): string[] {
  const raw = process.env.SUPER_ADMIN_EMAILS?.trim();
  if (raw === undefined || raw === "") {
    return [...DEFAULT_SUPER_ADMIN_EMAILS];
  }
  const parsed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_SUPER_ADMIN_EMAILS];
}

/** Comma-separated list from env, else defaults — all compared case-insensitively. */
export function getSuperAdminEmails(): string[] {
  return parseSuperAdminEmails();
}

/** True if email is in the bootstrap super-admin allowlist. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return getSuperAdminEmails().some((e) => e.toLowerCase() === lower);
}
