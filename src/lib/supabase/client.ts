/**
 * @module SupabaseClient
 * @status COMPLETE
 * @description Browser-side Supabase client singleton with Realtime channel helpers
 * @lastAudit 2026-03-22
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Trim to avoid WebSocket URL corruption (e.g. trailing newline in env → %0A in apikey)
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** Whether Supabase is configured (avoids Realtime/WS when env is missing or invalid). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ── Singleton browser client ───────────────────────────────────
 * Before this fix, every call to createClient() would:
 *   1. Parse localStorage("iworkr-auth") via JSON.parse
 *   2. Create a new createBrowserClient() instance (albeit @supabase/ssr
 *      deduplicates internally when URL+key match — but custom headers
 *      could defeat that).
 * Now we create a single instance and cache the workspace header lookup.
 * The header is refreshed whenever switchOrg / setActiveWorkspace is called.
 */
let _cachedClient: ReturnType<typeof createBrowserClient<Database>> | null = null;
let _cachedWorkspaceId: string | undefined;

/** Call this when the active workspace changes (e.g. switchOrg) */
export function setActiveWorkspace(workspaceId: string | undefined) {
  _cachedWorkspaceId = workspaceId;
  // Force new client on next call to pick up new headers
  _cachedClient = null;
}

function resolveWorkspaceId(): string | undefined {
  // Fast path: already resolved
  if (_cachedWorkspaceId) return _cachedWorkspaceId;
  // Fallback: read from persisted zustand store (cold start only)
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("iworkr-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        _cachedWorkspaceId = parsed?.state?.currentOrg?.id as string | undefined;
      }
    }
  } catch {
    // ignore — not critical
  }
  return _cachedWorkspaceId;
}

/**
 * Returns a Supabase browser client (singleton).
 * Injects `x-active-workspace-id` for RLS tenant isolation.
 */
export function createClient() {
  if (_cachedClient) return _cachedClient;

  const activeWorkspaceId = resolveWorkspaceId();
  const headers: Record<string, string> = {};
  if (activeWorkspaceId) {
    headers["x-active-workspace-id"] = activeWorkspaceId;
  }

  _cachedClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers },
  });
  return _cachedClient;
}
