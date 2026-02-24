import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Trim to avoid WebSocket URL corruption (e.g. trailing newline in env → %0A in apikey)
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** Whether Supabase is configured (avoids Realtime/WS when env is missing or invalid). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
