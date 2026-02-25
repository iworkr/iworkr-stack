"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  XCircle,
  Calendar,
  Clock,
  Bell,
  BarChart3,
  Shield,
  UserPlus,
  Pencil,
  X,
  Mail,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toggle } from "@/components/settings/settings-toggle";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";

/* ── Email type definitions ─────────────────────────────────── */

interface EmailType {
  event: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: "dispatch" | "chronological" | "admin" | "iam";
}

const EMAIL_TYPES: EmailType[] = [
  { event: "job_assigned", title: "Job Assigned", description: "Sent when a technician is assigned to a job", icon: Briefcase, category: "dispatch" },
  { event: "job_cancelled", title: "Job Cancelled", description: "Sent when a job is cancelled", icon: XCircle, category: "dispatch" },
  { event: "job_rescheduled", title: "Job Rescheduled", description: "Sent when a job is rescheduled", icon: Calendar, category: "dispatch" },
  { event: "job_reminder_24h", title: "24-Hour Reminder", description: "Sent 24 hours before a scheduled job", icon: Clock, category: "chronological" },
  { event: "job_reminder_1h", title: "Day-Of Reminder", description: "Sent on the morning of a scheduled job", icon: Bell, category: "chronological" },
  { event: "daily_fleet_digest", title: "Daily Digest", description: "Daily operations summary for admins", icon: BarChart3, category: "admin" },
  { event: "compliance_warning_swms", title: "SWMS Compliance Alert", description: "Sent when a job starts without signed SWMS", icon: Shield, category: "admin" },
  { event: "invite_user", title: "Team Invite", description: "Sent when inviting a new team member", icon: UserPlus, category: "iam" },
];

const CATEGORIES: { key: EmailType["category"]; label: string }[] = [
  { key: "dispatch", label: "Dispatch" },
  { key: "chronological", label: "Chronological" },
  { key: "admin", label: "Admin" },
  { key: "iam", label: "Identity & Access" },
];

const TEMPLATE_VARIABLES = [
  "{{job.title}}",
  "{{job.date}}",
  "{{job.location}}",
  "{{tech.name}}",
  "{{client.name}}",
  "{{client.address}}",
  "{{workspace.name}}",
];

/* ── Types ──────────────────────────────────────────────────── */

interface TemplateRow {
  id?: string;
  organization_id: string;
  event_type: string;
  is_active: boolean;
  subject_line: string | null;
  body_html: string | null;
}

/* ── Page component ─────────────────────────────────────────── */

export default function CommunicationsPage() {
  const { currentOrg } = useAuthStore();
  const [templates, setTemplates] = useState<Record<string, TemplateRow>>({});
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);

  const orgId = currentOrg?.id;

  // Fetch templates on mount
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();

    (async () => {
      const { data } = await (supabase as any)
        .from("workspace_email_templates")
        .select("*")
        .eq("organization_id", orgId);

      const map: Record<string, TemplateRow> = {};
      for (const row of data ?? []) {
        map[row.event_type] = row;
      }
      setTemplates(map);
      setLoading(false);
    })();
  }, [orgId]);

  const toggleActive = useCallback(
    async (event: string) => {
      if (!orgId) return;
      const supabase = createClient();
      const existing = templates[event];
      const newActive = existing ? !existing.is_active : true;

      const row: TemplateRow = {
        ...existing,
        organization_id: orgId,
        event_type: event,
        is_active: newActive,
        subject_line: existing?.subject_line ?? "",
        body_html: existing?.body_html ?? null,
      };

      const { data } = await (supabase as any)
        .from("workspace_email_templates")
        .upsert(
          {
            organization_id: orgId,
            event_type: event,
            is_active: newActive,
            subject_line: row.subject_line,
            body_html: row.body_html,
          },
          { onConflict: "organization_id,event_type" }
        )
        .select()
        .single();

      if (data) {
        setTemplates((prev) => ({ ...prev, [event]: data }));
      }
    },
    [orgId, templates]
  );

  const saveTemplate = useCallback(
    async (event: string, subject: string, body: string) => {
      if (!orgId) return;
      const supabase = createClient();
      const existing = templates[event];

      const { data } = await (supabase as any)
        .from("workspace_email_templates")
        .upsert(
          {
            organization_id: orgId,
            event_type: event,
            is_active: existing?.is_active ?? true,
            subject_line: subject,
            body_html: body,
          },
          { onConflict: "organization_id,event_type" }
        )
        .select()
        .single();

      if (data) {
        setTemplates((prev) => ({ ...prev, [event]: data }));
      }
      setEditingEvent(null);
    },
    [orgId, templates]
  );

  const editingType = EMAIL_TYPES.find((t) => t.event === editingEvent);

  return (
    <>
      <h1 className="mb-1 text-2xl font-medium tracking-tight text-zinc-100">
        Email Communications
      </h1>
      <p className="mb-8 text-[13px] text-zinc-500">
        Manage automated emails sent to your team
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]"
            />
          ))}
        </div>
      ) : (
        CATEGORIES.map((cat) => {
          const items = EMAIL_TYPES.filter((t) => t.category === cat.key);
          if (items.length === 0) return null;

          return (
            <div key={cat.key} className="mb-8">
              <h3 className="mb-1 text-[15px] font-medium text-zinc-300">
                {cat.label}
              </h3>
              <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                {items.map((emailType) => {
                  const Icon = emailType.icon;
                  const tpl = templates[emailType.event];
                  const isActive = tpl?.is_active ?? false;

                  return (
                    <div
                      key={emailType.event}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
                          isActive
                            ? "bg-[rgba(0,230,118,0.08)] text-[#00E676]"
                            : "bg-[rgba(255,255,255,0.04)] text-zinc-600"
                        }`}
                      >
                        <Icon size={15} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-zinc-200">
                          {emailType.title}
                        </div>
                        <div className="text-[12px] text-zinc-600">
                          {emailType.description}
                        </div>
                      </div>

                      <button
                        onClick={() => setEditingEvent(emailType.event)}
                        className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] text-zinc-500 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
                      >
                        <Pencil size={12} />
                      </button>

                      <Toggle
                        checked={isActive}
                        onChange={() => toggleActive(emailType.event)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {editingEvent && editingType && (
          <TemplateEditorModal
            emailType={editingType}
            template={templates[editingEvent] ?? null}
            onSave={(subject, body) => saveTemplate(editingEvent, subject, body)}
            onClose={() => setEditingEvent(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Template Editor Modal ──────────────────────────────────── */

function TemplateEditorModal({
  emailType,
  template,
  onSave,
  onClose,
}: {
  emailType: EmailType;
  template: TemplateRow | null;
  onSave: (subject: string, body: string) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(template?.subject_line ?? "");
  const [body, setBody] = useState(template?.body_html ?? "");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (variable: string) => {
    const ta = bodyRef.current;
    if (!ta) {
      setBody((prev) => prev + variable);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const next = before + variable + after;
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + variable.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(subject, body);
    setSaving(false);
  };

  const Icon = emailType.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[560px] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0a0a0a] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(0,230,118,0.08)] text-[#00E676]">
              <Icon size={15} />
            </div>
            <div>
              <div className="text-[14px] font-medium text-zinc-200">
                {emailType.title}
              </div>
              <div className="text-[12px] text-zinc-600">
                Edit template
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5">
          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-400">
              Subject line
            </label>
            <div className="flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
              <Mail size={13} className="shrink-0 text-zinc-600" />
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={`e.g. You've been assigned to {{job.title}}`}
                className="w-full bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700"
              />
            </div>
          </div>

          {/* Variable pills */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-400">
              Insert variable
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-[#00E676]/30 hover:bg-[rgba(0,230,118,0.05)] hover:text-[#00E676]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Body textarea */}
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-zinc-400">
              Email body
            </label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write your email template here..."
              className="w-full resize-none rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-[#00E676]/30"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-[rgba(255,255,255,0.1)] px-3.5 py-1.5 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#00E676] px-3.5 py-1.5 text-[12px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save template"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
