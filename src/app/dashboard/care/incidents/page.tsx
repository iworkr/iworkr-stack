"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  AlertTriangle,
  Shield,
  X,
  Clock,
  MapPin,
  FileText,
  ChevronRight,
  Loader2,
  Check,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useIncidentsStore,
  useFilteredIncidents,
  CATEGORY_LABELS,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  type IncidentCategory,
  type IncidentSeverity,
  type IncidentStatus,
  type CreateIncidentParams,
} from "@/lib/incidents-store";
import { useOrg } from "@/lib/hooks/use-org";
import { useAuthStore } from "@/lib/auth-store";

/* ── Tabs Config ─────────────────────────────────────── */

type TabKey = "all" | "reported" | "under_review" | "critical" | "resolved";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reported", label: "Reported" },
  { key: "under_review", label: "Under Review" },
  { key: "critical", label: "Critical" },
  { key: "resolved", label: "Resolved" },
];

/* ── Badges ──────────────────────────────────────────── */

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const c = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${c.bg} ${c.color} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.color.replace("text-", "bg-")}`} />
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

/* ── Create Incident Modal ───────────────────────────── */

function CreateIncidentModal({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const user = useAuthStore((s) => s.user);
  const createIncident = useIncidentsStore((s) => s.createIncident);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("other");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [location, setLocation] = useState("");
  const [immediateActions, setImmediateActions] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => { setTitle(""); setDescription(""); setCategory("other"); setSeverity("medium"); setLocation(""); setImmediateActions(""); }, []);

  const handleSubmit = async () => {
    if (!title || !description || !user?.id) return;
    setSaving(true);
    await createIncident({
      organization_id: orgId, worker_id: user.id, category, severity, title, description,
      location: location || undefined, occurred_at: new Date().toISOString(), immediate_actions: immediateActions || undefined,
    });
    setSaving(false); resetForm(); onClose();
  };

  const inputCls = "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { onClose(); resetForm(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0A0A0A]/95 p-6 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">New Report</span>
                <h2 className="text-[15px] font-medium text-zinc-200 mt-0.5">Report Incident</h2>
              </div>
              <button onClick={() => { onClose(); resetForm(); }} className="rounded-lg p-1.5 text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the incident" className={inputCls} />
              </div>

              {/* Category + Severity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                    className={`${inputCls} cursor-pointer`}>
                    {(Object.entries(CATEGORY_LABELS) as [IncidentCategory, string][]).map(([k, v]) => (
                      <option key={k} value={k} className="bg-zinc-900">{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Severity</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    className={`${inputCls} cursor-pointer`}>
                    {(Object.entries(SEVERITY_CONFIG) as [IncidentSeverity, { label: string }][]).map(([k, v]) => (
                      <option key={k} value={k} className="bg-zinc-900">{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="Detailed account of what happened…" className={`${inputCls} resize-none`} />
              </div>

              {/* Location */}
              <div>
                <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where did it occur?" className={inputCls} />
              </div>

              {/* Immediate Actions */}
              <div>
                <label className="block font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-1.5">Immediate Actions Taken</label>
                <textarea value={immediateActions} onChange={(e) => setImmediateActions(e.target.value)} rows={2}
                  placeholder="What was done immediately in response?" className={`${inputCls} resize-none`} />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => { onClose(); resetForm(); }}
                className="rounded-lg px-4 py-2 text-[12px] font-medium text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!title || !description || saving}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-white transition-all duration-200 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {saving ? "Reporting…" : "Report Incident"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ───────────────────────────────────────── */

export default function IncidentsPage() {
  const { orgId } = useOrg();
  const loading = useIncidentsStore((s) => s.loading);
  const incidents = useFilteredIncidents();
  const allIncidents = useIncidentsStore((s) => s.incidents);
  const loadFromServer = useIncidentsStore((s) => s.loadFromServer);

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabKey>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (orgId) loadFromServer(orgId); }, [orgId, loadFromServer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const tabFiltered = useMemo(() => {
    if (selectedTab === "all") return incidents;
    if (selectedTab === "critical") return incidents.filter((i) => i.severity === "critical" && !["resolved", "closed"].includes(i.status));
    return incidents.filter((i) => i.status === selectedTab);
  }, [incidents, selectedTab]);

  const searched = useMemo(() => {
    if (!search) return tabFiltered;
    const q = search.toLowerCase();
    return tabFiltered.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.worker_name?.toLowerCase().includes(q));
  }, [tabFiltered, search]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: incidents.length, critical: 0, reported: 0, under_review: 0, resolved: 0 };
    for (const i of incidents) { if (i.status === "reported") c.reported++; if (i.status === "under_review") c.under_review++; if (i.status === "resolved") c.resolved++; if (i.severity === "critical" && !["resolved", "closed"].includes(i.status)) c.critical++; }
    return c;
  }, [incidents]);

  const stats = useMemo(() => ({
    total: allIncidents.length, open: allIncidents.filter((i) => !["resolved", "closed"].includes(i.status)).length,
    critical: allIncidents.filter((i) => i.severity === "critical" && !["resolved", "closed"].includes(i.status)).length,
  }), [allIncidents]);

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Command Bar Header ─────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
              INCIDENT REGISTER
            </span>
            <div className="ml-4 flex items-center gap-0.5">
              {TABS.map((tab) => {
                const isActive = selectedTab === tab.key;
                const count = tabCounts[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedTab(tab.key)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="incidents-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                        isActive ? "bg-white/[0.06] text-zinc-300" : "text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stealth Search */}
            <div className="relative flex items-center gap-2">
              <motion.div
                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
                initial={false}
                animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              />
              <div className="flex items-center gap-2 pl-2">
                <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search incidents…"
                  className="w-48 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                {!searchFocused && !search && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-none transition-all duration-200 hover:bg-emerald-500"
            >
              <Plus size={12} />
              Report Incident
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Column Headers ─────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
        <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Date</div>
        <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Title</div>
        <div className="w-32 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Category</div>
        <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Severity</div>
        <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
        <div className="w-32 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Reporter</div>
        <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Location</div>
        <div className="w-10" />
      </div>

      {/* ── Rows ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Loading skeleton */}
        {loading && incidents.length === 0 && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.02] animate-pulse">
            <div className="w-28 px-2"><div className="w-16 h-3 bg-zinc-800 rounded" /></div>
            <div className="min-w-0 flex-1 px-2"><div className="w-48 h-3 bg-zinc-800 rounded" /></div>
            <div className="w-32 px-2"><div className="w-20 h-4 bg-zinc-800/40 rounded-full" /></div>
            <div className="w-24 px-2"><div className="w-14 h-4 bg-zinc-800/40 rounded-full" /></div>
            <div className="w-28 px-2"><div className="w-16 h-4 bg-zinc-800/40 rounded-full" /></div>
            <div className="w-32 px-2"><div className="w-20 h-3 bg-zinc-800/60 rounded" /></div>
            <div className="w-28 px-2"><div className="w-16 h-3 bg-zinc-800/40 rounded" /></div>
            <div className="w-10" />
          </div>
        ))}

        {/* Empty state */}
        {!loading && searched.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[60px]" />
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02]">
              <AlertTriangle size={32} className="text-zinc-600" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-200">
              {search || selectedTab !== "all" ? "No incidents match your filters" : "No incidents reported yet"}
            </h3>
            <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-zinc-600">
              {search || selectedTab !== "all"
                ? "Try adjusting your search or tab selection."
                : "Report your first incident to begin tracking."}
            </p>
            {!search && selectedTab === "all" && (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white shadow-none transition-all duration-200 hover:bg-emerald-500"
              >
                <Plus size={14} />
                Report First Incident
              </button>
            )}
          </motion.div>
        )}

        {/* Data rows */}
        <AnimatePresence mode="popLayout">
          {searched.map((incident, idx) => (
            <motion.div
              key={incident.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ delay: Math.min(idx * 0.015, 0.2), duration: 0.2 }}
              className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer transition-colors duration-100 hover:bg-white/[0.02]"
            >
              {/* Date */}
              <div className="w-28 px-2">
                <div className="flex items-center gap-1.5">
                  <Clock size={10} className="text-zinc-700 shrink-0" />
                  <span className="text-xs text-zinc-400 font-mono">
                    {new Date(incident.occurred_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-700 font-mono pl-4">
                  {new Date(incident.occurred_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Title */}
              <div className="min-w-0 flex-1 px-2">
                <span className="text-sm text-zinc-200 truncate block group-hover:text-white transition-colors">
                  {incident.title}
                </span>
                <span className="text-[10px] text-zinc-600 truncate block">
                  {incident.description.length > 60 ? incident.description.slice(0, 60) + "…" : incident.description}
                </span>
              </div>

              {/* Category */}
              <div className="w-32 px-2">
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-white/[0.04] text-zinc-400">
                  {CATEGORY_LABELS[incident.category]}
                </span>
              </div>

              {/* Severity */}
              <div className="w-24 px-2">
                <SeverityBadge severity={incident.severity} />
              </div>

              {/* Status */}
              <div className="w-28 px-2">
                <StatusBadge status={incident.status} />
              </div>

              {/* Reporter */}
              <div className="w-32 px-2">
                <span className="text-xs text-zinc-500 truncate block">
                  {incident.worker_name || "—"}
                </span>
              </div>

              {/* Location */}
              <div className="w-28 px-2">
                {incident.location ? (
                  <span className="flex items-center gap-1 text-xs text-zinc-600 truncate">
                    <MapPin size={9} className="shrink-0" />
                    {incident.location}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-800">—</span>
                )}
              </div>

              {/* Chevron */}
              <div className="w-10 flex justify-end">
                <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      {!loading && searched.length > 0 && (
        <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
            <div className="flex items-center gap-1.5">
              <FileText size={10} />
              <span>{stats.total} incidents</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={10} className="text-amber-500/50" />
              <span>{stats.open} open</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <Shield size={10} className="text-rose-500/50" />
              <span>{stats.critical} critical</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
            <span>↑↓ Navigate</span>
            <span className="text-zinc-800">·</span>
            <span>⌘F Search</span>
          </div>
        </div>
      )}

      {/* ── Create Modal ───────────────────────────────── */}
      <CreateIncidentModal open={createOpen} onClose={() => setCreateOpen(false)} orgId={orgId ?? ""} />
    </div>
  );
}
