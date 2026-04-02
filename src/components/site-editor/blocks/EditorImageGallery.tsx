/**
 * @component components/site-editor/blocks/EditorImageGallery.tsx
 * @status STABLE
 * @description Loom site builder — EditorImageGallery
 * @lastReview 2026-03-28
 */
/* eslint-disable @next/next/no-img-element */
"use client";

import type { SiteBlockRendererProps, ImageGalleryContent } from "../types";

export function EditorImageGallery({ block, isEditing, onContentChange }: SiteBlockRendererProps<"image_gallery">) {
  const c = block.content as ImageGalleryContent;
  const cols = c.columns === 4 ? "grid-cols-4" : c.columns === 3 ? "grid-cols-3" : "grid-cols-2";
  const aspect = c.aspectRatio === "portrait" ? "aspect-[3/4]" : c.aspectRatio === "landscape" ? "aspect-video" : "aspect-square";

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-5xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-8"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Gallery"}
        </h2>
        <div className={`grid gap-3 ${cols}`}>
          {c.images.map((img) => (
            <div key={img.id} className={`overflow-hidden rounded-lg ${aspect} bg-gray-100`}>
              {img.url ? (
                <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">No image</div>
              )}
            </div>
          ))}
          {c.images.length === 0 && (
            <div className="col-span-full text-center text-xs text-gray-400 py-8">Add images via the property panel</div>
          )}
        </div>
      </div>
    </section>
  );
}
