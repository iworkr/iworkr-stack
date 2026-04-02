/**
 * @component components/site-editor/blocks/EditorLeadCaptureForm.tsx
 * @status STABLE
 * @description Loom site builder — EditorLeadCaptureForm
 * @lastReview 2026-03-28
 */
"use client";

import type { SiteBlockRendererProps, LeadCaptureContent } from "../types";

export function EditorLeadCaptureForm({ block, isEditing, globalStyles, onContentChange }: SiteBlockRendererProps<"lead_capture_form">) {
  const c = block.content as LeadCaptureContent;

  return (
    <section className="py-12 px-6 bg-gray-50">
      <div className="mx-auto max-w-md">
        <h2
          className="text-xl font-bold text-gray-900 text-center mb-2"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ heading: e.currentTarget.textContent || "" })}
        >
          {c.heading || "Get in Touch"}
        </h2>
        <p
          className="text-xs text-gray-500 text-center mb-6"
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={(e) => onContentChange({ description: e.currentTarget.textContent || "" })}
        >
          {c.description || "Fill out the form and we'll get back to you."}
        </p>
        <div className="space-y-3 pointer-events-none opacity-80">
          {c.fields.name && <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-400">Your Name</div>}
          {c.fields.email && <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-400">Email Address</div>}
          {c.fields.phone && <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-400">Phone Number</div>}
          {c.fields.serviceType && <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-400">Select a service...</div>}
          {c.fields.message && <div className="rounded-lg border border-gray-200 bg-white px-3 py-8 text-xs text-gray-400">Message</div>}
          <div
            className="w-full py-2.5 text-center text-xs font-semibold text-white rounded-lg"
            style={{ backgroundColor: globalStyles.primaryColor }}
          >
            {c.submitLabel || "Get a Quote"}
          </div>
        </div>
      </div>
    </section>
  );
}
