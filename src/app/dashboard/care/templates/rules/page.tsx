"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { Plus, GitMerge } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createTemplateAssignmentRuleAction,
  listShiftNoteTemplatesAction,
  listTemplateAssignmentRulesAction,
} from "@/app/actions/care-shift-notes";

export default function ShiftNoteRulesPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  interface TemplateRulesData {
    templates: Array<{ id: string; name: string; version: number }>;
    rules: Array<{
      id: string;
      priority: number;
      target_type: string;
      target_value?: string | null;
      min_duration_minutes?: number | null;
      max_duration_minutes?: number | null;
      merge_strategy: string;
      shift_note_templates?: { name?: string; version?: number };
    }>;
  }

  const { data } = useQuery<TemplateRulesData>({
    queryKey: queryKeys.care.templateRules(orgId!),
    queryFn: async () => {
      const [tpls, assignedRules] = await Promise.all([
        listShiftNoteTemplatesAction(orgId!),
        listTemplateAssignmentRulesAction(orgId!),
      ]);
      return { templates: tpls, rules: assignedRules };
    },
    enabled: !!orgId,
  });

  const templates = data?.templates ?? [];
  const rules = data?.rules ?? [];

  const defaultTemplateId = templates[0]?.id ?? "";
  const [form, setForm] = useState({
    template_id: "",
    target_type: "participant",
    target_value: "",
    priority: 0,
    min_duration_minutes: "",
    max_duration_minutes: "",
    merge_strategy: "override",
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Project Rosetta</p>
        <h1 className="text-xl font-semibold text-zinc-100">Template Assignment Rules</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Hierarchy resolution: Participant &gt; NDIS Line Item &gt; Duration &gt; Global Default.
        </p>
      </div>

      <section className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <select
            value={form.template_id || defaultTemplateId}
            onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Select template…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} v{template.version}
              </option>
            ))}
          </select>

          <select
            value={form.target_type}
            onChange={(e) => setForm((p) => ({ ...p, target_type: e.target.value }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="participant">Participant</option>
            <option value="ndis_line_item">NDIS line item</option>
            <option value="duration">Duration</option>
            <option value="global_default">Global default</option>
          </select>

          {form.target_type !== "global_default" && (
            <input
              value={form.target_value}
              onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value }))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder={
                form.target_type === "participant"
                  ? "participant UUID"
                  : form.target_type === "ndis_line_item"
                    ? "NDIS line item code"
                    : "Optional key"
              }
            />
          )}

          {form.target_type === "duration" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.min_duration_minutes}
                onChange={(e) => setForm((p) => ({ ...p, min_duration_minutes: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="Min mins"
              />
              <input
                value={form.max_duration_minutes}
                onChange={(e) => setForm((p) => ({ ...p, max_duration_minutes: e.target.value }))}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                placeholder="Max mins"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: Number(e.target.value || 0) }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder="Priority"
            />
            <select
              value={form.merge_strategy}
              onChange={(e) => setForm((p) => ({ ...p, merge_strategy: e.target.value }))}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="override">override</option>
              <option value="merge">merge</option>
            </select>
          </div>

          <button
            disabled={!orgId || !(form.template_id || defaultTemplateId) || isPending}
            onClick={() =>
              startTransition(async () => {
                if (!orgId) return;
                await createTemplateAssignmentRuleAction({
                  organization_id: orgId,
                  template_id: form.template_id || defaultTemplateId,
                  target_type: form.target_type as
                    | "participant"
                    | "ndis_line_item"
                    | "duration"
                    | "global_default",
                  target_value:
                    form.target_type === "global_default" ? undefined : form.target_value || undefined,
                  min_duration_minutes:
                    form.target_type === "duration" && form.min_duration_minutes
                      ? Number(form.min_duration_minutes)
                      : undefined,
                  max_duration_minutes:
                    form.target_type === "duration" && form.max_duration_minutes
                      ? Number(form.max_duration_minutes)
                      : undefined,
                  priority: form.priority,
                  merge_strategy: form.merge_strategy as "override" | "merge",
                });
                await queryClient.invalidateQueries({ queryKey: queryKeys.care.templateRules(orgId!) });
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <Plus size={14} />
            Add Rule
          </button>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-medium text-zinc-100">Active Rules</p>
          <div className="mt-3 space-y-2 max-h-[620px] overflow-auto">
            {rules.length === 0 && <p className="text-xs text-zinc-500">No rules configured yet.</p>}
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-zinc-100 font-medium">
                    {rule.shift_note_templates?.name || "Template"} v
                    {rule.shift_note_templates?.version || "?"}
                  </p>
                  <span className="text-xs text-zinc-400">priority {rule.priority}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {rule.target_type}
                  {rule.target_value ? ` = ${rule.target_value}` : ""}
                  {rule.min_duration_minutes || rule.max_duration_minutes
                    ? ` (${rule.min_duration_minutes || 0}-${rule.max_duration_minutes || "∞"} mins)`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500 inline-flex items-center gap-1">
                  <GitMerge size={11} /> {rule.merge_strategy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
