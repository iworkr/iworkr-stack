/**
 * @page /dashboard/settings/widgets
 * @status COMPLETE
 * @description Embeddable widget builder with preview, config, and embed code generator
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Copy, Trash2, ChevronRight, ChevronDown, Loader2, Globe, Code2,
  ToggleLeft, ToggleRight, Pencil, Save, AlertTriangle, Activity, TrendingUp,
  DollarSign, Users, GitBranch, MessageSquare, Target, X, Check, RefreshCw,
  Clock, MapPin, ArrowDown,
} from "lucide-react";
import {
  getWidgets,
  createWidget,
  deleteWidget,
  updateWidget,
  getTriageTree,
  updateTriageTree,
  getBookingIntents,
  getBookingWidgetStats,
  getEmbedCode,
  type BookingWidget,
  type TriageTree,
  type TriageNode,
  type BookingIntent,
  type BookingWidgetStats,
} from "@/app/actions/glasshouse-triage";
import { useOrg } from "@/lib/hooks/use-org";

// ── Animation Variants ─────────────────────────────────────
const fadeIn: any = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.2 },
};

const stagger: any = {
  animate: { transition: { staggerChildren: 0.04 } },
};

// ── Helpers ────────────────────────────────────────────────
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDollars(amount: number): string {
  return `$${Number(amount).toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${Number(value).toFixed(1)}%`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function truncateToken(token: string): string {
  if (!token || token.length < 16) return token ?? "";
  return `${token.slice(0, 8)}…${token.slice(-6)}`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  initiated: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
  triage_complete: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  scheduling_selected: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
  payment_pending: { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" },
  converted_to_job: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  abandoned: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
  abandoned_capacity: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
  expired: { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.initiated;
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800 rounded-lg ${className}`} />;
}

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-3 flex gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab 1: Widget Card ─────────────────────────────────────
function WidgetCard({
  widget,
  onEdit,
  onToggle,
  onDelete,
  onCopyEmbed,
}: {
  widget: BookingWidget;
  onEdit: (w: BookingWidget) => void;
  onToggle: (w: BookingWidget) => void;
  onDelete: (w: BookingWidget) => void;
  onCopyEmbed: (w: BookingWidget) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyToken() {
    navigator.clipboard.writeText(widget.embed_script_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div {...fadeIn} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Globe size={16} className="text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{widget.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <button onClick={copyToken} className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
                {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                {truncateToken(widget.embed_script_token)}
              </button>
            </div>
          </div>
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 flex-shrink-0 ${
            widget.is_active
              ? "text-emerald-400 bg-emerald-400/12 border border-emerald-500/20"
              : "text-zinc-500 bg-zinc-800 border border-white/5"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${widget.is_active ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
          {widget.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Details */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <DollarSign size={11} />
          Call-out: <span className="text-zinc-300 font-mono">{formatDollars(widget.call_out_fee_amount)}</span>
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          Horizon: <span className="text-zinc-300 font-mono">{widget.scheduling_horizon_days}d</span>
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={11} />
          Radius: <span className="text-zinc-300 font-mono">{widget.max_travel_radius_km}km</span>
        </span>
        <span className="flex items-center gap-1">
          <Globe size={11} />
          Domains: <span className="text-zinc-300">{Array.isArray(widget.allowed_domains) ? widget.allowed_domains.join(", ") : "*"}</span>
        </span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(widget)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Pencil size={12} /> Edit
        </button>
        <button
          onClick={() => onCopyEmbed(widget)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Code2 size={12} /> Embed Code
        </button>
        <button
          onClick={() => onToggle(widget)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        >
          {widget.is_active ? <ToggleRight size={12} className="text-emerald-400" /> : <ToggleLeft size={12} />}
          {widget.is_active ? "Deactivate" : "Activate"}
        </button>
        <button
          onClick={() => onDelete(widget)}
          className="ml-auto p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Widget Edit Form ───────────────────────────────────────
function WidgetEditForm({
  widget,
  onSave,
  onCancel,
}: {
  widget: BookingWidget;
  onSave: (updated: Partial<BookingWidget>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: widget.name,
    call_out_fee_amount: widget.call_out_fee_amount,
    scheduling_horizon_days: widget.scheduling_horizon_days,
    minimum_buffer_minutes: widget.minimum_buffer_minutes,
    max_travel_radius_km: widget.max_travel_radius_km,
    slot_window_hours: widget.slot_window_hours,
    allowed_domains: Array.isArray(widget.allowed_domains) ? widget.allowed_domains.join(", ") : "*",
    primary_color: widget.branding_config?.primary_color ?? "#10B981",
    mode: widget.branding_config?.mode ?? "dark",
    welcome_message: widget.branding_config?.welcome_message ?? "Book a service online",
  });

  const [saving, setSaving] = useState(false);

  function handleSubmit() {
    setSaving(true);
    const domains = form.allowed_domains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    onSave({
      name: form.name,
      call_out_fee_amount: Number(form.call_out_fee_amount),
      scheduling_horizon_days: Number(form.scheduling_horizon_days),
      minimum_buffer_minutes: Number(form.minimum_buffer_minutes),
      max_travel_radius_km: Number(form.max_travel_radius_km),
      slot_window_hours: Number(form.slot_window_hours),
      allowed_domains: domains,
      branding_config: {
        primary_color: form.primary_color,
        mode: form.mode as "dark" | "light",
        logo_url: widget.branding_config?.logo_url ?? null,
        company_name: widget.branding_config?.company_name ?? null,
        welcome_message: form.welcome_message,
      },
    });
  }

  const inputCls =
    "w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors";
  const labelCls = "text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1 block";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-5 mt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelCls}>Widget Name</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Website Widget" /></div>
          <div><label className={labelCls}>Call-out Fee ($)</label>
            <input className={inputCls} type="number" step="0.01" value={form.call_out_fee_amount} onChange={(e) => setForm({ ...form, call_out_fee_amount: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Scheduling Horizon (days)</label>
            <input className={inputCls} type="number" value={form.scheduling_horizon_days} onChange={(e) => setForm({ ...form, scheduling_horizon_days: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Min. Buffer (minutes)</label>
            <input className={inputCls} type="number" value={form.minimum_buffer_minutes} onChange={(e) => setForm({ ...form, minimum_buffer_minutes: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Max Travel Radius (km)</label>
            <input className={inputCls} type="number" value={form.max_travel_radius_km} onChange={(e) => setForm({ ...form, max_travel_radius_km: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Slot Window (hours)</label>
            <input className={inputCls} type="number" value={form.slot_window_hours} onChange={(e) => setForm({ ...form, slot_window_hours: Number(e.target.value) })} /></div>
          <div><label className={labelCls}>Allowed Domains (comma-separated)</label>
            <input className={inputCls} value={form.allowed_domains} onChange={(e) => setForm({ ...form, allowed_domains: e.target.value })} placeholder="example.com, app.example.com" /></div>
          <div><label className={labelCls}>Brand Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
              <input className={inputCls} value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div></div>
          <div><label className={labelCls}>Theme Mode</label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((m) => (
                <button key={m} onClick={() => setForm({ ...form, mode: m })} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${form.mode === m ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>
                  {m === "dark" ? "🌙 Dark" : "☀️ Light"}</button>))}</div></div>
          <div className="col-span-2"><label className={labelCls}>Welcome Message</label>
            <input className={inputCls} value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} placeholder="Book a service online" /></div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/5">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Changes
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Tab 2: Triage Node Card ────────────────────────────────
function TriageNodeCard({
  node,
  allNodes,
  onEdit,
}: {
  node: TriageNode;
  allNodes: TriageNode[];
  onEdit: (node: TriageNode) => void;
}) {
  const isQuestion = node.type === "QUESTION";
  const priorityColors: Record<string, string> = {
    urgent: "text-rose-400 bg-rose-500/10",
    high: "text-amber-400 bg-amber-500/10",
    medium: "text-blue-400 bg-blue-500/10",
    low: "text-zinc-400 bg-zinc-500/10",
  };

  return (
    <div className={`relative border rounded-xl p-4 transition-colors hover:border-white/15 ${isQuestion ? "bg-zinc-900/50 border-white/5" : "bg-emerald-500/[0.03] border-emerald-500/20"}`}>
      {/* Type badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${isQuestion ? "text-blue-400 bg-blue-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
          {isQuestion ? "Question" : "Outcome"}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-600">{node.id}</span>
          <button onClick={() => onEdit(node)} className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
            <Pencil size={11} />
          </button>
        </div>
      </div>

      {isQuestion ? (
        <>
          <p className="text-sm text-white font-medium mb-2">{node.text}</p>
          <div className="space-y-1">
            {(node.answers ?? []).map((a, i) => {
              const target = allNodes.find((n) => n.id === a.next_node);
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <ChevronRight size={11} className="text-zinc-600 flex-shrink-0" />
                  <span className="text-zinc-300">{a.text}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-zinc-500 font-mono text-[10px]">{a.next_node}</span>
                  {a.is_urgent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold">URGENT</span>}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-white font-medium">{node.service_label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-mono text-zinc-400">{node.base_duration_mins}min</span>
            {node.priority && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${priorityColors[node.priority] ?? priorityColors.medium}`}>
                {node.priority}
              </span>
            )}
            {node.base_estimate_cents != null && (
              <span className="font-mono text-emerald-400">{formatCents(node.base_estimate_cents)}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab 2: Triage Node Edit Form ───────────────────────────
function NodeEditForm({
  node,
  allNodes,
  onSave,
  onCancel,
}: {
  node: TriageNode;
  allNodes: TriageNode[];
  onSave: (updated: TriageNode) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TriageNode>({ ...node, answers: node.answers ? [...node.answers.map((a) => ({ ...a }))] : [] });

  const inputCls =
    "w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors";
  const labelCls = "text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1 block";

  function addAnswer() {
    setForm({ ...form, answers: [...(form.answers ?? []), { text: "", next_node: "" }] });
  }

  function removeAnswer(idx: number) {
    setForm({ ...form, answers: (form.answers ?? []).filter((_, i) => i !== idx) });
  }

  function updateAnswer(idx: number, field: string, value: string | boolean) {
    const answers = [...(form.answers ?? [])];
    answers[idx] = { ...answers[idx], [field]: value };
    setForm({ ...form, answers });
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-zinc-950 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white">Edit Node: {form.id}</span>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={14} /></button>
      </div>

      {form.type === "QUESTION" ? (
        <>
          <div>
            <label className={labelCls}>Question Text</label>
            <input className={inputCls} value={form.text ?? ""} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Answers</label>
            <div className="space-y-2">
              {(form.answers ?? []).map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={`${inputCls} flex-1`} value={a.text} onChange={(e) => updateAnswer(i, "text", e.target.value)} placeholder="Answer text" />
                  <select
                    className="bg-zinc-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                    value={a.next_node}
                    onChange={(e) => updateAnswer(i, "next_node", e.target.value)}
                  >
                    <option value="">→ next…</option>
                    {allNodes.filter((n) => n.id !== node.id).map((n) => (
                      <option key={n.id} value={n.id}>{n.id}</option>
                    ))}
                  </select>
                  <button onClick={() => removeAnswer(i)} className="p-1 text-zinc-500 hover:text-rose-400"><X size={12} /></button>
                </div>
              ))}
              <button onClick={addAnswer} className="text-[11px] text-emerald-500 hover:text-emerald-400 transition-colors">+ Add Answer</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Service Label</label>
              <input className={inputCls} value={form.service_label ?? ""} onChange={(e) => setForm({ ...form, service_label: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Base Duration (min)</label>
              <input className={inputCls} type="number" value={form.base_duration_mins ?? 60} onChange={(e) => setForm({ ...form, base_duration_mins: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority ?? "medium"} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Base Estimate (cents)</label>
              <input className={inputCls} type="number" value={form.base_estimate_cents ?? 0} onChange={(e) => setForm({ ...form, base_estimate_cents: Number(e.target.value) })} />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button onClick={() => onSave(form)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors">
          <Save size={12} /> Save Node
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
      </div>
    </motion.div>
  );
}

// ── Tab 3: Intent Row ──────────────────────────────────────
function IntentRow({ intent }: { intent: BookingIntent }) {
  const [expanded, setExpanded] = useState(false);
  const clientName = [intent.client_first_name, intent.client_last_name].filter(Boolean).join(" ") || "Anonymous";
  const serviceType = (intent.triage_outcome as any)?.service_label ?? "—";

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
        <div className="flex-1 min-w-0">
          <span className="text-sm text-white font-medium">{clientName}</span>
          <span className="text-[11px] text-zinc-500 ml-3">{serviceType}</span>
        </div>
        <StatusBadge status={intent.status} />
        <span className="text-[10px] font-mono text-zinc-600 w-24 text-right flex-shrink-0">
          {formatRelative(intent.created_at)}
        </span>
        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
              <div>
                <span className="text-zinc-500">Email:</span>
                <span className="text-zinc-300 ml-2">{intent.client_email ?? "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Phone:</span>
                <span className="text-zinc-300 ml-2">{intent.client_phone ?? "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Address:</span>
                <span className="text-zinc-300 ml-2">{intent.service_address ?? "—"}</span>
              </div>
              <div>
                <span className="text-zinc-500">Duration:</span>
                <span className="text-zinc-300 font-mono ml-2">{intent.estimated_duration_mins ?? "—"} min</span>
              </div>
              {intent.selected_window_start && (
                <div>
                  <span className="text-zinc-500">Slot:</span>
                  <span className="text-zinc-300 ml-2">
                    {new Date(intent.selected_window_start).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
              )}
              {intent.deposit_amount_cents != null && intent.deposit_amount_cents > 0 && (
                <div>
                  <span className="text-zinc-500">Deposit:</span>
                  <span className="text-emerald-400 font-mono ml-2">{formatCents(intent.deposit_amount_cents)}</span>
                </div>
              )}
              {intent.payment_status && (
                <div>
                  <span className="text-zinc-500">Payment:</span>
                  <span className="text-zinc-300 ml-2">{intent.payment_status}</span>
                </div>
              )}
              {intent.converted_job_id && (
                <div className="col-span-2">
                  <span className="text-zinc-500">Converted Job:</span>
                  <a href={`/dashboard/jobs/${intent.converted_job_id}`} className="text-emerald-400 hover:text-emerald-300 ml-2 underline underline-offset-2">
                    View Job →
                  </a>
                </div>
              )}
              {intent.triage_path && (intent.triage_path as any[]).length > 0 && (
                <div className="col-span-2">
                  <span className="text-zinc-500">Triage Path:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(intent.triage_path as any[]).map((step: any, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-400 font-mono">{step?.answer ?? step?.text ?? `Step ${i + 1}`}</span>
                    ))}
                  </div>
                </div>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab 4: Funnel Bar ──────────────────────────────────────
function FunnelBar({ label, count, maxCount, color }: { label: string; count: number; maxCount: number; color: string }) {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 2;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-zinc-500 w-36 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-7 bg-zinc-900/60 rounded-lg overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-lg ${color}`}
        />
        <span className="absolute inset-0 flex items-center px-3 text-xs font-mono text-white font-semibold">
          {count}
        </span>
      </div>
    </div>
  );
}

// ── Embed Code Modal ───────────────────────────────────────
function EmbedCodeModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 flex items-center justify-center z-50 p-6"
      >
        <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Code2 size={16} className="text-emerald-500" /> Embed Code
            </h3>
            <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
          </div>
          <pre className="bg-zinc-900 border border-white/5 rounded-xl p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {code}
          </pre>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// ── MAIN PAGE ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
const TABS = ["Widgets", "Triage Builder", "Booking Feed", "Analytics"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  Widgets: <Globe size={14} />,
  "Triage Builder": <GitBranch size={14} />,
  "Booking Feed": <Activity size={14} />,
  Analytics: <TrendingUp size={14} />,
};

const INTENT_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "initiated", label: "Initiated" },
  { value: "triage_complete", label: "Triage Complete" },
  { value: "scheduling_selected", label: "Scheduling Selected" },
  { value: "payment_pending", label: "Payment Pending" },
  { value: "converted_to_job", label: "Converted" },
  { value: "abandoned", label: "Abandoned" },
];

export default function WidgetsPage() {
  const org = useOrg();
  const orgId = (org as any)?.orgId ?? (org as any)?.id;

  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("Widgets");

  // Global
  const [error, setError] = useState<string | null>(null);

  // Tab 1: Widgets
  const [widgets, setWidgets] = useState<BookingWidget[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState(true);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [creatingWidget, setCreatingWidget] = useState(false);

  // Tab 2: Triage Builder
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [triageTree, setTriageTree] = useState<TriageTree | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [savingTree, setSavingTree] = useState(false);

  // Tab 3: Booking Feed
  const [intents, setIntents] = useState<BookingIntent[]>([]);
  const [loadingIntents, setLoadingIntents] = useState(true);
  const [intentFilter, setIntentFilter] = useState("all");

  // Tab 4: Analytics
  const [stats, setStats] = useState<BookingWidgetStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── Data Fetching ────────────────────────────────────────
  const fetchWidgets = useCallback(async () => {
    if (!orgId) return;
    setLoadingWidgets(true);
    try { const { data, error: err } = await getWidgets(orgId); if (err) setError(err); else setWidgets(data ?? []); } catch (e: any) { setError(e.message ?? "Failed to load widgets"); }
    setLoadingWidgets(false);
  }, [orgId]);

  const fetchIntents = useCallback(async () => {
    if (!orgId) return;
    setLoadingIntents(true);
    try { const { data, error: err } = await getBookingIntents(orgId, intentFilter); if (err) setError(err); else setIntents(data ?? []); } catch (e: any) { setError(e.message ?? "Failed to load intents"); }
    setLoadingIntents(false);
  }, [orgId, intentFilter]);

  const fetchStats = useCallback(async () => {
    if (!orgId) return;
    setLoadingStats(true);
    try { const { data, error: err } = await getBookingWidgetStats(orgId); if (err) setError(err); else setStats(data ?? null); } catch (e: any) { setError(e.message ?? "Failed to load stats"); }
    setLoadingStats(false);
  }, [orgId]);

  const fetchTriageTree = useCallback(async (widgetId: string) => {
    setLoadingTree(true);
    try { const { data, error: err } = await getTriageTree(widgetId, orgId!); if (err) setError(err); else setTriageTree(data); } catch (e: any) { setError(e.message ?? "Failed to load triage tree"); }
    setLoadingTree(false);
  }, []);

  useEffect(() => { if (activeTab === "Widgets") fetchWidgets(); }, [activeTab, fetchWidgets]);
  useEffect(() => { if (activeTab === "Booking Feed") fetchIntents(); }, [activeTab, fetchIntents]);
  useEffect(() => { if (activeTab === "Analytics") fetchStats(); }, [activeTab, fetchStats]);
  useEffect(() => { if (selectedWidgetId) fetchTriageTree(selectedWidgetId); }, [selectedWidgetId, fetchTriageTree]);
  useEffect(() => {
    if (activeTab === "Triage Builder" && widgets.length > 0 && !selectedWidgetId) setSelectedWidgetId(widgets[0].id);
    if (activeTab === "Triage Builder" && widgets.length === 0 && !loadingWidgets) fetchWidgets();
  }, [activeTab, widgets, selectedWidgetId, loadingWidgets, fetchWidgets]);

  async function handleCreateWidget() {
    if (!orgId) return;
    setCreatingWidget(true);
    try { const { error: err } = await createWidget(orgId!, `Widget ${widgets.length + 1}`); if (err) setError(err); else await fetchWidgets(); } catch (e: any) { setError(e.message); }
    setCreatingWidget(false);
  }

  async function handleUpdateWidget(widgetId: string, payload: Partial<BookingWidget>) {
    try { const { error: err } = await updateWidget(widgetId, orgId!, payload); if (err) setError(err); else { setEditingWidgetId(null); await fetchWidgets(); } } catch (e: any) { setError(e.message); }
  }

  async function handleToggleWidget(w: BookingWidget) { await handleUpdateWidget(w.id, { is_active: !w.is_active }); }

  async function handleDeleteWidget(w: BookingWidget) {
    if (!confirm(`Delete widget "${w.name}"? This cannot be undone.`)) return;
    try { const { error: err } = await deleteWidget(w.id, orgId!); if (err) setError(err); else await fetchWidgets(); } catch (e: any) { setError(e.message); }
  }

  async function handleCopyEmbed(w: BookingWidget) {
    try { const res = await getEmbedCode(w.id, orgId!); setEmbedCode((res as any)?.data ?? ""); } catch (e: any) { setError(e.message); }
  }

  async function handleSaveTree() {
    if (!selectedWidgetId || !triageTree) return;
    setSavingTree(true);
    try { const { error: err } = await updateTriageTree(triageTree?.id ?? selectedWidgetId, orgId!, triageTree?.tree_graph); if (err) setError(err); } catch (e: any) { setError(e.message); }
    setSavingTree(false);
  }

  function handleNodeSave(updated: TriageNode) {
    if (!triageTree) return;
    const nodes = triageTree.tree_graph.nodes.map((n) => (n.id === updated.id ? updated : n));
    setTriageTree({ ...triageTree, tree_graph: { ...triageTree.tree_graph, nodes } });
    setEditingNodeId(null);
  }

  function handleAddNode(type: "QUESTION" | "OUTCOME") {
    if (!triageTree) return;
    const prefix = type === "QUESTION" ? "q" : "result";
    const existing = triageTree.tree_graph.nodes.filter((n) => n.id.startsWith(prefix));
    const newId = `${prefix}_${existing.length + 1}`;
    const newNode: TriageNode =
      type === "QUESTION"
        ? { id: newId, type: "QUESTION", text: "New question?", answers: [] }
        : { id: newId, type: "OUTCOME", service_label: "New Outcome", base_duration_mins: 60, priority: "medium", base_estimate_cents: 10000 };
    setTriageTree({
      ...triageTree,
      tree_graph: { ...triageTree.tree_graph, nodes: [...triageTree.tree_graph.nodes, newNode] },
    });
    setEditingNodeId(newId);
  }

  // ── Computed ─────────────────────────────────────────────
  const treeNodes = triageTree?.tree_graph?.nodes ?? [];
  const questionNodes = treeNodes.filter((n) => n.type === "QUESTION");
  const outcomeNodes = treeNodes.filter((n) => n.type === "OUTCOME");

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#050505] overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center px-6 gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>SETTINGS</span>
          <ChevronRight size={12} />
          <span className="text-zinc-300">BOOKING WIDGETS</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (activeTab === "Widgets") fetchWidgets();
              if (activeTab === "Booking Feed") fetchIntents();
              if (activeTab === "Analytics") fetchStats();
            }}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5 px-6 flex items-center gap-1 flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-emerald-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {TAB_ICONS[tab]}
            {tab}
          </button>
        ))}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div {...fadeIn} className="mx-6 mt-4 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
            <p className="text-xs text-rose-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 text-rose-400 hover:text-rose-300"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* ── TAB 1: WIDGETS ──────────────────────── */}
          {activeTab === "Widgets" && (
            <motion.div {...fadeIn}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-white mb-1">Booking Widgets</h1>
                  <p className="text-sm text-zinc-500">Manage your public booking widgets and embed codes.</p>
                </div>
                <button
                  onClick={handleCreateWidget}
                  disabled={creatingWidget}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {creatingWidget ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create Widget
                </button>
              </div>

              {loadingWidgets ? (
                <SkeletonCards />
              ) : widgets.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mx-auto mb-4">
                    <Globe size={24} className="text-zinc-600" />
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No booking widgets yet</p>
                  <p className="text-xs text-zinc-600">Create your first widget to start accepting bookings online.</p>
                </div>
              ) : (
                <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">
                  {widgets.map((w) => (
                    <div key={w.id}>
                      <WidgetCard
                        widget={w}
                        onEdit={(widget) => setEditingWidgetId(editingWidgetId === widget.id ? null : widget.id)}
                        onToggle={handleToggleWidget}
                        onDelete={handleDeleteWidget}
                        onCopyEmbed={handleCopyEmbed}
                      />
                      <AnimatePresence>
                        {editingWidgetId === w.id && (
                          <WidgetEditForm
                            widget={w}
                            onSave={(payload) => handleUpdateWidget(w.id, payload)}
                            onCancel={() => setEditingWidgetId(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── TAB 2: TRIAGE BUILDER ──────────────── */}
          {activeTab === "Triage Builder" && (
            <motion.div {...fadeIn}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-bold text-white mb-1">Triage Builder</h1>
                  <p className="text-sm text-zinc-500">Design the decision tree customers follow to describe their issue.</p>
                </div>
                <div className="flex items-center gap-2">
                  {treeNodes.length > 0 && (
                    <>
                      <button
                        onClick={() => handleAddNode("QUESTION")}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <MessageSquare size={12} /> Add Question
                      </button>
                      <button
                        onClick={() => handleAddNode("OUTCOME")}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-300 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <Target size={12} /> Add Outcome
                      </button>
                      <button
                        onClick={handleSaveTree}
                        disabled={savingTree}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                      >
                        {savingTree ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save Tree
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Widget selector */}
              <div className="mb-6">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5 block">Select Widget</label>
                <select
                  value={selectedWidgetId ?? ""}
                  onChange={(e) => {
                    setSelectedWidgetId(e.target.value || null);
                    setEditingNodeId(null);
                  }}
                  className="bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50 min-w-[280px] transition-colors"
                >
                  <option value="">— Choose a widget —</option>
                  {widgets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {loadingTree ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : !selectedWidgetId ? (
                <div className="text-center py-16">
                  <GitBranch size={24} className="text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">Select a widget above to edit its triage tree.</p>
                </div>
              ) : treeNodes.length === 0 ? (
                <div className="text-center py-16">
                  <GitBranch size={24} className="text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400 mb-3">No triage tree configured for this widget.</p>
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleAddNode("QUESTION")} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors">
                      <Plus size={12} /> Add First Question
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Questions section */}
                  <div className="mb-6">
                    <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-3">Questions ({questionNodes.length})</h3>
                    <div className="space-y-2">
                      {questionNodes.map((node) => (
                        <div key={node.id}>
                          {editingNodeId === node.id ? (
                            <NodeEditForm
                              node={node}
                              allNodes={treeNodes}
                              onSave={handleNodeSave}
                              onCancel={() => setEditingNodeId(null)}
                            />
                          ) : (
                            <TriageNodeCard node={node} allNodes={treeNodes} onEdit={() => setEditingNodeId(node.id)} />
                          )}
                          {/* Connector line */}
                          {node.answers && node.answers.length > 0 && (
                            <div className="flex justify-center py-1">
                              <div className="w-px h-4 bg-zinc-800" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Arrow down between sections */}
                  <div className="flex justify-center py-2 mb-4">
                    <ArrowDown size={16} className="text-zinc-700" />
                  </div>

                  {/* Outcomes section */}
                  <div>
                    <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-3">Outcomes ({outcomeNodes.length})</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {outcomeNodes.map((node) => (
                        <div key={node.id}>
                          {editingNodeId === node.id ? (
                            <NodeEditForm
                              node={node}
                              allNodes={treeNodes}
                              onSave={handleNodeSave}
                              onCancel={() => setEditingNodeId(null)}
                            />
                          ) : (
                            <TriageNodeCard node={node} allNodes={treeNodes} onEdit={() => setEditingNodeId(node.id)} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB 3: BOOKING FEED ────────────────── */}
          {activeTab === "Booking Feed" && (
            <motion.div {...fadeIn}>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1">Booking Feed</h1>
                <p className="text-sm text-zinc-500">Real-time feed of all booking intents from your widgets.</p>
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap items-center gap-1.5 mb-5">
                {INTENT_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIntentFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                      intentFilter === opt.value
                        ? "bg-white/10 text-white"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {loadingIntents ? (
                <SkeletonCards />
              ) : intents.length === 0 ? (
                <div className="text-center py-16">
                  <Activity size={24} className="text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">No booking intents found.</p>
                  <p className="text-xs text-zinc-600 mt-1">Intents will appear here once customers interact with your widget.</p>
                </div>
              ) : (
                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                    <span className="flex-1">Client & Service</span>
                    <span className="w-36 text-center">Status</span>
                    <span className="w-24 text-right">Time</span>
                    <span className="w-4" />
                  </div>
                  {intents.map((intent) => (
                    <IntentRow key={intent.id} intent={intent} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB 4: ANALYTICS ───────────────────── */}
          {activeTab === "Analytics" && (
            <motion.div {...fadeIn}>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white mb-1">Analytics</h1>
                <p className="text-sm text-zinc-500">Conversion funnel and booking performance metrics.</p>
              </div>

              {loadingStats ? (
                <div className="grid grid-cols-4 gap-3 mb-8">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-2xl" />
                  ))}
                </div>
              ) : stats ? (
                <>
                  {/* Stats ribbon */}
                  <div className="grid grid-cols-4 gap-3 mb-8">
                    {[
                      { label: "Total Intents", value: stats.total_intents.toString(), icon: <Users size={16} />, color: "text-zinc-300" },
                      { label: "Conversion Rate", value: formatPercent(stats.conversion_rate), icon: <TrendingUp size={16} />, color: stats.conversion_rate > 20 ? "text-emerald-400" : "text-amber-400" },
                      { label: "Revenue from Deposits", value: formatCents(stats.total_revenue_cents), icon: <DollarSign size={16} />, color: "text-emerald-400" },
                      { label: "Abandoned", value: stats.abandoned.toString(), icon: <AlertTriangle size={16} />, color: stats.abandoned > stats.total_intents * 0.6 ? "text-rose-400" : "text-zinc-400" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2 text-zinc-500">{stat.icon}<span className="text-[10px] uppercase tracking-wider font-semibold">{stat.label}</span></div>
                        <p className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Abandonment warning */}
                  {stats.total_intents > 0 && (stats.abandoned / stats.total_intents) * 100 > 60 && (
                    <div className="mb-6 flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                      <AlertTriangle size={16} className="text-rose-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-rose-300 font-medium">High Abandonment Rate</p>
                        <p className="text-[10px] text-rose-400/70">
                          Over 60% of booking intents are abandoned. Consider simplifying your triage tree or adjusting pricing.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Funnel */}
                  <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-5">Conversion Funnel</h3>
                    <div className="space-y-2">
                      <FunnelBar label="Initiated" count={stats.initiated} maxCount={stats.total_intents} color="bg-zinc-500" />
                      <FunnelBar label="Triage Complete" count={stats.triage_complete} maxCount={stats.total_intents} color="bg-blue-500" />
                      <FunnelBar label="Scheduling Selected" count={stats.scheduling_selected} maxCount={stats.total_intents} color="bg-amber-500" />
                      <FunnelBar label="Payment Pending" count={stats.payment_pending} maxCount={stats.total_intents} color="bg-purple-500" />
                      <FunnelBar label="Converted" count={stats.converted} maxCount={stats.total_intents} color="bg-emerald-500" />
                      <FunnelBar label="Abandoned" count={stats.abandoned} maxCount={stats.total_intents} color="bg-rose-500" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <TrendingUp size={24} className="text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">No analytics data available yet.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Embed Code Modal */}
      <AnimatePresence>
        {embedCode && <EmbedCodeModal code={embedCode} onClose={() => setEmbedCode(null)} />}
      </AnimatePresence>
    </div>
  );
}
