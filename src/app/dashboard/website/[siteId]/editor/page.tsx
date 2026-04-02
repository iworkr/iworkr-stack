/**
 * @page app/dashboard/website/[siteId]/editor/page.tsx
 * @status STABLE
 * @description Route — dashboard/website/[siteId]/editor
 * @lastReview 2026-03-28
 */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSite, getPages, getPageLayout } from "@/app/actions/sites";
import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { EditorTopBar } from "@/components/site-editor/EditorTopBar";
import { SitePropertyPanel } from "@/components/site-editor/SitePropertyPanel";
import { EditorCanvas } from "@/components/site-editor/EditorCanvas";
import { SiteBlockLibrary } from "@/components/site-editor/BlockLibrary";
import type { SiteBlock, SiteGlobalStyles } from "@/components/site-editor/types";

export default function SiteEditorPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const store = useSiteEditorStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!siteId) return;

    async function load() {
      try {
        const [site, pages] = await Promise.all([
          getSite(siteId),
          getPages(siteId),
        ]);

        store.setSiteId(siteId);
        store.setSiteSettings({
          name: site.name,
          subdomain: site.subdomain ?? "",
          customDomain: site.custom_domain,
          isPublished: site.is_published,
          domainVerified: site.domain_verified,
        });
        store.setGlobalStyles((site.global_styles_jsonb ?? {}) as SiteGlobalStyles);
        store.setPages(pages);

        const firstPage = pages[0];
        if (firstPage) {
          store.setPageId(firstPage.id);
          const layout = await getPageLayout(firstPage.id);
          store.setBlocks(layout.blocks as SiteBlock[]);
        }

        store.markClean();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load site");
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => { store.reset(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-48px)] items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col">
      <EditorTopBar />
      <div className="flex flex-1 overflow-hidden">
        <SiteBlockLibrary />
        <EditorCanvas />
        <SitePropertyPanel />
      </div>
    </div>
  );
}
