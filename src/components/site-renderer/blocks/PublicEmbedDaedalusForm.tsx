/**
 * @component components/site-renderer/blocks/PublicEmbedDaedalusForm.tsx
 * @status STABLE
 * @description Public Loom site render — PublicEmbedDaedalusForm
 * @lastReview 2026-03-28
 */
"use client";

import { useState, useEffect } from "react";
import type { PublicBlockProps } from ".";
import type { EmbedDaedalusFormContent } from "@/components/site-editor/types";

interface FormField {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export function PublicEmbedDaedalusForm({ block, globalStyles, workspaceId }: PublicBlockProps<"embed_daedalus_form">) {
  const c = block.content as EmbedDaedalusFormContent;
  const [schema, setSchema] = useState<FormField[]>([]);
  const [formTitle, setFormTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!c.templateId) { setLoading(false); return; }
    fetch(`/api/sites/form-schema?templateId=${c.templateId}`)
      .then((r) => r.json())
      .then((data) => {
        setSchema(data.fields ?? []);
        setFormTitle(data.title ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [c.templateId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!c.templateId) return;
    setSubmitting(true);
    try {
      await fetch("/api/sites/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: c.templateId,
          workspaceId,
          data: values,
        }),
      });
      setSuccess(true);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  if (!c.templateId) {
    return (
      <section className="py-12 px-6">
        <div className="mx-auto max-w-xl text-center text-gray-400 text-sm">No form selected</div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="py-12 px-6">
        <div className="mx-auto max-w-xl text-center text-gray-400 text-sm">Loading form...</div>
      </section>
    );
  }

  if (success) {
    return (
      <section className="py-20 px-6">
        <div className="mx-auto max-w-xl text-center">
          <div className="mb-4 text-5xl">✓</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Submitted</h3>
          <p className="text-gray-600">Your form has been received. We&apos;ll be in touch.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-xl">
        {c.showTitle && (c.heading || formTitle) && (
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8" style={{ fontFamily: "var(--site-font-heading)" }}>
            {c.heading || formTitle}
          </h2>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {schema.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}{field.required && " *"}</label>
              {field.type === "textarea" ? (
                <textarea
                  required={field.required}
                  rows={4}
                  value={values[field.id] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 resize-none"
                />
              ) : field.type === "select" && field.options ? (
                <select
                  required={field.required}
                  value={values[field.id] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2"
                >
                  <option value="">Select...</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || "text"}
                  required={field.required}
                  value={values[field.id] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2"
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            style={{
              backgroundColor: globalStyles.primaryColor,
              borderRadius: `var(--site-button-radius)`,
            }}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </section>
  );
}
