/**
 * @component CareBlueprintBuilder
 * @status COMPLETE
 * @description Multi-step builder for creating and editing care plan blueprints with AI assist
 * @lastAudit 2026-03-22
 */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Calendar, Users, Shield, Sparkles, Clock, Loader2,
  Check, ChevronRight, AlertTriangle, Brain, Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchClinicalSkills,
  createCareBlueprint,
  generateRosterShell,
  triggerSmartMatch,
  type ClinicalSkill,
  type CareBlueprint,
  type RosterShellResult,
  type SmartMatchResult,
} from "@/app/actions/care-blueprints";

/* ── Types ───────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onClose: () => void;
  participantId: string;
  participantName: string;
  orgId: string;
}

type CoverageType = "standard_hourly" | "24_7_continuous" | "active_night" | "sleepover";

interface ShiftPatternEntry {
  label: string;
  start: string;
  end: string;
}

/* ── Constants ───────────────────────────────────────────── */

const COVERAGE_OPTIONS: Array<{ value: CoverageType; label: string; desc: string; shifts: ShiftPatternEntry[] }> = [
  {
    value: "standard_hourly",
    label: "Standard Hourly",
    desc: "Custom shift times — not 24/7",
    shifts: [{ label: "Day Support", start: "09:00", end: "15:00" }],
  },
  {
    value: "24_7_continuous",
    label: "24/7 Continuous",
    desc: "Three 8-hour shifts covering full day",
    shifts: [
      { label: "Morning", start: "07:00", end: "15:00" },
      { label: "Evening", start: "15:00", end: "23:00" },
      { label: "Night", start: "23:00", end: "07:00" },
    ],
  },
  {
    value: "active_night",
    label: "Active Night",
    desc: "Day support + active overnight",
    shifts: [
      { label: "Day", start: "07:00", end: "19:00" },
      { label: "Active Night", start: "19:00", end: "07:00" },
    ],
  },
  {
    value: "sleepover",
    label: "Sleepover",
    desc: "Day support + sleepover overnight",
    shifts: [
      { label: "Day", start: "07:00", end: "21:00" },
      { label: "Sleepover", start: "21:00", end: "07:00" },
    ],
  },
];

const RATIO_OPTIONS = [1, 2, 3] as const;

/* ── Component ───────────────────────────────────────────── */

export function CareBlueprintBuilder({ open, onClose, participantId, participantName, orgId }: Props) {
  const queryClient = useQueryClient();

  // Wizard state
  const [phase, setPhase] = useState<"config" | "generating" | "matching" | "complete">("config");
  const [coverageType, setCoverageType] = useState<CoverageType>("standard_hourly");
  const [ratio, setRatio] = useState(1);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [genderPref, setGenderPref] = useState<"no_preference" | "male_only" | "female_only">("no_preference");
  const [shiftPattern, setShiftPattern] = useState<ShiftPatternEntry[]>(COVERAGE_OPTIONS[0].shifts);
  const [weeks, setWeeks] = useState(4);

  // Results
  const [blueprint, setBlueprint] = useState<CareBlueprint | null>(null);
  const [shellResult, setShellResult] = useState<RosterShellResult | null>(null);
  const [matchResult, setMatchResult] = useState<SmartMatchResult | null>(null);

  // Fetch clinical skills
  const { data: skills = [] } = useQuery<ClinicalSkill[]>({
    queryKey: ["clinical-skills", orgId],
    queryFn: () => fetchClinicalSkills(orgId),
    enabled: open && !!orgId,
    staleTime: 300_000,
  });

  // Auto-update shift pattern when coverage type changes
  useEffect(() => {
    const opt = COVERAGE_OPTIONS.find((o) => o.value === coverageType);
    if (opt) setShiftPattern(opt.shifts);
  }, [coverageType]);

  // Skill toggle
  const toggleSkill = useCallback((skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId],
    );
  }, []);

  // Generate pipeline
  const runPipeline = useCallback(async () => {
    setPhase("generating");

    try {
      // 1. Create blueprint
      const bpResult = await createCareBlueprint({
        organization_id: orgId,
        participant_id: participantId,
        coverage_type: coverageType,
        staffing_ratio: ratio,
        required_skills: selectedSkills,
        gender_preference: genderPref,
        shift_pattern: shiftPattern,
      });

      if (!bpResult.success || !bpResult.blueprint) {
        throw new Error(bpResult.error || "Failed to create blueprint");
      }

      setBlueprint(bpResult.blueprint);

      // 2. Generate roster shell
      const shell = await generateRosterShell(bpResult.blueprint.id, weeks);
      setShellResult(shell);

      // 3. Smart match
      setPhase("matching");
      const match = await triggerSmartMatch(bpResult.blueprint.id);
      setMatchResult(match);

      // 4. Complete
      setPhase("complete");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    } catch (e: any) {
      setPhase("config");
      alert(e.message || "Pipeline failed");
    }
  }, [orgId, participantId, coverageType, ratio, selectedSkills, genderPref, shiftPattern, weeks, queryClient]);

  // Reset on close
  const handleClose = useCallback(() => {
    setPhase("config");
    setCoverageType("standard_hourly");
    setRatio(1);
    setSelectedSkills([]);
    setBlueprint(null);
    setShellResult(null);
    setMatchResult(null);
    onClose();
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  if (!open) return null;

  const totalShiftsPreview = shiftPattern.length * 7 * weeks * ratio;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[720px] max-h-[85vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0A0A0A]"
            style={{ boxShadow: "0 0 80px rgba(16,185,129,0.06)" }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800/60 bg-[#0A0A0A]/95 px-6 py-4 backdrop-blur-md">
              <div>
                <h2 className="text-[15px] font-semibold text-white">Care Blueprint</h2>
                <p className="mt-0.5 text-[12px] text-zinc-500">{participantName}</p>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              {/* ── Phase: Configuration ── */}
              {phase === "config" && (
                <div className="space-y-6">
                  {/* Coverage Type */}
                  <section>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Coverage Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {COVERAGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCoverageType(opt.value)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            coverageType === opt.value
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                          }`}
                        >
                          <p className={`text-[13px] font-medium ${coverageType === opt.value ? "text-emerald-400" : "text-zinc-300"}`}>{opt.label}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-600">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Staffing Ratio */}
                  <section>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Staffing Ratio</label>
                    <div className="flex gap-2">
                      {RATIO_OPTIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRatio(r)}
                          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all ${
                            ratio === r
                              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
                              : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                          }`}
                        >
                          <Users size={14} />
                          {r}:{1}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Required Clinical Skills */}
                  <section>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Required Clinical Skills</label>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => toggleSkill(skill.id)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-all ${
                            selectedSkills.includes(skill.id)
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                          }`}
                        >
                          {selectedSkills.includes(skill.id) && <Check size={10} className="mr-1 inline" />}
                          {skill.name}
                        </button>
                      ))}
                      {skills.length === 0 && (
                        <p className="text-[11px] text-zinc-600">No clinical skills configured yet. Workers will not be filtered by skills.</p>
                      )}
                    </div>
                  </section>

                  {/* Gender Preference */}
                  <section>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Gender Preference</label>
                    <div className="flex gap-2">
                      {(["no_preference", "male_only", "female_only"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGenderPref(g)}
                          className={`rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
                            genderPref === g
                              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
                              : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                          }`}
                        >
                          {g === "no_preference" ? "No Preference" : g === "male_only" ? "Male Only" : "Female Only"}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Shift Pattern Preview */}
                  <section>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Shift Pattern</label>
                    <div className="space-y-1.5">
                      {shiftPattern.map((sp, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-900/30 px-3 py-2">
                          <Clock size={12} className="text-zinc-600" />
                          <span className="text-[12px] font-medium text-zinc-300 w-24">{sp.label}</span>
                          <span className="text-[12px] text-zinc-500">{sp.start} — {sp.end}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Weeks selector */}
                  <section>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Generate Weeks</label>
                    <div className="flex gap-2">
                      {[2, 4, 6, 8].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setWeeks(w)}
                          className={`rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
                            weeks === w
                              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-400"
                              : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                          }`}
                        >
                          {w} Weeks
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* Summary + Action */}
                  <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={14} className="text-emerald-500" />
                      <span className="text-[12px] font-semibold text-zinc-300">Generation Preview</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {shiftPattern.length} shifts/day × {7} days × {weeks} weeks × {ratio} staff = <span className="font-semibold text-white">{totalShiftsPreview} shift slots</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={runPipeline}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-[14px] font-semibold text-black transition-colors hover:bg-zinc-200"
                  >
                    <Sparkles size={16} />
                    Generate Roster & Auto-Fill
                  </button>
                </div>
              )}

              {/* ── Phase: Generating ── */}
              {phase === "generating" && (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Zap size={32} className="text-emerald-500" />
                  </motion.div>
                  <p className="text-[14px] font-semibold text-white">Generating Roster Shell</p>
                  <p className="text-[12px] text-zinc-500">Creating {totalShiftsPreview} shift slots across {weeks} weeks...</p>
                </div>
              )}

              {/* ── Phase: Matching ── */}
              {phase === "matching" && (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <Brain size={32} className="text-blue-500" />
                  </motion.div>
                  <p className="text-[14px] font-semibold text-white">Smart Match Running</p>
                  <p className="text-[12px] text-zinc-500">
                    {shellResult && <>Shell created: {shellResult.total_shifts_created} shifts. </>}
                    Matching workers by skills, availability & continuity...
                  </p>
                </div>
              )}

              {/* ── Phase: Complete ── */}
              {phase === "complete" && (
                <div className="space-y-6 py-4">
                  <div className="text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
                      className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10"
                    >
                      <Check size={24} className="text-emerald-500" />
                    </motion.div>
                    <h3 className="text-[16px] font-semibold text-white">Roster Generated</h3>
                    <p className="mt-1 text-[12px] text-zinc-500">{participantName}&apos;s care roster is ready</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3 text-center">
                      <p className="text-[20px] font-bold text-white">{shellResult?.total_shifts_created ?? 0}</p>
                      <p className="text-[10px] text-zinc-500">Shifts Created</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3 text-center">
                      <p className="text-[20px] font-bold text-emerald-400">{matchResult?.filled ?? 0}</p>
                      <p className="text-[10px] text-zinc-500">Auto-Filled</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3 text-center">
                      <p className={`text-[20px] font-bold ${(matchResult?.remaining_unfilled ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {matchResult?.remaining_unfilled ?? 0}
                      </p>
                      <p className="text-[10px] text-zinc-500">Need Attention</p>
                    </div>
                  </div>

                  {/* Assignments preview */}
                  {matchResult && matchResult.assignments.length > 0 && (
                    <section>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Recent Assignments</label>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {matchResult.assignments.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-zinc-400 bg-zinc-900/30">
                            <Check size={10} className="text-emerald-500 shrink-0" />
                            <span className="text-zinc-300 font-medium">{a.worker_name}</span>
                            <span className="text-zinc-600">→ assigned</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {(matchResult?.remaining_unfilled ?? 0) > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-300/80">
                        {matchResult?.remaining_unfilled} shifts could not be auto-filled. These require manual assignment from the Dispatch board due to skill or availability constraints.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200"
                    >
                      <Calendar size={14} />
                      View on Dispatch Board
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
