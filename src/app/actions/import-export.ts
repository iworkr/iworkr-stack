"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const ImportRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(["residential", "commercial"]).optional(),
});

export async function importClientsFromCSV(
  csvText: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { imported: 0, skipped: 0, errors: ["Not authenticated"] };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { imported: 0, skipped: 0, errors: ["No organization found"] };

  const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: ["CSV must have a header row and at least one data row"] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const nameIdx = headers.findIndex((h) => h === "name" || h === "client" || h === "company");
  const emailIdx = headers.findIndex((h) => h === "email" || h === "e-mail");
  const phoneIdx = headers.findIndex((h) => h === "phone" || h === "mobile" || h === "tel");
  const addressIdx = headers.findIndex((h) => h === "address" || h === "location");
  const typeIdx = headers.findIndex((h) => h === "type" || h === "category");

  if (nameIdx === -1) return { imported: 0, skipped: 0, errors: ["CSV must have a 'name' column"] };

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i]);
    const row = {
      name: cols[nameIdx]?.trim() || "",
      email: emailIdx >= 0 ? cols[emailIdx]?.trim() || "" : "",
      phone: phoneIdx >= 0 ? cols[phoneIdx]?.trim() || "" : "",
      address: addressIdx >= 0 ? cols[addressIdx]?.trim() || "" : "",
      type: typeIdx >= 0 ? cols[typeIdx]?.trim().toLowerCase() || "" : "",
    };

    const result = ImportRowSchema.safeParse(row);
    if (!result.success) {
      errors.push(`Row ${i + 1}: ${result.error.issues[0].message}`);
      skipped++;
      continue;
    }

    rows.push({
      organization_id: membership.organization_id,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      address: row.address || null,
      type: row.type === "commercial" ? "commercial" : "residential",
      status: "active",
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("clients").insert(rows);
    if (error) {
      return { imported: 0, skipped, errors: [...errors, `Database error: ${error.message}`] };
    }
    imported = rows.length;
  }

  return { imported, skipped, errors };
}

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export async function exportWorkspaceData(): Promise<{
  clients: any[];
  jobs: any[];
  invoices: any[];
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { clients: [], jobs: [], invoices: [], error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { clients: [], jobs: [], invoices: [], error: "No organization found" };

  const orgId = membership.organization_id;

  const [clientsRes, jobsRes, invoicesRes] = await Promise.all([
    supabase.from("clients").select("name, email, phone, address, type, status, tags, billing_terms, created_at").eq("organization_id", orgId).order("name"),
    supabase.from("jobs").select("display_id, title, status, priority, scheduled_date, address, description, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("display_id, client_name, client_email, status, subtotal, tax, total, issue_date, due_date, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);

  return {
    clients: clientsRes.data || [],
    jobs: jobsRes.data || [],
    invoices: invoicesRes.data || [],
  };
}
