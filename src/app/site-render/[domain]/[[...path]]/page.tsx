/**
 * @page app/site-render/[domain]/[[...path]]/page.tsx
 * @status STABLE
 * @description Route — site-render/[domain]/[[...path]]
 * @lastReview 2026-03-28
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "crypto";
import type { Metadata } from "next";
import { resolvePublicSite, resolvePublicPage, recordAnalyticsHit } from "@/app/actions/sites";
import { PublicSiteRenderer } from "@/components/site-renderer/PublicSiteRenderer";
import type { SiteBlock, SiteGlobalStyles } from "@/components/site-editor/types";

interface Props {
  params: Promise<{ domain: string; path?: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain, path: pathSegments } = await params;
  const slug = "/" + (pathSegments?.join("/") || "");
  const site = await resolvePublicSite(domain);
  if (!site) return {};

  const page = await resolvePublicPage(site.id, slug);
  if (!page) return {};

  const seo = (page.seo_metadata_jsonb ?? {}) as Record<string, string>;
  const siteSeo = (site.seo_defaults_jsonb ?? {}) as Record<string, string>;

  return {
    title: seo.title || page.title || site.name,
    description: seo.description || siteSeo.description || "",
    openGraph: {
      title: seo.title || page.title || site.name,
      description: seo.description || siteSeo.description || "",
      images: seo.ogImage ? [seo.ogImage] : siteSeo.ogImage ? [siteSeo.ogImage] : [],
      siteName: site.name,
    },
  };
}

export default async function PublicSitePage({ params }: Props) {
  const { domain, path: pathSegments } = await params;
  const slug = "/" + (pathSegments?.join("/") || "");

  const site = await resolvePublicSite(domain);
  if (!site) notFound();

  const page = await resolvePublicPage(site.id, slug);
  if (!page) notFound();

  const blocks = (page.layout_jsonb ?? []) as SiteBlock[];
  const globalStyles = (site.global_styles_jsonb ?? {}) as SiteGlobalStyles;

  const hdrs = await headers();
  const ip = hdrs.get("x-real-ip") || hdrs.get("x-forwarded-for")?.split(",")[0] || "0.0.0.0";
  const ua = hdrs.get("user-agent") || "";
  const referrer = hdrs.get("referer") || "";
  const country = hdrs.get("x-vercel-ip-country") || "";
  const city = hdrs.get("x-vercel-ip-city") || "";

  const dateStr = new Date().toISOString().split("T")[0];
  const visitorHash = createHash("sha256").update(`${ip}|${ua}|${dateStr}`).digest("hex");
  const isMobile = /mobile|android|iphone/i.test(ua);

  recordAnalyticsHit({
    siteId: site.id,
    pagePath: slug,
    visitorHash,
    referrer: referrer || undefined,
    country: country || undefined,
    city: city || undefined,
    deviceType: isMobile ? "mobile" : "desktop",
  }).catch(() => {});

  return (
    <PublicSiteRenderer
      blocks={blocks}
      globalStyles={globalStyles}
      siteName={site.name}
      workspaceId={site.workspace_id}
    />
  );
}
