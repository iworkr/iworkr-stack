/**
 * @component components/site-renderer/blocks/PublicLeadCaptureForm.tsx
 * @status STABLE
 * @description Public Loom site render — PublicLeadCaptureForm
 * @lastReview 2026-03-28
 */
"use client";

import { useState } from "react";
import type { PublicBlockProps } from ".";
import type { LeadCaptureContent } from "@/components/site-editor/types";

export function PublicLeadCaptureForm({ block, globalStyles, workspaceId }: PublicBlockProps<"lead_capture_form">) {
  const c = block.content as LeadCaptureContent;
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    service_type: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const intakeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intake-router`
        : "/api/sites/lead-capture";

      await fetch(intakeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          widget_id: c.widgetId,
          source: "website",
          source_domain: typeof window !== "undefined" ? window.location.hostname : "",
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message: formData.message,
          service_type: formData.service_type,
        }),
      });
      setSuccess(true);
    } catch {
      // silently handle — the lead is fire-and-forget
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <section className="py-20 px-6" id="contact">
        <div className="mx-auto max-w-xl text-center">
          <div className="mb-4 text-5xl">✓</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-600">{c.successMessage || "We'll be in touch shortly."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-6 bg-gray-50" id="contact">
      <div className="mx-auto max-w-xl">
        {c.heading && (
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading}
          </h2>
        )}
        {c.description && (
          <p className="text-gray-600 text-center mb-8">{c.description}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {c.fields.name && (
            <input
              type="text"
              placeholder="Your Name"
              required
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2"
              style={{ focusRingColor: globalStyles.primaryColor } as React.CSSProperties}
            />
          )}
          {c.fields.email && (
            <input
              type="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2"
            />
          )}
          {c.fields.phone && (
            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2"
            />
          )}
          {c.fields.serviceType && c.serviceOptions.length > 0 && (
            <select
              value={formData.service_type}
              onChange={(e) => setFormData((p) => ({ ...p, service_type: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2"
            >
              <option value="">Select a service...</option>
              {c.serviceOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
          {c.fields.message && (
            <textarea
              placeholder="Tell us about your needs..."
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 resize-none"
            />
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{
              backgroundColor: globalStyles.primaryColor,
              borderRadius: `var(--site-button-radius)`,
            }}
          >
            {submitting ? "Sending..." : c.submitLabel || "Get a Quote"}
          </button>
        </form>
      </div>
    </section>
  );
}
