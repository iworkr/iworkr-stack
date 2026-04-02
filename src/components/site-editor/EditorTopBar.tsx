/**
 * @component components/site-editor/EditorTopBar.tsx
 * @status STABLE
 * @description Loom site builder — EditorTopBar
 * @lastReview 2026-03-28
 */
"use client";

import { useState } from "react";
import { Globe, Save, Eye, Upload, ChevronDown, Loader2 } from "lucide-react";
import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { savePage, publishSite, unpublishSite } from "@/app/actions/sites";

export function EditorTopBar() {
  const store = useSiteEditorStore();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);

  const currentPage = store.pages.find((p) => p.id === store.pageId);

  async function handleSave() {
    if (!store.pageId) return;
    setSaving(true);
    try {
      await savePage(store.pageId, store.blocks);
      store.markClean();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!store.siteId) return;
    setPublishing(true);
    try {
      if (store.siteSettings.isPublished) {
        await unpublishSite(store.siteId);
        store.setSiteSettings({ isPublished: false });
      } else {
        await handleSave();
        await publishSite(store.siteId);
        store.setSiteSettings({ isPublished: true });
      }
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setPublishing(false);
    }
  }

  const previewUrl = store.siteSettings.subdomain
    ? `https://${store.siteSettings.subdomain}.iworkrsites.com`
    : null;

  return (
    <div className="flex items-center justify-between border-b border-[var(--border-base)] bg-[var(--surface-0)] px-4 py-2.5">
      {/* Left: site name + page selector */}
      <div className="flex items-center gap-3">
        <Globe size={14} className="text-emerald-500" />
        <span className="text-sm font-semibold text-zinc-200">
          {store.siteSettings.name || "Untitled Site"}
        </span>
        <span className="text-zinc-600">/</span>
        <div className="relative">
          <button
            onClick={() => setPageMenuOpen(!pageMenuOpen)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
          >
            {currentPage?.title || "Home"}
            <ChevronDown size={12} />
          </button>
          {pageMenuOpen && store.pages.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPageMenuOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-[var(--border-base)] bg-[var(--surface-1)] py-1 shadow-xl">
                {store.pages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { store.setPageId(p.id); setPageMenuOpen(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.04] ${
                      p.id === store.pageId ? "text-emerald-400 font-medium" : "text-zinc-400"
                    }`}
                  >
                    {p.title} <span className="text-zinc-600">{p.slug}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {store.isDirty && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-400">Unsaved</span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Domain status */}
        {store.siteSettings.isPublished && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live
          </span>
        )}

        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Eye size={12} />
            Preview
          </a>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !store.isDirty}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border-base)] px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.04] disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save
        </button>

        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {publishing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {store.siteSettings.isPublished ? "Unpublish" : "Publish"}
        </button>
      </div>
    </div>
  );
}
