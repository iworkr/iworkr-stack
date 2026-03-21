"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  Target,
  Wallet,
  Car,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronRight,
  DollarSign,
  Loader2,
  FileText,
  ClipboardList,
  Calendar,
  Shield,
  Users,
  Sparkles,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchParticipantMedications,
  upsertParticipantMedication,
  deleteParticipantMedication,
  fetchParticipantGoals,
  upsertParticipantGoal,
  deleteParticipantGoal,
  fetchParticipantFundsMetadata,
  updateParticipantFundsMetadata,
  fetchParticipantCarePlans,
  fetchParticipantServiceAgreements,
  createCarePlan,
  type ParticipantMedication,
  type ParticipantGoal,
} from "@/app/actions/participants";
import {
  fetchBlueprintForParticipant,
  type CareBlueprint,
} from "@/app/actions/care-blueprints";

const ease: [number, number, number, number] = [0.16, 1, 0.3, 1];

const ROUTE_LABELS: Record<string, string> = {
  oral: "Oral", topical: "Topical", inhaled: "Inhaled", sublingual: "Sublingual",
  subcutaneous: "Subcutaneous", intramuscular: "IM", rectal: "Rectal",
  ophthalmic: "Ophthalmic", otic: "Otic", nasal: "Nasal", transdermal: "Patch", other: "Other",
};

const FREQ_LABELS: Record<string, string> = {
  once_daily: "Once daily", twice_daily: "Twice daily", three_times_daily: "3× daily",
  four_times_daily: "4× daily", every_morning: "Morning", every_night: "Night",
  weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", prn: "PRN", other: "Other",
};

const GOAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not Started", color: "text-zinc-500", bg: "bg-zinc-500/10" },
  in_progress: { label: "In Progress", color: "text-blue-400", bg: "bg-blue-500/10" },
  achieved: { label: "Achieved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  on_hold: { label: "On Hold", color: "text-amber-400", bg: "bg-amber-500/10" },
};

const CATEGORY_COLORS: Record<string, string> = {
  core: "text-blue-400", capacity_building: "text-violet-400", capital: "text-emerald-400",
};

/* ═══════════════════════════════════════════════════════════════════════════════
   Medications Box
   ═══════════════════════════════════════════════════════════════════════════════ */

export function MedicationsBox({ participantId, orgId }: { participantId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ medication_name: "", dosage: "", route: "oral", frequency: "once_daily", prescribing_doctor: "", is_prn: false, special_instructions: "" });

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ["participants", "medications", participantId],
    queryFn: () => fetchParticipantMedications(participantId, orgId),
    enabled: !!participantId && !!orgId,
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof upsertParticipantMedication>[2]) =>
      upsertParticipantMedication(orgId, participantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", "medications", participantId] });
      setAdding(false);
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteParticipantMedication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants", "medications", participantId] }),
  });

  function resetForm() {
    setForm({ medication_name: "", dosage: "", route: "oral", frequency: "once_daily", prescribing_doctor: "", is_prn: false, special_instructions: "" });
  }

  function startEdit(m: ParticipantMedication) {
    setEditingId(m.id);
    setForm({ medication_name: m.medication_name, dosage: m.dosage, route: m.route, frequency: m.frequency, prescribing_doctor: m.prescribing_doctor || "", is_prn: m.is_prn, special_instructions: m.special_instructions || "" });
    setAdding(false);
  }

  function handleSave() {
    if (!form.medication_name.trim() || !form.dosage.trim()) return;
    saveMut.mutate({ id: editingId || undefined, ...form } as any);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.3 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Pill size={14} className="text-purple-400" />
          <h3 className="text-[13px] font-semibold text-zinc-200">Current Medications</h3>
          <span className="text-[10px] text-zinc-600 tabular-nums">{meds.length}</span>
        </div>
        <button onClick={() => { setAdding(true); setEditingId(null); resetForm(); }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        ><Plus size={12} /> Add</button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
      ) : meds.length === 0 && !adding ? (
        <div className="text-center py-6 text-[12px] text-zinc-600">No medications recorded</div>
      ) : null}

      <div className="space-y-2">
        {meds.map((m) => editingId === m.id ? (
          <MedForm key={m.id} form={form} setForm={setForm} onSave={handleSave} onCancel={() => { setEditingId(null); resetForm(); }} saving={saveMut.isPending} />
        ) : (
          <div key={m.id} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Pill size={14} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-zinc-200 truncate">{m.medication_name}</p>
                {m.is_prn && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400">PRN</span>}
              </div>
              <p className="text-[11px] text-zinc-500 truncate">
                {m.dosage} · {ROUTE_LABELS[m.route] || m.route} · {FREQ_LABELS[m.frequency] || m.frequency}
                {m.prescribing_doctor && ` · Dr ${m.prescribing_doctor}`}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(m)} className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors"><Pencil size={12} /></button>
              <button onClick={() => deleteMut.mutate(m.id)} className="p-1.5 rounded text-zinc-600 hover:text-rose-400 transition-colors"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}

        <AnimatePresence>
          {adding && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <MedForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => { setAdding(false); resetForm(); }} saving={saveMut.isPending} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function MedForm({ form, setForm, onSave, onCancel, saving }: {
  form: { medication_name: string; dosage: string; route: string; frequency: string; prescribing_doctor: string; is_prn: boolean; special_instructions: string };
  setForm: (f: typeof form) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const inputCls = "w-full border-b border-zinc-800 bg-transparent pb-1.5 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Name</label>
          <input value={form.medication_name} onChange={(e) => setForm({ ...form, medication_name: e.target.value })} placeholder="Paracetamol" className={inputCls} autoFocus />
        </div>
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Dosage</label>
          <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500mg" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Route</label>
          <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className={`${inputCls} [color-scheme:dark]`}>
            {Object.entries(ROUTE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Frequency</label>
          <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={`${inputCls} [color-scheme:dark]`}>
            {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Prescriber</label>
          <input value={form.prescribing_doctor} onChange={(e) => setForm({ ...form, prescribing_doctor: e.target.value })} placeholder="Dr..." className={inputCls} />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={() => setForm({ ...form, is_prn: !form.is_prn })}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-all ${form.is_prn ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-600"}`}
        >{form.is_prn && <Check size={8} />}PRN</button>
        <div className="flex items-center gap-1">
          <button onClick={onCancel} className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.medication_name.trim() || !form.dosage.trim()}
            className="rounded-md bg-white px-3 py-1 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
          >{saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Goals Box
   ═══════════════════════════════════════════════════════════════════════════════ */

export function GoalsBox({ participantId, orgId }: { participantId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", support_category: "core", target_outcome: "", status: "not_started" });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["participants", "goals", participantId],
    queryFn: () => fetchParticipantGoals(participantId, orgId),
    enabled: !!participantId && !!orgId,
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof upsertParticipantGoal>[2]) =>
      upsertParticipantGoal(orgId, participantId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", "goals", participantId] });
      setAdding(false);
      setEditingId(null);
      resetForm();
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteParticipantGoal,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["participants", "goals", participantId] }),
  });

  function resetForm() {
    setForm({ title: "", description: "", support_category: "core", target_outcome: "", status: "not_started" });
  }

  function startEdit(g: ParticipantGoal) {
    setEditingId(g.id);
    setForm({ title: g.title, description: g.description || "", support_category: g.support_category || "core", target_outcome: g.target_outcome || "", status: g.status || "not_started" });
    setAdding(false);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    saveMut.mutate({ id: editingId || undefined, ...form } as any);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.35 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-emerald-400" />
          <h3 className="text-[13px] font-semibold text-zinc-200">NDIS Goals</h3>
          <span className="text-[10px] text-zinc-600 tabular-nums">{goals.length}</span>
        </div>
        <button onClick={() => { setAdding(true); setEditingId(null); resetForm(); }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        ><Plus size={12} /> Add</button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
      ) : goals.length === 0 && !adding ? (
        <div className="text-center py-6 text-[12px] text-zinc-600">No goals recorded</div>
      ) : null}

      <div className="space-y-2">
        {goals.map((g) => editingId === g.id ? (
          <GoalForm key={g.id} form={form} setForm={setForm} onSave={handleSave} onCancel={() => { setEditingId(null); resetForm(); }} saving={saveMut.isPending} />
        ) : (
          <div key={g.id} className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.03]">
            <div className="mt-0.5 h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Target size={14} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[13px] font-medium text-zinc-200 truncate">{g.title}</p>
                {g.support_category && (
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${CATEGORY_COLORS[g.support_category] || "text-zinc-500"}`}>
                    {g.support_category.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {g.description && <p className="text-[11px] text-zinc-500 line-clamp-2">{g.description}</p>}
              {g.target_outcome && <p className="text-[10px] text-zinc-600 mt-0.5">Target: {g.target_outcome}</p>}
              <div className="mt-1">
                {(() => {
                  const sc = GOAL_STATUS_CONFIG[g.status] || GOAL_STATUS_CONFIG.not_started;
                  return <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] ${sc.bg} ${sc.color}`}>{sc.label}</span>;
                })()}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => startEdit(g)} className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors"><Pencil size={12} /></button>
              <button onClick={() => deleteMut.mutate(g.id)} className="p-1.5 rounded text-zinc-600 hover:text-rose-400 transition-colors"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}

        <AnimatePresence>
          {adding && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <GoalForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => { setAdding(false); resetForm(); }} saving={saveMut.isPending} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function GoalForm({ form, setForm, onSave, onCancel, saving }: {
  form: { title: string; description: string; support_category: string; target_outcome: string; status: string };
  setForm: (f: typeof form) => void;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const inputCls = "w-full border-b border-zinc-800 bg-transparent pb-1.5 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600";
  const cats = [{ v: "core", l: "Core" }, { v: "capacity_building", l: "Capacity" }, { v: "capital", l: "Capital" }];
  const statuses = [{ v: "not_started", l: "Not Started" }, { v: "in_progress", l: "In Progress" }, { v: "achieved", l: "Achieved" }, { v: "on_hold", l: "On Hold" }];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
      <div>
        <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Goal Title</label>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Increase community participation..." className={inputCls} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Category</label>
          <div className="flex gap-1 mt-0.5">
            {cats.map((c) => (
              <button key={c.v} type="button" onClick={() => setForm({ ...form, support_category: c.v })}
                className={`rounded-full px-2 py-0.5 text-[10px] transition-all ${form.support_category === c.v ? "bg-zinc-700 text-zinc-200" : "bg-zinc-800/50 text-zinc-600 hover:text-zinc-400"}`}
              >{c.l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={`${inputCls} [color-scheme:dark]`}>
            {statuses.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Target Outcome</label>
        <input value={form.target_outcome} onChange={(e) => setForm({ ...form, target_outcome: e.target.value })} placeholder="Measurable outcome..." className={inputCls} />
      </div>
      <div>
        <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Description</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Details..." rows={2}
          className="w-full resize-none bg-transparent text-[11px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
        />
      </div>
      <div className="flex justify-end gap-1 pt-1">
        <button onClick={onCancel} className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
        <button onClick={onSave} disabled={saving || !form.title.trim()}
          className="rounded-md bg-white px-3 py-1 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
        >{saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Funds Management Box
   ═══════════════════════════════════════════════════════════════════════════════ */

export function FundsManagementBox({ participantId, orgId }: { participantId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ petty_cash_enabled: false, petty_cash_limit: 0, petty_cash_notes: "", transport_budget_weekly: 0, discretionary_fund_notes: "" });

  const { data: funds, isLoading } = useQuery({
    queryKey: ["participants", "funds", participantId],
    queryFn: () => fetchParticipantFundsMetadata(participantId, orgId),
    enabled: !!participantId && !!orgId,
    staleTime: 60_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateParticipantFundsMetadata>[2]) =>
      updateParticipantFundsMetadata(participantId, orgId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", "funds", participantId] });
      setEditing(false);
    },
  });

  const startEdit = useCallback(() => {
    if (funds) {
      setForm({
        petty_cash_enabled: funds.petty_cash_enabled,
        petty_cash_limit: funds.petty_cash_limit,
        petty_cash_notes: funds.petty_cash_notes || "",
        transport_budget_weekly: funds.transport_budget_weekly,
        discretionary_fund_notes: funds.discretionary_fund_notes || "",
      });
    }
    setEditing(true);
  }, [funds]);

  function handleSave() {
    saveMut.mutate(form);
  }

  const hasFunds = funds && (funds.petty_cash_enabled || funds.transport_budget_weekly > 0 || funds.discretionary_fund_notes);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.4 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-amber-400" />
          <h3 className="text-[13px] font-semibold text-zinc-200">Funds Management</h3>
        </div>
        {!editing && (
          <button onClick={startEdit}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          ><Pencil size={11} /> Edit</button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
      ) : editing ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm({ ...form, petty_cash_enabled: !form.petty_cash_enabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.petty_cash_enabled ? "bg-emerald-500/30" : "bg-zinc-800"}`}
            >
              <div className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${form.petty_cash_enabled ? "left-5 bg-emerald-400" : "left-0.5 bg-zinc-600"}`} />
            </button>
            <span className="text-[12px] text-zinc-400">Petty Cash</span>
          </div>

          {form.petty_cash_enabled && (
            <div className="grid grid-cols-2 gap-3 pl-12">
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Weekly Limit ($)</label>
                <input type="number" step="0.01" min="0" value={form.petty_cash_limit} onChange={(e) => setForm({ ...form, petty_cash_limit: parseFloat(e.target.value) || 0 })}
                  className="w-full border-b border-zinc-800 bg-transparent pb-1.5 text-[12px] text-zinc-300 outline-none focus:border-zinc-600" />
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Purpose / Notes</label>
                <input value={form.petty_cash_notes} onChange={(e) => setForm({ ...form, petty_cash_notes: e.target.value })} placeholder="Groceries, outings..."
                  className="w-full border-b border-zinc-800 bg-transparent pb-1.5 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600" />
              </div>
            </div>
          )}

          <div className="border-t border-zinc-800/50 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Car size={12} className="text-zinc-500" />
              <span className="text-[11px] text-zinc-400">Transport Budget</span>
            </div>
            <div className="pl-5">
              <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Weekly ($)</label>
              <input type="number" step="0.01" min="0" value={form.transport_budget_weekly} onChange={(e) => setForm({ ...form, transport_budget_weekly: parseFloat(e.target.value) || 0 })}
                className="w-full max-w-[180px] border-b border-zinc-800 bg-transparent pb-1.5 text-[12px] text-zinc-300 outline-none focus:border-zinc-600" />
            </div>
          </div>

          <div className="border-t border-zinc-800/50 pt-3">
            <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Other Fund Notes</label>
            <textarea value={form.discretionary_fund_notes} onChange={(e) => setForm({ ...form, discretionary_fund_notes: e.target.value })} rows={2}
              placeholder="Nominee manages bank account, direct debit notes..."
              className="w-full resize-none bg-transparent text-[11px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700" />
          </div>

          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setEditing(false)} className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saveMut.isPending}
              className="rounded-md bg-white px-3 py-1 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >{saveMut.isPending ? <Loader2 size={10} className="animate-spin" /> : "Save"}</button>
          </div>
        </div>
      ) : !hasFunds ? (
        <div className="text-center py-6">
          <p className="text-[12px] text-zinc-600 mb-2">No funds management configured</p>
          <button onClick={startEdit} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">+ Set up now</button>
        </div>
      ) : (
        <div className="space-y-3">
          {funds.petty_cash_enabled && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.02]">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <DollarSign size={14} className="text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] text-zinc-200">Petty Cash</p>
                <p className="text-[11px] text-zinc-500">
                  Limit: ${funds.petty_cash_limit.toFixed(2)}/wk
                  {funds.petty_cash_notes && ` · ${funds.petty_cash_notes}`}
                </p>
              </div>
            </div>
          )}

          {funds.transport_budget_weekly > 0 && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.02]">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Car size={14} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-[12px] text-zinc-200">Transport</p>
                <p className="text-[11px] text-zinc-500">${funds.transport_budget_weekly.toFixed(2)}/wk</p>
              </div>
            </div>
          )}

          {funds.discretionary_fund_notes && (
            <div className="rounded-lg px-3 py-2 bg-white/[0.02]">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 mb-1">Notes</p>
              <p className="text-[11px] text-zinc-400 whitespace-pre-line">{funds.discretionary_fund_notes}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Care Plans Box
   ═══════════════════════════════════════════════════════════════════════════════ */

const PLAN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  completed: { label: "Completed", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  archived: { label: "Archived", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
};

export function CarePlansBox({ participantId, orgId }: { participantId: string; orgId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["participants", "care-plans", participantId],
    queryFn: () => fetchParticipantCarePlans(participantId, orgId),
    enabled: !!participantId && !!orgId,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: () => createCarePlan(participantId, orgId, newTitle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants", "care-plans", participantId] });
      setCreating(false);
      setNewTitle("");
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.25 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-blue-400" />
          <h3 className="text-[13px] font-semibold text-zinc-200">Care Plans</h3>
          <span className="text-[10px] text-zinc-600 tabular-nums">{plans.length}</span>
        </div>
        <button onClick={() => { setCreating(true); setNewTitle(""); }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
        ><Plus size={12} /> Add</button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
      ) : plans.length === 0 && !creating ? (
        <div className="text-center py-6">
          <ClipboardList size={20} className="mx-auto mb-2 text-zinc-700" />
          <p className="text-[12px] text-zinc-600">No care plans created yet</p>
          <button onClick={() => { setCreating(true); setNewTitle(""); }}
            className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >+ Create first care plan</button>
        </div>
      ) : null}

      <div className="space-y-2">
        {plans.map((plan) => {
          const sc = PLAN_STATUS_CONFIG[plan.status] || PLAN_STATUS_CONFIG.active;
          return (
            <div key={plan.id} className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-white/[0.03]">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <ClipboardList size={16} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[13px] font-medium text-zinc-200 truncate">{plan.title}</p>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${sc.bg} ${sc.color} ${sc.border}`}>
                    {sc.label}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {plan.goals_count} goal{plan.goals_count !== 1 ? "s" : ""} · Created {new Date(plan.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <ChevronRight size={14} className="text-zinc-800 group-hover:text-zinc-600 transition-colors shrink-0" />
            </div>
          );
        })}

        <AnimatePresence>
          {creating && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
                <div>
                  <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">Plan Title</label>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Care Plan — 2026 Review"
                    className="w-full border-b border-zinc-800 bg-transparent pb-1.5 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:border-zinc-600" autoFocus />
                </div>
                <div className="flex justify-end gap-1 pt-1">
                  <button onClick={() => setCreating(false)} className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
                  <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !newTitle.trim()}
                    className="rounded-md bg-white px-3 py-1 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                  >{createMut.isPending ? <Loader2 size={10} className="animate-spin" /> : "Create"}</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Service Agreements Box
   ═══════════════════════════════════════════════════════════════════════════════ */

const SA_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  draft: { label: "Draft", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  pending_signature: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  expired: { label: "Expired", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  cancelled: { label: "Cancelled", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

const MGMT_LABELS: Record<string, string> = {
  ndia_managed: "NDIA Managed", plan_managed: "Plan Managed", self_managed: "Self Managed",
};

export function ServiceAgreementsBox({ participantId, orgId }: { participantId: string; orgId: string }) {
  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["participants", "service-agreements", participantId],
    queryFn: () => fetchParticipantServiceAgreements(participantId, orgId),
    enabled: !!participantId && !!orgId,
    staleTime: 60_000,
  });

  function fmtMoney(n: number) { return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`; }
  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.28 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-violet-400" />
          <h3 className="text-[13px] font-semibold text-zinc-200">Service Agreements</h3>
          <span className="text-[10px] text-zinc-600 tabular-nums">{agreements.length}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
      ) : agreements.length === 0 ? (
        <div className="text-center py-6">
          <FileText size={20} className="mx-auto mb-2 text-zinc-700" />
          <p className="text-[12px] text-zinc-600">No service agreements</p>
          <p className="text-[10px] text-zinc-700 mt-1">Service agreements are created during participant intake.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agreements.map((sa) => {
            const sc = SA_STATUS_CONFIG[sa.status] || SA_STATUS_CONFIG.active;
            return (
              <div key={sa.id} className="group rounded-lg border border-zinc-800/40 bg-white/[0.015] px-4 py-3 transition-colors hover:bg-white/[0.03]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-violet-400 shrink-0" />
                    <p className="text-[13px] font-medium text-zinc-200 truncate">{sa.title}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium border shrink-0 ${sc.bg} ${sc.color} ${sc.border}`}>
                    {sc.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Period</p>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Calendar size={10} className="text-zinc-600" />
                      {fmtDate(sa.start_date)} — {fmtDate(sa.end_date)}
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Budget</p>
                    <p className="font-mono text-[12px] font-semibold text-zinc-200 tabular-nums">{fmtMoney(sa.total_budget)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Management</p>
                    <p className="text-[11px] text-zinc-400">{MGMT_LABELS[sa.funding_management_type || ""] || sa.funding_management_type || "—"}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Care Blueprint Box
   ═══════════════════════════════════════════════════════════ */

const COVERAGE_LABELS: Record<string, string> = {
  standard_hourly: "Standard Hourly",
  "24_7_continuous": "24/7 Continuous",
  active_night: "Active Night",
  sleepover: "Sleepover",
};

export function CareBlueprintBox({
  participantId,
  orgId,
  onOpenBuilder,
}: {
  participantId: string;
  orgId: string;
  onOpenBuilder?: () => void;
}) {
  const { data: blueprint, isLoading } = useQuery<CareBlueprint | null>({
    queryKey: ["care-blueprint", participantId, orgId],
    queryFn: () => fetchBlueprintForParticipant(participantId, orgId),
    enabled: !!participantId && !!orgId,
    staleTime: 60_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay: 0.2 }}
      className="col-span-2 bg-[#0A0A0A] border border-zinc-800/50 rounded-xl p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-emerald-400" />
          <h3 className="text-[13px] font-semibold text-zinc-200">Care Blueprint</h3>
        </div>
        {!blueprint && !isLoading && onOpenBuilder && (
          <button onClick={onOpenBuilder}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          ><Sparkles size={12} /> Create Blueprint</button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 size={16} className="animate-spin text-zinc-600" /></div>
      ) : !blueprint ? (
        <div className="text-center py-6">
          <Shield size={20} className="mx-auto mb-2 text-zinc-700" />
          <p className="text-[12px] text-zinc-600">No care blueprint configured</p>
          <p className="text-[10px] text-zinc-700 mt-1">Create a blueprint to auto-generate rosters and match workers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Coverage</p>
              <p className="text-[12px] font-medium text-zinc-300">{COVERAGE_LABELS[blueprint.coverage_type] || blueprint.coverage_type}</p>
            </div>
            <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Ratio</p>
              <p className="text-[12px] font-medium text-zinc-300 flex items-center gap-1"><Users size={11} /> {blueprint.staffing_ratio}:1</p>
            </div>
            <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/30 p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Skills Required</p>
              <p className="text-[12px] font-medium text-zinc-300">{blueprint.required_skills.length || "None"}</p>
            </div>
          </div>

          {blueprint.shift_pattern && (
            <div className="space-y-1">
              {(blueprint.shift_pattern as Array<{ label: string; start: string; end: string }>).map((sp, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <Calendar size={10} className="text-zinc-600" />
                  <span className="text-zinc-400 font-medium w-20">{sp.label}</span>
                  <span>{sp.start} — {sp.end}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
