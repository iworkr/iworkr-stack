/**
 * @module app/actions/sites
 * @status STABLE
 * @description Loom-Space server actions — sites, pages, public resolve, analytics (service-role where noted).
 * @risk P1 — getWorkspaceId() uses first organization_members row without status filter → wrong org for multi-org users.
 * @risk P2 — resolvePublicSite hostname must stay normalized; used in PostgREST filters.
 * @auditNote getWorkspaceId() has INCOMPLETE trail — multi-org alignment pending.
 * @lastReview 2026-03-28
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SiteBlock, SiteGlobalStyles, SitePage } from "@/components/site-editor/types";

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const SITES_SCHEMA_MISSING_HINT =
  "Website tables are not on this database. Most reliable fix: Supabase Dashboard → SQL Editor → paste the full contents of supabase/migrations/202603270001_loom_space_schema.sql → Run. Then Project Settings → API → Reload schema. If your repo and remote migration history match, you can also try: pnpm db:push from the repo root (CLI must be linked to this project).";

function throwIfSitesError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const m = error.message ?? "";
  const code = (error as { code?: string }).code;
  if (
    code === "PGRST205" ||
    m.includes("schema cache") ||
    /relation ["']?public\.(sites|site_pages|site_analytics)["']? does not exist/i.test(m) ||
    (m.includes("sites") && m.includes("Could not find"))
  ) {
    throw new Error(SITES_SCHEMA_MISSING_HINT);
  }
  throw new Error(m);
}

/* INCOMPLETE: getWorkspaceId — must use active workspace from session/cookie and organization_members.status = 'active'
   (same source as switch-context). Current .limit(1) is nondeterministic for multi-org users (P1). */
async function getWorkspaceId() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) throw new Error("No active workspace");
  return { supabase, workspaceId: membership.organization_id, userId: user.id };
}

/* ─── Site CRUD ────────────────────────────────────────────────────────────── */

export async function createSite(data: {
  name: string;
  subdomain: string;
  themeId?: string;
  globalStyles?: Partial<SiteGlobalStyles>;
}) {
  const { supabase, workspaceId } = await getWorkspaceId();
  const { data: site, error } = await (supabase as any)
    .from("sites")
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      subdomain: data.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      theme_id: data.themeId ?? null,
      global_styles_jsonb: data.globalStyles ?? undefined,
    })
    .select("id")
    .single();

  throwIfSitesError(error);
  return site;
}

export async function getSites() {
  const { supabase, workspaceId } = await getWorkspaceId();
  const { data, error } = await (supabase as any)
    .from("sites")
    .select("id, name, subdomain, custom_domain, is_published, domain_verified, theme_id, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  throwIfSitesError(error);
  return data ?? [];
}

export async function getSite(siteId: string) {
  const { supabase } = await getWorkspaceId();
  const { data, error } = await (supabase as any)
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .single();

  throwIfSitesError(error);
  return data;
}

export async function updateSite(siteId: string, patch: {
  name?: string;
  subdomain?: string;
  is_published?: boolean;
  global_styles_jsonb?: SiteGlobalStyles;
  seo_defaults_jsonb?: Record<string, unknown>;
}) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("sites")
    .update(patch)
    .eq("id", siteId);

  throwIfSitesError(error);
}

export async function deleteSite(siteId: string) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("sites")
    .delete()
    .eq("id", siteId);

  throwIfSitesError(error);
}

export async function publishSite(siteId: string) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("sites")
    .update({ is_published: true })
    .eq("id", siteId);

  throwIfSitesError(error);
}

export async function unpublishSite(siteId: string) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("sites")
    .update({ is_published: false })
    .eq("id", siteId);

  throwIfSitesError(error);
}

/* ─── Page CRUD ────────────────────────────────────────────────────────────── */

export async function getPages(siteId: string): Promise<SitePage[]> {
  const { supabase } = await getWorkspaceId();
  const { data, error } = await (supabase as any)
    .from("site_pages")
    .select("id, slug, title, seo_metadata_jsonb, sort_order, is_draft")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true });

  throwIfSitesError(error);
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    slug: p.slug as string,
    title: p.title as string,
    seoMetadata: (p.seo_metadata_jsonb as Record<string, unknown>) ?? {},
    sortOrder: p.sort_order as number,
    isDraft: p.is_draft as boolean,
  }));
}

export async function getPageLayout(pageId: string) {
  const { supabase } = await getWorkspaceId();
  const { data, error } = await (supabase as any)
    .from("site_pages")
    .select("id, slug, title, layout_jsonb, seo_metadata_jsonb, is_draft")
    .eq("id", pageId)
    .single();

  throwIfSitesError(error);
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    blocks: (data.layout_jsonb as SiteBlock[]) ?? [],
    seoMetadata: data.seo_metadata_jsonb ?? {},
    isDraft: data.is_draft,
  };
}

export async function createPage(siteId: string, page: { slug: string; title: string; layoutJsonb?: SiteBlock[] }) {
  const { supabase } = await getWorkspaceId();
  const { data: existing } = await (supabase as any)
    .from("site_pages")
    .select("id")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const sortOrder = existing && existing.length > 0 ? ((existing[0] as Record<string, unknown>).sort_order as number ?? 0) + 1 : 0;

  const { data, error } = await (supabase as any)
    .from("site_pages")
    .insert({
      site_id: siteId,
      slug: page.slug,
      title: page.title,
      layout_jsonb: page.layoutJsonb ?? [],
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  throwIfSitesError(error);
  return data;
}

export async function savePage(pageId: string, layout: SiteBlock[]) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("site_pages")
    .update({ layout_jsonb: layout as unknown as Record<string, unknown> })
    .eq("id", pageId);

  throwIfSitesError(error);
}

export async function updatePage(pageId: string, patch: {
  title?: string;
  slug?: string;
  seo_metadata_jsonb?: Record<string, unknown>;
  is_draft?: boolean;
}) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("site_pages")
    .update(patch)
    .eq("id", pageId);

  throwIfSitesError(error);
}

export async function deletePage(pageId: string) {
  const { supabase } = await getWorkspaceId();
  const { error } = await (supabase as any)
    .from("site_pages")
    .delete()
    .eq("id", pageId);

  throwIfSitesError(error);
}

/* ─── Analytics ────────────────────────────────────────────────────────────── */

export async function getSiteAnalytics(siteId: string, range: "7d" | "30d" | "90d" = "30d") {
  const { supabase } = await getWorkspaceId();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await (supabase as any)
    .from("site_analytics")
    .select("page_path, visitor_hash, referrer, country, city, device_type, created_at")
    .eq("site_id", siteId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(10000);

  throwIfSitesError(error);
  return data ?? [];
}

/* ─── Public Site Resolve (service role — for renderer) ─────────────────── */

export async function resolvePublicSite(hostname: string) {
  const admin = createAdminSupabaseClient();

  const subdomain = hostname.replace(/\.iworkrsites\.com$/, "");
  const { data: site } = await (admin as any)
    .from("sites")
    .select("id, workspace_id, name, global_styles_jsonb, seo_defaults_jsonb, theme_id")
    .or(`custom_domain.eq.${hostname},subdomain.eq.${subdomain}`)
    .eq("is_published", true)
    .single();

  return site ?? null;
}

export async function resolvePublicPage(siteId: string, slug: string) {
  const admin = createAdminSupabaseClient();
  const { data: page } = await (admin as any)
    .from("site_pages")
    .select("id, slug, title, layout_jsonb, seo_metadata_jsonb")
    .eq("site_id", siteId)
    .eq("slug", slug || "/")
    .eq("is_draft", false)
    .single();

  return page ?? null;
}

export async function recordAnalyticsHit(hit: {
  siteId: string;
  pagePath: string;
  visitorHash: string;
  referrer?: string;
  country?: string;
  city?: string;
  deviceType?: string;
}) {
  const admin = createAdminSupabaseClient();
  await (admin as any).from("site_analytics").insert({
    site_id: hit.siteId,
    page_path: hit.pagePath,
    visitor_hash: hit.visitorHash,
    referrer: hit.referrer ?? null,
    country: hit.country ?? null,
    city: hit.city ?? null,
    device_type: hit.deviceType ?? "desktop",
  });
}
