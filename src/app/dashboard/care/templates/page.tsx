/**
 * @page /dashboard/care/templates
 * @status COMPLETE
 * @description Shift note template builder with field configuration and preview
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Save, Sparkles, Eye, EyeOff } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createShiftNoteTemplateAction,
  listShiftNoteTemplatesAction,
} from "@/app/actions/care-shift-notes";

type BuilderField = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  family_visible: boolean;
};

type RosettaTemplate = {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  schema_payload?: {
    fields?: Array<{ family_visible?: boolean }>;
  };
};

const STARTER_TYPES = [
  "short_text",
  "number",
  "dropdown",
  "body_map",
  "signature",
  "blood_glucose",
  "blood_pressure",
  "mood_slider",
  "goal_linker",
  "photo_upload",
];

export default function CareTemplatesPage() {
  const { orgId } = useOrg();
  const [isPending, startTransition] = useTransition();
  const [templates, setTemplates] = useState<RosettaTemplate[]>([]);
  const [name, setName] = useState("SIL Overnight Shift Note");
  const [description, setDescription] = useState("Dynamic shift close-out template");
  const [fields, setFields] = useState<BuilderField[]>([
    {
      id: "fld_mood",
      type: "mood_slider",
      label: "Participant Evening Mood",
      required: true,
      family_visible: true,
    },
    {
      id: "fld_sleep",
      type: "number",
      label: "Hours of Uninterrupted Sleep",
      required: true,
      family_visible: false,
    },
  ]);

  const canSave = Boolean(orgId && name.trim() && fields.length > 0);

  const loadTemplates = async () => {
    if (!orgId) return;
    const data = await listShiftNoteTemplatesAction(orgId);
    setTemplates(data);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void loadTemplates();
  }, [orgId]);

  const familyVisibleCount = useMemo(
    () => fields.filter((f) => f.family_visible).length,
    [fields],
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Project Rosetta</p>
          <h1 className="text-xl font-semibold text-zinc-100">Shift Note Templates</h1>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
              placeholder="Template name"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none"
              placeholder="Description"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STARTER_TYPES.map((type) => (
              <button
                key={type}
                onClick={() =>
                  setFields((prev) => [
                    ...prev,
                    {
                      id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                      type,
                      label: type.replace(/_/g, " "),
                      required: false,
                      family_visible: false,
                    },
                  ])
                }
                className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-600"
              >
                <Plus size={12} />
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {fields.map((field, idx) => (
              <div key={field.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="grid gap-2 md:grid-cols-12">
                  <input
                    value={field.label}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((f) => (f.id === field.id ? { ...f, label: e.target.value } : f)),
                      )
                    }
                    className="md:col-span-6 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                  />
                  <select
                    value={field.type}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((f) => (f.id === field.id ? { ...f, type: e.target.value } : f)),
                      )
                    }
                    className="md:col-span-3 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                  >
                    {STARTER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <label className="md:col-span-1 flex items-center gap-1 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) => (f.id === field.id ? { ...f, required: e.target.checked } : f)),
                        )
                      }
                    />
                    Req
                  </label>
                  <label className="md:col-span-2 flex items-center gap-1 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={field.family_visible}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((f) =>
                            f.id === field.id ? { ...f, family_visible: e.target.checked } : f,
                          ),
                        )
                      }
                    />
                    Family
                  </label>
                </div>
                <button
                  onClick={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                  className="mt-2 text-xs text-rose-400"
                >
                  Remove field {idx + 1}
                </button>
              </div>
            ))}
          </div>

          <button
            disabled={!canSave || isPending}
            onClick={() =>
              startTransition(async () => {
                if (!orgId) return;
                await createShiftNoteTemplateAction({
                  organization_id: orgId,
                  name,
                  description,
                  schema_payload: {
                    template_name: name,
                    fields,
                    logic: [],
                  },
                });
                await loadTemplates();
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <Save size={14} />
            Save Versioned Template
          </button>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-100">Template Registry</p>
            <div className="text-xs text-zinc-400 inline-flex items-center gap-1">
              <Sparkles size={12} /> family fields: {familyVisibleCount}
            </div>
          </div>
          <div className="mt-3 space-y-2 max-h-[560px] overflow-auto">
            {templates.length === 0 && <p className="text-xs text-zinc-500">No Rosetta templates yet.</p>}
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-sm font-semibold text-zinc-100">
                  {template.name} <span className="text-zinc-500">v{template.version}</span>
                </p>
                <p className="mt-1 text-xs text-zinc-400">{template.description || "No description"}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {Array.isArray(template.schema_payload?.fields)
                    ? `${template.schema_payload.fields.length} fields`
                    : "0 fields"}
                </p>
                <p className="mt-1 text-xs text-zinc-500 inline-flex items-center gap-1">
                  {Array.isArray(template.schema_payload?.fields) &&
                  template.schema_payload.fields.some((f) => f.family_visible) ? (
                    <>
                      <Eye size={11} /> Has family-visible fields
                    </>
                  ) : (
                    <>
                      <EyeOff size={11} /> Internal only
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
