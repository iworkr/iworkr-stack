"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  AlertTriangle,
  Clock,
  Shield,
  X,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
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

/* ── Severity Badge ───────────────────────────────────── */

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} border ${config.border}`}>
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

/* ── Create Incident Modal ────────────────────────────── */

function CreateIncidentModal({
  open,
  onClose,
  orgId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
}) {
  const user = useAuthStore((s) => s.user);
  const createIncident = useIncidentsStore((s) => s.createIncident);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("other");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [location, setLocation] = useState("");
  const [immediateActions, setImmediateActions] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description || !user?.id) return;
    setSaving(true);

    const params: CreateIncidentParams = {
      organization_id: orgId,
      worker_id: user.id,
      category,
      severity,
      title,
      description,
      location: location || undefined,
      occurred_at: new Date().toISOString(),
      immediate_actions: immediateActions || undefined,
    };

    await createIncident(params);
    setSaving(false);
    setTitle(""); setDescription(""); setCategory("other"); setSeverity("medium");
    setLocation(""); setImmediateActions("");
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Report Incident</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the incident"
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500/50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-rose-500/50">
                  {(Object.entries(CATEGORY_LABELS) as [IncidentCategory, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Severity</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-rose-500/50">
                  {(Object.entries(SEVERITY_CONFIG) as [IncidentSeverity, { label: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                placeholder="Detailed account of what happened..."
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where did it occur?"
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500/50" />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Immediate Actions Taken</label>
              <textarea value={immediateActions} onChange={(e) => setImmediateActions(e.target.value)} rows={2}
                placeholder="What was done immediately in response?"
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--card-border)]">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
            <button onClick={handleSubmit} disabled={!title || !description || saving}
              className="px-4 py-2 text-sm font-medium bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? "Reporting..." : "Report Incident"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function IncidentsPage() {
  const { orgId } = useOrg();
  const loading = useIncidentsStore((s) => s.loading);
  const severityFilter = useIncidentsStore((s) => s.severityFilter);
  const statusFilter = useIncidentsStore((s) => s.statusFilter);
  const categoryFilter = useIncidentsStore((s) => s.categoryFilter);
  const setSeverityFilter = useIncidentsStore((s) => s.setSeverityFilter);
  const setStatusFilter = useIncidentsStore((s) => s.setStatusFilter);
  const setCategoryFilter = useIncidentsStore((s) => s.setCategoryFilter);
  const incidents = useFilteredIncidents();
  const allIncidents = useIncidentsStore((s) => s.incidents);
  const loadFromServer = useIncidentsStore((s) => s.loadFromServer);

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (orgId) loadFromServer(orgId);
  }, [orgId, loadFromServer]);

  const searched = useMemo(() => {
    if (!search) return incidents;
    const q = search.toLowerCase();
    return incidents.filter(
      (i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || (i.worker_name?.toLowerCase().includes(q))
    );
  }, [incidents, search]);

  // Stats
  const stats = useMemo(() => ({
    total: allIncidents.length,
    open: allIncidents.filter((i) => !["resolved", "closed"].includes(i.status)).length,
    critical: allIncidents.filter((i) => i.severity === "critical" && !["resolved", "closed"].includes(i.status)).length,
    thisMonth: allIncidents.filter((i) => {
      const d = new Date(i.occurred_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  }), [allIncidents]);

  return (
    <>
      <div className="stealth-noise min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="stealth-overline mb-1">GOVERNANCE</p>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">Incident Register</h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Report, track, and resolve incidents and hazards.
              </p>
            </div>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors">
              <Plus className="w-4 h-4" />
              Report Incident
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Incidents", value: stats.total, icon: AlertTriangle, color: "text-[var(--text-primary)]" },
              { label: "Open", value: stats.open, icon: Clock, color: "text-amber-400" },
              { label: "Critical Open", value: stats.critical, icon: Shield, color: "text-rose-400" },
              { label: "This Month", value: stats.thisMonth, icon: AlertTriangle, color: "text-sky-400" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${card.color}`} />
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search incidents..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500/50" />
            </div>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | "all")}
              className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none">
              <option value="all">All Severity</option>
              {(Object.entries(SEVERITY_CONFIG) as [IncidentSeverity, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | "all")}
              className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none">
              <option value="all">All Status</option>
              {(Object.entries(STATUS_CONFIG) as [IncidentStatus, { label: string }][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as IncidentCategory | "all")}
              className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none">
              <option value="all">All Categories</option>
              {(Object.entries(CATEGORY_LABELS) as [IncidentCategory, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Incidents List */}
          <div className="space-y-3">
            {loading && incidents.length === 0 && (
              <div className="text-center py-12 text-sm text-[var(--text-muted)]">Loading incidents...</div>
            )}
            {!loading && searched.length === 0 && (
              <div className="text-center py-16">
                <AlertTriangle className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No incidents found</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {severityFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all"
                    ? "Try adjusting your filters."
                    : "No incidents have been reported yet."}
                </p>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {searched.map((incident, idx) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ delay: idx * 0.02 }}
                  className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-5 hover:border-[var(--card-border-hover)] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{incident.title}</h3>
                        <SeverityBadge severity={incident.severity} />
                        <StatusBadge status={incident.status} />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{incident.description}</p>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-4">
                      {new Date(incident.occurred_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--subtle-bg)]">
                      {CATEGORY_LABELS[incident.category]}
                    </span>
                    {incident.worker_name && <span>Reported by: {incident.worker_name}</span>}
                    {incident.location && <span>📍 {incident.location}</span>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <CreateIncidentModal open={createOpen} onClose={() => setCreateOpen(false)} orgId={orgId ?? ""} />
    </>
  );
}
