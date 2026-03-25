"use client";

/**
 * @page Widget Builder
 * @route /dashboard/settings/intake
 * @description Project Gateway-Intake: Widget configuration command center.
 *   Create/manage embeddable intake widgets with domain whitelisting,
 *   custom fields, sector configuration, and embed code generation.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import {
  createWidget,
  updateWidget,
  fetchWidgets,
  deleteWidget,
  getWidgetEmbedCode,
  type IntakeWidget,
} from "@/app/actions/gateway-intake";
import {
  Plus,
  Settings,
  Globe,
  Copy,
  CheckCircle2,
  Trash2,
  Code2,
  Palette,
  ToggleLeft,
  ToggleRight,
  Zap,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Hash,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

/* ── Widget Card ──────────────────────────────────────── */

function WidgetCard({
  widget,
  onToggle,
  onDelete,
}: {
  widget: IntakeWidget;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [copied, setCopied] = useState(false);

  const loadEmbed = useCallback(async () => {
    if (!embedCode) {
      const code = await getWidgetEmbedCode(widget.id);
      setEmbedCode(code);
    }
  }, [widget.id, embedCode]);

  const copyEmbed = useCallback(async () => {
    await loadEmbed();
    if (embedCode) {
      navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [loadEmbed, embedCode]);

  useEffect(() => {
    if (expanded) loadEmbed();
  }, [expanded, loadEmbed]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${widget.theme_color}20` }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: widget.theme_color }} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-neutral-200">{widget.name}</h3>
              <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${widget.is_active ? "bg-emerald-400" : "bg-neutral-600"}`} />
                {widget.is_active ? "Active" : "Inactive"} · {widget.sector} · {widget.submissions_count} submissions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors">
              {widget.is_active ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-neutral-600" />}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Domains */}
        {widget.allowed_domains.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <Globe className="w-3 h-3 text-neutral-600" />
            {widget.allowed_domains.map((d) => (
              <span key={d} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400">{d}</span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-3 border-t border-neutral-800">
              <div className="pt-3">
                <label className="text-xs text-neutral-400 font-medium flex items-center gap-1 mb-2">
                  <Code2 className="w-3.5 h-3.5" /> Embed Code
                </label>
                <div className="relative">
                  <pre className="text-xs text-emerald-300 bg-neutral-950 rounded-lg p-3 overflow-x-auto font-mono border border-neutral-800">
                    {embedCode || "Loading..."}
                  </pre>
                  <button
                    onClick={copyEmbed}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onDelete}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete Widget
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Create Widget Form ───────────────────────────────── */

function CreateWidgetForm({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("TRADES");
  const [themeColor, setThemeColor] = useState("#10B981");
  const [domains, setDomains] = useState("");
  const [showUrgency, setShowUrgency] = useState(true);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [customQuestions, setCustomQuestions] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);

    const domainList = domains
      .split(/[,\n]/)
      .map((d) => d.trim())
      .filter(Boolean);

    const questions = customQuestions
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);

    await createWidget({
      organization_id: orgId,
      name: name.trim(),
      sector,
      theme_color: themeColor,
      allowed_domains: domainList,
      config_jsonb: {
        show_urgency: showUrgency,
        require_photo: requirePhoto,
        custom_questions: questions,
      },
    });

    setName("");
    setDomains("");
    setCustomQuestions("");
    setCreating(false);
    onCreated();
  }, [orgId, name, sector, themeColor, domains, showUrgency, requirePhoto, customQuestions, onCreated]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4">
      <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
        <Plus className="w-4 h-4 text-emerald-400" /> Create New Widget
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-neutral-400 mb-1 block">Widget Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Website Form"
            className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-950 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-950 border border-neutral-700 text-neutral-200"
            >
              <option value="TRADES">Trades</option>
              <option value="CARE">Care / NDIS</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block flex items-center gap-1"><Palette className="w-3 h-3" /> Color</label>
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-full h-[38px] rounded-lg border border-neutral-700 bg-neutral-950 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-neutral-400 mb-1 block flex items-center gap-1">
          <Globe className="w-3 h-3" /> Allowed Domains (one per line or comma-separated)
        </label>
        <textarea
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          rows={2}
          placeholder="acmeplumbing.com.au, www.acmeplumbing.com.au"
          className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-950 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none font-mono"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showUrgency} onChange={(e) => setShowUrgency(e.target.checked)} className="rounded" />
          <span className="text-xs text-neutral-300">Show urgency selector</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={requirePhoto} onChange={(e) => setRequirePhoto(e.target.checked)} className="rounded" />
          <span className="text-xs text-neutral-300">Require photo upload</span>
        </label>
      </div>

      <div>
        <label className="text-xs text-neutral-400 mb-1 block">Custom Questions (one per line)</label>
        <textarea
          value={customQuestions}
          onChange={(e) => setCustomQuestions(e.target.value)}
          rows={3}
          placeholder={"What is your NDIS number?\nWhat type of support do you need?"}
          className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-950 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

      <button
        onClick={handleCreate}
        disabled={creating || !name.trim()}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Create Widget
      </button>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function IntakeWidgetSettings() {
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;

  const [widgets, setWidgets] = useState<IntakeWidget[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWidgets = useCallback(async () => {
    if (!orgId) return;
    const data = await fetchWidgets(orgId);
    setWidgets(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadWidgets(); }, [loadWidgets]);

  const handleToggle = useCallback(async (widget: IntakeWidget) => {
    await updateWidget(widget.id, { is_active: !widget.is_active } as any);
    loadWidgets();
  }, [loadWidgets]);

  const handleDelete = useCallback(async (widgetId: string) => {
    if (!confirm("Delete this widget? This cannot be undone.")) return;
    await deleteWidget(widgetId);
    loadWidgets();
  }, [loadWidgets]);

  if (!orgId) return <div className="flex items-center justify-center h-64"><p className="text-neutral-500">Select an organization</p></div>;

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            Intake Widgets
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">Configure embeddable lead capture forms for your website</p>
        </div>
        <Link
          href="/dashboard/intake/queue"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-sm transition-colors"
        >
          <Zap className="w-4 h-4" /> Lead Queue <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Warning Banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-amber-300 font-medium">Domain Whitelisting Required</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Always add your website domains. The intake router will reject submissions from non-whitelisted origins.
            </p>
          </div>
        </div>
      </div>

      {/* Create Form */}
      <CreateWidgetForm orgId={orgId} onCreated={loadWidgets} />

      {/* Existing Widgets */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-400 flex items-center gap-2">
          <Hash className="w-4 h-4" /> Your Widgets ({widgets.length})
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-neutral-600 animate-spin" />
          </div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-12 text-neutral-600 text-sm">
            No widgets yet. Create one above to get started.
          </div>
        ) : (
          widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              onToggle={() => handleToggle(w)}
              onDelete={() => handleDelete(w.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
