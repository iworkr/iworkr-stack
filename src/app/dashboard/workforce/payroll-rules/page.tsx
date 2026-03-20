/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useTransition, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  Scale, Plus, ArrowLeft, Play, Trash2, Loader2,
  FileText, Shield, Zap, AlertTriangle, Archive, CheckCircle2,
  ToggleLeft, ToggleRight, Clock, Calendar, DollarSign,
  Layers, X, Hash, GripVertical, Eye, Sparkles, BarChart3,
  FlaskConical, CircleDot, Boxes, ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  createAgreement,
  getAgreements,
  getAgreementDetail,
  updateAgreement,
  activateAgreement,
  archiveAgreement,
  createRule,
  updateRule,
  deleteRule,
  getRulesForAgreement,
  simulatePayroll,
  getEbaDashboardStats,
  type PayrollAgreement,
  type PayrollRule,
  type EbaAgreementStatus,
  type EbaRuleCategory,
  type EbaStackingBehavior,
  type ConditionsAST,
  type ConditionNode,
  type ActionsAST,
  type SimulationResult,
  type SimulationPayLine,
  type EbaDashboardStats,
  type RuleLogic,
} from "@/app/actions/chronos-eba";

// ─── Constants ────────────────────────────────────────────────────────────────

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_SPRING: [number, number, number, number] = [0.175, 0.885, 0.32, 1.275];
const EASE_SNAPPY: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

const MONO_FONT = "'JetBrains Mono', 'Courier New', monospace";

const STATUS_CONFIG: Record<
  EbaAgreementStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  DRAFT: { label: "Draft", bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-500" },
  TESTING: { label: "Testing", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-500" },
  ACTIVE: { label: "Active", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" },
  ARCHIVED: { label: "Archived", bg: "bg-zinc-700/20", text: "text-zinc-600", dot: "bg-zinc-700" },
};

const CATEGORY_CONFIG: Record<
  EbaRuleCategory,
  { label: string; bg: string; text: string; icon: typeof Zap }
> = {
  PENALTY_RATE: { label: "Penalty Rate", bg: "bg-rose-500/10", text: "text-rose-400", icon: Zap },
  ALLOWANCE_FIXED: { label: "Fixed Allowance", bg: "bg-blue-500/10", text: "text-blue-400", icon: DollarSign },
  OVERTIME_TRIGGER: { label: "Overtime Trigger", bg: "bg-orange-500/10", text: "text-orange-400", icon: Clock },
  MINIMUM_ENGAGEMENT: { label: "Min. Engagement", bg: "bg-violet-500/10", text: "text-violet-400", icon: Shield },
  TIME_RECLASSIFICATION: { label: "Time Reclass", bg: "bg-cyan-500/10", text: "text-cyan-400", icon: Layers },
  BROKEN_SHIFT: { label: "Broken Shift", bg: "bg-amber-500/10", text: "text-amber-400", icon: AlertTriangle },
};

const STACKING_OPTIONS: { value: EbaStackingBehavior; label: string; desc: string }[] = [
  { value: "HIGHEST_WINS", label: "Highest Rate Wins", desc: "Only the highest multiplier applies" },
  { value: "COMPOUND", label: "Compound Rates", desc: "Multipliers are applied sequentially" },
  { value: "ADDITIVE", label: "Additive", desc: "Multiplier increments are summed" },
];

const CONDITION_TYPE_OPTIONS = [
  { value: "time_range", label: "Time of Day" },
  { value: "day_of_week", label: "Day of Week" },
  { value: "shift_duration", label: "Shift Duration" },
  { value: "weekly_hours", label: "Weekly Hours" },
  { value: "public_holiday", label: "Public Holiday" },
  { value: "employment_type", label: "Employment Type" },
] as const;

const DAYS_OF_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const EMPLOYMENT_TYPES = ["CASUAL", "PART_TIME", "FULL_TIME"] as const;

const ACTION_TYPE_OPTIONS = [
  { value: "APPLY_MULTIPLIER", label: "Apply Multiplier" },
  { value: "ADD_FIXED_ALLOWANCE", label: "Add Fixed Allowance" },
  { value: "RECLASSIFY_TIME", label: "Reclassify Time" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(val);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function makeDefaultCondition(): ConditionNode {
  return { type: "time_range", start: "06:00", end: "18:00", operator: "is_between" };
}

function makeDefaultActions(): ActionsAST {
  return { action_type: "APPLY_MULTIPLIER", value: 1.5, pay_category_label: "PENALTY_RATE" };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EbaAgreementStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: EbaRuleCategory }) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ─── Telemetry Card ───────────────────────────────────────────────────────────

function TelemetryCard({
  label,
  value,
  icon: Icon,
  color = "text-zinc-400",
  delay = 0,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE_EXPO }}
      className="relative overflow-hidden rounded-lg border border-white/5 bg-zinc-950/40 p-4"
    >
      <div className="absolute inset-0 bg-noise opacity-[0.015] pointer-events-none" />
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span
          className={`text-2xl font-bold ${color}`}
          style={{ fontFamily: MONO_FONT }}
        >
          {value}
        </span>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
        {label}
      </p>
    </motion.div>
  );
}

// ─── New Agreement Modal ──────────────────────────────────────────────────────

function NewAgreementModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    effective_from: string;
    effective_to: string;
  }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
    });
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: EASE_EXPO }}
            className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-[14px] font-semibold text-zinc-200">New Agreement</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">
                  Agreement Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SCHADS Award 2025"
                  className="w-full h-9 px-3 text-[13px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the enterprise agreement…"
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">
                    Effective From
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full h-9 px-3 text-[13px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40 transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">
                    Effective To
                  </label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="w-full h-9 px-3 text-[13px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-3 text-[12px] font-medium text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="h-8 px-4 text-[12px] font-semibold text-black bg-emerald-500 rounded-lg hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  Create Agreement
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Condition Row ────────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  index,
  onChange,
  onDelete,
  showLogicToggle,
  logicOperator,
  onToggleLogic,
}: {
  condition: ConditionNode;
  index: number;
  onChange: (updated: ConditionNode) => void;
  onDelete: () => void;
  showLogicToggle: boolean;
  logicOperator: "AND" | "OR";
  onToggleLogic: () => void;
}) {
  const update = (patch: Partial<ConditionNode>) => onChange({ ...condition, ...patch });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: EASE_SNAPPY }}
    >
      {showLogicToggle && (
        <div className="flex items-center justify-center py-1.5">
          <button
            type="button"
            onClick={onToggleLogic}
            className={`px-3 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              logicOperator === "AND"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {logicOperator}
          </button>
        </div>
      )}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/30 border border-white/5">
        <div className="flex items-center mt-1">
          <GripVertical className="w-3.5 h-3.5 text-zinc-700" />
        </div>

        {/* Condition Type */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={condition.type}
              onChange={(e) => {
                const type = e.target.value as ConditionNode["type"];
                const defaults: Record<string, Partial<ConditionNode>> = {
                  time_range: { start: "06:00", end: "18:00", operator: "is_between" },
                  day_of_week: { values: ["MON", "TUE", "WED", "THU", "FRI"], operator: "in" },
                  shift_duration: { value: 8, operator: "greater_than" },
                  weekly_hours: { value: 38, operator: "greater_than" },
                  public_holiday: { value: true, operator: "is" },
                  employment_type: { value: "CASUAL", operator: "is" },
                };
                onChange({ type, ...defaults[type] } as ConditionNode);
              }}
              className="h-7 px-2 text-[11px] text-zinc-200 bg-zinc-900 border border-white/10 rounded focus:outline-none focus:border-emerald-500/40"
            >
              {CONDITION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* Value inputs based on type */}
            {condition.type === "time_range" && (
              <>
                <span className="text-[10px] text-zinc-600 uppercase">between</span>
                <input
                  type="time"
                  value={condition.start || "06:00"}
                  onChange={(e) => update({ start: e.target.value })}
                  className="h-7 px-2 text-[11px] text-zinc-200 bg-zinc-900 border border-white/10 rounded focus:outline-none focus:border-emerald-500/40 [color-scheme:dark]"
                  style={{ fontFamily: MONO_FONT }}
                />
                <span className="text-[10px] text-zinc-600 uppercase">and</span>
                <input
                  type="time"
                  value={condition.end || "18:00"}
                  onChange={(e) => update({ end: e.target.value })}
                  className="h-7 px-2 text-[11px] text-zinc-200 bg-zinc-900 border border-white/10 rounded focus:outline-none focus:border-emerald-500/40 [color-scheme:dark]"
                  style={{ fontFamily: MONO_FONT }}
                />
              </>
            )}

            {condition.type === "day_of_week" && (
              <div className="flex items-center gap-1 flex-wrap">
                {DAYS_OF_WEEK.map((day) => {
                  const selected = (condition.values || []).includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const current = condition.values || [];
                        const next = selected
                          ? current.filter((d) => d !== day)
                          : [...current, day];
                        update({ values: next });
                      }}
                      className={`w-8 h-7 text-[9px] font-bold rounded transition-colors ${
                        selected
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-zinc-900 text-zinc-600 border border-white/5 hover:border-white/10"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            )}

            {condition.type === "shift_duration" && (
              <>
                <span className="text-[10px] text-zinc-600 uppercase">greater than</span>
                <input
                  type="number"
                  value={typeof condition.value === "number" ? condition.value : 8}
                  onChange={(e) => update({ value: parseFloat(e.target.value) || 0 })}
                  className="h-7 w-16 px-2 text-[11px] text-zinc-200 bg-zinc-900 border border-white/10 rounded focus:outline-none focus:border-emerald-500/40"
                  style={{ fontFamily: MONO_FONT }}
                  min={0}
                  step={0.5}
                />
                <span className="text-[10px] text-zinc-500">hours</span>
              </>
            )}

            {condition.type === "weekly_hours" && (
              <>
                <span className="text-[10px] text-zinc-600 uppercase">greater than</span>
                <input
                  type="number"
                  value={typeof condition.value === "number" ? condition.value : 38}
                  onChange={(e) => update({ value: parseFloat(e.target.value) || 0 })}
                  className="h-7 w-16 px-2 text-[11px] text-zinc-200 bg-zinc-900 border border-white/10 rounded focus:outline-none focus:border-emerald-500/40"
                  style={{ fontFamily: MONO_FONT }}
                  min={0}
                  step={0.5}
                />
                <span className="text-[10px] text-zinc-500">hours</span>
              </>
            )}

            {condition.type === "public_holiday" && (
              <button
                type="button"
                onClick={() => update({ value: !condition.value })}
                className="flex items-center gap-1.5"
              >
                {condition.value ? (
                  <ToggleRight className="w-5 h-5 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-zinc-600" />
                )}
                <span className={`text-[11px] font-medium ${condition.value ? "text-emerald-400" : "text-zinc-600"}`}>
                  {condition.value ? "Yes" : "No"}
                </span>
              </button>
            )}

            {condition.type === "employment_type" && (
              <select
                value={typeof condition.value === "string" ? condition.value : "CASUAL"}
                onChange={(e) => update({ value: e.target.value })}
                className="h-7 px-2 text-[11px] text-zinc-200 bg-zinc-900 border border-white/10 rounded focus:outline-none focus:border-emerald-500/40"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="mt-0.5 w-6 h-6 flex items-center justify-center rounded text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Rule Editor Panel ────────────────────────────────────────────────────────

interface RuleEditorState {
  name: string;
  description: string;
  category: EbaRuleCategory;
  priority_weight: number;
  stacking_behavior: EbaStackingBehavior;
  is_active: boolean;
  conditions: ConditionNode[];
  logic_operator: "AND" | "OR";
  action_type: ActionsAST["action_type"];
  action_value: number;
  pay_category_label: string;
}

function ruleToEditorState(rule: PayrollRule): RuleEditorState {
  const logic = rule.rule_logic as RuleLogic | null;
  const conditionsAst = logic?.conditions_ast;
  const actionsAst = logic?.actions_ast;

  return {
    name: rule.name,
    description: rule.description || "",
    category: rule.category,
    priority_weight: rule.priority_weight,
    stacking_behavior: rule.stacking_behavior,
    is_active: rule.is_active,
    conditions: conditionsAst?.conditions || [],
    logic_operator: conditionsAst?.operator || "AND",
    action_type: actionsAst?.action_type || "APPLY_MULTIPLIER",
    action_value: actionsAst?.value ?? 1.5,
    pay_category_label: actionsAst?.pay_category_label || "PENALTY_RATE",
  };
}

function editorStateToASTs(state: RuleEditorState): {
  conditions_ast: ConditionsAST;
  actions_ast: ActionsAST;
} {
  return {
    conditions_ast: {
      operator: state.logic_operator,
      conditions: state.conditions,
    },
    actions_ast: {
      action_type: state.action_type,
      value: state.action_value,
      pay_category_label: state.pay_category_label,
    },
  };
}

function RuleEditorPanel({
  rule,
  onSave,
  onCancel,
  saving,
}: {
  rule: PayrollRule | null;
  onSave: (state: RuleEditorState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const defaultState: RuleEditorState = {
    name: "",
    description: "",
    category: "PENALTY_RATE",
    priority_weight: 50,
    stacking_behavior: "HIGHEST_WINS",
    is_active: true,
    conditions: [makeDefaultCondition()],
    logic_operator: "AND",
    action_type: "APPLY_MULTIPLIER",
    action_value: 1.5,
    pay_category_label: "PENALTY_RATE",
  };

  const [state, setState] = useState<RuleEditorState>(
    rule ? ruleToEditorState(rule) : defaultState
  );

  const patch = (p: Partial<RuleEditorState>) => setState((s) => ({ ...s, ...p }));

  function addCondition() {
    patch({ conditions: [...state.conditions, makeDefaultCondition()] });
  }

  function updateCondition(index: number, updated: ConditionNode) {
    const next = [...state.conditions];
    next[index] = updated;
    patch({ conditions: next });
  }

  function removeCondition(index: number) {
    patch({ conditions: state.conditions.filter((_, i) => i !== index) });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.3, ease: EASE_EXPO }}
      className="space-y-4"
    >
      {/* Rule Metadata */}
      <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Hash className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            Rule Configuration
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Name *</label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Night Shift Penalty"
              className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Category</label>
            <select
              value={state.category}
              onChange={(e) => patch({ category: e.target.value as EbaRuleCategory })}
              className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
            >
              {(Object.keys(CATEGORY_CONFIG) as EbaRuleCategory[]).map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Priority Weight</label>
            <input
              type="number"
              value={state.priority_weight}
              onChange={(e) => patch({ priority_weight: parseInt(e.target.value) || 0 })}
              min={1}
              max={100}
              className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
              style={{ fontFamily: MONO_FONT }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Description</label>
            <input
              type="text"
              value={state.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Optional description…"
              className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* IF Block — Conditions */}
      <div className="rounded-lg border border-white/5 bg-zinc-950/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-zinc-900/20">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
              When these conditions are met
            </span>
          </div>
          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-1 h-6 px-2 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/10 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Condition
          </button>
        </div>
        <div className="p-3 space-y-0">
          <AnimatePresence mode="popLayout">
            {state.conditions.length === 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[11px] text-zinc-600 text-center py-6"
              >
                No conditions — rule will always match
              </motion.p>
            )}
            {state.conditions.map((cond, i) => (
              <ConditionRow
                key={`${i}-${cond.type}`}
                condition={cond}
                index={i}
                onChange={(u) => updateCondition(i, u)}
                onDelete={() => removeCondition(i)}
                showLogicToggle={i > 0}
                logicOperator={state.logic_operator}
                onToggleLogic={() =>
                  patch({ logic_operator: state.logic_operator === "AND" ? "OR" : "AND" })
                }
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* THEN Block — Actions */}
      <div className="rounded-lg border border-white/5 bg-zinc-950/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-zinc-900/20">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] uppercase tracking-wider text-zinc-300 font-bold">
            Apply this outcome
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Action Type</label>
              <select
                value={state.action_type}
                onChange={(e) => patch({ action_type: e.target.value as ActionsAST["action_type"] })}
                className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
              >
                {ACTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">
                {state.action_type === "APPLY_MULTIPLIER" ? "Multiplier" : "Amount ($)"}
              </label>
              <input
                type="number"
                value={state.action_value}
                onChange={(e) => patch({ action_value: parseFloat(e.target.value) || 0 })}
                step={state.action_type === "APPLY_MULTIPLIER" ? 0.05 : 1}
                min={0}
                className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
                style={{ fontFamily: MONO_FONT }}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Pay Category Label</label>
              <input
                type="text"
                value={state.pay_category_label}
                onChange={(e) => patch({ pay_category_label: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                placeholder="EBA_NIGHT_15"
                className="w-full h-8 px-3 text-[12px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40"
                style={{ fontFamily: MONO_FONT }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stacking Behavior */}
      <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            Stacking Behavior
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {STACKING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => patch({ stacking_behavior: opt.value })}
              className={`p-3 rounded-lg border text-left transition-all ${
                state.stacking_behavior === opt.value
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-white/5 bg-zinc-900/20 hover:border-white/10"
              }`}
            >
              <p className={`text-[11px] font-semibold ${state.stacking_behavior === opt.value ? "text-emerald-400" : "text-zinc-300"}`}>
                {opt.label}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AST Preview */}
      <div className="rounded-lg border border-white/5 bg-zinc-950/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-zinc-900/20">
          <Boxes className="w-3.5 h-3.5 text-zinc-600" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
            Compiled AST Preview
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-zinc-700 mb-1 font-bold">conditions_ast</p>
            <pre
              className="text-[10px] text-zinc-500 bg-zinc-900/40 rounded-lg p-2 overflow-x-auto max-h-32 scrollbar-none"
              style={{ fontFamily: MONO_FONT }}
            >
              {JSON.stringify(editorStateToASTs(state).conditions_ast, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest text-zinc-700 mb-1 font-bold">actions_ast</p>
            <pre
              className="text-[10px] text-zinc-500 bg-zinc-900/40 rounded-lg p-2 overflow-x-auto max-h-32 scrollbar-none"
              style={{ fontFamily: MONO_FONT }}
            >
              {JSON.stringify(editorStateToASTs(state).actions_ast, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 text-[12px] font-medium text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(state)}
          disabled={saving || !state.name.trim()}
          className="h-8 px-4 text-[12px] font-semibold text-black bg-emerald-500 rounded-lg hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          {rule ? "Update Rule" : "Create Rule"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
  highestPriority,
}: {
  rule: PayrollRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  highestPriority: number;
}) {
  const priorityPct = highestPriority > 0 ? (rule.priority_weight / highestPriority) * 100 : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: EASE_SNAPPY }}
      className={`group relative rounded-lg border p-4 transition-all cursor-pointer ${
        rule.is_active
          ? "border-white/5 bg-zinc-950/40 hover:border-white/10"
          : "border-white/[0.03] bg-zinc-950/20 opacity-50"
      }`}
      onClick={onEdit}
    >
      {/* Priority indicator bar */}
      <div className="absolute top-0 left-0 h-0.5 rounded-t-lg bg-emerald-500/30" style={{ width: `${priorityPct}%` }} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[13px] font-semibold text-zinc-200 truncate">{rule.name}</p>
            <CategoryBadge category={rule.category} />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1" style={{ fontFamily: MONO_FONT }}>
              <BarChart3 className="w-3 h-3" />
              Priority: {rule.priority_weight}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {STACKING_OPTIONS.find((s) => s.value === rule.stacking_behavior)?.label || rule.stacking_behavior}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors hover:bg-white/5"
            title={rule.is_active ? "Deactivate" : "Activate"}
          >
            {rule.is_active ? (
              <ToggleRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-zinc-600" />
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-700 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Simulation Panel ─────────────────────────────────────────────────────────

function SimulationPanel({
  open,
  onClose,
  orgId,
  agreementId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  agreementId: string;
}) {
  const [employmentType, setEmploymentType] = useState("CASUAL");
  const [baseRate, setBaseRate] = useState(38.75);
  const [shiftStart, setShiftStart] = useState("2026-03-20T06:00");
  const [shiftEnd, setShiftEnd] = useState("2026-03-20T14:00");
  const [weeklyHours, setWeeklyHours] = useState(32);
  const [isPublicHoliday, setIsPublicHoliday] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    const { result: simResult, error: simError } = await simulatePayroll(orgId, agreementId, {
      employment_type: employmentType,
      base_rate: baseRate,
      shift_start: shiftStart,
      shift_end: shiftEnd,
      weekly_hours_worked: weeklyHours,
      is_public_holiday: isPublicHoliday,
    });
    setLoading(false);
    if (simError) {
      setError(simError);
    } else {
      setResult(simResult);
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.3, ease: EASE_EXPO }}
            className="w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[14px] font-semibold text-zinc-200">Payroll Simulator</h3>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Input Parameters */}
              <div className="p-5 border-b border-white/5 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Simulation Input</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-600 mb-1">Employment Type</label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full h-8 px-2 text-[11px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
                    >
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 mb-1">Base Rate ($)</label>
                    <input
                      type="number"
                      value={baseRate}
                      onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                      step={0.25}
                      min={0}
                      className="w-full h-8 px-2 text-[11px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
                      style={{ fontFamily: MONO_FONT }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 mb-1">Weekly Hours</label>
                    <input
                      type="number"
                      value={weeklyHours}
                      onChange={(e) => setWeeklyHours(parseFloat(e.target.value) || 0)}
                      step={0.5}
                      min={0}
                      className="w-full h-8 px-2 text-[11px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40"
                      style={{ fontFamily: MONO_FONT }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 mb-1">Shift Start</label>
                    <input
                      type="datetime-local"
                      value={shiftStart}
                      onChange={(e) => setShiftStart(e.target.value)}
                      className="w-full h-8 px-2 text-[11px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40 [color-scheme:dark]"
                      style={{ fontFamily: MONO_FONT }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-600 mb-1">Shift End</label>
                    <input
                      type="datetime-local"
                      value={shiftEnd}
                      onChange={(e) => setShiftEnd(e.target.value)}
                      className="w-full h-8 px-2 text-[11px] text-zinc-200 bg-zinc-900/60 border border-white/10 rounded-lg focus:outline-none focus:border-emerald-500/40 [color-scheme:dark]"
                      style={{ fontFamily: MONO_FONT }}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <button
                      type="button"
                      onClick={() => setIsPublicHoliday(!isPublicHoliday)}
                      className="flex items-center gap-2 h-8"
                    >
                      {isPublicHoliday ? (
                        <ToggleRight className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-zinc-600" />
                      )}
                      <span className={`text-[11px] ${isPublicHoliday ? "text-emerald-400" : "text-zinc-500"}`}>
                        Public Holiday
                      </span>
                    </button>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleRun}
                    disabled={loading}
                    className="h-8 px-4 text-[12px] font-semibold text-black bg-emerald-500 rounded-lg hover:bg-emerald-400 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    Run Simulation
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <p className="text-[11px] text-rose-400">{error}</p>
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="p-5 space-y-4">
                  {/* Pay Lines Table */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
                      Fractured Pay Lines
                    </p>
                    <div className="rounded-lg border border-white/5 overflow-hidden">
                      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] px-3 py-2 border-b border-white/5 bg-zinc-900/40">
                        {["Time Block", "Category", "Hours", "Rate", "Amount"].map((h) => (
                          <span
                            key={h}
                            className="text-[9px] uppercase tracking-widest font-bold text-zinc-600"
                            style={{ fontFamily: MONO_FONT }}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      {result.pay_lines.map((line, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors"
                        >
                          <span className="text-[11px] text-zinc-300" style={{ fontFamily: MONO_FONT }}>
                            {line.time_block}
                          </span>
                          <span className="text-[11px] text-amber-400" style={{ fontFamily: MONO_FONT }}>
                            {line.category}
                          </span>
                          <span className="text-[11px] text-zinc-300" style={{ fontFamily: MONO_FONT }}>
                            {line.hours.toFixed(2)}h
                          </span>
                          <span className="text-[11px] text-zinc-300" style={{ fontFamily: MONO_FONT }}>
                            ${line.rate.toFixed(4)}
                          </span>
                          <span className="text-[11px] text-white font-medium" style={{ fontFamily: MONO_FONT }}>
                            {formatAUD(line.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                      Total Simulation Cost
                    </span>
                    <span
                      className="text-xl font-bold text-emerald-400"
                      style={{ fontFamily: MONO_FONT }}
                    >
                      {formatAUD(result.total_cost)}
                    </span>
                  </div>

                  {/* Debug Log */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
                      Debug Log — Rule Evaluation Trace
                    </p>
                    <div className="rounded-lg border border-white/5 bg-zinc-900/30 p-3 max-h-60 overflow-y-auto scrollbar-none">
                      <pre
                        className="text-[10px] text-zinc-500 whitespace-pre-wrap"
                        style={{ fontFamily: MONO_FONT }}
                      >
                        {result.debug_log.join("\n")}
                      </pre>
                    </div>
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

// ─── Priority Visualization ───────────────────────────────────────────────────

function PriorityVisualization({ rules }: { rules: PayrollRule[] }) {
  const sorted = [...rules].sort((a, b) => b.priority_weight - a.priority_weight);
  const maxPriority = sorted[0]?.priority_weight || 1;

  // Detect conflicts: same priority weight
  const priorityMap = new Map<number, PayrollRule[]>();
  for (const r of sorted) {
    const existing = priorityMap.get(r.priority_weight) || [];
    existing.push(r);
    priorityMap.set(r.priority_weight, existing);
  }
  const conflicts = Array.from(priorityMap.entries()).filter(([, rules]) => rules.length > 1);

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/5 bg-zinc-950/40 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
          Rule Priority Ordering
        </span>
        <span className="text-[9px] text-zinc-700 ml-auto">
          Higher weight = evaluated first
        </span>
      </div>

      <div className="space-y-1.5">
        {sorted.map((rule, i) => {
          const pct = (rule.priority_weight / maxPriority) * 100;
          const hasConflict = (priorityMap.get(rule.priority_weight)?.length || 0) > 1;

          return (
            <div key={rule.id} className="flex items-center gap-2">
              <span
                className="text-[10px] text-zinc-600 w-5 text-right shrink-0"
                style={{ fontFamily: MONO_FONT }}
              >
                {i + 1}
              </span>
              <div className="flex-1 h-6 relative rounded bg-zinc-900/40 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: EASE_EXPO }}
                  className={`h-full rounded ${
                    hasConflict ? "bg-amber-500/20" : "bg-emerald-500/15"
                  }`}
                />
                <div className="absolute inset-0 flex items-center px-2 justify-between">
                  <span className="text-[10px] text-zinc-300 truncate">{rule.name}</span>
                  <span
                    className={`text-[10px] font-bold shrink-0 ${hasConflict ? "text-amber-400" : "text-zinc-500"}`}
                    style={{ fontFamily: MONO_FONT }}
                  >
                    {rule.priority_weight}
                  </span>
                </div>
              </div>
              {hasConflict && (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {conflicts.length > 0 && (
        <div className="mt-2 p-2 rounded bg-amber-500/5 border border-amber-500/10">
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {conflicts.length} priority conflict{conflicts.length > 1 ? "s" : ""} detected — rules with the same weight may produce non-deterministic ordering
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Rule Builder View ────────────────────────────────────────────────────────

function RuleBuilderView({
  agreement,
  orgId,
  onBack,
  onRefresh,
}: {
  agreement: PayrollAgreement;
  orgId: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [editingRule, setEditingRule] = useState<PayrollRule | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rulesQueryClient = useQueryClient();

  const { data: rules = [], isLoading: loading } = useQuery<PayrollRule[]>({
    queryKey: [...queryKeys.workforce.payrollRules(orgId), "rules", agreement.id],
    queryFn: async () => {
      const { rules: data } = await getRulesForAgreement(agreement.id);
      return data;
    },
  });

  const highestPriority = useMemo(
    () => Math.max(...rules.map((r) => r.priority_weight), 1),
    [rules]
  );

  async function handleSaveRule(state: RuleEditorState) {
    setSaving(true);
    const asts = editorStateToASTs(state);

    if (editingRule) {
      const { error } = await updateRule(editingRule.id, {
        name: state.name,
        description: state.description || undefined,
        category: state.category,
        priority_weight: state.priority_weight,
        stacking_behavior: state.stacking_behavior,
        is_active: state.is_active,
        conditions_ast: asts.conditions_ast,
        actions_ast: asts.actions_ast,
      });
      if (!error) {
        setEditingRule(null);
        await rulesQueryClient.invalidateQueries({ queryKey: [...queryKeys.workforce.payrollRules(orgId), "rules", agreement.id] });
      }
    } else {
      const { error } = await createRule(orgId, agreement.id, {
        name: state.name,
        description: state.description || undefined,
        category: state.category,
        priority_weight: state.priority_weight,
        stacking_behavior: state.stacking_behavior,
        conditions_ast: asts.conditions_ast,
        actions_ast: asts.actions_ast,
      });
      if (!error) {
        setCreatingRule(false);
        await rulesQueryClient.invalidateQueries({ queryKey: [...queryKeys.workforce.payrollRules(orgId), "rules", agreement.id] });
      }
    }
    setSaving(false);
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm("Delete this rule? This action cannot be undone.")) return;
    const { error } = await deleteRule(ruleId);
    if (!error) {
      if (editingRule?.id === ruleId) setEditingRule(null);
      await rulesQueryClient.invalidateQueries({ queryKey: [...queryKeys.workforce.payrollRules(orgId), "rules", agreement.id] });
    }
  }

  async function handleToggleRule(rule: PayrollRule) {
    startTransition(async () => {
      await updateRule(rule.id, { is_active: !rule.is_active });
      await rulesQueryClient.invalidateQueries({ queryKey: [...queryKeys.workforce.payrollRules(orgId), "rules", agreement.id] });
    });
  }

  async function handleActivateAgreement() {
    startTransition(async () => {
      await activateAgreement(agreement.id);
      onRefresh();
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE_EXPO }}
      className="space-y-4"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-zinc-200">{agreement.name}</h2>
              <StatusBadge status={agreement.status} />
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {formatDate(agreement.effective_from)} — {formatDate(agreement.effective_to)}
              {" · "}v{agreement.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agreement.status !== "ACTIVE" && agreement.status !== "ARCHIVED" && (
            <button
              onClick={handleActivateAgreement}
              disabled={isPending}
              className="h-8 px-3 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              Activate Agreement
            </button>
          )}
          <button
            onClick={() => setShowSimulator(true)}
            className="h-8 px-3 text-[11px] font-semibold text-black bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Run Simulation
          </button>
        </div>
      </div>

      {/* Rule List */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-600" />
          <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">
            Rules ({rules.length})
          </span>
        </div>
        <button
          onClick={() => { setEditingRule(null); setCreatingRule(true); }}
          className="h-7 px-3 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Rule
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Rule Cards */}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {rules.length === 0 && !creatingRule && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-12 h-12 rounded-lg border border-white/5 bg-white/[0.02] flex items-center justify-center mb-3">
                    <Layers className="w-5 h-5 text-zinc-700" />
                  </div>
                  <p className="text-[13px] text-zinc-400 mb-1">No rules yet</p>
                  <p className="text-[11px] text-zinc-600">Add your first payroll rule to this agreement</p>
                </motion.div>
              )}
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => { setCreatingRule(false); setEditingRule(rule); }}
                  onDelete={() => handleDeleteRule(rule.id)}
                  onToggle={() => handleToggleRule(rule)}
                  highestPriority={highestPriority}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Priority Visualization */}
          {rules.length > 1 && <PriorityVisualization rules={rules} />}

          {/* Rule Editor */}
          <AnimatePresence mode="wait">
            {(creatingRule || editingRule) && (
              <RuleEditorPanel
                key={editingRule?.id || "new"}
                rule={editingRule}
                onSave={handleSaveRule}
                onCancel={() => { setCreatingRule(false); setEditingRule(null); }}
                saving={saving}
              />
            )}
          </AnimatePresence>
        </>
      )}

      {/* Simulator */}
      <SimulationPanel
        open={showSimulator}
        onClose={() => setShowSimulator(false)}
        orgId={orgId}
        agreementId={agreement.id}
      />
    </motion.div>
  );
}

// ─── Agreement Card ───────────────────────────────────────────────────────────

function AgreementCard({
  agreement,
  onSelect,
  onActivate,
  onArchive,
}: {
  agreement: PayrollAgreement;
  onSelect: () => void;
  onActivate: () => void;
  onArchive: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: EASE_EXPO }}
      whileHover={{ y: -2 }}
      className="group relative rounded-lg border border-white/5 bg-zinc-950/40 p-4 cursor-pointer hover:border-white/10 transition-all"
      onClick={onSelect}
    >
      <div className="absolute inset-0 rounded-lg bg-noise opacity-[0.015] pointer-events-none" />
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
            <p className="text-[13px] font-semibold text-zinc-200 truncate">{agreement.name}</p>
          </div>
          {agreement.description && (
            <p className="text-[11px] text-zinc-600 line-clamp-2 mt-0.5 ml-6">{agreement.description}</p>
          )}
        </div>
        <StatusBadge status={agreement.status} />
      </div>

      <div className="flex items-center gap-4 text-[10px] text-zinc-600 ml-6">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(agreement.effective_from)} — {formatDate(agreement.effective_to)}
        </span>
        <span className="flex items-center gap-1" style={{ fontFamily: MONO_FONT }}>
          <Layers className="w-3 h-3" />
          {agreement.rule_count ?? 0} rules
        </span>
        <span className="flex items-center gap-1" style={{ fontFamily: MONO_FONT }}>
          v{agreement.version}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-3 ml-6 opacity-0 group-hover:opacity-100 transition-opacity">
        {agreement.status !== "ACTIVE" && agreement.status !== "ARCHIVED" && (
          <button
            onClick={(e) => { e.stopPropagation(); onActivate(); }}
            className="h-6 px-2 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" />
            Activate
          </button>
        )}
        {agreement.status !== "ARCHIVED" && (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            className="h-6 px-2 text-[10px] font-semibold text-zinc-500 border border-white/10 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <Archive className="w-3 h-3" />
            Archive
          </button>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 ml-auto" />
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PayrollRulesPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id) ?? null;

  // ── State ──
  const [view, setView] = useState<"library" | "builder">("library");
  const [showNewModal, setShowNewModal] = useState(false);
  const [creatingAgreement, setCreatingAgreement] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<PayrollAgreement | null>(null);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  // ── Data Loading ──
  const { data: pageData, isLoading: loading } = useQuery<{
    agreements: PayrollAgreement[];
    stats: EbaDashboardStats | null;
  }>({
    queryKey: queryKeys.workforce.payrollRules(orgId!),
    queryFn: async () => {
      const [agreementsResult, statsResult] = await Promise.all([
        getAgreements(orgId!),
        getEbaDashboardStats(orgId!),
      ]);
      return {
        agreements: agreementsResult.agreements,
        stats: statsResult.stats,
      };
    },
    enabled: !!orgId,
  });

  const agreements = pageData?.agreements ?? [];
  const stats = pageData?.stats ?? null;

  // ── Actions ──
  async function handleCreateAgreement(data: {
    name: string;
    description: string;
    effective_from: string;
    effective_to: string;
  }) {
    if (!orgId) return;
    setCreatingAgreement(true);
    const { error } = await createAgreement(orgId, data);
    setCreatingAgreement(false);
    if (!error) {
      setShowNewModal(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollRules(orgId!) });
    }
  }

  async function handleActivate(id: string) {
    startTransition(async () => {
      await activateAgreement(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollRules(orgId!) });
    });
  }

  async function handleArchive(id: string) {
    startTransition(async () => {
      await archiveAgreement(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollRules(orgId!) });
    });
  }

  function selectAgreement(agreement: PayrollAgreement) {
    setSelectedAgreement(agreement);
    setView("builder");
  }

  // ── No Org Guard ──
  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505]">
        <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_EXPO }}
          className="flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-zinc-100 tracking-tight">
                Chronos EBA Engine
              </h1>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                Custom Enterprise Bargaining Agreement Rules — Payroll Sovereignty
              </p>
            </div>
          </div>

          {view === "library" && (
            <button
              onClick={() => setShowNewModal(true)}
              className="h-8 px-4 text-[12px] font-semibold text-black bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Agreement
            </button>
          )}
        </motion.div>

        {/* ── Telemetry Ribbon ── */}
        {view === "library" && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <TelemetryCard
              label="Total Agreements"
              value={stats?.total_agreements ?? 0}
              icon={FileText}
              color="text-zinc-400"
              delay={0}
            />
            <TelemetryCard
              label="Draft"
              value={stats?.draft ?? 0}
              icon={CircleDot}
              color="text-zinc-500"
              delay={0.05}
            />
            <TelemetryCard
              label="Testing"
              value={stats?.testing ?? 0}
              icon={FlaskConical}
              color="text-amber-400"
              delay={0.1}
            />
            <TelemetryCard
              label="Active"
              value={stats?.active ?? 0}
              icon={CheckCircle2}
              color="text-emerald-400"
              delay={0.15}
            />
            <TelemetryCard
              label="Total Rules"
              value={stats?.total_rules ?? 0}
              icon={Layers}
              color="text-blue-400"
              delay={0.2}
            />
          </div>
        )}

        {/* ── View Tabs ── */}
        {view === "library" && (
          <div className="flex items-center gap-0 border-b border-white/5">
            <button
              className="relative px-3 py-2.5 text-[13px] font-medium text-zinc-200"
            >
              Agreement Library
              <div className="absolute bottom-[-1px] left-3 right-3 h-[1px] bg-zinc-200 rounded-sm" />
            </button>
            <button
              className="px-3 py-2.5 text-[13px] text-zinc-600 hover:text-zinc-400 transition-colors"
              onClick={() => {
                if (agreements.length > 0) {
                  selectAgreement(agreements[0]);
                }
              }}
            >
              Rule Builder
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && view === "library" && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
          </div>
        )}

        {/* ── Agreement Library View ── */}
        {!loading && view === "library" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE_EXPO }}
          >
            {agreements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center mb-4">
                  <Scale className="w-6 h-6 text-zinc-700" />
                </div>
                <p className="text-[14px] text-zinc-300 font-medium mb-1">No agreements yet</p>
                <p className="text-[12px] text-zinc-600 max-w-sm">
                  Create your first Enterprise Bargaining Agreement to start building custom payroll rules.
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-4 h-8 px-4 text-[12px] font-semibold text-black bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Agreement
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {agreements.map((agreement) => (
                  <AgreementCard
                    key={agreement.id}
                    agreement={agreement}
                    onSelect={() => selectAgreement(agreement)}
                    onActivate={() => handleActivate(agreement.id)}
                    onArchive={() => handleArchive(agreement.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Rule Builder View ── */}
        {view === "builder" && selectedAgreement && (
          <RuleBuilderView
            agreement={selectedAgreement}
            orgId={orgId}
            onBack={() => { setView("library"); setSelectedAgreement(null); queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollRules(orgId!) }); }}
            onRefresh={async () => {
              const { agreement } = await getAgreementDetail(selectedAgreement.id);
              if (agreement) setSelectedAgreement(agreement);
              await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.payrollRules(orgId!) });
            }}
          />
        )}

        {/* ── New Agreement Modal ── */}
        <NewAgreementModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreateAgreement}
          loading={creatingAgreement}
        />
      </div>
    </div>
  );
}
