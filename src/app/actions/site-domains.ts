/**
 * @module app/actions/site-domains
 * @status STABLE
 * @description Vercel custom domain attach/detach for published sites; syncs `sites` rows with Vercel project domains.
 * @risk P2 — Vercel API failures may be swallowed in `.catch(() => {})` on DELETE — DB and Vercel can diverge; verify logs.
 * @lastReview 2026-03-28
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN ?? "";
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "";
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID ?? "";

const VERCEL_API = "https://api.vercel.com";

function vercelHeaders() {
  return {
    Authorization: `Bearer ${VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function teamParam() {
  return VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : "";
}

async function getWorkspaceId() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

export async function addCustomDomain(siteId: string, domain: string) {
  const { supabase } = await getWorkspaceId();
  const normalized = domain.toLowerCase().trim();

  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    throw new Error("Vercel integration not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID.");
  }

  const res = await fetch(
    `${VERCEL_API}/v10/projects/${VERCEL_PROJECT_ID}/domains${teamParam()}`,
    {
      method: "POST",
      headers: vercelHeaders(),
      body: JSON.stringify({ name: normalized }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || `Vercel API error: ${res.status}`);
  }

  const dnsRecords = [];
  if (data.apexName === normalized) {
    dnsRecords.push({ type: "A", name: "@", value: "76.76.21.21" });
  } else {
    dnsRecords.push({ type: "CNAME", name: normalized.split(".")[0], value: "cname.vercel-dns.com" });
  }

  const { error } = await (supabase as any)
    .from("sites")
    .update({
      custom_domain: normalized,
      domain_dns_records: dnsRecords,
      domain_verified: false,
      vercel_domain_config: data,
    })
    .eq("id", siteId);

  if (error) throw new Error(error.message);

  return { domain: normalized, dnsRecords };
}

export async function checkDomainStatus(siteId: string) {
  const { supabase } = await getWorkspaceId();

  const { data: site } = await (supabase as any)
    .from("sites")
    .select("custom_domain")
    .eq("id", siteId)
    .single();

  if (!site?.custom_domain) throw new Error("No custom domain configured");

  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return { verified: false, status: "not_configured" };
  }

  const res = await fetch(
    `${VERCEL_API}/v10/projects/${VERCEL_PROJECT_ID}/domains/${site.custom_domain}${teamParam()}`,
    { headers: vercelHeaders() },
  );

  const data = await res.json();
  const verified = data.verified === true;

  if (verified) {
    await (supabase as any)
      .from("sites")
      .update({ domain_verified: true })
      .eq("id", siteId);
  }

  return {
    verified,
    status: verified ? "verified" : data.verification?.[0]?.type || "pending",
    verification: data.verification || [],
  };
}

export async function removeCustomDomain(siteId: string) {
  const { supabase } = await getWorkspaceId();

  const { data: site } = await (supabase as any)
    .from("sites")
    .select("custom_domain")
    .eq("id", siteId)
    .single();

  if (site?.custom_domain && VERCEL_TOKEN && VERCEL_PROJECT_ID) {
    await fetch(
      `${VERCEL_API}/v10/projects/${VERCEL_PROJECT_ID}/domains/${site.custom_domain}${teamParam()}`,
      { method: "DELETE", headers: vercelHeaders() },
    ).catch(() => {
      /* INCOMPLETE: log + surface partial failure — DB may clear domain while Vercel still serves it */
    });
  }

  const { error } = await (supabase as any)
    .from("sites")
    .update({
      custom_domain: null,
      domain_verified: false,
      domain_dns_records: [],
      vercel_domain_config: {},
    })
    .eq("id", siteId);

  if (error) throw new Error(error.message);
}
