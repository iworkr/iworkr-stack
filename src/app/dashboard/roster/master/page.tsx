/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Calendar,
  Users,
  Clock,
  ChevronRight,
  Trash2,
  Edit3,
  Play,
  Shield,
  AlertTriangle,
  Check,
  X,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useRouter } from "next/navigation";
import {
  fetchRosterTemplates,
  createRosterTemplate,
  updateRosterTemplate,
  deleteRosterTemplate,
  fetchTemplateShifts,
  createTemplateShift,
  updateTemplateShift,
  deleteTemplateShift,
  type RosterTemplate,
  type TemplateShift,
} from "@/app/actions/roster-templates";
import { fetchParticipants } from "@/app/actions/participants";
import { getOrgTechnicians } from "@/app/actions/schedule";

/* ═══════════════════════════════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════════════════════════════ */

const INPUT_CLASS =
  "w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors";

const CYCLE_OPTIONS = [
  { days: 7, label: "1 Week" },
  { days: 14, label: "2 Weeks" },
  { days: 21, label: "3 Weeks" },
  { days: 28, label: "4 Weeks" },
];

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

const DAY_LABELS: Record<number, string> = {};
for (let i = 1; i <= 28; i++) {
  const weekNum = Math.ceil(i / 7);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayName = dayNames[(i - 1) % 7];
  DAY_LABELS[i] = `W${weekNum} ${dayName}`;
}

const HOUR_COLUMNS = Array.from({ length: 15 }, (_, i) => i + 6); // 6AM–8PM

function timeToFraction(time: string): number {
  const [h, m] = time.split(":");
  return parseInt(h) + parseInt(m) / 60;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════════ */

interface Worker {
  id: string;
  full_name: string;
  email?: string;
}

interface Participant {
  id: string;
  client_name?: string;
  ndis_number?: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function MasterRosterBlueprintPage() {
  const { orgId, userId } = useOrg();
  const router = useRouter();

  /* ── State ── */
  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<RosterTemplate | null>(null);
  const [shifts, setShifts] = useState<TemplateShift[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [saving, setSaving] = useState(false);

  // New template modal
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateParticipant, setNewTemplateParticipant] = useState("");
  const [newTemplateCycle, setNewTemplateCycle] = useState(14);
  const [participantSearch, setParticipantSearch] = useState("");

  // Shift modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<TemplateShift | null>(null);
  const [shiftForm, setShiftForm] = useState({
    day_of_cycle: 1,
    start_time: "09:00",
    end_time: "13:00",
    support_purpose: "",
    ndis_line_item: "",
    primary_worker_id: "",
    backup_worker_id: "",
    public_holiday_behavior: "flag" as "proceed" | "cancel" | "flag",
    notes: "",
  });

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  /* ── Load initial data ── */
  useEffect(() => {
    if (!orgId) return;
    async function load() {
      setLoading(true);
      const [tpls, techResult, pList] = await Promise.all([
        fetchRosterTemplates(orgId!),
        getOrgTechnicians(orgId!),
        fetchParticipants(orgId!, { limit: 500 }),
      ]);
      setTemplates(tpls);
      setWorkers(
        (techResult.data || []).map((t: any) => ({
          id: t.id,
          full_name: t.full_name || t.email || "Unknown",
          email: t.email,
        }))
      );
      setParticipants(
        (pList.data || []).map((p: any) => ({
          id: p.id,
          client_name: p.client_name || p.clients?.name || "Unknown",
          ndis_number: p.ndis_number,
        }))
      );
      setLoading(false);
    }
    load();
  }, [orgId]);

  /* ── Load shifts when template selected ── */
  const loadShifts = useCallback(async (tmpl: RosterTemplate | null) => {
    if (!tmpl) {
      setShifts([]);
      return;
    }
    setLoadingShifts(true);
    const s = await fetchTemplateShifts(tmpl.id);
    setShifts(s);
    setLoadingShifts(false);
  }, []);

  useEffect(() => {
    loadShifts(selectedTemplate);
  }, [selectedTemplate, loadShifts]);

  /* ── Derived ── */
  const cycleDays = selectedTemplate ? selectedTemplate.cycle_length_days : 14;
  const cycleDayArray = useMemo(() => Array.from({ length: cycleDays }, (_, i) => i + 1), [cycleDays]);

  const filteredParticipants = useMemo(() => {
    if (!participantSearch) return participants;
    const q = participantSearch.toLowerCase();
    return participants.filter(
      (p) =>
        p.client_name?.toLowerCase().includes(q) ||
        p.ndis_number?.toLowerCase().includes(q)
    );
  }, [participants, participantSearch]);

  /* ── Auto-generate template name ── */
  useEffect(() => {
    if (!newTemplateParticipant) return;
    const p = participants.find((x) => x.id === newTemplateParticipant);
    if (p) {
      const cycleName = CYCLE_OPTIONS.find((c) => c.days === newTemplateCycle)?.label || `${newTemplateCycle}-day`;
      setNewTemplateName(`${p.client_name} - ${cycleName} Cycle`);
    }
  }, [newTemplateParticipant, newTemplateCycle, participants]);

  /* ── Handlers ── */
  const handleSelectTemplate = useCallback((t: RosterTemplate) => {
    setSelectedTemplate(t);
    setConfirmDelete(null);
  }, []);

  const handleCreateTemplate = useCallback(async () => {
    if (!orgId || !newTemplateParticipant || !newTemplateName) return;
    setSaving(true);
    const result = await createRosterTemplate({
      organization_id: orgId,
      participant_id: newTemplateParticipant,
      name: newTemplateName,
      cycle_length_days: newTemplateCycle,
      created_by: userId || undefined,
    });
    if (result.success && result.id) {
      const refreshed = await fetchRosterTemplates(orgId);
      setTemplates(refreshed);
      const newT = refreshed.find((t) => t.id === result.id) || null;
      setSelectedTemplate(newT);
      setShowNewTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateParticipant("");
      setNewTemplateCycle(14);
      setParticipantSearch("");
    }
    setSaving(false);
  }, [orgId, userId, newTemplateParticipant, newTemplateName, newTemplateCycle]);

  const handleToggleActive = useCallback(async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    await updateRosterTemplate(selectedTemplate.id, { is_active: !selectedTemplate.is_active });
    const refreshed = await fetchRosterTemplates(orgId!);
    setTemplates(refreshed);
    const updated = refreshed.find((t) => t.id === selectedTemplate.id) || null;
    setSelectedTemplate(updated);
    setSaving(false);
  }, [selectedTemplate, orgId]);

  const handleDeleteTemplate = useCallback(async () => {
    if (!selectedTemplate || !orgId) return;
    setSaving(true);
    await deleteRosterTemplate(selectedTemplate.id);
    const refreshed = await fetchRosterTemplates(orgId);
    setTemplates(refreshed);
    setSelectedTemplate(null);
    setShifts([]);
    setConfirmDelete(null);
    setSaving(false);
  }, [selectedTemplate, orgId]);

  const handleUpdateCycleLength = useCallback(
    async (days: number) => {
      if (!selectedTemplate || !orgId) return;
      setSaving(true);
      await updateRosterTemplate(selectedTemplate.id, { cycle_length_days: days });
      const refreshed = await fetchRosterTemplates(orgId);
      setTemplates(refreshed);
      const updated = refreshed.find((t) => t.id === selectedTemplate.id) || null;
      setSelectedTemplate(updated);
      setSaving(false);
    },
    [selectedTemplate, orgId]
  );

  const openNewShiftModal = useCallback(
    (dayOfCycle: number) => {
      setEditingShift(null);
      setShiftForm({
        day_of_cycle: dayOfCycle,
        start_time: "09:00",
        end_time: "13:00",
        support_purpose: "",
        ndis_line_item: "",
        primary_worker_id: "",
        backup_worker_id: "",
        public_holiday_behavior: "flag",
        notes: "",
      });
      setShowShiftModal(true);
    },
    []
  );

  const openEditShiftModal = useCallback((shift: TemplateShift) => {
    setEditingShift(shift);
    setShiftForm({
      day_of_cycle: shift.day_of_cycle,
      start_time: shift.start_time,
      end_time: shift.end_time,
      support_purpose: shift.support_purpose || "",
      ndis_line_item: shift.ndis_line_item || "",
      primary_worker_id: shift.primary_worker_id || "",
      backup_worker_id: shift.backup_worker_id || "",
      public_holiday_behavior: shift.public_holiday_behavior || "flag",
      notes: shift.notes || "",
    });
    setShowShiftModal(true);
  }, []);

  const handleSaveShift = useCallback(async () => {
    if (!selectedTemplate || !orgId) return;
    setSaving(true);
    if (editingShift) {
      await updateTemplateShift(editingShift.id, {
        day_of_cycle: shiftForm.day_of_cycle,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        support_purpose: shiftForm.support_purpose || undefined,
        ndis_line_item: shiftForm.ndis_line_item || undefined,
        primary_worker_id: shiftForm.primary_worker_id || undefined,
        backup_worker_id: shiftForm.backup_worker_id || undefined,
        public_holiday_behavior: shiftForm.public_holiday_behavior,
        notes: shiftForm.notes || undefined,
      });
    } else {
      await createTemplateShift({
        template_id: selectedTemplate.id,
        organization_id: orgId,
        day_of_cycle: shiftForm.day_of_cycle,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        support_purpose: shiftForm.support_purpose || undefined,
        ndis_line_item: shiftForm.ndis_line_item || undefined,
        primary_worker_id: shiftForm.primary_worker_id || undefined,
        backup_worker_id: shiftForm.backup_worker_id || undefined,
        public_holiday_behavior: shiftForm.public_holiday_behavior,
        notes: shiftForm.notes || undefined,
      });
    }
    const refreshedShifts = await fetchTemplateShifts(selectedTemplate.id);
    setShifts(refreshedShifts);
    setShowShiftModal(false);
    setEditingShift(null);
    setSaving(false);

    // Refresh template list for shift counts
    const refreshedTemplates = await fetchRosterTemplates(orgId);
    setTemplates(refreshedTemplates);
    const upd = refreshedTemplates.find((t) => t.id === selectedTemplate.id) || null;
    setSelectedTemplate(upd);
  }, [selectedTemplate, orgId, editingShift, shiftForm]);

  const handleDeleteShift = useCallback(async () => {
    if (!editingShift || !selectedTemplate || !orgId) return;
    setSaving(true);
    await deleteTemplateShift(editingShift.id);
    const refreshedShifts = await fetchTemplateShifts(selectedTemplate.id);
    setShifts(refreshedShifts);
    setShowShiftModal(false);
    setEditingShift(null);
    setSaving(false);

    const refreshedTemplates = await fetchRosterTemplates(orgId);
    setTemplates(refreshedTemplates);
    const upd = refreshedTemplates.find((t) => t.id === selectedTemplate.id) || null;
    setSelectedTemplate(upd);
  }, [editingShift, selectedTemplate, orgId]);

  /* ═══════════════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-[var(--background)]">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading Master Roster…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[var(--background)] text-white">
      {/* Noise texture */}
      <div className="stealth-noise" />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Command Bar Header ── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              MASTER ROSTER
            </span>
            <div className="ml-4 flex items-center gap-3">
              <span className="text-[11px] text-zinc-500">
                {templates.length} template{templates.length !== 1 ? "s" : ""}
              </span>
              {selectedTemplate && (
                <>
                  <span className="text-zinc-800">·</span>
                  <span className="text-[11px] text-zinc-300 font-medium">
                    {selectedTemplate.participant_name}
                  </span>
                  {saving && <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedTemplate && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/dashboard/roster/rollout?template=${selectedTemplate.id}`)}
                disabled={shifts.length === 0}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play className="w-3 h-3" />
                Preview Rollout
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowNewTemplateModal(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all duration-200"
            >
              <Plus size={12} />
              New Template
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* ── Template Selector Panel (Left) ── */}
        <div className="w-[260px] shrink-0 border-r border-white/[0.04] overflow-y-auto scrollbar-none">
          <div className="px-4 py-3 border-b border-white/[0.03]">
            <h2 className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
              Templates
            </h2>
          </div>

          {templates.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <CalendarClock className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No templates yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Create a blueprint to define recurring shift patterns
              </p>
            </div>
          ) : (
            <div className="py-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTemplate(t)}
                  className={`w-full text-left px-4 py-3 transition-all group border-b border-white/[0.02] ${
                    selectedTemplate?.id === t.id
                      ? "bg-white/[0.03]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-200 truncate max-w-[170px] group-hover:text-white transition-colors">
                      {t.participant_name}
                    </span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 text-zinc-700 transition-transform ${
                        selectedTemplate?.id === t.id ? "rotate-90 text-emerald-500" : "group-hover:text-zinc-500"
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500 border border-white/[0.04]">
                      {t.cycle_length_days}d
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {t.shift_count || 0} shift{(t.shift_count || 0) !== 1 ? "s" : ""}
                    </span>
                    <span
                      className={`ml-auto w-1.5 h-1.5 rounded-full ${
                        t.is_active ? "bg-emerald-500" : "bg-zinc-600"
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-white/[0.03]">
            <button
              onClick={() => setShowNewTemplateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-800 text-zinc-500 text-xs hover:border-emerald-500/30 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Template
            </button>
          </div>
        </div>

        {/* ── Main Area ── */}
        <div className="flex-1 min-w-0 overflow-y-auto scrollbar-none">
          {!selectedTemplate ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
              <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.01] blur-[60px]" />
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mb-4">
                <CalendarClock className="w-7 h-7 text-zinc-600" />
              </div>
              <h3 className="text-[15px] font-medium text-zinc-300 mb-1">Select a template</h3>
              <p className="text-[12px] text-zinc-600 max-w-[280px] text-center leading-relaxed">
                Choose a roster blueprint from the sidebar or create a new one to define recurring shift patterns.
              </p>
            </div>
          ) : (
            /* ── Template Builder ── */
            <motion.div
              key={selectedTemplate.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Template Info Bar */}
              <div className="border-b border-white/[0.03] bg-white/[0.01] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-200">{selectedTemplate.name}</h2>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Users className="w-3 h-3" />
                        {selectedTemplate.participant_name}
                      </span>
                      <span className="text-zinc-800">·</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        {shifts.length} shift{shifts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Cycle Length Selector */}
                  <div className="flex items-center gap-0.5 bg-white/[0.02] rounded-md border border-white/[0.04] p-0.5">
                    {CYCLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.days}
                        onClick={() => handleUpdateCycleLength(opt.days)}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          selectedTemplate.cycle_length_days === opt.days
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Active Toggle */}
                  <button
                    onClick={handleToggleActive}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      selectedTemplate.is_active
                        ? "bg-emerald-500/[0.06] text-emerald-400"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {selectedTemplate.is_active ? (
                      <><Check className="w-3 h-3" /> Active</>
                    ) : (
                      <><X className="w-3 h-3" /> Inactive</>
                    )}
                  </button>

                  {/* Delete */}
                  {confirmDelete === selectedTemplate.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleDeleteTemplate}
                        className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 rounded-md text-zinc-500 text-[11px] hover:text-zinc-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(selectedTemplate.id)}
                      className="p-1 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Cycle Grid ── */}
              <div>
                {/* Column headers */}
                <div className="flex border-b border-white/[0.03] bg-[var(--surface-1)]">
                  <div className="w-[90px] shrink-0 px-3 py-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                    Day
                  </div>
                  <div className="flex-1 flex">
                    {HOUR_COLUMNS.map((hour) => (
                      <div
                        key={hour}
                        className="flex-1 px-1 py-2 text-center font-mono text-[9px] font-bold tracking-widest text-zinc-700 border-l border-white/[0.02]"
                      >
                        {hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}
                        {hour >= 12 ? "p" : "a"}
                      </div>
                    ))}
                  </div>
                  <div className="w-[60px] shrink-0 px-2 py-2 text-right">
                    <button
                      onClick={() => openNewShiftModal(1)}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-emerald-400 transition-colors ml-auto"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {loadingShifts ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                      {/* Day Rows */}
                      {cycleDayArray.map((day) => {
                        const dayShifts = shifts.filter((s) => s.day_of_cycle === day);
                        const isWeekend = (day - 1) % 7 >= 5;
                        const isWeekBoundary = day > 1 && (day - 1) % 7 === 0;

                        return (
                          <div key={day}>
                            {isWeekBoundary && (
                              <div className="h-px bg-emerald-500/10" />
                            )}
                            <div
                              className={`flex border-b border-white/[0.02] group/row hover:bg-white/[0.015] transition-colors ${
                                isWeekend ? "bg-white/[0.01]" : ""
                              }`}
                            >
                              {/* Day Label */}
                              <div className="w-[90px] shrink-0 px-3 py-2 flex items-center">
                                <span
                                  className={`text-[11px] font-mono ${
                                    isWeekend ? "text-zinc-700" : "text-zinc-500"
                                  }`}
                                >
                                  {DAY_LABELS[day]}
                                </span>
                              </div>

                              {/* Grid Area */}
                              <div
                                className="flex-1 relative min-h-[42px] cursor-pointer"
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest("[data-shift-block]")) return;
                                  openNewShiftModal(day);
                                }}
                              >
                                {/* Hour grid lines */}
                                <div className="absolute inset-0 flex pointer-events-none">
                                  {HOUR_COLUMNS.map((h) => (
                                    <div
                                      key={h}
                                      className="flex-1 border-l border-white/[0.02]"
                                    />
                                  ))}
                                </div>

                                {/* Shift blocks */}
                                {dayShifts.map((shift) => {
                                  const startFrac = timeToFraction(shift.start_time);
                                  const endFrac = timeToFraction(shift.end_time);
                                  const gridStart = 6;
                                  const gridEnd = 21;
                                  const gridSpan = gridEnd - gridStart;

                                  const leftPct = Math.max(0, ((startFrac - gridStart) / gridSpan) * 100);
                                  const widthPct = Math.max(3, ((endFrac - startFrac) / gridSpan) * 100);

                                  return (
                                    <div
                                      key={shift.id}
                                      data-shift-block
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditShiftModal(shift);
                                      }}
                                      className="absolute top-1 bottom-1 z-10"
                                      style={{
                                        left: `${leftPct}%`,
                                        width: `${Math.min(widthPct, 100 - leftPct)}%`,
                                      }}
                                    >
                                      <div className="relative h-full border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] rounded-md px-2 flex items-center gap-1 cursor-pointer hover:bg-emerald-500/[0.08] hover:border-emerald-500/50 transition-colors group">
                                        <span className="text-[10px] font-mono text-emerald-400/80">
                                          {formatTime(shift.start_time)}
                                        </span>
                                        <span className="text-[10px] text-zinc-700">→</span>
                                        <span className="text-[10px] font-mono text-emerald-400/80">
                                          {formatTime(shift.end_time)}
                                        </span>
                                        {shift.primary_worker_name && (
                                          <span className="text-[10px] text-zinc-500 ml-1 truncate">
                                            {shift.primary_worker_name}
                                          </span>
                                        )}
                                        <Edit3 className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Click hint on hover */}
                                {dayShifts.length === 0 && (
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity pointer-events-none">
                                    <span className="text-[10px] text-zinc-700 flex items-center gap-1">
                                      <Plus className="w-2.5 h-2.5" /> Click to add shift
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Day action */}
                              <div className="w-[60px] shrink-0 flex items-center justify-end pr-3">
                                {dayShifts.length > 0 && (
                                  <span className="text-[9px] font-mono text-zinc-700">
                                    {dayShifts.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Bottom Rollout Bar ── */}
      {selectedTemplate && shifts.length > 0 && (
        <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between bg-[var(--surface-1)]">
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <Shield className="w-3.5 h-3.5 text-emerald-500/50" />
            <span>
              Blueprint for{" "}
              <span className="text-zinc-300 font-medium">{selectedTemplate.participant_name}</span>
              {" — "}
              <span className="font-mono text-zinc-400">{shifts.length}</span> template shift{shifts.length !== 1 ? "s" : ""} across{" "}
              <span className="font-mono text-zinc-400">{selectedTemplate.cycle_length_days}</span> days
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              router.push(`/dashboard/roster/rollout?template=${selectedTemplate.id}`)
            }
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            Preview Rollout
          </motion.button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         Modals
         ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── New Template Modal ── */}
      <AnimatePresence>
        {showNewTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNewTemplateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-4 bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/50"
            >
              <div className="px-6 py-5 border-b border-white/[0.04]">
                <h3 className="text-base font-semibold text-white">New Roster Template</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Create a recurring shift template for a participant
                </p>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Participant selector */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Participant</label>
                  <input
                    type="text"
                    placeholder="Search participants…"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className={INPUT_CLASS}
                  />
                  {(participantSearch || !newTemplateParticipant) && (
                    <div className="mt-1.5 max-h-[140px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50">
                      {filteredParticipants.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-zinc-600 text-center">No participants found</div>
                      ) : (
                        filteredParticipants.slice(0, 20).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setNewTemplateParticipant(p.id);
                              setParticipantSearch(p.client_name || "");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-white/[0.03] transition-colors flex items-center justify-between ${
                              newTemplateParticipant === p.id ? "bg-emerald-500/[0.06] text-emerald-400" : "text-zinc-300"
                            }`}
                          >
                            <span>{p.client_name}</span>
                            {p.ndis_number && (
                              <span className="text-[10px] font-mono text-zinc-600">{p.ndis_number}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Template name */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Template Name</label>
                  <input
                    type="text"
                    placeholder="Auto-generated from participant & cycle"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Cycle length */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Cycle Length</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CYCLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.days}
                        onClick={() => setNewTemplateCycle(opt.days)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-medium text-center transition-all border ${
                          newTemplateCycle === opt.days
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setShowNewTemplateModal(false);
                    setNewTemplateName("");
                    setNewTemplateParticipant("");
                    setParticipantSearch("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplateParticipant || !newTemplateName || saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Create Template
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Template Shift Modal ── */}
      <AnimatePresence>
        {showShiftModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setShowShiftModal(false);
                setEditingShift(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-4 bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/50 max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-xl z-10 rounded-t-2xl">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {editingShift ? "Edit Template Shift" : "Add Template Shift"}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {selectedTemplate?.participant_name} — {DAY_LABELS[shiftForm.day_of_cycle]}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowShiftModal(false);
                    setEditingShift(null);
                  }}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.03] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Day of Cycle */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Day of Cycle</label>
                  <select
                    value={shiftForm.day_of_cycle}
                    onChange={(e) => setShiftForm((f) => ({ ...f, day_of_cycle: parseInt(e.target.value) }))}
                    className={INPUT_CLASS}
                  >
                    {cycleDayArray.map((d) => (
                      <option key={d} value={d}>Day {d} — {DAY_LABELS[d]}</option>
                    ))}
                  </select>
                </div>

                {/* Start / End time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Time</label>
                    <input
                      type="time"
                      value={shiftForm.start_time}
                      onChange={(e) => setShiftForm((f) => ({ ...f, start_time: e.target.value }))}
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Time</label>
                    <input
                      type="time"
                      value={shiftForm.end_time}
                      onChange={(e) => setShiftForm((f) => ({ ...f, end_time: e.target.value }))}
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                </div>

                {/* Time display */}
                {shiftForm.start_time && shiftForm.end_time && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/[0.03]">
                    <Clock className="w-3.5 h-3.5 text-emerald-400/60" />
                    <span className="text-xs font-mono text-emerald-400">
                      {formatTime(shiftForm.start_time)} → {formatTime(shiftForm.end_time)}
                    </span>
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      {(() => {
                        const s = timeToFraction(shiftForm.start_time);
                        const e = timeToFraction(shiftForm.end_time);
                        const diff = e - s;
                        if (diff <= 0) return "—";
                        const hours = Math.floor(diff);
                        const mins = Math.round((diff - hours) * 60);
                        return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
                      })()}
                    </span>
                  </div>
                )}

                {/* Support Purpose */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Support Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Community access, personal care, meal prep"
                    value={shiftForm.support_purpose}
                    onChange={(e) => setShiftForm((f) => ({ ...f, support_purpose: e.target.value }))}
                    className={INPUT_CLASS}
                  />
                </div>

                {/* NDIS Line Item */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">NDIS Line Item</label>
                  <input
                    type="text"
                    placeholder="e.g. 01_011_0107_1_1"
                    value={shiftForm.ndis_line_item}
                    onChange={(e) => setShiftForm((f) => ({ ...f, ndis_line_item: e.target.value }))}
                    className={`${INPUT_CLASS} font-mono`}
                  />
                </div>

                {/* Workers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Primary Worker</label>
                    <select
                      value={shiftForm.primary_worker_id}
                      onChange={(e) => setShiftForm((f) => ({ ...f, primary_worker_id: e.target.value }))}
                      className={INPUT_CLASS}
                    >
                      <option value="">Unassigned</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>{w.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Backup Worker</label>
                    <select
                      value={shiftForm.backup_worker_id}
                      onChange={(e) => setShiftForm((f) => ({ ...f, backup_worker_id: e.target.value }))}
                      className={INPUT_CLASS}
                    >
                      <option value="">None</option>
                      {workers
                        .filter((w) => w.id !== shiftForm.primary_worker_id)
                        .map((w) => (
                          <option key={w.id} value={w.id}>{w.full_name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Public Holiday Behavior */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Public Holiday Behavior</label>
                  <div className="space-y-2">
                    {[
                      { value: "proceed" as const, label: "Proceed as Normal", note: "250% penalty rate applies", icon: Check, color: "text-emerald-400" },
                      { value: "cancel" as const, label: "Cancel Automatically", note: null, icon: X, color: "text-zinc-400" },
                      { value: "flag" as const, label: "Flag for Review", note: "Recommended", icon: AlertTriangle, color: "text-amber-400" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          shiftForm.public_holiday_behavior === opt.value
                            ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                            : "border-white/[0.04] hover:border-white/[0.08] bg-white/[0.01]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="holiday_behavior"
                          value={opt.value}
                          checked={shiftForm.public_holiday_behavior === opt.value}
                          onChange={(e) =>
                            setShiftForm((f) => ({
                              ...f,
                              public_holiday_behavior: e.target.value as "proceed" | "cancel" | "flag",
                            }))
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            shiftForm.public_holiday_behavior === opt.value
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-zinc-600"
                          }`}
                        >
                          {shiftForm.public_holiday_behavior === opt.value && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                        <div className="flex-1">
                          <span className="text-sm text-zinc-200">{opt.label}</span>
                          {opt.note && (
                            <span className="ml-2 text-[10px] text-zinc-600">{opt.note}</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Notes</label>
                  <textarea
                    placeholder="Additional notes for this template shift…"
                    value={shiftForm.notes}
                    onChange={(e) => setShiftForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className={`${INPUT_CLASS} resize-none`}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/[0.04] flex items-center justify-between sticky bottom-0 bg-[#0A0A0A]/95 backdrop-blur-xl z-10 rounded-b-2xl">
                <div>
                  {editingShift && (
                    <button
                      onClick={handleDeleteShift}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowShiftModal(false);
                      setEditingShift(null);
                    }}
                    className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveShift}
                    disabled={saving || !shiftForm.start_time || !shiftForm.end_time}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {editingShift ? "Update Shift" : "Add Shift"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
