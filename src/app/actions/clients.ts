/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Events, dispatch } from "@/lib/automation";
import { createClientSchema, validate } from "@/lib/validation";
import { z } from "zod";
import { logger } from "@/lib/logger";

const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  status: z.enum(["active", "lead", "churned", "inactive"]).optional(),
  type: z.enum(["residential", "commercial"]).optional(),
  address: z.string().max(500).optional().nullable(),
  address_lat: z.number().min(-90).max(90).optional().nullable(),
  address_lng: z.number().min(-180).max(180).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional().nullable(),
  since: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "lead" | "churned" | "inactive";
  type: "residential" | "commercial";
  address: string | null;
  address_lat: number | null;
  address_lng: number | null;
  tags: string[];
  notes: string | null;
  since: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  job_count?: number;
  total_spend?: number;
  last_job_date?: string | null;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface CreateClientParams {
  organization_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: "active" | "lead" | "churned" | "inactive";
  type?: "residential" | "commercial";
  address?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  tags?: string[];
  notes?: string | null;
  since?: string | null;
  billing_terms?: string | null;
  metadata?: Record<string, any> | null;
  initial_contact?: {
    name: string;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    is_primary?: boolean;
  };
}

export interface ClientFilters {
  search?: string | null;
  status?: string | null;
  type?: string | null;
  sort_by?: string;
  sort_asc?: boolean;
  limit?: number;
  offset?: number;
}

export interface UpdateClientParams {
  name?: string;
  email?: string | null;
  phone?: string | null;
  status?: "active" | "lead" | "churned" | "inactive";
  type?: "residential" | "commercial";
  address?: string | null;
  address_lat?: number | null;
  address_lng?: number | null;
  tags?: string[];
  notes?: string | null;
  since?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreateClientContactParams {
  client_id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
}

export interface UpdateClientContactParams {
  name?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
}

/**
 * Get all clients for an organization with job count, total spend, and last job date
 */
export async function getClients(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (clientsError) {
      return { data: null, error: clientsError.message };
    }

    if (!clients || clients.length === 0) {
      return { data: [], error: null };
    }

    const clientIds = clients.map((c: any) => c.id);

    // Get job counts and last job dates
    const { data: jobStats, error: jobStatsError } = await supabase
      .from("jobs")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .is("deleted_at", null);

    if (jobStatsError) {
      return { data: null, error: jobStatsError.message };
    }

    // Get total spend from invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("client_id, total")
      .in("client_id", clientIds)
      .eq("status", "paid");

    if (invoicesError) {
      return { data: null, error: invoicesError.message };
    }

    // Calculate stats per client
    const statsByClient: Record<string, { job_count: number; total_spend: number; last_job_date: string | null }> = {};

    // Initialize stats
    clients.forEach((client: any) => {
      statsByClient[client.id] = {
        job_count: 0,
        total_spend: 0,
        last_job_date: null,
      };
    });

    // Count jobs and find last job date
    jobStats?.forEach((job: any) => {
      if (job.client_id && statsByClient[job.client_id]) {
        statsByClient[job.client_id].job_count++;
        const jobDate = job.created_at;
        if (!statsByClient[job.client_id].last_job_date || jobDate > statsByClient[job.client_id].last_job_date!) {
          statsByClient[job.client_id].last_job_date = jobDate;
        }
      }
    });

    // Sum invoice totals
    invoices?.forEach((invoice: any) => {
      if (invoice.client_id && statsByClient[invoice.client_id]) {
        statsByClient[invoice.client_id].total_spend += invoice.total || 0;
      }
    });

    // Combine client data with stats
    const clientsWithStats = clients.map((client: any) => ({
      ...client,
      job_count: statsByClient[client.id]?.job_count || 0,
      total_spend: statsByClient[client.id]?.total_spend || 0,
      last_job_date: statsByClient[client.id]?.last_job_date || null,
    }));

    return { data: clientsWithStats, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch clients" };
  }
}

/**
 * Get a single client with contacts, recent activity, and spend history
 */
export async function getClient(clientId: string, orgId?: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Get client — filter by org when provided to enforce ownership
    let query = supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .is("deleted_at", null);

    if (orgId) query = query.eq("organization_id", orgId);

    const { data: client, error: clientError } = await query.maybeSingle();

    if (clientError) {
      return { data: null, error: clientError.message };
    }

    if (!client) {
      return { data: null, error: "Client not found" };
    }

    // Get contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (contactsError) {
      return { data: null, error: contactsError.message };
    }

    // Get recent activity from job_activity through jobs
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id")
      .eq("client_id", clientId)
      .is("deleted_at", null);

    if (jobsError) {
      return { data: null, error: jobsError.message };
    }

    let recentActivity: any[] = [];
    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map((j: any) => j.id);
      const { data: activity, error: activityError } = await supabase
        .from("job_activity")
        .select(`
          *,
          profiles:user_id (
            full_name
          )
        `)
        .in("job_id", jobIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!activityError && activity) {
        recentActivity = activity.map((act: any) => ({
          ...act,
          user_name: act.profiles?.full_name || null,
          profiles: undefined,
        }));
      }
    }

    // Get spend history from invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (invoicesError) {
      return { data: null, error: invoicesError.message };
    }

    const clientWithDetails = {
      ...client,
      contacts: contacts || [],
      recent_activity: recentActivity,
      spend_history: invoices || [],
    };

    return { data: clientWithDetails, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch client" };
  }
}

/**
 * Create a new client with optional initial contact
 */
export async function createClient(params: CreateClientParams) {
  try {
    // Validate input
    const validated = validate(createClientSchema, params);
    if (validated.error) {
      return { data: null, error: validated.error };
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Create client
    const clientData = {
      organization_id: params.organization_id,
      name: params.name,
      email: params.email || null,
      phone: params.phone || null,
      status: params.status || "lead",
      type: params.type || "residential",
      address: params.address || null,
      address_lat: params.address_lat || null,
      address_lng: params.address_lng || null,
      tags: params.tags || [],
      notes: params.notes || null,
      since: params.since || new Date().toISOString(),
      metadata: params.metadata || null,
    };

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert(clientData)
      .select()
      .single();

    if (clientError) {
      return { data: null, error: clientError.message };
    }

    // Create initial contact if provided
    if (params.initial_contact) {
      const contactData = {
        client_id: client.id,
        name: params.initial_contact.name,
        role: params.initial_contact.role || null,
        email: params.initial_contact.email || null,
        phone: params.initial_contact.phone || null,
        is_primary: params.initial_contact.is_primary ?? true,
      };

      const { error: contactError } = await supabase
        .from("client_contacts")
        .insert(contactData);

      if (contactError) {
        // Client created but contact failed - still return client
        console.error("Failed to create initial contact:", contactError);
      }
    }

    // Dispatch automation event
    dispatch(Events.clientCreated(params.organization_id, client.id, {
      name: params.name,
      email: params.email,
      status: params.status || "lead",
      type: params.type || "residential",
    }));

    revalidatePath("/dashboard/clients");
    return { data: client, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to create client" };
  }
}

/**
 * Update a client (orgId optional but recommended for ownership verification)
 */
export async function updateClient(clientId: string, updates: UpdateClientParams, orgId?: string) {
  try {
    // Validate input
    const validated = validate(UpdateClientSchema, updates);
    if (validated.error) return { data: null, error: validated.error };

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Verify org ownership when orgId is provided
    if (orgId) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!existing) return { data: null, error: "Client not found in organization" };
    }

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.address_lat !== undefined) updateData.address_lat = updates.address_lat;
    if (updates.address_lng !== undefined) updateData.address_lng = updates.address_lng;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.since !== undefined) updateData.since = updates.since;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    updateData.updated_at = new Date().toISOString();

    let query = supabase
      .from("clients")
      .update(updateData)
      .eq("id", clientId)
      .is("deleted_at", null);

    if (orgId) query = query.eq("organization_id", orgId);

    const { data: client, error } = await query.select().single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/clients");
    return { data: client, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update client" };
  }
}

/**
 * Soft delete a client (orgId optional but recommended for ownership verification)
 */
export async function deleteClient(clientId: string, orgId?: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    let query = supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", clientId)
      .is("deleted_at", null);

    if (orgId) query = query.eq("organization_id", orgId);

    const { error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/clients");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to delete client" };
  }
}

/**
 * Add a contact to a client
 */
export async function addClientContact(clientId: string, contact: CreateClientContactParams) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // If this is set as primary, unset other primary contacts
    if (contact.is_primary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", clientId)
        .eq("is_primary", true);
    }

    const contactData = {
      client_id: clientId,
      name: contact.name,
      role: contact.role || null,
      email: contact.email || null,
      phone: contact.phone || null,
      is_primary: contact.is_primary ?? false,
    };

    const { data: newContact, error } = await supabase
      .from("client_contacts")
      .insert(contactData)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/clients");
    return { data: newContact, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to add contact" };
  }
}

/**
 * Update a client contact
 */
export async function updateClientContact(contactId: string, updates: UpdateClientContactParams) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Get current contact to check client_id
    const { data: currentContact, error: fetchError } = await supabase
      .from("client_contacts")
      .select("client_id, is_primary")
      .eq("id", contactId)
      .maybeSingle();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    if (!currentContact) {
      return { data: null, error: "Contact not found" };
    }

    // If setting as primary, unset other primary contacts for this client
    if (updates.is_primary === true && !currentContact.is_primary) {
      await supabase
        .from("client_contacts")
        .update({ is_primary: false })
        .eq("client_id", currentContact.client_id)
        .eq("is_primary", true)
        .neq("id", contactId);
    }

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.is_primary !== undefined) updateData.is_primary = updates.is_primary;

    const { data: contact, error } = await supabase
      .from("client_contacts")
      .update(updateData)
      .eq("id", contactId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/clients");
    return { data: contact, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update contact" };
  }
}

/**
 * Delete a client contact
 */
export async function deleteClientContact(contactId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Fetch contact to get client_id, then client to get org_id
    const { data: contact } = await supabase
      .from("client_contacts")
      .select("client_id")
      .eq("id", contactId)
      .maybeSingle();
    if (!contact) return { data: null, error: "Contact not found" };

    const { data: client } = await supabase
      .from("clients")
      .select("organization_id")
      .eq("id", contact.client_id)
      .maybeSingle();
    if (!client) return { data: null, error: "Client not found" };

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", client.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", contactId);

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/clients");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to delete contact" };
  }
}

/* ── RPC-backed Operations ─────────────────────────────── */

/**
 * Get clients with aggregated stats via RPC (efficient single query)
 */
export async function getClientsWithStats(orgId: string, filters: ClientFilters = {}) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_clients_with_stats", {
      p_org_id: orgId,
      p_search: filters.search ?? undefined,
      p_status: filters.status ?? undefined,
      p_type: filters.type ?? undefined,
      p_sort_by: filters.sort_by || "name",
      p_sort_asc: filters.sort_asc ?? true,
      p_limit: filters.limit || 200,
      p_offset: filters.offset || 0,
    });

    if (error) {
      logger.error("get_clients_with_stats RPC failed, falling back", "clients", undefined, { error: error.message });
      return getClients(orgId);
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    logger.error("Failed to fetch clients with stats", "clients", error);
    return { data: null, error: error.message || "Failed to fetch clients" };
  }
}

/**
 * Create client with contact via RPC (transactional)
 */
export async function createClientFull(params: CreateClientParams) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data: result, error: rpcError } = await supabase.rpc("create_client_full", {
      p_org_id: params.organization_id,
      p_name: params.name,
      p_type: params.type || "residential",
      p_status: params.status || "active",
      p_email: params.email ?? undefined,
      p_phone: params.phone ?? undefined,
      p_address: params.address ?? undefined,
      p_address_lat: params.address_lat ?? undefined,
      p_address_lng: params.address_lng ?? undefined,
      p_tags: params.tags || [],
      p_notes: params.notes ?? undefined,
      p_billing_terms: params.billing_terms || "due_on_receipt",
      p_contact_name: params.initial_contact?.name ?? undefined,
      p_contact_role: params.initial_contact?.role ?? undefined,
      p_contact_email: params.initial_contact?.email ?? undefined,
      p_contact_phone: params.initial_contact?.phone ?? undefined,
    });

    if (rpcError) {
      logger.error("create_client_full RPC failed, falling back", "clients", undefined, { error: rpcError.message });
      return createClient(params);
    }

    const rpcResult = result as unknown as { client_id: string };

    // Dispatch automation event
    dispatch(Events.clientCreated(params.organization_id, rpcResult.client_id, {
      name: params.name,
      email: params.email,
      status: params.status || "active",
      type: params.type || "residential",
    }));

    // Fetch the full client to return
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", rpcResult.client_id)
      .maybeSingle();

    revalidatePath("/dashboard/clients");
    return { data: client || result, error: null };
  } catch (error: any) {
    logger.error("Failed to create client (full)", "clients", error);
    return { data: null, error: error.message || "Failed to create client" };
  }
}

/**
 * Get full client details via RPC (orgId enforces ownership — PRD §2.1)
 */
export async function getClientDetails(clientId: string, orgId?: string) {
  try {
    const supabase = await createServerSupabaseClient();

    // Security: verify org ownership before calling security-definer RPC
    if (orgId) {
      const { data: exists } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!exists) return { data: null, error: "Client not found in organization" };
    }

    const { data, error } = await supabase.rpc("get_client_details", {
      p_client_id: clientId,
    });

    if (error) {
      logger.error("get_client_details RPC failed, falling back", "clients", undefined, { error: error.message });
      return getClient(clientId, orgId);
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to fetch client details", "clients", error);
    return { data: null, error: error.message || "Failed to fetch client details" };
  }
}

/* ── ABN Lookup ─────────────────────────────────────── */

export async function lookupABN(name: string): Promise<{
  abn: string; name: string; type: string; address: string; status: string;
} | null> {
  const guid = process.env.ABR_GUID;
  if (!guid) return null;
  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=&callback=c&name=${encodeURIComponent(name)}&guid=${guid}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const jsonStr = text.replace(/^c\(/, "").replace(/\)$/, "");
    const data = JSON.parse(jsonStr);
    if (!data?.Abn) return null;
    return {
      abn: data.Abn,
      name: data.EntityName || data.BusinessName?.[0] || name,
      type: data.EntityTypeName || "Unknown",
      address: [data.AddressState, data.AddressPostcode].filter(Boolean).join(" "),
      status: data.AbnStatus || "Unknown",
    };
  } catch {
    return null;
  }
}

/* ── Distance from HQ ──────────────────────────────── */

export async function getDistanceFromHQ(orgId: string, clientAddress: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !clientAddress) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: org } = await supabase
      .from("organizations").select("settings").eq("id", orgId).maybeSingle();
    const hqAddress = (org?.settings as any)?.address;
    if (!hqAddress) return null;
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(hqAddress)}&destinations=${encodeURIComponent(clientAddress)}&key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];
    if (element?.status !== "OK") return null;
    return element.duration.text;
  } catch {
    return null;
  }
}

/* ── CSV Client Import ─────────────────────────────── */

function parseCSVRows(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
    rows.push(row);
  }
  return rows;
}

export async function importClientsFromCSV(orgId: string, csvText: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: membership } = await supabase
    .from("organization_members").select("user_id")
    .eq("organization_id", orgId).eq("user_id", user.id).maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  const rows = parseCSVRows(csvText);
  if (rows.length === 0) return { error: "No data rows found in CSV" };
  if (rows.length > 5000) return { error: "Maximum 5000 rows per import" };

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  const ClientRowSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(255).optional().or(z.literal("")),
    phone: z.string().max(30).optional(),
    address: z.string().max(500).optional(),
    type: z.enum(["residential", "commercial"]).optional(),
  });

  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const validRecords: any[] = [];
    for (const row of batch) {
      const parsed = ClientRowSchema.safeParse({
        name: row.name || row.client_name || row.company || "",
        email: row.email || row.client_email || "",
        phone: row.phone || row.mobile || "",
        address: row.address || row.street_address || "",
        type: row.type === "commercial" ? "commercial" : "residential",
      });
      if (!parsed.success) { skipped++; errors.push(`Row ${i + batch.indexOf(row) + 2}: Invalid data`); continue; }
      validRecords.push({
        organization_id: orgId, name: parsed.data.name,
        email: parsed.data.email || null, phone: parsed.data.phone || null,
        address: parsed.data.address || null, type: parsed.data.type || "residential",
        status: "active" as const,
      });
    }
    if (validRecords.length > 0) {
      const { error } = await supabase.from("clients").insert(validRecords);
      if (error) { errors.push(`Batch error: ${error.message}`); skipped += validRecords.length; }
      else { imported += validRecords.length; }
    }
  }
  revalidatePath("/dashboard/clients");
  return { imported, skipped, errors: errors.slice(0, 20) };
}
