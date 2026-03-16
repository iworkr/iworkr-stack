"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Aegis — SIRS Triage Dashboard
   Obsidian Shield: Defcon coloring, SLA countdown timers,
   Kanban workflow, investigation drawer
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  Clock,
  AlertTriangle,
  ChevronRight,
  Search,
  RefreshCw,
  FileText,
  CheckCircle2,
  ArrowDownCircle,
  X,
  Plus,
} from "lucide-react";
import {
  fetchAegisIncidents,
  fetchAegisIncidentDetail,
  updateAegisIncidentStatus,
  upsertInvestigation,
  createCorrectiveAction,
  updateCorrectiveAction,
  type AegisIncident,
  type AegisInvestigation,
  type AegisCorrectiveAction,
} from "@/app/actions/aegis";

// ── Helpers ────────────────────────────────────────────────────

function formatCountdown(deadline: string | null): string {
  if (!deadline) return "—";
  const now = Date.now();
  const target = new Date(deadline).getTime();
  const delta = target - now;
  if (delta <= 0) return "OVERDUE";
  const h = Math.floor(delta / 3600000);
  const m = Math.floor((delta % 3600000) / 60000);
  const s = Math.floor((delta % 60000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

function priorityColor(p: string | null) {
  if (p === "priority_1") return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", dot: "bg-red-500" };
  if (p === "priority_2") return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", dot: "bg-amber-500" };
  return { bg: "bg-zinc-800/50", text: "text-zinc-400", border: "border-zinc-700", dot: "bg-zinc-500" };
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    reported: "New",
    under_review: "Investigating",
    investigation: "Investigating",
    sirs_submitted: "SIRS Submitted",
    resolved: "Resolved",
    closed: "Closed",
  };
  return map[s] || s;
}

const KANBAN_COLUMNS = [
  { key: "new", label: "New", statuses: ["reported"] },
  { key: "investigating", label: "Investigating", statuses: ["under_review", "investigation"] },
  { key: "drafting", label: "Drafting Report", statuses: ["sirs_submitted"] },
  { key: "closed", label: "Closed", statuses: ["resolved", "closed"] },
];

// ── Main Page ──────────────────────────────────────────────────

export default function AegisTriagePage() {
  const [incidents, setIncidents] = useState<AegisIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    const data = await fetchAegisIncidents();
    setIncidents(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadIncidents(); }, [loadIncidents]);

  // Tick every second for SLA countdown
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery) return incidents;
    const q = searchQuery.toLowerCase();
    return incidents.filter(
      (i) =>
        i.title?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        (i.worker as unknown as { full_name?: string })?.full_name?.toLowerCase().includes(q) ||
        (i.participant_profiles as unknown as { preferred_name?: string })?.preferred_name?.toLowerCase().includes(q)
    );
  }, [incidents, searchQuery]);

  // Stats
  const p1Count = incidents.filter((i) => i.sirs_priority === "priority_1" && !["resolved", "closed"].includes(i.status)).length;
  const p2Count = incidents.filter((i) => i.sirs_priority === "priority_2" && !["resolved", "closed"].includes(i.status)).length;
  const overdueCount = incidents.filter(
    (i) => i.sirs_sla_deadline && new Date(i.sirs_sla_deadline).getTime() < Date.now() && !["resolved", "closed"].includes(i.status)
  ).length;

  return (
    <div className="min-h-screen bg-black p-6">
      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
            <ShieldAlert size={20} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Aegis SIRS Triage</h1>
            <p className="text-[11px] text-zinc-500">Incident Management & Compliance Engine</p>
          </div>
        </div>
        <button
          onClick={loadIncidents}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400 transition hover:text-white"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stats Bar ── */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <StatCard label="Total Active" value={incidents.filter((i) => !["resolved", "closed"].includes(i.status)).length} />
        <StatCard label="Priority 1 (24h)" value={p1Count} color="red" />
        <StatCard label="Priority 2 (5d)" value={p2Count} color="amber" />
        <StatCard label="SLA Overdue" value={overdueCount} color="rose" />
      </div>

      {/* ── Search ── */}
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <Search size={14} className="text-zinc-500" />
        <input
          type="text"
          placeholder="Search incidents by title, category, worker, participant..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
        />
      </div>

      {/* ── Kanban Board ── */}
      <div className="grid grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const colIncidents = filtered
            .filter((i) => col.statuses.includes(i.status))
            .sort((a, b) => {
              // SLA-first sorting: closest deadline first
              if (a.sirs_sla_deadline && b.sirs_sla_deadline) {
                return new Date(a.sirs_sla_deadline).getTime() - new Date(b.sirs_sla_deadline).getTime();
              }
              if (a.sirs_sla_deadline) return -1;
              if (b.sirs_sla_deadline) return 1;
              return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
            });

          return (
            <div key={col.key} className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {col.label}
                </span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                  {colIncidents.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                {colIncidents.map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={incident}
                    onClick={() => setSelectedId(incident.id)}
                  />
                ))}
                {colIncidents.length === 0 && (
                  <div className="py-8 text-center text-[11px] text-zinc-700">
                    No incidents
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Investigation Drawer ── */}
      {selectedId && (
        <InvestigationDrawer
          incidentId={selectedId}
          onClose={() => { setSelectedId(null); loadIncidents(); }}
        />
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    red: "text-red-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${colorMap[color ?? ""] ?? "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

// ── Incident Card ──────────────────────────────────────────────

function IncidentCard({ incident, onClick }: { incident: AegisIncident; onClick: () => void }) {
  const pc = priorityColor(incident.sirs_priority);
  const countdown = formatCountdown(incident.sirs_sla_deadline);
  const isOverdue = incident.sirs_sla_deadline && new Date(incident.sirs_sla_deadline).getTime() < Date.now();
  const workerName = (incident.worker as unknown as { full_name?: string })?.full_name ?? "Unknown";
  const participantName = (incident.participant_profiles as unknown as { preferred_name?: string })?.preferred_name;

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border ${pc.border} ${pc.bg} p-3 text-left transition hover:brightness-110`}
    >
      {/* Priority + SLA */}
      {incident.sirs_priority !== "internal_only" && (
        <div className="mb-2 flex items-center justify-between">
          <span className={`flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider ${pc.text}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${pc.dot} ${incident.sirs_priority === "priority_1" ? "animate-pulse" : ""}`} />
            {incident.sirs_priority === "priority_1" ? "P1 — 24h" : "P2 — 5d"}
          </span>
          <span className={`font-mono text-[10px] font-bold ${isOverdue ? "text-red-400 animate-pulse" : pc.text}`}>
            <Clock size={10} className="mr-0.5 inline" />
            {countdown}
          </span>
        </div>
      )}
      {/* Title */}
      <p className="mb-1 text-[12px] font-semibold text-white leading-tight line-clamp-2">
        {incident.title}
      </p>
      {/* Meta */}
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 capitalize">{incident.category}</span>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 capitalize">{incident.severity}</span>
      </div>
      {participantName && (
        <p className="mt-1.5 text-[10px] text-zinc-500">Participant: {participantName}</p>
      )}
      <p className="mt-0.5 text-[10px] text-zinc-600">Reported by {workerName}</p>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════
// INVESTIGATION DRAWER
// ══════════════════════════════════════════════════════════════

function InvestigationDrawer({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"evidence" | "investigation" | "actions">("evidence");
  const [incident, setIncident] = useState<AegisIncident | null>(null);
  const [investigation, setInvestigation] = useState<AegisInvestigation | null>(null);
  const [actions, setActions] = useState<AegisCorrectiveAction[]>([]);
  const [participants, setParticipants] = useState<Array<{ participant_id: string; role: string; notes: string | null; participant_profiles: { preferred_name: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Investigation form state
  const [why1, setWhy1] = useState("");
  const [why2, setWhy2] = useState("");
  const [why3, setWhy3] = useState("");
  const [why4, setWhy4] = useState("");
  const [why5, setWhy5] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [contributing, setContributing] = useState("");

  // Status change state
  const [downgradeReason, setDowngradeReason] = useState("");
  const [sirsRef, setSirsRef] = useState("");

  // CAPA form state
  const [newActionType, setNewActionType] = useState("policy_review");
  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionDue, setNewActionDue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const detail = await fetchAegisIncidentDetail(incidentId);
    setIncident(detail.incident);
    setInvestigation(detail.investigation);
    setActions(detail.actions);
    setParticipants(detail.participants);
    if (detail.investigation) {
      setWhy1(detail.investigation.why_1 ?? "");
      setWhy2(detail.investigation.why_2 ?? "");
      setWhy3(detail.investigation.why_3 ?? "");
      setWhy4(detail.investigation.why_4 ?? "");
      setWhy5(detail.investigation.why_5 ?? "");
      setRootCause(detail.investigation.root_cause_summary ?? "");
      setContributing(detail.investigation.contributing_factors ?? "");
    }
    if (detail.incident?.ndis_sirs_reference_number) {
      setSirsRef(detail.incident.ndis_sirs_reference_number);
    }
    setLoading(false);
  }, [incidentId]);

  useEffect(() => { load(); }, [load]);

  if (loading || !incident) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="text-zinc-400 text-sm">Loading incident...</div>
      </div>
    );
  }

  const pc = priorityColor(incident.sirs_priority);
  const countdown = formatCountdown(incident.sirs_sla_deadline);

  const handleSaveInvestigation = async () => {
    if (!why1 || !why5) {
      alert("The 5 Whys analysis must be completed. Why #1 and Why #5 are required.");
      return;
    }
    setSaving(true);
    try {
      await upsertInvestigation(incidentId, incident.organization_id, {
        why_1: why1,
        why_2: why2,
        why_3: why3,
        why_4: why4,
        why_5: why5,
        root_cause_summary: rootCause,
        contributing_factors: contributing,
      });
      await load();
    } catch (e) {
      alert(`Failed to save: ${e}`);
    }
    setSaving(false);
  };

  const handleStatusChange = async (status: string) => {
    setSaving(true);
    try {
      // Closure gate: verify all CAPA completed and SIRS ref entered
      if (status === "closed") {
        const incompleteActions = actions.filter((a) => a.status !== "completed");
        if (incompleteActions.length > 0) {
          alert(`Cannot close: ${incompleteActions.length} corrective action(s) are not completed.`);
          setSaving(false);
          return;
        }
        if (!investigation?.why_1) {
          alert("Cannot close: Root Cause Analysis has not been completed.");
          setSaving(false);
          return;
        }
        if (incident.sirs_priority !== "internal_only" && !incident.ndis_sirs_reference_number && !sirsRef) {
          alert("Cannot close: NDIS SIRS Reference Number must be entered for reportable incidents.");
          setSaving(false);
          return;
        }
      }
      await updateAegisIncidentStatus(incidentId, status, {
        ndis_sirs_reference_number: sirsRef || undefined,
      });
      await load();
    } catch (e) {
      alert(`Status update failed: ${e}`);
    }
    setSaving(false);
  };

  const handleDowngrade = async () => {
    if (!downgradeReason) {
      alert("Justification for downgrade is mandatory for audit compliance.");
      return;
    }
    setSaving(true);
    try {
      await updateAegisIncidentStatus(incidentId, incident.status, {
        sirs_priority: "internal_only",
        downgrade_justification: downgradeReason,
      });
      await load();
    } catch (e) {
      alert(`Downgrade failed: ${e}`);
    }
    setSaving(false);
  };

  const handleAddAction = async () => {
    if (!newActionDesc || !newActionDue || !investigation?.id) {
      alert("Please fill all fields and ensure the investigation is saved first.");
      return;
    }
    setSaving(true);
    try {
      await createCorrectiveAction({
        investigation_id: investigation.id,
        organization_id: incident.organization_id,
        action_type: newActionType,
        description: newActionDesc,
        due_date: new Date(newActionDue).toISOString(),
      });
      setNewActionDesc("");
      setNewActionDue("");
      await load();
    } catch (e) {
      alert(`Failed to create action: ${e}`);
    }
    setSaving(false);
  };

  const handleCompleteAction = async (actionId: string) => {
    setSaving(true);
    try {
      await updateCorrectiveAction(actionId, { status: "completed" });
      await load();
    } catch (e) {
      alert(`Failed: ${e}`);
    }
    setSaving(false);
  };

  const tabs = [
    { key: "evidence", label: "Evidence", icon: FileText },
    { key: "investigation", label: "Investigation", icon: Search },
    { key: "actions", label: "Actions", icon: CheckCircle2 },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[640px] bg-zinc-950 border-l border-zinc-800 overflow-y-auto">
        {/* Header */}
        <div className={`p-4 border-b ${pc.border} ${pc.bg}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {incident.sirs_priority !== "internal_only" && (
                <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${pc.text} ${pc.bg} ring-1 ring-inset ${pc.border}`}>
                  {incident.sirs_priority === "priority_1" ? "PRIORITY 1 — 24h" : "PRIORITY 2 — 5d"}
                </span>
              )}
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] capitalize text-zinc-400">{incident.severity}</span>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
          </div>

          <h2 className="text-base font-bold text-white mb-1">{incident.title}</h2>

          {/* SLA Timer */}
          {incident.sirs_sla_deadline && (
            <div className={`font-mono text-xl font-bold ${
              new Date(incident.sirs_sla_deadline).getTime() < Date.now()
                ? "text-red-400 animate-pulse"
                : pc.text
            }`}>
              <Clock size={14} className="inline mr-1" />
              {countdown} remaining
            </div>
          )}

          <p className="mt-1 text-[11px] text-zinc-500">
            Occurred: {new Date(incident.occurred_at).toLocaleString()} · Reported: {new Date(incident.reported_at).toLocaleString()} · Status: {statusLabel(incident.status)}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2.5 text-[11px] font-medium border-b-2 transition ${
                activeTab === t.key
                  ? "border-red-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <t.icon size={12} className="inline mr-1" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ── EVIDENCE TAB ── */}
          {activeTab === "evidence" && (
            <div className="space-y-4">
              <Section title="Incident Description">
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
              </Section>

              <Section title="Category & Classification">
                <div className="flex flex-wrap gap-2">
                  <Chip label={`Category: ${incident.category}`} />
                  <Chip label={`Severity: ${incident.severity}`} />
                  <Chip label={`SIRS: ${incident.sirs_priority}`} />
                  {incident.is_emergency_services_involved && <Chip label="Emergency Services Involved" color="red" />}
                  {incident.is_reportable && <Chip label="NDIS Reportable" color="amber" />}
                </div>
              </Section>

              {incident.immediate_actions && (
                <Section title="Immediate Actions Taken">
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{incident.immediate_actions}</p>
                </Section>
              )}

              {incident.location && (
                <Section title="Location">
                  <p className="text-sm text-zinc-400">{incident.location}</p>
                </Section>
              )}

              {participants.length > 0 && (
                <Section title="Involved Participants">
                  {participants.map((p) => (
                    <div key={p.participant_id} className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] capitalize text-zinc-400">{p.role}</span>
                      <span className="text-sm text-zinc-300">{p.participant_profiles?.preferred_name ?? "Unknown"}</span>
                    </div>
                  ))}
                </Section>
              )}

              {incident.photos && incident.photos.length > 0 && (
                <Section title="Photographic Evidence">
                  <div className="flex flex-wrap gap-2">
                    {incident.photos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg border border-zinc-700 bg-zinc-800 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </Section>
              )}

              {/* Downgrade */}
              {incident.sirs_priority !== "internal_only" && (
                <Section title="Administrative Downgrade">
                  <p className="text-[11px] text-zinc-500 mb-2">Downgrading requires a mandatory justification that is permanently logged for NDIS audit compliance.</p>
                  <textarea
                    value={downgradeReason}
                    onChange={(e) => setDowngradeReason(e.target.value)}
                    placeholder="Justification for downgrade (mandatory, permanently logged)..."
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none min-h-[60px]"
                  />
                  <button
                    onClick={handleDowngrade}
                    disabled={saving}
                    className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <ArrowDownCircle size={12} />
                    Downgrade to Internal Only
                  </button>
                </Section>
              )}

              {/* Status workflow */}
              <Section title="Workflow">
                <div className="flex flex-wrap gap-2">
                  {incident.status === "reported" && (
                    <WorkflowButton label="Begin Investigation" onClick={() => handleStatusChange("investigation")} disabled={saving} />
                  )}
                  {(incident.status === "investigation" || incident.status === "under_review") && (
                    <WorkflowButton label="Mark SIRS Submitted" onClick={() => handleStatusChange("sirs_submitted")} disabled={saving} />
                  )}
                  {incident.status === "sirs_submitted" && (
                    <>
                      <input
                        value={sirsRef}
                        onChange={(e) => setSirsRef(e.target.value)}
                        placeholder="NDIS SIRS Reference Number..."
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-300 placeholder:text-zinc-600 outline-none"
                      />
                      <WorkflowButton label="Close Incident" onClick={() => handleStatusChange("closed")} disabled={saving} />
                    </>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* ── INVESTIGATION TAB (5 Whys RCA) ── */}
          {activeTab === "investigation" && (
            <div className="space-y-4">
              <Section title="Root Cause Analysis — The 5 Whys">
                <p className="text-[11px] text-zinc-500 mb-3">
                  The NDIS requires systemic root cause analysis. All 5 levels must be completed before closure.
                </p>
                {[
                  { n: 1, val: why1, set: setWhy1, placeholder: "Why did the incident occur? (Direct cause)" },
                  { n: 2, val: why2, set: setWhy2, placeholder: "Why did that happen? (Contributing factor)" },
                  { n: 3, val: why3, set: setWhy3, placeholder: "Why did that happen? (Systemic factor)" },
                  { n: 4, val: why4, set: setWhy4, placeholder: "Why did that happen? (Organizational factor)" },
                  { n: 5, val: why5, set: setWhy5, placeholder: "Why did that happen? (Root cause)" },
                ].map((w) => (
                  <div key={w.n} className="mb-3">
                    <label className="block mb-1 font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      Why #{w.n} {(w.n === 1 || w.n === 5) && <span className="text-red-400">*</span>}
                    </label>
                    <textarea
                      value={w.val}
                      onChange={(e) => w.set(e.target.value)}
                      placeholder={w.placeholder}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none min-h-[50px]"
                    />
                  </div>
                ))}
              </Section>

              <Section title="Root Cause Summary">
                <textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="Summarize the identified root cause. State facts, not opinions."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none min-h-[80px]"
                />
              </Section>

              <Section title="Contributing Factors">
                <textarea
                  value={contributing}
                  onChange={(e) => setContributing(e.target.value)}
                  placeholder="Environmental, staffing, training, or process factors that contributed..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none min-h-[60px]"
                />
              </Section>

              <button
                onClick={handleSaveInvestigation}
                disabled={saving}
                className="w-full rounded-lg bg-red-500/10 border border-red-500/30 py-2.5 text-[12px] font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
              >
                {saving ? "Saving..." : "Save Investigation"}
              </button>
            </div>
          )}

          {/* ── ACTIONS TAB (CAPA) ── */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              <Section title="Corrective & Preventative Actions">
                {actions.length === 0 && (
                  <p className="text-[11px] text-zinc-600">No corrective actions yet. Save the investigation first, then add actions.</p>
                )}
                {actions.map((a) => (
                  <div key={a.id} className="mb-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400">
                        {a.action_type.replace(/_/g, " ")}
                      </span>
                      <span className={`text-[10px] font-mono ${
                        a.status === "completed" ? "text-emerald-400" : a.status === "overdue" ? "text-red-400" : "text-amber-400"
                      }`}>
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-1">{a.description}</p>
                    <p className="text-[10px] text-zinc-500">Due: {new Date(a.due_date).toLocaleDateString()}</p>
                    {a.status !== "completed" && (
                      <button
                        onClick={() => handleCompleteAction(a.id)}
                        disabled={saving}
                        className="mt-2 flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <CheckCircle2 size={10} />
                        Mark Completed
                      </button>
                    )}
                  </div>
                ))}
              </Section>

              {/* Add new action */}
              {investigation?.id && (
                <Section title="Add Corrective Action">
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value)}
                    className="w-full mb-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-300 outline-none"
                  >
                    <option value="policy_review">Policy Review</option>
                    <option value="staff_retraining">Staff Retraining</option>
                    <option value="facility_maintenance">Facility Maintenance</option>
                    <option value="participant_bsp_update">BSP Update</option>
                    <option value="process_change">Process Change</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea
                    value={newActionDesc}
                    onChange={(e) => setNewActionDesc(e.target.value)}
                    placeholder="Describe the corrective action required..."
                    className="w-full mb-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none min-h-[60px]"
                  />
                  <input
                    type="date"
                    value={newActionDue}
                    onChange={(e) => setNewActionDue(e.target.value)}
                    className="w-full mb-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-300 outline-none"
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <Plus size={12} />
                    Add Action
                  </button>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared UI ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    red: "bg-red-500/10 text-red-400 border-red-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] ${colorMap[color ?? ""] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
      {label}
    </span>
  );
}

function WorkflowButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
    >
      <ChevronRight size={12} />
      {label}
    </button>
  );
}
