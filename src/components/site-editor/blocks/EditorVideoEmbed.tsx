/**
 * @component components/site-editor/blocks/EditorVideoEmbed.tsx
 * @status STABLE
 * @description Loom site builder — EditorVideoEmbed
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, VideoEmbedContent } from "../types";

export function EditorVideoEmbed({ block, isEditing, onContentChange }: SiteBlockRendererProps<"video_embed">) {
  const c = block.content as VideoEmbedContent;

  return (
    <section className="py-12 px-6">
      <div className="mx-auto max-w-3xl">
        <h2
          className="text-2xl font-bold text-gray-900 text-center mb-6"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Watch"}
        </h2>
        <div className="aspect-video rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
          {c.videoUrl ? (
            <div className="text-xs text-gray-500 text-center">
              <p className="font-medium">Video Preview</p>
              <p className="text-[10px] text-gray-400 mt-1 break-all px-4">{c.videoUrl}</p>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Set a video URL in the property panel</span>
          )}
        </div>
      </div>
    </section>
  );
}
