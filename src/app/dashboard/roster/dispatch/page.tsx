/**
 * @page /dashboard/roster/dispatch
 * @status COMPLETE
 * @description Roster dispatch with smart-match, shift calendar, and worker assignment
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Users, AlertTriangle, ChevronLeft, ChevronRight,
  Sparkles, Loader2, Shield, User, Clock, Brain, Filter,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchBlueprintShifts,
  fetchBlueprintForParticipant,
  triggerSmartMatch,
  validateWorkerAssignment,
  assignWorkerToShift,
  type BlueprintShift,
  type CareBlueprint,
} from "@/app/actions/care-blueprints";
import { fetchParticipants } from "@/app/actions/participants";
import { getOrgTechnicians } from "@/app/actions/schedule";
import { useToastStore } from "@/components/app/action-toast";

/* ── Helpers ─────────────────────────────────────────────── */

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  unfilled: { bg: "bg-rose-500/5", text: "text-rose-400", border: "border-rose-500/20", label: "Unfilled" },
  published: { bg: "bg-emerald-500/5", text: "text-emerald-400", border: "border-emerald-500/20", label: "Published" },
  scheduled: { bg: "bg-blue-500/5", text: "text-blue-400", border: "border-blue-500/20", label: "Scheduled" },
  complete: { bg: "bg-zinc-500/5", text: "text-zinc-400", border: "border-zinc-500/20", label: "Complete" },
};

/* ── Component ───────────────────────────────────────────── */

export default function RosterDispatchPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [selectedBlueprint, setSelectedBlueprint] = useState<CareBlueprint | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [assigning, setAssigning] = useState<string | null>(null);

  const weekStart = useMemo(() => {
    const d = startOfDay(new Date());
    d.setDate(d.getDate() - d.getDay() + 1 + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Fetch participants with blueprints
  const { data: participantsData } = useQuery({
    queryKey: ["participants", "list", orgId],
    queryFn: () => fetchParticipants(orgId!),
    enabled: !!orgId,
    staleTime: 120_000,
  });
  const participants = participantsData?.data ?? [];

  // Fetch workers
  const { data: workers = [] } = useQuery({
    queryKey: ["technicians", orgId],
    queryFn: () => getOrgTechnicians(orgId!),
    enabled: !!orgId,
    staleTime: 120_000,
  });

  // Fetch blueprint for selected participant
  const { data: blueprint } = useQuery({
    queryKey: ["care-blueprint", selectedParticipant, orgId],
    queryFn: () => fetchBlueprintForParticipant(selectedParticipant!, orgId!),
    enabled: !!selectedParticipant && !!orgId,
    staleTime: 60_000,
  });

  // Update selectedBlueprint when blueprint loads
  useMemo(() => {
    if (blueprint) setSelectedBlueprint(blueprint);
  }, [blueprint]);

  // Fetch shifts for the blueprint
  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["blueprint-shifts", selectedBlueprint?.id, weekStart.toISOString()],
    queryFn: () =>
      fetchBlueprintShifts(
        selectedBlueprint!.id,
        orgId!,
        weekStart.toISOString(),
        weekEnd.toISOString(),
      ),
    enabled: !!selectedBlueprint?.id && !!orgId,
    staleTime: 30_000,
  });

  // Group shifts by day -> shift_group_id
  const groupedByDay = useMemo(() => {
    const map = new Map<string, Map<string, BlueprintShift[]>>();
    for (const day of weekDays) {
      const dayKey = day.toISOString().slice(0, 10);
      map.set(dayKey, new Map());
    }
    for (const shift of shifts) {
      if (filterStatus !== "all" && shift.status !== filterStatus) continue;
      const dayKey = new Date(shift.start_time).toISOString().slice(0, 10);
      const dayMap = map.get(dayKey);
      if (!dayMap) continue;
      const group = dayMap.get(shift.shift_group_id) || [];
      group.push(shift);
      dayMap.set(shift.shift_group_id, group);
    }
    return map;
  }, [shifts, weekDays, filterStatus]);

  // Stats
  const totalShifts = shifts.length;
  const unfilledCount = shifts.filter((s) => s.status === "unfilled").length;
  const filledCount = shifts.filter((s) => s.status !== "unfilled").length;

  // Smart match mutation
  const smartMatchMut = useMutation({
    mutationFn: () => triggerSmartMatch(selectedBlueprint!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprint-shifts"] });
    },
  });

  // Worker assignment
  const handleAssignWorker = useCallback(
    async (shiftId: string, workerId: string) => {
      if (!orgId) return;
      setAssigning(shiftId);

      const validation = await validateWorkerAssignment(workerId, shiftId, orgId);
      if (!validation.valid) {
        addToast(`Assignment Rejected: Worker lacks required skills — ${validation.missing_skills.join(", ")}`, undefined, "error");
        setAssigning(null);
        return;
      }

      const result = await assignWorkerToShift(shiftId, workerId);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["blueprint-shifts"] });
      } else {
        addToast(`Failed: ${result.error}`, undefined, "error");
      }
      setAssigning(null);
    },
    [orgId, queryClient],
  );

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
        <div>
          <h1 className="text-[15px] font-semibold text-white">Dispatch Matrix</h1>
          <p className="mt-0.5 text-[11px] text-zinc-500">Auto-generated roster from Care Blueprints</p>
        </div>

        <div className="flex items-center gap-2">
          {selectedBlueprint && unfilledCount > 0 && (
            <button
              onClick={() => smartMatchMut.mutate()}
              disabled={smartMatchMut.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] font-medium text-emerald-400 border border-emerald-500/20 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {smartMatchMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Auto-Fill ({unfilledCount} gaps)
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar: Participant selector ────────────── */}
        <div className="w-64 border-r border-zinc-800/60 overflow-y-auto bg-[#080808]">
          <div className="p-3">
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Participants</p>
            <div className="space-y-0.5">
              {participants.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedParticipant(p.id)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                    selectedParticipant === p.id
                      ? "bg-white/5 text-white"
                      : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400 shrink-0">
                    {(p.client_name || p.first_name || "?")[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium truncate">{p.client_name || `${p.first_name} ${p.last_name}`}</p>
                    {p.ndis_number && <p className="text-[10px] text-zinc-600">{p.ndis_number}</p>}
                  </div>
                </button>
              ))}
              {participants.length === 0 && (
                <p className="text-[11px] text-zinc-600 text-center py-4">No participants</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Main: Roster Grid ───────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {!selectedBlueprint && selectedParticipant && !blueprint && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Shield size={28} className="text-zinc-700 mb-3" />
              <p className="text-[14px] font-medium text-zinc-400">No Care Blueprint</p>
              <p className="text-[11px] text-zinc-600 mt-1">This participant doesn&apos;t have a care blueprint yet. Create one from their profile to generate shifts.</p>
            </div>
          )}

          {!selectedParticipant && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Users size={28} className="text-zinc-700 mb-3" />
              <p className="text-[14px] font-medium text-zinc-400">Select a Participant</p>
              <p className="text-[11px] text-zinc-600 mt-1">Choose a participant from the sidebar to view their roster.</p>
            </div>
          )}

          {selectedBlueprint && (
            <>
              {/* Stats Bar */}
              <div className="flex items-center gap-4 border-b border-zinc-800/40 px-6 py-3 bg-[#080808]">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-zinc-500" />
                  <span className="text-[11px] text-zinc-400">{totalShifts} shifts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-emerald-500" />
                  <span className="text-[11px] text-emerald-400">{filledCount} filled</span>
                </div>
                {unfilledCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span className="text-[11px] text-amber-400">{unfilledCount} unfilled</span>
                  </div>
                )}
                <div className="flex-1" />

                {/* Filter */}
                <div className="flex items-center gap-1">
                  <Filter size={10} className="text-zinc-600" />
                  {["all", "unfilled", "published"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilterStatus(f)}
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        filterStatus === f ? "bg-white/10 text-white" : "text-zinc-600 hover:text-zinc-400"
                      }`}
                    >
                      {f === "all" ? "All" : f === "unfilled" ? "Gaps" : "Filled"}
                    </button>
                  ))}
                </div>

                {/* Week nav */}
                <div className="flex items-center gap-1">
                  <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded p-1 text-zinc-600 hover:text-white hover:bg-white/5">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-[11px] text-zinc-400 min-w-[140px] text-center">
                    {formatShortDate(weekStart)} — {formatShortDate(addDays(weekStart, 6))}
                  </span>
                  <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded p-1 text-zinc-600 hover:text-white hover:bg-white/5">
                    <ChevronRight size={14} />
                  </button>
                  {weekOffset !== 0 && (
                    <button onClick={() => setWeekOffset(0)} className="rounded px-2 py-0.5 text-[10px] text-zinc-600 hover:text-white">Today</button>
                  )}
                </div>
              </div>

              {/* Grid */}
              {loadingShifts ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={20} className="animate-spin text-zinc-600" />
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {weekDays.map((day) => {
                    const dayKey = day.toISOString().slice(0, 10);
                    const dayGroups = groupedByDay.get(dayKey);
                    if (!dayGroups || dayGroups.size === 0) return null;

                    return (
                      <div key={dayKey}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-zinc-400">{formatShortDate(day)}</span>
                          <div className="flex-1 border-t border-zinc-800/40" />
                        </div>
                        <div className="space-y-2">
                          {Array.from(dayGroups.entries()).map(([groupId, groupShifts]) => {
                            const ref = groupShifts[0];
                            const ratio = ref.target_ratio;
                            const filledSlots = groupShifts.filter((s) => s.technician_id);
                            const unfilledSlots = groupShifts.filter((s) => !s.technician_id);
                            const allFilled = unfilledSlots.length === 0;
                            const label = ref.title?.split(" — ")[0] || "Shift";

                            return (
                              <div
                                key={groupId}
                                className={`rounded-xl border p-3 transition-colors ${
                                  allFilled
                                    ? "border-zinc-800/40 bg-zinc-900/20"
                                    : "border-amber-500/20 bg-amber-500/[0.02]"
                                }`}
                              >
                                {/* Shift header */}
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock size={12} className="text-zinc-600" />
                                  <span className="text-[12px] font-medium text-zinc-300">{label}</span>
                                  <span className="text-[11px] text-zinc-600">
                                    {formatTime(ref.start_time)} — {formatTime(ref.end_time)}
                                  </span>
                                  <div className="flex-1" />
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium border ${
                                    allFilled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                  }`}>
                                    {filledSlots.length}/{ratio} filled
                                  </span>
                                </div>

                                {/* Slots */}
                                <div className="grid grid-cols-2 gap-2">
                                  {groupShifts.map((slot, idx) => {
                                    const ss = STATUS_STYLES[slot.status] || STATUS_STYLES.unfilled;
                                    return (
                                      <div
                                        key={slot.id}
                                        className={`rounded-lg border px-3 py-2 ${ss.border} ${ss.bg}`}
                                      >
                                        {slot.technician_id ? (
                                          <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-[9px] font-bold text-emerald-400 shrink-0">
                                              {(slot.worker_name || "?")[0]}
                                            </div>
                                            <div>
                                              <p className="text-[12px] font-medium text-zinc-200">{slot.worker_name || "Assigned"}</p>
                                              <p className="text-[9px] text-zinc-600">Slot {idx + 1} · {ss.label}</p>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full border border-dashed border-amber-500/30 flex items-center justify-center shrink-0">
                                              <AlertTriangle size={10} className="text-amber-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-[12px] font-medium text-amber-400">Unfilled Slot {idx + 1}</p>
                                              <p className="text-[9px] text-zinc-600">Requires assignment</p>
                                            </div>
                                            {/* Quick assign dropdown */}
                                            <select
                                              className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none"
                                              value=""
                                              disabled={assigning === slot.id}
                                              onChange={(e) => {
                                                if (e.target.value) handleAssignWorker(slot.id, e.target.value);
                                              }}
                                            >
                                              <option value="">Assign...</option>
                                              {(workers as any[]).map((w: any) => (
                                                <option key={w.id || w.user_id} value={w.id || w.user_id}>
                                                  {w.name || w.full_name || "Worker"}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {shifts.length === 0 && (
                    <div className="text-center py-16">
                      <Calendar size={28} className="mx-auto text-zinc-700 mb-3" />
                      <p className="text-[13px] text-zinc-400">No shifts in this week</p>
                      <p className="text-[11px] text-zinc-600 mt-1">Navigate forward to see generated shifts, or generate a roster from the blueprint.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
