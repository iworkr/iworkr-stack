/**
 * @page /dashboard/settings/communications
 * @status COMPLETE
 * @description Project Hermes-Matrix — Command Center for toggleable omni-channel
 *   dispatch. Per-event channel toggles (SMS/Email/Push), customisable SMS
 *   templates with variable injector pills, live segment calculator, and
 *   dispatch log viewer for audit/billing.
 * @dataSource server-action
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Mail,
  Bell,
  Calendar,
  AlertTriangle,
  Megaphone,
  Receipt,
  Clock,
  Shield,
  Save,
  Loader2,
  Smartphone,
  Radio,
  ChevronDown,
  Plus,
  Info,
  Truck,
  CheckCircle2,
  Pill,
  FileText,
  Search,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/components/app/action-toast";
import {
  getWorkspaceCommunicationSettings,
  updateWorkspaceCommunicationSettings,
  getCommunicationRules,
  updateCommunicationRule,
  getCommunicationLogs,
  type CommunicationSettings,
  type CommunicationRule,
  type DispatchLogEntry,
  type NotificationEventType,
  DEFAULT_SETTINGS,
  EVENT_TYPE_META,
} from "@/app/actions/communications";

// ─── Segment Calculator ────────────────────────────────────────────────
function calculateSegments(message: string) {
  const hasUcs2 = /[^\x00-\x7F]/.test(message);
  const encoding = hasUcs2 ? "UCS-2" : "GSM-7";
  const limit = hasUcs2 ? 70 : 160;
  const concatLimit = hasUcs2 ? 67 : 153;
  const len = message.length;

  if (len === 0) return { segments: 0, encoding, charCount: 0, limit };
  if (len <= limit) return { segments: 1, encoding, charCount: len, limit };
  return { segments: Math.ceil(len / concatLimit), encoding, charCount: len, limit };
}

// ─── Event Icons ───────────────────────────────────────────────────────
const EVENT_ICONS: Record<NotificationEventType, React.ElementType> = {
  ROSTER_PUBLISHED: Calendar,
  SHIFT_UPDATED: AlertTriangle,
  SHIFT_CANCELLED: Clock,
  NEW_JOB_ASSIGNED: Truck,
  OUTRIDER_EN_ROUTE: Truck,
  JOB_COMPLETED: CheckCircle2,
  INVOICE_OVERDUE: Receipt,
  S8_MEDICATION_MISSED: Pill,
};

const SECTOR_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  schedule: { label: "Schedule Alerts", icon: Calendar },
  dispatch: { label: "Dispatch & Jobs", icon: Truck },
  billing: { label: "Billing Alerts", icon: Receipt },
  compliance: { label: "Compliance Alerts", icon: Shield },
};

// ─── Toggle Component ──────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled = false,
  size = "md",
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? 36 : 44;
  const h = size === "sm" ? 20 : 24;
  const dot = size === "sm" ? 14 : 18;
  const pad = 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
      style={{ width: w, height: h }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          backgroundColor: checked ? "rgb(16 185 129)" : "rgb(39 39 42)",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
      <motion.div
        className="absolute rounded-full bg-white shadow-sm"
        style={{ width: dot, height: dot, top: pad }}
        animate={{ x: checked ? w - dot - pad * 2 : pad }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ─── Variable Pill ─────────────────────────────────────────────────────
function VariablePill({
  variable,
  onClick,
}: {
  variable: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/60 px-2.5 py-1 text-xs font-mono text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors"
    >
      <Plus className="h-3 w-3" />
      {variable}
    </button>
  );
}

// ─── Segment Indicator ─────────────────────────────────────────────────
function SegmentIndicator({ message }: { message: string }) {
  const { segments, encoding, charCount, limit } = calculateSegments(message);
  const costPerSegment = 0.05;
  const estimatedCost = (segments * costPerSegment).toFixed(2);

  if (charCount === 0) return null;

  const isWarning = segments > 1;
  const isDanger = segments > 3;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
        isDanger
          ? "border-red-500/30 bg-red-500/5 text-red-300"
          : isWarning
            ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
            : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
      }`}
    >
      <span>
        {charCount} chars · {encoding} · {limit} limit
      </span>
      <span className="text-zinc-600">|</span>
      <span className="font-medium">
        {segments} segment{segments !== 1 ? "s" : ""} · ~${estimatedCost}/recipient
      </span>
      {encoding === "UCS-2" && (
        <>
          <span className="text-zinc-600">|</span>
          <span className="text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Emoji detected — reduced character limit
          </span>
        </>
      )}
    </div>
  );
}

// ─── Rule Card ─────────────────────────────────────────────────────────
function RuleCard({
  rule,
  smsEnabled,
  onUpdate,
  saving,
}: {
  rule: CommunicationRule;
  smsEnabled: boolean;
  onUpdate: (eventType: NotificationEventType, updates: Partial<CommunicationRule>) => void;
  saving: boolean;
}) {
  const meta = EVENT_TYPE_META[rule.event_type];
  const Icon = EVENT_ICONS[rule.event_type] || FileText;
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const smsDisabled = !smsEnabled;

  const insertVariable = useCallback(
    (varName: string) => {
      const tag = `{{${varName}}}`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const current = rule.sms_template;
        const newVal = current.slice(0, start) + tag + current.slice(end);
        onUpdate(rule.event_type, { sms_template: newVal } as any);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        });
      } else {
        onUpdate(rule.event_type, {
          sms_template: rule.sms_template + tag,
        } as any);
      }
    },
    [rule, onUpdate]
  );

  return (
    <div className="border-b border-zinc-800/30 last:border-0">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_80px_80px_80px_40px] items-center gap-4 px-6 py-4 hover:bg-zinc-800/10 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800/60 mt-0.5 shrink-0">
            <Icon className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-200">{meta.label}</p>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
              {meta.description}
            </p>
          </div>
        </div>

        {/* SMS toggle */}
        <div className="flex justify-center">
          <Toggle
            checked={rule.enable_sms}
            onChange={(v) => onUpdate(rule.event_type, { enable_sms: v } as any)}
            disabled={smsDisabled || saving}
            size="sm"
          />
        </div>

        {/* Email toggle */}
        <div className="flex justify-center">
          <Toggle
            checked={rule.enable_email}
            onChange={(v) => onUpdate(rule.event_type, { enable_email: v } as any)}
            disabled={saving}
            size="sm"
          />
        </div>

        {/* Push toggle */}
        <div className="flex justify-center">
          <Toggle
            checked={rule.enable_push}
            onChange={(v) => onUpdate(rule.event_type, { enable_push: v } as any)}
            disabled={saving}
            size="sm"
          />
        </div>

        {/* Expand button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
      </div>

      {/* Expansion panel: SMS template editor */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 space-y-3">
              <div className="ml-11">
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  SMS Template
                </label>
                <textarea
                  ref={textareaRef}
                  value={rule.sms_template}
                  onChange={(e) =>
                    onUpdate(rule.event_type, {
                      sms_template: e.target.value,
                    } as any)
                  }
                  disabled={saving}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2.5 text-sm text-zinc-200 font-mono leading-relaxed placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none disabled:opacity-50"
                  placeholder="Enter SMS template..."
                />

                <SegmentIndicator message={rule.sms_template} />

                {/* Variable injector pills */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <span className="text-xs text-zinc-500 mr-1">
                    Insert variable:
                  </span>
                  {meta.templateVars.map((v) => (
                    <VariablePill
                      key={v}
                      variable={v}
                      onClick={() => insertVariable(v)}
                    />
                  ))}
                </div>

                {/* Email subject template */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Email Subject Line
                  </label>
                  <input
                    type="text"
                    value={rule.email_subject_template || ""}
                    onChange={(e) =>
                      onUpdate(rule.event_type, {
                        email_subject_template: e.target.value,
                      } as any)
                    }
                    disabled={saving}
                    className="w-full rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
                    placeholder="Email subject line..."
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Dispatch Logs Tab ─────────────────────────────────────────────────
function DispatchLogsPanel({ orgId }: { orgId: string }) {
  const [logs, setLogs] = useState<DispatchLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data, total: t } = await getCommunicationLogs(orgId, {
      limit: pageSize,
      offset: page * pageSize,
      status: statusFilter || undefined,
    });
    setLogs(data || []);
    setTotal(t);
    setLoading(false);
  }, [orgId, page, statusFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    if (!searchFilter) return logs;
    const q = searchFilter.toLowerCase();
    return logs.filter(
      (l) =>
        l.to_address?.toLowerCase().includes(q) ||
        l.recipient_phone?.toLowerCase().includes(q) ||
        l.body_preview?.toLowerCase().includes(q) ||
        l.event_type?.toLowerCase().includes(q)
    );
  }, [logs, searchFilter]);

  const statusColor = (s: string) => {
    switch (s) {
      case "delivered":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "bounced":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "failed":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      case "in_progress":
        return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default:
        return "text-zinc-400 bg-zinc-800/50 border-zinc-700/40";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by phone, content, event..."
            className="w-full rounded-lg border border-zinc-800 bg-[#141414] pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/50 focus:outline-none [color-scheme:dark]"
        >
          <option value="">All statuses</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="bounced">Bounced</option>
          <option value="in_progress">In Progress</option>
        </select>
      </div>

      {/* Logs table */}
      <div className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_100px_80px_140px] items-center gap-2 border-b border-zinc-800/60 px-4 py-2.5">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Recipient
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Event
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Channel
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Status
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Cost
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Sent
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No dispatch logs yet</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[1fr_120px_100px_100px_80px_140px] items-center gap-2 px-4 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/10 transition-colors text-sm"
            >
              <div className="truncate text-zinc-300 font-mono text-xs">
                {log.recipient_phone || log.to_address || "—"}
              </div>
              <div className="text-zinc-400 text-xs truncate">
                {log.event_type
                  ? EVENT_TYPE_META[log.event_type as NotificationEventType]?.label ||
                    log.event_type
                  : "—"}
              </div>
              <div className="text-zinc-400 text-xs uppercase">{log.channel}</div>
              <div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(log.status)}`}
                >
                  {log.status}
                </span>
              </div>
              <div className="text-zinc-400 text-xs font-mono">
                {log.cost_cents ? `$${(Number(log.cost_cents) / 100).toFixed(4)}` : "—"}
              </div>
              <div className="text-zinc-500 text-xs">
                {new Date(log.created_at).toLocaleString("en-AU", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of{" "}
            {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-800 bg-[#141414] px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={(page + 1) * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-800 bg-[#141414] px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function CommunicationsSettingsPage() {
  const { currentOrg } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const orgId = currentOrg?.id;

  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  const [settings, setSettings] = useState<CommunicationSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [savedSettings, setSavedSettings] = useState<CommunicationSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [rules, setRules] = useState<CommunicationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyRules, setDirtyRules] = useState<
    Map<NotificationEventType, Partial<CommunicationRule>>
  >(new Map());

  // ─── Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const [settingsRes, rulesRes] = await Promise.all([
        getWorkspaceCommunicationSettings(orgId),
        getCommunicationRules(orgId),
      ]);

      if (settingsRes.data) {
        const merged = {
          ...DEFAULT_SETTINGS,
          ...settingsRes.data,
        } as CommunicationSettings;
        setSettings(merged);
        setSavedSettings(merged);
      }

      if (rulesRes.data) {
        setRules(rulesRes.data);
      }

      setLoading(false);
    })();
  }, [orgId]);

  // ─── Settings dirty check ────────────────────────────────────────
  const settingsDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  const rulesDirty = dirtyRules.size > 0;
  const isDirty = settingsDirty || rulesDirty;

  // ─── Update workspace settings ───────────────────────────────────
  const updateSetting = useCallback(
    (key: keyof CommunicationSettings, value: boolean | string) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "sms_enabled" && value === false) {
          next.sms_roster_published = false;
          next.sms_shift_modified_urgent = false;
          next.sms_shift_modified_standard = false;
          next.sms_announcements = false;
          next.sms_payslips = false;
        }
        next.sms_payslips = false;
        next.push_always_on = true;
        return next;
      });
    },
    []
  );

  // ─── Update rule (local + mark dirty) ────────────────────────────
  const handleRuleUpdate = useCallback(
    (eventType: NotificationEventType, updates: Partial<CommunicationRule>) => {
      setRules((prev) =>
        prev.map((r) => (r.event_type === eventType ? { ...r, ...updates } : r))
      );
      setDirtyRules((prev) => {
        const next = new Map(prev);
        const existing = next.get(eventType) || {};
        next.set(eventType, { ...existing, ...updates });
        return next;
      });
    },
    []
  );

  // ─── Save all ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!orgId || saving) return;
    setSaving(true);

    const promises: Promise<any>[] = [];

    if (settingsDirty) {
      promises.push(
        updateWorkspaceCommunicationSettings(orgId, settings).then((res) => {
          if (res.error) throw new Error(res.error);
          setSavedSettings({ ...settings });
        })
      );
    }

    for (const [eventType, updates] of dirtyRules.entries()) {
      promises.push(
        updateCommunicationRule(orgId, eventType, {
          enable_sms: (updates as any).enable_sms,
          enable_email: (updates as any).enable_email,
          enable_push: (updates as any).enable_push,
          sms_template: (updates as any).sms_template,
          email_subject_template: (updates as any).email_subject_template,
        }).then((res) => {
          if (res.error) throw new Error(res.error);
        })
      );
    }

    try {
      await Promise.all(promises);
      setDirtyRules(new Map());
      addToast("Communication settings saved");
    } catch (err: any) {
      addToast(`Failed to save: ${err.message}`, undefined, "error");
    }

    setSaving(false);
  }, [orgId, saving, settings, settingsDirty, dirtyRules, addToast]);

  // ─── Group rules by sector ──────────────────────────────────────
  const groupedRules = useMemo(() => {
    const groups: Record<string, CommunicationRule[]> = {};
    for (const rule of rules) {
      const sector = EVENT_TYPE_META[rule.event_type]?.sector || "dispatch";
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(rule);
    }
    return groups;
  }, [rules]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-5xl space-y-8 pb-28">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Radio className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Communications
          </h1>
        </div>
        <p className="text-sm text-zinc-500 pl-12">
          Control exactly which channels fire for each event type. Customise SMS
          templates and monitor delivery status.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-zinc-800/60 bg-[#0A0A0A] p-1 w-fit">
        <button
          onClick={() => setActiveTab("rules")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "rules"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Notification Rules
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "logs"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Message Logs
        </button>
      </div>

      {activeTab === "rules" && (
        <>
          {/* SMS Master Switch */}
          <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
                  <Smartphone className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-zinc-100">
                    SMS Notifications
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Master switch for all outbound SMS via ClickSend. Individual
                    events can be toggled below.
                  </p>
                </div>
              </div>
              <Toggle
                checked={settings.sms_enabled}
                onChange={(v) => updateSetting("sms_enabled", v)}
              />
            </div>

            <AnimatePresence>
              {settings.sms_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-300/80">
                      SMS costs apply per segment (~$0.05 AUD/segment). Emojis
                      and special characters use UCS-2 encoding, reducing the
                      per-segment limit from 160 to 70 characters.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Event Rules by Sector */}
          {Object.entries(SECTOR_LABELS).map(([sector, { label, icon: SectorIcon }]) => {
            const sectorRules = groupedRules[sector];
            if (!sectorRules || sectorRules.length === 0) return null;

            return (
              <section
                key={sector}
                className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] overflow-hidden"
              >
                {/* Sector header */}
                <div className="flex items-center gap-3 border-b border-zinc-800/60 px-6 py-3">
                  <SectorIcon className="h-4 w-4 text-zinc-400" />
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    {label}
                  </h3>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_80px_80px_80px_40px] items-center gap-4 border-b border-zinc-800/40 px-6 py-2">
                  <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">
                    Event
                  </span>
                  <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider text-center">
                    <MessageSquare className="h-3 w-3 mx-auto" />
                  </span>
                  <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider text-center">
                    <Mail className="h-3 w-3 mx-auto" />
                  </span>
                  <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider text-center">
                    <Bell className="h-3 w-3 mx-auto" />
                  </span>
                  <span />
                </div>

                {/* Rule rows */}
                {sectorRules.map((rule) => (
                  <RuleCard
                    key={rule.event_type}
                    rule={rule}
                    smsEnabled={settings.sms_enabled}
                    onUpdate={handleRuleUpdate}
                    saving={saving}
                  />
                ))}
              </section>
            );
          })}

          {/* Quiet Hours */}
          <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
                  <Clock className="h-5 w-5 text-zinc-300" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-zinc-100">
                    Quiet Hours
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Suppress non-urgent notifications during specified hours.
                  </p>
                </div>
              </div>
              <Toggle
                checked={settings.quiet_hours_enabled}
                onChange={(v) => updateSetting("quiet_hours_enabled", v)}
              />
            </div>

            <AnimatePresence>
              {settings.quiet_hours_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          Start time
                        </label>
                        <input
                          type="time"
                          value={settings.quiet_hours_start}
                          onChange={(e) =>
                            updateSetting("quiet_hours_start", e.target.value)
                          }
                          className="w-full rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                          End time
                        </label>
                        <input
                          type="time"
                          value={settings.quiet_hours_end}
                          onChange={(e) =>
                            updateSetting("quiet_hours_end", e.target.value)
                          }
                          className="w-full rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={settings.quiet_hours_override_urgent}
                        onChange={(e) =>
                          updateSetting(
                            "quiet_hours_override_urgent",
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 rounded border-zinc-700 bg-[#141414] text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
                      />
                      <div>
                        <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
                          Allow urgent notifications to bypass quiet hours
                        </p>
                        <p className="text-xs text-zinc-500">
                          S8 Medication Missed and Shift Updated alerts will
                          still be delivered.
                        </p>
                      </div>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Sender ID */}
          <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
                <MessageSquare className="h-5 w-5 text-zinc-300" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-sm font-medium text-zinc-100">
                    SMS Sender ID
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    The name displayed on outgoing SMS. Max 11 alphanumeric
                    characters.
                  </p>
                </div>
                <input
                  type="text"
                  value={settings.twilio_sender_id}
                  onChange={(e) => {
                    const val = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .slice(0, 11);
                    updateSetting("twilio_sender_id", val);
                  }}
                  maxLength={11}
                  placeholder="iWorkr"
                  className="w-48 rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 font-mono tracking-wide focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === "logs" && orgId && <DispatchLogsPanel orgId={orgId} />}

      {/* Sticky Save Bar */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-4 rounded-xl border border-zinc-700/60 bg-[#0A0A0A]/95 backdrop-blur-md px-5 py-3 shadow-2xl shadow-black/40">
              <span className="text-sm text-zinc-400">Unsaved changes</span>
              <button
                onClick={() => {
                  setSettings({ ...savedSettings });
                  setDirtyRules(new Map());
                  if (orgId) {
                    getCommunicationRules(orgId).then((res) => {
                      if (res.data) setRules(res.data);
                    });
                  }
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
