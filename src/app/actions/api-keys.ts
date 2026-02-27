"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────── */

const GenerateApiKeySchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(100),
  scopes: z.array(z.string().max(50)).optional(),
});

/* ── Types ─────────────────────────────────────────── */

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  scopes: string[];
  status: "active" | "revoked";
  created_at: string;
  revoked_at: string | null;
}

/* ── CRUD ─────────────────────────────────────────── */

export async function getApiKeys(orgId: string): Promise<{ data: ApiKey[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, expires_at, scopes, status, created_at, revoked_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as ApiKey[] };
}

export async function generateApiKey(params: {
  organization_id: string;
  name: string;
  scopes?: string[];
}): Promise<{ key: string | null; data: ApiKey | null; error?: string }> {
  // Validate input
  const parsed = GenerateApiKeySchema.safeParse(params);
  if (!parsed.success) {
    return { key: null, data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { key: null, data: null, error: "Unauthorized" };

  // Generate a secure API key
  const rawKey = randomBytes(32).toString("hex");
  const prefix = `sk_live_${rawKey.slice(0, 8)}`;
  const fullKey = `sk_live_${rawKey}`;
  const keyHash = createHash("sha256").update(fullKey).digest("hex");

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      organization_id: params.organization_id,
      name: params.name,
      key_prefix: prefix,
      key_hash: keyHash,
      scopes: params.scopes || ["read", "write"],
      created_by: user.id,
    })
    .select("id, name, key_prefix, last_used_at, expires_at, scopes, status, created_at, revoked_at")
    .single();

  if (error) return { key: null, data: null, error: error.message };
  revalidatePath("/settings/developers");
  return { key: fullKey, data: data as ApiKey };
}

export async function revokeApiKey(keyId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", keyId);

  if (error) return { error: error.message };
  revalidatePath("/settings/developers");
  return {};
}
