import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Trim to avoid WebSocket URL corruption (e.g. trailing newline in env → %0A in apikey)
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** Whether Supabase is configured (avoids Realtime/WS when env is missing or invalid). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Returns a Supabase browser client.
 * When called on the client, injects `x-active-workspace-id` from the auth
 * store so that RLS `is_active_workspace_member()` can enforce tenant isolation.
 */
export function createClient() {
  // Resolve active workspace ID without importing auth-store directly
  // (avoids circular dependencies — auth-store imports createClient).
  let activeWorkspaceId: string | undefined;
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("iworkr-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        activeWorkspaceId = parsed?.state?.currentOrg?.id as string | undefined;
      }
    }
  } catch {
    // ignore — not critical
  }

  const headers: Record<string, string> = {};
  if (activeWorkspaceId) {
    headers["x-active-workspace-id"] = activeWorkspaceId;
  }

  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers },
  });
}
