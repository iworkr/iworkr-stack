/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search, Filter, ShieldCheck, X, Copy,
  Loader2, Lock, Smartphone, ExternalLink,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createAuditorPortalAction,
  listAuditorPortalsAction,
  listIroncladScopeOptionsAction,
  revokeAuditorPortalAction,
  getAuditorPortalTelemetryAction,
  getAuditTrailAction,
} from "@/app/actions/care-ironclad";

/* ═══════════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════════ */

type PillTab = "active" | "historical";
type Option = { id: string; name: string };
type Portal = {
  id: string;
  title: string | null;
  auditor_email: string;
  auditor_phone: string | null;
  access_token: string;
  scope_date_start: string;
  scope_date_end: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
  auditor_access_logs?: { count: number }[];
};
type AuditLog = {
  id: string;
  action: string;
  target_record_id: string | null;
  ip_address: string | null;
  created_at: string;
};
interface Telemetry {
  active_data_rooms: number;
  evidence_files_linked: number;
  last_auditor_login: string;
  security_exceptions: number;
}

const PILL_TABS: { id: PillTab; label: string }[] = [
  { id: "active", label: "Active Data Rooms" },
  { id: "historical", label: "Historical / Revoked" },
];

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatTime(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 19);
  }
}

function portalStatus(p: Portal): "active" | "expired" | "revoked" {
  if (p.is_revoked) return "revoked";
  if (new Date(p.expires_at) < new Date()) return "expired";
  return "active";
}

function getInitials(email: string) {
  const parts = email.split("@")[0].split(/[._-]/);
  return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    view_file: "Viewed evidence file",
    download: "Downloaded document",
    login: "Logged into data room",
    otp_failed: "Failed OTP verification",
    auth_failed: "Authentication failed",
    view_participant: "Viewed participant record",
    view_staff: "Viewed staff profile",
  };
  return map[action] || action.replace(/_/g, " ");
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════════ */

function GhostBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    expired: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    revoked: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const cls = map[status] || map.expired;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {status.toUpperCase()}
    </span>
  );
}

function MetricNode({ label, value, colorClass, alert }: { label: string; value: string | number; colorClass?: string; alert?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        {alert && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
        )}
        <span className={`font-mono text-[20px] leading-none ${colorClass || "text-white"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5 h-16 animate-pulse">
      <td className="px-8 py-3"><div className="space-y-1.5"><div className="h-3 w-40 rounded bg-white/5" /><div className="h-2 w-32 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-white/5" /><div className="h-3 w-36 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="h-3 w-28 rounded bg-white/5" /></td>
      <td className="py-3"><div className="h-5 w-16 rounded-full bg-white/5" /></td>
      <td className="py-3 pr-8"><div className="h-5 w-24 rounded bg-white/5" /></td>
    </tr>
  );
}

function EmptyState() {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/5 bg-zinc-950/50 mx-8 mt-8">
      <Lock size={40} strokeWidth={0.8} className="mb-4 text-zinc-800" />
      <p className="text-[15px] font-medium text-white">No active auditor portals.</p>
      <p className="mt-1 max-w-md text-center text-[13px] text-zinc-500">
        Your workspace data is currently isolated. Provision a portal to grant time-bound, read-only access to external reviewers.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide-Over: Provision Portal
   ═══════════════════════════════════════════════════════════════════ */

function ProvisionPortalSlideOver({
  orgId,
  participants,
  staff,
  onClose,
  onCreated,
}: {
  orgId: string;
  participants: Option[];
  staff: Option[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [auditorEmail, setAuditorEmail] = useState("");
  const [auditorPhone, setAuditorPhone] = useState("");
  const [passcode, setPasscode] = useState("");
  const [title, setTitle] = useState("NDIS Sample Audit Data Room");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = auditorEmail && auditorPhone && passcode && dateStart && dateEnd && selectedParticipants.length > 0 && selectedStaff.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createAuditorPortalAction({
        organization_id: orgId,
        auditor_email: auditorEmail,
        auditor_phone: auditorPhone,
        passcode,
        scope_date_start: dateStart,
        scope_date_end: dateEnd,
        allowed_participant_ids: selectedParticipants,
        allowed_staff_ids: selectedStaff,
        title,
        expires_in_days: 14,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      console.error("[overseer] provision failed:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItem = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 500 }}
        animate={{ x: 0 }}
        exit={{ x: 500 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[500px] flex-col border-l border-white/5 bg-zinc-950 shadow-2xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <h3 className="text-[16px] font-medium text-white">Configure Data Room</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Portal Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          {/* Auditor Email */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Auditor Email</label>
            <input value={auditorEmail} onChange={(e) => setAuditorEmail(e.target.value)} type="email" placeholder="auditor@ndis.gov.au" className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          {/* Mobile */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Auditor Mobile (E.164)</label>
            <input value={auditorPhone} onChange={(e) => setAuditorPhone(e.target.value)} placeholder="+61400000000" className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          {/* Passcode */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Passcode (shared out-of-band)</label>
            <input value={passcode} onChange={(e) => setPasscode(e.target.value)} type="password" className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
          </div>
          {/* Scope Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Scope Start</label>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Scope End</label>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all" />
            </div>
          </div>
          {/* Participant Sample */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Participant Sample</label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/10 bg-zinc-900 p-2">
              {participants.length === 0 ? (
                <p className="px-2 py-2 text-xs text-zinc-600">No participants available</p>
              ) : (
                participants.map((p) => (
                  <button key={p.id} onClick={() => toggleItem(selectedParticipants, setSelectedParticipants, p.id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors ${selectedParticipants.includes(p.id) ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400 hover:bg-white/5"}`}>
                    <span>{p.name}</span>
                    {selectedParticipants.includes(p.id) && <span className="font-mono text-[9px] text-emerald-400">SELECTED</span>}
                  </button>
                ))
              )}
            </div>
          </div>
          {/* Staff Sample */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Staff Sample</label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/10 bg-zinc-900 p-2">
              {staff.length === 0 ? (
                <p className="px-2 py-2 text-xs text-zinc-600">No staff available</p>
              ) : (
                staff.map((s) => (
                  <button key={s.id} onClick={() => toggleItem(selectedStaff, setSelectedStaff, s.id)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors ${selectedStaff.includes(s.id) ? "bg-emerald-500/15 text-emerald-300" : "text-zinc-400 hover:bg-white/5"}`}>
                    <span>{s.name}</span>
                    {selectedStaff.includes(s.id) && <span className="font-mono text-[9px] text-emerald-400">SELECTED</span>}
                  </button>
                ))
              )}
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">Vault links require passcode + SMS OTP before data room access.</p>
        </div>

        <div className="border-t border-white/5 bg-[#050505] p-6">
          <button onClick={handleSubmit} disabled={!canSubmit || submitting} className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Generate Secure Link
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Slide-Over: Audit Trail
   ═══════════════════════════════════════════════════════════════════ */

function AuditTrailSlideOver({
  portal,
  onClose,
}: {
  portal: Portal;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAuditTrailAction(portal.id)
      .then((res) => setLogs(res as AuditLog[]))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [portal.id]);

  const status = portalStatus(portal);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: 500 }}
        animate={{ x: 0 }}
        exit={{ x: 500 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-50 flex w-[500px] flex-col border-l border-white/5 bg-zinc-950 shadow-2xl"
      >
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <div>
            <h3 className="text-[14px] font-medium text-white">{portal.title || "Auditor Portal"}</h3>
            <p className="text-[11px] text-zinc-500">{portal.auditor_email}</p>
          </div>
          <div className="flex items-center gap-2">
            <GhostBadge status={status} />
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-300"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Portal Details */}
          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-4 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-zinc-500">Scope</span>
              <span className="font-mono text-[12px] text-white">{formatDate(portal.scope_date_start)} — {formatDate(portal.scope_date_end)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Expires</span>
              <span className="font-mono text-[12px] text-white">{formatDate(portal.expires_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Created</span>
              <span className="font-mono text-[12px] text-zinc-400">{formatDate(portal.created_at)}</span>
            </div>
          </div>

          {/* Access Log */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Audit Access Trail</p>
            {loading ? (
              <div className="flex items-center gap-2 py-8">
                <Loader2 size={14} className="animate-spin text-zinc-500" />
                <span className="text-xs text-zinc-500">Loading access logs...</span>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-[12px] text-zinc-500">No access activity recorded yet.</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-white/[0.02] transition-colors">
                    <span className="font-mono text-[10px] text-zinc-600 mt-0.5 whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </span>
                    <div className="flex-1">
                      <p className="font-mono text-[11px] text-zinc-400">
                        {actionLabel(log.action)}
                        {log.target_record_id && (
                          <span className="text-zinc-600"> · {log.target_record_id.slice(0, 8)}</span>
                        )}
                      </p>
                      {log.ip_address && (
                        <p className="font-mono text-[10px] text-zinc-700">{log.ip_address}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ComplianceAuditsPage() {
  const { orgId, loading: orgLoading } = useOrg();

  const [activeTab, setActiveTab] = useState<PillTab>("active");
  const [search, setSearch] = useState("");
  const [portals, setPortals] = useState<Portal[]>([]);
  const [participants, setParticipants] = useState<Option[]>([]);
  const [staff, setStaff] = useState<Option[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry>({
    active_data_rooms: 0,
    evidence_files_linked: 0,
    last_auditor_login: "—",
    security_exceptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showProvisionSlideOver, setShowProvisionSlideOver] = useState(false);
  const [trailPortal, setTrailPortal] = useState<Portal | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState("");

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [portalData, scopeOpts, telemetryData] = await Promise.all([
        listAuditorPortalsAction(orgId),
        listIroncladScopeOptionsAction(orgId),
        getAuditorPortalTelemetryAction(orgId),
      ]);
      setPortals(portalData as Portal[]);
      setParticipants(scopeOpts.participants);
      setStaff(scopeOpts.staff);
      setTelemetry(telemetryData);
    } catch (e: any) {
      console.error("[overseer] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId, loadData]);

  // Filter portals by tab + search
  const filteredPortals = useMemo(() => {
    const now = new Date();
    let filtered = portals;

    if (activeTab === "active") {
      filtered = filtered.filter((p) => !p.is_revoked && new Date(p.expires_at) > now);
    } else {
      filtered = filtered.filter((p) => p.is_revoked || new Date(p.expires_at) <= now);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          p.auditor_email.toLowerCase().includes(q) ||
          (p.auditor_phone || "").includes(q)
      );
    }

    return filtered;
  }, [portals, activeTab, search]);

  const handleRevoke = async (portalId: string) => {
    if (!orgId) return;
    setRevoking(portalId);
    try {
      await revokeAuditorPortalAction({ portal_id: portalId, organization_id: orgId });
      loadData();
    } catch (e: any) {
      console.error("[overseer] revoke failed:", e);
    } finally {
      setRevoking(null);
    }
  };

  const portalBase = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/vault`;
  }, []);

  if (orgLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#050505]">
      {/* Copy toast */}
      <AnimatePresence>
        {copyMsg && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="fixed top-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-400 shadow-lg"
          >
            {copyMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ COMMAND HEADER (h-14) ═══ */}
      <div className="flex h-14 items-center justify-between border-b border-white/5 bg-[#050505] px-8">
        <div className="flex items-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">GOVERNANCE</span>
          <div className="mx-4 h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-zinc-900/50 p-1">
            {PILL_TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-md px-3 py-1.5 text-xs transition-colors ${activeTab === tab.id ? "bg-white/10 text-white font-medium shadow-sm" : "text-zinc-400 hover:text-zinc-200 cursor-pointer"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-8 w-64 items-center rounded-md border border-white/5 bg-zinc-900 px-3">
            <Search className="h-3 w-3 text-zinc-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search auditor, scope..." className="ml-2 w-full bg-transparent text-xs text-white placeholder:text-zinc-600 outline-none" />
          </div>
          <button className="flex h-8 items-center gap-1.5 rounded-md border border-white/5 bg-transparent px-3 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
            <Filter className="h-3 w-3" />
            Filters
          </button>
          <button onClick={() => setShowProvisionSlideOver(true)} className="ml-3 flex h-8 items-center gap-1.5 rounded-md bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-zinc-200">
            <ShieldCheck className="h-3 w-3" />
            Provision Portal
          </button>
        </div>
      </div>

      {/* ═══ TELEMETRY RIBBON (h-16) ═══ */}
      <div className="flex h-16 w-full items-center overflow-x-auto border-b border-white/5 bg-zinc-950/30 px-8">
        <MetricNode label="ACTIVE DATA ROOMS" value={telemetry.active_data_rooms} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode label="EVIDENCE FILES LINKED" value={telemetry.evidence_files_linked} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode label="LAST AUDITOR LOGIN" value={telemetry.last_auditor_login} />
        <div className="mx-6 h-8 w-px bg-white/5" />
        <MetricNode label="SECURITY EXCEPTIONS" value={telemetry.security_exceptions} colorClass={telemetry.security_exceptions > 0 ? "text-rose-500 font-bold" : "text-white"} alert={telemetry.security_exceptions > 0} />
      </div>

      {/* ═══ DATA GRID ═══ */}
      <div className="flex-1 overflow-y-auto px-8 mt-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="w-[30%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">PORTAL NAME & SCOPE</th>
              <th className="w-[25%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">AUDITOR IDENTITY</th>
              <th className="w-[20%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">SECURITY LAYER</th>
              <th className="w-[15%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">STATUS</th>
              <th className="w-[10%] text-[10px] font-semibold uppercase tracking-widest text-zinc-500">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
              </>
            ) : filteredPortals.length === 0 ? (
              <tr><td colSpan={5}><EmptyState /></td></tr>
            ) : (
              filteredPortals.map((portal, i) => {
                const status = portalStatus(portal);
                const link = `${portalBase}/${portal.access_token}`;
                return (
                  <motion.tr
                    key={portal.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.25 }}
                    onClick={() => setTrailPortal(portal)}
                    className="group cursor-pointer border-b border-white/5 transition-colors h-16 hover:bg-white/[0.02]"
                  >
                    {/* PORTAL NAME & SCOPE */}
                    <td className="py-3">
                      <div>
                        <p className="text-[14px] font-medium text-zinc-100">{portal.title || "Auditor Portal"}</p>
                        <p className="font-mono text-[11px] text-zinc-500">
                          {formatDate(portal.scope_date_start)} — {formatDate(portal.scope_date_end)}
                        </p>
                      </div>
                    </td>

                    {/* AUDITOR IDENTITY */}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400">
                          {getInitials(portal.auditor_email)}
                        </div>
                        <span className="text-[13px] text-zinc-300">{portal.auditor_email}</span>
                      </div>
                    </td>

                    {/* SECURITY LAYER */}
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <Smartphone className="h-3 w-3 text-zinc-500" />
                        <span className="text-[12px] text-zinc-400">SMS OTP + Passcode</span>
                      </div>
                    </td>

                    {/* STATUS */}
                    <td className="py-3">
                      <GhostBadge status={status} />
                    </td>

                    {/* ACTION */}
                    <td className="py-3 pr-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(link);
                            setCopyMsg("Portal link copied.");
                            setTimeout(() => setCopyMsg(""), 2000);
                          }}
                          className="h-6 w-6 flex items-center justify-center rounded text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                          title="Copy link"
                        >
                          <Copy size={12} />
                        </button>
                        <a href={link} target="_blank" rel="noreferrer" className="h-6 w-6 flex items-center justify-center rounded text-zinc-600 hover:bg-white/5 hover:text-zinc-300" title="Open portal">
                          <ExternalLink size={12} />
                        </a>
                        {status === "active" && (
                          <button
                            onClick={() => handleRevoke(portal.id)}
                            disabled={revoking === portal.id}
                            className="h-6 rounded-md px-2 text-[10px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
                          >
                            {revoking === portal.id ? <Loader2 size={10} className="animate-spin" /> : "Revoke"}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ SLIDE-OVERS ═══ */}
      <AnimatePresence>
        {showProvisionSlideOver && orgId && (
          <ProvisionPortalSlideOver orgId={orgId} participants={participants} staff={staff} onClose={() => setShowProvisionSlideOver(false)} onCreated={loadData} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {trailPortal && (
          <AuditTrailSlideOver portal={trailPortal} onClose={() => setTrailPortal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
