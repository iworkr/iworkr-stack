/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Project Hearth — Family & Participant Portal (Admin Dashboard View)
 * Allows org admins to:
 *  - View and manage participant nominees
 *  - See live client portal data (shifts awaiting approval, budget telemetry)
 *  - Invite family members to their portal
 *  - Monitor client approvals
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Users, Heart, DollarSign, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, Plus, Mail, Shield, Loader2, X, Send, RefreshCw,
  TrendingUp, TrendingDown, Minus, Eye, Bell, UserCheck,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";
import {
  getPortalDashboard,
  getPortalFunds,
  inviteFamilyPortalMember,
  getPortalAdminOverview,
} from "@/app/actions/portal-family";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  participant_id: string;
  participant_name: string;
  relationship_type: string;
  permissions: Record<string, boolean>;
  organization_id: string;
}

interface BudgetTelemetry {
  total_budget: number;
  invoiced: number;
  unbilled_wip: number;
  remaining: number;
  burn_rate_pct: number;
  pro_rata_pct: number;
  burn_status: "on_track" | "over_burning" | "critical" | "depleted";
  plan_start: string | null;
  plan_end: string | null;
  next_shift: {
    id: string;
    start_time: string;
    end_time: string;
    worker_name: string;
    worker_avatar: string | null;
    worker_first_name: string;
    public_note: string | null;
  } | null;
}

interface PortalShift {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  shift_note: string | null;
  client_approved: boolean;
  client_approved_at: string | null;
  worker_name: string | null;
  worker_avatar: string | null;
  billable_hours: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function getInitials(name: string): string {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getBurnColor(status: string): string {
  switch (status) {
    case "on_track": return "text-emerald-400";
    case "over_burning": return "text-amber-400";
    case "critical": case "depleted": return "text-rose-400";
    default: return "text-zinc-400";
  }
}

function getBurnBorderColor(status: string): string {
  switch (status) {
    case "on_track": return "border-emerald-500/30";
    case "over_burning": return "border-amber-500/30";
    case "critical": case "depleted": return "border-rose-500/30 animate-pulse";
    default: return "border-zinc-700";
  }
}

// ─── Budget Gauge ─────────────────────────────────────────────────────────────

function BudgetGauge({ telemetry }: { telemetry: BudgetTelemetry }) {
  const burnPct = Math.min(telemetry.burn_rate_pct, 100);
  const proPct = Math.min(telemetry.pro_rata_pct, 100);
  const color = getBurnColor(telemetry.burn_status);
  const circumference = 2 * Math.PI * 44;
  const burnOffset = circumference - (burnPct / 100) * circumference;
  const proOffset = circumference - (proPct / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="110" height="110" viewBox="0 0 110 110" className="-rotate-90">
        {/* Track */}
        <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
        {/* Pro-rata marker */}
        <circle cx="55" cy="55" r="44" fill="none" stroke="rgba(255,255,255,0.15)"
          strokeWidth="3" strokeDasharray={`${circumference}`} strokeDashoffset={proOffset}
          strokeLinecap="round" />
        {/* Burn rate fill */}
        <circle cx="55" cy="55" r="44" fill="none"
          stroke={telemetry.burn_status === "on_track" ? "#10B981" :
            telemetry.burn_status === "over_burning" ? "#F59E0B" : "#F43F5E"}
          strokeWidth="8" strokeDasharray={`${circumference}`} strokeDashoffset={burnOffset}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[16px] font-bold tabular-nums ${color}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {burnPct.toFixed(0)}%
        </span>
        <span className="text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">burned</span>
      </div>
    </div>
  );
}

// ─── Who Is Coming Card ───────────────────────────────────────────────────────

function WhoIsComingCard({ shift }: { shift: BudgetTelemetry["next_shift"] }) {
  if (!shift) {
    return (
      <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-4 flex items-center justify-center h-24">
        <p className="text-[11px] text-zinc-600">No upcoming shifts scheduled</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-zinc-900/50 p-4 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent" />
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-3">Next Scheduled Support</p>
      <div className="flex items-center gap-3">
        {shift.worker_avatar ? (
          <img src={shift.worker_avatar} alt={shift.worker_name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[12px] font-semibold text-zinc-400">
            {getInitials(shift.worker_name || "?")}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-zinc-100">{shift.worker_first_name || shift.worker_name}</p>
          <p className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#ffffff" }}>
            {formatDate(shift.start_time)} · {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`w-1.5 h-1.5 rounded-full ${s <= 4 ? "bg-amber-400" : "bg-zinc-700"}`} />
            ))}
          </div>
          <p className="text-[9px] text-zinc-600 mt-0.5">Rating</p>
        </div>
      </div>
      {shift.public_note && (
        <p className="text-[11px] text-zinc-500 italic mt-2 border-t border-white/5 pt-2">
          "{shift.public_note}"
        </p>
      )}
    </motion.div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  participantId,
  participantName,
  onClose,
}: {
  participantId: string;
  participantName: string;
  onClose: () => void;
}) {
  const { addToast } = useToastStore();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("primary_guardian");
  const [canApprove, setCanApprove] = useState(true);
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleInvite() {
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const result = await inviteFamilyPortalMember({
        participant_id: participantId,
        email: email.trim(),
        display_name: name.trim() || undefined,
        relationship_type: relationship,
        permissions: {
          can_approve_timesheets: canApprove,
          can_view_financials: canViewFinancials,
          can_view_medical: false,
        },
      });
      if (result && (result as any).error) throw new Error((result as any).error);
      addToast(`Invitation sent to ${email}`);
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Invite failed", undefined, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-[420px] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-100">Invite Family Member</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Nominee for {participantName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Email Address *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="family@example.com"
              className="w-full h-8 px-2.5 bg-zinc-950 border border-white/5 rounded text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Mrs. Eleanor Howard"
              className="w-full h-8 px-2.5 bg-zinc-950 border border-white/5 rounded text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-white/20" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Relationship</label>
            <select value={relationship} onChange={e => setRelationship(e.target.value)}
              className="w-full h-8 px-2.5 bg-zinc-950 border border-white/5 rounded text-[12px] text-zinc-200 focus:outline-none focus:border-white/20">
              <option value="primary_guardian">Primary Guardian</option>
              <option value="secondary_guardian">Secondary Guardian</option>
              <option value="self">Self (Participant)</option>
              <option value="external_coordinator">Plan Coordinator</option>
            </select>
          </div>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={canApprove} onChange={e => setCanApprove(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/10 accent-emerald-500" />
              <span className="text-[11px] text-zinc-400">Can approve timesheets</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={canViewFinancials} onChange={e => setCanViewFinancials(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/10 accent-emerald-500" />
              <span className="text-[11px] text-zinc-400">Can view financials</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 h-8 text-[12px] text-zinc-500 border border-white/5 rounded hover:text-zinc-300 transition-colors">
            Cancel
          </button>
          <button onClick={handleInvite} disabled={submitting || !email.trim()}
            className="flex-1 h-8 text-[12px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Send Invite
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Participant Card ─────────────────────────────────────────────────────────

function ParticipantPortalCard({
  participant,
  onInvite,
}: {
  participant: Participant;
  onInvite: (id: string, name: string) => void;
}) {
  const { orgId } = useOrg();
  const [telemetry, setTelemetry] = useState<BudgetTelemetry | null>(null);
  const [shifts, setShifts] = useState<PortalShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [dash, funds] = await Promise.all([
          getPortalDashboard(participant.participant_id),
          getPortalFunds(participant.participant_id),
        ]);
        if (funds && !(funds as any).error) {
          setTelemetry(funds as any);
        }
        if (dash && (dash as any).upcoming_shifts) {
          setShifts((dash as any).upcoming_shifts);
        }
      } catch {
        // Silently handle — data not available
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [participant.participant_id, orgId]);

  const pendingApprovals = shifts.filter(s => !s.client_approved && s.status === "complete").length;

  return (
    <motion.div
      layout
      className="border border-white/5 rounded-xl bg-[#0A0A0A] overflow-hidden"
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.01] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/5 flex items-center justify-center text-[11px] font-semibold text-zinc-300">
            {getInitials(participant.participant_name)}
          </div>
          <div>
            <p className="text-[13px] font-medium text-zinc-200">{participant.participant_name}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {participant.relationship_type.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pendingApprovals > 0 && (
            <div className="flex items-center gap-1 h-5 px-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
              <Bell className="w-2.5 h-2.5" />
              <span className="text-[9px] font-semibold">{pendingApprovals} awaiting approval</span>
            </div>
          )}
          {telemetry && (
            <div className={`h-5 px-2 rounded-full text-[9px] font-semibold flex items-center border ${getBurnBorderColor(telemetry.burn_status)} ${getBurnColor(telemetry.burn_status)} bg-transparent`}>
              {telemetry.burn_status.replace(/_/g, " ")}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onInvite(participant.participant_id, participant.participant_name); }}
            className="h-6 px-2.5 flex items-center gap-1 text-[10px] font-medium text-zinc-500 border border-white/5 rounded hover:text-zinc-300 hover:border-white/10 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
            Add Nominee
          </button>
          <ChevronRight className={`w-4 h-4 text-zinc-700 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />
                <span className="text-xs text-zinc-600">Loading portal data…</span>
              </div>
            ) : (
              <div className="px-5 py-4 grid grid-cols-3 gap-4">
                {/* Budget telemetry */}
                <div className="col-span-1">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-3">Budget Tracker</p>
                  {telemetry ? (
                    <div className="space-y-3">
                      <BudgetGauge telemetry={telemetry} />
                      <div className="space-y-1.5">
                        {[
                          { label: "Total Budget", value: formatAUD(telemetry.total_budget), color: "text-zinc-300" },
                          { label: "Invoiced", value: formatAUD(telemetry.invoiced), color: "text-zinc-400" },
                          { label: "Unbilled WIP", value: formatAUD(telemetry.unbilled_wip), color: "text-amber-400" },
                          { label: "Remaining", value: formatAUD(telemetry.remaining), color: getBurnColor(telemetry.burn_status) },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-[10px] text-zinc-600">{label}</span>
                            <span className={`text-[11px] font-medium tabular-nums ${color}`}
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {value}
                            </span>
                          </div>
                        ))}
                        <div className="border-t border-white/5 pt-1.5 flex justify-between">
                          <span className="text-[10px] text-zinc-600">Burn vs Pro-Rata</span>
                          <div className="flex items-center gap-1">
                            {telemetry.burn_rate_pct > telemetry.pro_rata_pct ? (
                              <TrendingUp className="w-3 h-3 text-rose-400" />
                            ) : telemetry.burn_rate_pct < telemetry.pro_rata_pct - 5 ? (
                              <TrendingDown className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Minus className="w-3 h-3 text-zinc-500" />
                            )}
                            <span className={`text-[11px] font-medium tabular-nums ${getBurnColor(telemetry.burn_status)}`}
                              style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {telemetry.burn_rate_pct}% / {telemetry.pro_rata_pct}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-700 italic">No service agreement found.</p>
                  )}
                </div>

                {/* Who is coming */}
                <div className="col-span-1">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-3">Who Is Coming</p>
                  <WhoIsComingCard shift={telemetry?.next_shift || null} />
                </div>

                {/* Pending approvals */}
                <div className="col-span-1">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-3">Recent Shifts</p>
                  <div className="space-y-1.5">
                    {shifts.slice(0, 5).map(shift => (
                      <div key={shift.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/50 border border-white/[0.04]">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-zinc-300 truncate">
                            {shift.worker_name || "Worker"}
                          </p>
                          <p className="text-[9px] text-zinc-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {formatDate(shift.start_time)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {shift.billable_hours && (
                            <span className="text-[9px] text-zinc-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {Number(shift.billable_hours).toFixed(1)}h
                            </span>
                          )}
                          {shift.client_approved ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          ) : shift.status === "complete" ? (
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Clock className="w-3 h-3 text-zinc-600" />
                          )}
                        </div>
                      </div>
                    ))}
                    {shifts.length === 0 && (
                      <p className="text-[11px] text-zinc-700 italic">No recent shifts</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortalAdminPage() {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPortalAdminOverview(orgId);
      if (data && (data as any).linked_participants) {
        setParticipants((data as any).linked_participants);
      }
    } catch (err) {
      addToast("Failed to load portal data", undefined, "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  // Telemetry totals
  const totalParticipants = participants.length;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Command Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 sticky top-0 bg-[#050505]/95 backdrop-blur-sm z-40">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-600 uppercase tracking-widest">Client Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startTransition(() => load())}
            disabled={isPending || loading}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] text-zinc-400 border border-white/5 rounded hover:border-white/10 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Telemetry ribbon */}
      <div className="border-b border-white/5 bg-zinc-950/30">
        <div className="flex items-center px-6 h-16 gap-8">
          {[
            { label: "Participants", value: String(totalParticipants), icon: Users },
            { label: "Portal Access", value: "Active", icon: Shield },
            { label: "Awaiting Approval", value: "—", icon: Bell },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="w-3.5 h-3.5 text-zinc-700" />
              <div>
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest block">{label}</span>
                <span className="text-[14px] font-medium text-white">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <div className="mx-6 mt-4 mb-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
        <Eye className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] text-emerald-400 font-medium">Hearth Client Portal — Active</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Families access their portal at <span className="text-zinc-300">www.iworkrapp.com/portal</span>.
            All shift notes are privacy-filtered — internal notes are never exposed.
            Timesheet approvals flow directly into the payroll engine.
          </p>
        </div>
      </div>

      {/* Participants list */}
      <div className="px-6 py-2 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            <span className="text-sm text-zinc-600">Loading participant portals…</span>
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No participants with portal access yet.</p>
            <p className="text-xs text-zinc-700 mt-1">
              Go to a participant profile and invite their family members to the portal.
            </p>
          </div>
        ) : (
          participants.map(participant => (
            <ParticipantPortalCard
              key={participant.participant_id}
              participant={participant}
              onInvite={(id, name) => setInviteTarget({ id, name })}
            />
          ))
        )}
      </div>

      {/* Invite modal */}
      <AnimatePresence>
        {inviteTarget && (
          <InviteModal
            participantId={inviteTarget.id}
            participantName={inviteTarget.name}
            onClose={() => setInviteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
