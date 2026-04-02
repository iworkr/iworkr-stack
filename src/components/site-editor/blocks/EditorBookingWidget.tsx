/**
 * @component components/site-editor/blocks/EditorBookingWidget.tsx
 * @status STABLE
 * @description Loom site builder — EditorBookingWidget
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, BookingWidgetContent } from "../types";

export function EditorBookingWidget({ block, isEditing, onContentChange }: SiteBlockRendererProps<"booking_widget">) {
  const c = block.content as BookingWidgetContent;

  return (
    <section className="py-12 px-6 bg-gray-50">
      <div className="mx-auto max-w-md text-center">
        <h2
          className="text-xl font-bold text-gray-900 mb-2"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Book Online"}
        </h2>
        <p
          className="text-xs text-gray-500 mb-6"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ description: e.currentTarget.textContent || "" })}
        >
          {c.description || "Schedule a service at your convenience"}
        </p>
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-8">
          <p className="text-xs text-gray-400">Live booking integration (Phase 2)</p>
        </div>
      </div>
    </section>
  );
}
