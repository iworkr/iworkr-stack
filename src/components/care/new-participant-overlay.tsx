"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Search,
  Loader2,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Heart,
  Shield,
  Sparkles,
} from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";

interface NewParticipantOverlayProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (participantId: string) => void;
}

const FUNDING_TYPES = [
  { value: "ndia_managed", label: "NDIA Managed", desc: "NDIA pays providers directly" },
  { value: "plan_managed", label: "Plan Managed", desc: "Plan manager processes invoices" },
  { value: "self_managed", label: "Self Managed", desc: "Participant manages their own funds" },
] as const;

const MOBILITY_OPTIONS = [
  { value: "independent", label: "Independent" },
  { value: "mobility_aid", label: "Mobility Aid" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "hoist_required", label: "Hoist Required" },
] as const;

const COMMUNICATION_OPTIONS = [
  { value: "verbal", label: "Verbal" },
  { value: "non_verbal", label: "Non-Verbal" },
  { value: "uses_aac_device", label: "Uses AAC Device" },
  { value: "limited_verbal", label: "Limited Verbal" },
] as const;

const DAYS_OF_WEEK = [
  { key: "MON", label: "M", full: "Monday" },
  { key: "TUE", label: "T", full: "Tuesday" },
  { key: "WED", label: "W", full: "Wednesday" },
  { key: "THU", label: "T", full: "Thursday" },
  { key: "FRI", label: "F", full: "Friday" },
  { key: "SAT", label: "S", full: "Saturday" },
  { key: "SUN", label: "S", full: "Sunday" },
] as const;

interface NDISItem {
  support_item_number: string;
  support_item_name: string;
  support_category_name: string;
  unit: string;
  price_limit_national: number;
  support_purpose: string;
}

const lineItemSchema = z.object({
  ndis_code: z.string().min(1, "Select an NDIS item"),
  ndis_name: z.string(),
  unit_rate: z.number().min(0),
  support_purpose: z.string(),
  allocated_budget: z.number().min(0, "Budget must be positive"),
});

const rosterEntrySchema = z.object({
  days: z.array(z.string()).min(1, "Select at least one day"),
  start_time: z.string().min(1, "Set start time"),
  end_time: z.string().min(1, "Set end time"),
  linked_item_index: z.number().optional(),
  linked_item_number: z.string().optional(),
});

const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  ndis_number: z.string().optional(),
  funding_type: z.string().min(1, "Select a funding type"),
  date_of_birth: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  primary_diagnosis: z.string().optional(),
  critical_alerts: z.string().optional(),
  mobility_status: z.string().optional(),
  communication_type: z.string().optional(),
  sa_start_date: z.string().optional(),
  sa_end_date: z.string().optional(),
  sa_line_items: z.array(lineItemSchema),
  roster_entries: z.array(rosterEntrySchema),
});

type FormData = z.infer<typeof formSchema>;

type Phase = "name" | "identity" | "care" | "agreement" | "schedule";

const labelCls = "block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-600 mb-1.5";
const fieldInput = "w-full border-b border-white/[0.06] bg-transparent pb-2 text-[13px] text-neutral-300 outline-none transition-colors placeholder:text-neutral-700 focus:border-emerald-500/40";

export function NewParticipantOverlay({
  open,
  onClose,
  onComplete,
}: NewParticipantOverlayProps) {
  const [phase, setPhase] = useState<Phase>("name");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ndisItems, setNdisItems] = useState<NDISItem[]>([]);
  const [ndisSearch, setNdisSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const org = useOrg();
  const nameRef = useRef<HTMLInputElement>(null);
  const diagnosisRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: "", last_name: "", preferred_name: "", ndis_number: "",
      funding_type: "", date_of_birth: "", email: "", phone: "",
      primary_diagnosis: "", critical_alerts: "", mobility_status: "",
      communication_type: "",
      sa_start_date: new Date().toISOString().split("T")[0],
      sa_end_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
      sa_line_items: [], roster_entries: [],
    },
  });

  const { fields: lineItems, append: appendLineItem, remove: removeLineItem } = useFieldArray({ control, name: "sa_line_items" });
  const { fields: rosterEntries, append: appendRoster, remove: removeRoster, update: updateRoster } = useFieldArray({ control, name: "roster_entries" });

  const watchedLineItems = watch("sa_line_items");
  const watchedRoster = watch("roster_entries");
  const firstName = watch("first_name");
  const lastName = watch("last_name");

  const initials = useMemo(() => {
    const f = firstName?.trim()?.[0] ?? "";
    const l = lastName?.trim()?.[0] ?? "";
    return (f + l).toUpperCase();
  }, [firstName, lastName]);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    (supabase as ReturnType<typeof createClient> & { from: (t: string) => any })
      .from("ndis_support_items")
      .select("support_item_number, support_item_name, support_category_name, unit, price_limit_national, support_purpose")
      .eq("is_active", true)
      .order("support_item_number")
      .then(({ data }: { data: NDISItem[] | null }) => { if (data) setNdisItems(data); });
  }, [open]);

  useEffect(() => {
    if (open) {
      reset();
      setPhase("name");
      setSaving(false);
      setSaved(false);
      setNdisSearch("");
      setActiveSearchIndex(null);
      setTimeout(() => nameRef.current?.focus(), 150);
    }
  }, [open, reset]);

  const lockName = useCallback(async () => {
    const valid = await trigger(["first_name", "last_name"]);
    if (!valid) return;
    setPhase("identity");
  }, [trigger]);

  const advanceToCare = useCallback(async () => {
    const valid = await trigger(["funding_type"]);
    if (!valid) return;
    setPhase("care");
    setTimeout(() => diagnosisRef.current?.focus(), 100);
  }, [trigger]);

  const advanceToAgreement = useCallback(() => setPhase("agreement"), []);
  const advanceToSchedule = useCallback(() => setPhase("schedule"), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeSearchIndex !== null) setActiveSearchIndex(null);
        else onClose();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT") return;

        if (phase === "name") { e.preventDefault(); lockName(); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (phase === "schedule" || phase === "agreement") handleSubmit(onSubmit)();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, activeSearchIndex, phase, lockName]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSABudget = useMemo(
    () => (watchedLineItems || []).reduce((sum, li) => sum + (li.allocated_budget || 0), 0),
    [watchedLineItems]
  );

  const rosterMath = useMemo(() => {
    if (!watchedRoster?.length) return { weeklyHours: 0, weeklyCost: 0, annualProjection: 0 };
    let weeklyHours = 0, weeklyCost = 0;
    for (const entry of watchedRoster) {
      if (!entry.start_time || !entry.end_time || !entry.days?.length) continue;
      const [sh, sm] = entry.start_time.split(":").map(Number);
      const [eh, em] = entry.end_time.split(":").map(Number);
      const hrs = (eh + em / 60) - (sh + sm / 60);
      if (hrs <= 0) continue;
      weeklyHours += hrs * entry.days.length;
      if (entry.linked_item_index !== undefined && watchedLineItems?.[entry.linked_item_index]) {
        weeklyCost += hrs * entry.days.length * (watchedLineItems[entry.linked_item_index].unit_rate || 0);
      }
    }
    return { weeklyHours: Math.round(weeklyHours * 100) / 100, weeklyCost: Math.round(weeklyCost * 100) / 100, annualProjection: Math.round(weeklyCost * 52 * 100) / 100 };
  }, [watchedRoster, watchedLineItems]);

  const budgetHealth = useMemo(() => {
    if (totalSABudget <= 0 || rosterMath.annualProjection <= 0) return { status: "neutral" as const, pct: 0 };
    const pct = Math.round((rosterMath.annualProjection / totalSABudget) * 100);
    return rosterMath.annualProjection <= totalSABudget
      ? { status: "safe" as const, pct }
      : { status: "danger" as const, pct };
  }, [totalSABudget, rosterMath]);

  const filteredNDIS = useMemo(() => {
    if (!ndisSearch.trim()) return ndisItems.slice(0, 20);
    const q = ndisSearch.toLowerCase();
    return ndisItems.filter((i) =>
      i.support_item_number.toLowerCase().includes(q) ||
      i.support_item_name.toLowerCase().includes(q) ||
      i.support_category_name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [ndisSearch, ndisItems]);

  const onSubmit = useCallback(async (data: FormData) => {
    if (saving || !org?.orgId) return;
    setSaving(true);
    try {
      const payload = {
        workspace_id: org.orgId,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        preferred_name: data.preferred_name?.trim() || null,
        ndis_number: data.ndis_number?.trim() || null,
        funding_type: data.funding_type,
        date_of_birth: data.date_of_birth || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        primary_diagnosis: data.primary_diagnosis?.trim() || null,
        critical_alerts: data.critical_alerts ? data.critical_alerts.split("\n").map((a) => a.trim()).filter(Boolean) : [],
        mobility_status: data.mobility_status || null,
        communication_type: data.communication_type || null,
        sa_start_date: data.sa_start_date || null,
        sa_end_date: data.sa_end_date || null,
        sa_line_items: (data.sa_line_items || []).map((li) => ({
          ndis_code: li.ndis_code, ndis_name: li.ndis_name, unit_rate: li.unit_rate,
          support_purpose: li.support_purpose, allocated_budget: li.allocated_budget,
        })),
        roster_entries: (data.roster_entries || []).map((re) => ({
          days: re.days, start_time: re.start_time, end_time: re.end_time,
          linked_item_number: re.linked_item_number || null, title: null,
        })),
      };
      const supabase = createClient();
      const { data: result, error } = await (supabase as any).rpc("create_participant_ecosystem", { p_payload: payload });
      if (error) throw new Error(error.message);
      setSaved(true);
      addToast(`${data.first_name} ${data.last_name} activated`, undefined, "success");
      onComplete?.(result?.participant_id ?? "");
      setTimeout(() => onClose(), 400);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Something went wrong", undefined, "error");
    } finally {
      setSaving(false);
    }
  }, [saving, org, addToast, onComplete, onClose]);

  const phaseReached = (p: Phase) => {
    const order: Phase[] = ["name", "identity", "care", "agreement", "schedule"];
    return order.indexOf(phase) >= order.indexOf(p);
  };

  return (
    <AnimatePresence>
      {open && (
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Full-screen backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#050505]/95 backdrop-blur-sm"
          />

          {/* Full-screen container */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={saved ? { opacity: 0 } : { opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          >
            <div className="w-full max-w-[600px] px-6 py-12">
              {/* Close button */}
              <div className="fixed top-6 right-6 z-[10000] flex items-center gap-3">
                <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">Esc</kbd>
                <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-600 hover:text-white hover:bg-white/5 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* ════════════════════════════════════════════
                 PHASE 1: Name (the hero input)
                 ════════════════════════════════════════════ */}
              <motion.div layout className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600 mb-4">New Participant</p>

                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    {initials ? (
                      <span className="text-sm font-semibold text-emerald-400">{initials}</span>
                    ) : (
                      <Heart size={18} className="text-emerald-500/40" />
                    )}
                  </div>

                  {phase === "name" ? (
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <input
                        {...register("first_name")}
                        ref={(el) => { register("first_name").ref(el); (nameRef as any).current = el; }}
                        placeholder="First name"
                        autoComplete="off"
                        autoFocus
                        className="bg-transparent text-[24px] font-medium tracking-tight text-white outline-none placeholder:text-neutral-800"
                      />
                      <input
                        {...register("last_name")}
                        placeholder="Last name"
                        autoComplete="off"
                        className="bg-transparent text-[24px] font-medium tracking-tight text-white outline-none placeholder:text-neutral-800"
                      />
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPhase("name")} className="flex-1 text-left group">
                      <p className="text-[24px] font-medium tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                        {firstName} {lastName}
                      </p>
                    </button>
                  )}
                </div>

                {(errors.first_name || errors.last_name) && (
                  <p className="text-[11px] text-rose-400 ml-16">{errors.first_name?.message || errors.last_name?.message}</p>
                )}

                {phase === "name" && firstName?.trim() && lastName?.trim() && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[11px] text-neutral-700 ml-16 mt-2"
                  >
                    Press <kbd className="mx-0.5 rounded bg-white/5 px-1 py-0.5 font-mono text-[9px] text-neutral-500">Enter</kbd> to continue
                  </motion.p>
                )}
              </motion.div>

              {/* ════════════════════════════════════════════
                 PHASE 2: Identity details (appears after name lock)
                 ════════════════════════════════════════════ */}
              <AnimatePresence>
                {phaseReached("identity") && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-10 space-y-6"
                  >
                    <div className="h-px bg-white/[0.04]" />

                    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                      <div>
                        <label className={labelCls}>NDIS Number</label>
                        <input {...register("ndis_number")} placeholder="430 123 456" className={fieldInput} autoComplete="off" maxLength={11} />
                      </div>
                      <div>
                        <label className={labelCls}>Date of Birth</label>
                        <input type="date" {...register("date_of_birth")} className={`${fieldInput} [color-scheme:dark]`} />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input {...register("email")} placeholder="participant@example.com" className={fieldInput} type="email" autoComplete="off" />
                      </div>
                      <div>
                        <label className={labelCls}>Phone</label>
                        <input {...register("phone")} placeholder="0412 345 678" className={fieldInput} autoComplete="off" />
                      </div>
                      <div className="col-span-2">
                        <label className={labelCls}>Preferred Name</label>
                        <input {...register("preferred_name")} placeholder="Optional" className={fieldInput} autoComplete="off" />
                      </div>
                    </div>

                    {/* Funding Type */}
                    <div>
                      <label className={labelCls}>Funding Type</label>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <Controller
                          control={control}
                          name="funding_type"
                          render={({ field }) => (
                            <>
                              {FUNDING_TYPES.map((ft) => {
                                const active = field.value === ft.value;
                                return (
                                  <motion.button
                                    key={ft.value} type="button" whileTap={{ scale: 0.98 }}
                                    onClick={() => field.onChange(ft.value)}
                                    className={`relative rounded-lg p-3 text-left transition-all ${
                                      active
                                        ? "border border-emerald-500/30 bg-emerald-500/[0.06]"
                                        : "border border-white/[0.06] bg-white/[0.01] hover:border-white/[0.12]"
                                    }`}
                                  >
                                    {active && (
                                      <motion.div layoutId="funding-check" className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                                        <Check size={9} className="text-black" />
                                      </motion.div>
                                    )}
                                    <p className={`text-[12px] font-medium ${active ? "text-white" : "text-neutral-400"}`}>{ft.label}</p>
                                    <p className="mt-0.5 text-[10px] text-neutral-600">{ft.desc}</p>
                                  </motion.button>
                                );
                              })}
                            </>
                          )}
                        />
                      </div>
                      {errors.funding_type && <p className="mt-1.5 text-[11px] text-rose-400">{errors.funding_type.message}</p>}
                    </div>

                    {/* Continue to care profile */}
                    {phase === "identity" && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        type="button" onClick={advanceToCare}
                        className="flex items-center gap-2 text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Shield size={12} />
                        Continue to Care Profile
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ════════════════════════════════════════════
                 PHASE 3: Care Profile
                 ════════════════════════════════════════════ */}
              <AnimatePresence>
                {phaseReached("care") && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-10 space-y-6"
                  >
                    <div className="h-px bg-white/[0.04]" />
                    <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600">Care Profile</p>

                    <input
                      {...register("primary_diagnosis")}
                      ref={(el) => { register("primary_diagnosis").ref(el); (diagnosisRef as any).current = el; }}
                      placeholder="Primary diagnosis..."
                      autoComplete="off"
                      className="w-full bg-transparent text-[18px] font-medium tracking-tight text-white outline-none placeholder:text-neutral-800"
                    />

                    <div>
                      <label className={labelCls}>Critical Medical Alerts</label>
                      <textarea
                        {...register("critical_alerts")}
                        placeholder={"Seizure risk — administer midazolam if >5min\nAllergy: Penicillin"}
                        rows={3}
                        className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-neutral-400 outline-none placeholder:text-neutral-700"
                      />
                      <p className="mt-1 text-[9px] text-neutral-700">One alert per line. These appear on every shift card.</p>
                    </div>

                    {/* Mobility */}
                    <div>
                      <label className={labelCls}>Mobility</label>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Controller control={control} name="mobility_status"
                          render={({ field }) => (
                            <>{MOBILITY_OPTIONS.map((opt) => (
                              <button key={opt.value} type="button"
                                onClick={() => field.onChange(field.value === opt.value ? "" : opt.value)}
                                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                                  field.value === opt.value
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-white/[0.06] text-neutral-500 hover:border-white/[0.12] hover:text-neutral-300"
                                }`}
                              >{opt.label}</button>
                            ))}</>
                          )}
                        />
                      </div>
                    </div>

                    {/* Communication */}
                    <div>
                      <label className={labelCls}>Communication</label>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Controller control={control} name="communication_type"
                          render={({ field }) => (
                            <>{COMMUNICATION_OPTIONS.map((opt) => (
                              <button key={opt.value} type="button"
                                onClick={() => field.onChange(field.value === opt.value ? "" : opt.value)}
                                className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                                  field.value === opt.value
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-white/[0.06] text-neutral-500 hover:border-white/[0.12] hover:text-neutral-300"
                                }`}
                              >{opt.label}</button>
                            ))}</>
                          )}
                        />
                      </div>
                    </div>

                    {phase === "care" && (
                      <div className="flex items-center gap-3">
                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={advanceToAgreement}
                          className="flex items-center gap-2 text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <DollarSign size={12} /> Add Service Agreement
                        </motion.button>
                        <span className="text-[10px] text-neutral-700">or</span>
                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="submit" disabled={saving}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-40"
                        >
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          Activate Participant
                          <kbd className="ml-1 rounded bg-white/15 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ════════════════════════════════════════════
                 PHASE 4: Service Agreement
                 ════════════════════════════════════════════ */}
              <AnimatePresence>
                {phaseReached("agreement") && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-10 space-y-6"
                  >
                    <div className="h-px bg-white/[0.04]" />
                    <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600">Service Agreement</p>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className={labelCls}><Calendar size={9} className="mr-1 inline" />Start Date</label>
                        <input type="date" {...register("sa_start_date")} className={`${fieldInput} [color-scheme:dark]`} />
                      </div>
                      <div>
                        <label className={labelCls}><Calendar size={9} className="mr-1 inline" />End Date</label>
                        <input type="date" {...register("sa_end_date")} className={`${fieldInput} [color-scheme:dark]`} />
                      </div>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-2.5">
                      <label className={labelCls}>NDIS Line Items</label>
                      {lineItems.map((field, idx) => (
                        <motion.div key={field.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="group rounded-lg border border-white/[0.06] bg-white/[0.01] p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 space-y-3">
                              <div className="relative">
                                {watchedLineItems?.[idx]?.ndis_code ? (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="font-mono text-[11px] text-emerald-400">{watchedLineItems[idx].ndis_code}</span>
                                      <p className="text-[12px] text-neutral-400">{watchedLineItems[idx].ndis_name}</p>
                                    </div>
                                    <button type="button"
                                      onClick={() => { setValue(`sa_line_items.${idx}.ndis_code`, ""); setValue(`sa_line_items.${idx}.ndis_name`, ""); setValue(`sa_line_items.${idx}.unit_rate`, 0); setValue(`sa_line_items.${idx}.support_purpose`, ""); setActiveSearchIndex(idx); }}
                                      className="text-[10px] text-neutral-700 hover:text-neutral-400"
                                    >Change</button>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-2 border-b border-white/[0.06] pb-1.5">
                                      <Search size={12} className="text-neutral-700" />
                                      <input type="text" value={activeSearchIndex === idx ? ndisSearch : ""} onFocus={() => setActiveSearchIndex(idx)}
                                        onChange={(e) => { setActiveSearchIndex(idx); setNdisSearch(e.target.value); }}
                                        placeholder="Search NDIS items..." className="flex-1 bg-transparent text-[12px] text-neutral-300 outline-none placeholder:text-neutral-700"
                                      />
                                    </div>
                                    <AnimatePresence>
                                      {activeSearchIndex === idx && (
                                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-[#0A0A0A] shadow-xl"
                                        >
                                          {filteredNDIS.length === 0
                                            ? <p className="px-3 py-2 text-[11px] text-neutral-700">No items found</p>
                                            : filteredNDIS.map((item) => (
                                              <button key={item.support_item_number} type="button"
                                                onClick={() => {
                                                  setValue(`sa_line_items.${idx}.ndis_code`, item.support_item_number);
                                                  setValue(`sa_line_items.${idx}.ndis_name`, item.support_item_name);
                                                  setValue(`sa_line_items.${idx}.unit_rate`, item.price_limit_national);
                                                  setValue(`sa_line_items.${idx}.support_purpose`, item.support_purpose);
                                                  setActiveSearchIndex(null); setNdisSearch("");
                                                }}
                                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                                              >
                                                <div className="flex-1">
                                                  <span className="font-mono text-[10px] text-emerald-400">{item.support_item_number}</span>
                                                  <p className="text-[11px] text-neutral-400">{item.support_item_name}</p>
                                                </div>
                                                <span className="font-mono text-[11px] text-neutral-600">${item.price_limit_national.toFixed(2)}/hr</span>
                                              </button>
                                            ))}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-end gap-4">
                                <div className="flex-1">
                                  <label className={labelCls}>Budget</label>
                                  <div className="flex items-center gap-1 border-b border-white/[0.06] pb-1.5">
                                    <DollarSign size={13} className="text-neutral-700" />
                                    <input type="number" step="0.01" {...register(`sa_line_items.${idx}.allocated_budget`, { valueAsNumber: true })}
                                      placeholder="50,000" className="flex-1 bg-transparent font-mono text-[14px] text-white outline-none placeholder:text-neutral-700"
                                    />
                                  </div>
                                </div>
                                {watchedLineItems?.[idx]?.unit_rate > 0 && (
                                  <p className="pb-2 font-mono text-[11px] text-neutral-600">${watchedLineItems[idx].unit_rate.toFixed(2)}/hr</p>
                                )}
                              </div>
                            </div>
                            <button type="button" onClick={() => removeLineItem(idx)}
                              className="rounded-lg p-1.5 text-neutral-800 opacity-0 group-hover:opacity-100 transition-all hover:text-rose-400"
                            ><Trash2 size={13} /></button>
                          </div>
                        </motion.div>
                      ))}
                      <button type="button"
                        onClick={() => appendLineItem({ ndis_code: "", ndis_name: "", unit_rate: 0, support_purpose: "", allocated_budget: 0 })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.06] py-3 text-[12px] text-neutral-600 transition-colors hover:border-white/[0.12] hover:text-neutral-400"
                      ><Plus size={12} /> Add Line Item</button>
                    </div>

                    {totalSABudget > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-neutral-600">Total Agreement Value</span>
                        <span className="font-mono text-[16px] text-emerald-400">${totalSABudget.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {phase === "agreement" && (
                      <div className="flex items-center gap-3">
                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="button" onClick={advanceToSchedule}
                          className="flex items-center gap-2 text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors"
                        ><Clock size={12} /> Add Schedule</motion.button>
                        <span className="text-[10px] text-neutral-700">or</span>
                        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="submit" disabled={saving}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-40"
                        >
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          Activate Participant <kbd className="ml-1 rounded bg-white/15 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ════════════════════════════════════════════
                 PHASE 5: Master Schedule
                 ════════════════════════════════════════════ */}
              <AnimatePresence>
                {phaseReached("schedule") && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="mt-10 space-y-6"
                  >
                    <div className="h-px bg-white/[0.04]" />
                    <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-600">Master Schedule</p>

                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {rosterEntries.map((field, idx) => {
                          const entry = watchedRoster?.[idx];
                          const selectedDays = entry?.days || [];
                          return (
                            <motion.div key={field.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                              className="group space-y-4 rounded-lg border border-white/[0.06] bg-white/[0.01] p-4"
                            >
                              <div>
                                <label className={labelCls}>Support Days</label>
                                <div className="mt-1.5 flex gap-1.5">
                                  {DAYS_OF_WEEK.map((day) => {
                                    const sel = selectedDays.includes(day.key);
                                    return (
                                      <motion.button key={day.key} type="button" whileTap={{ scale: 0.92 }}
                                        onClick={() => {
                                          const cur = entry?.days || [];
                                          updateRoster(idx, { ...entry, days: sel ? cur.filter((d: string) => d !== day.key) : [...cur, day.key] });
                                        }}
                                        className={`flex h-9 w-9 items-center justify-center rounded-md text-[12px] font-semibold transition-all ${
                                          sel ? "bg-emerald-500 text-black" : "border border-white/[0.06] text-neutral-600 hover:border-white/[0.12] hover:text-neutral-400"
                                        }`}
                                        title={day.full}
                                      >{day.label}</motion.button>
                                    );
                                  })}
                                </div>
                              </div>
                              {selectedDays.length > 0 && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                                  <p className="text-[11px] text-neutral-600">
                                    Every <span className="text-neutral-300">{selectedDays.map((d: string) => DAYS_OF_WEEK.find((dw) => dw.key === d)?.full).filter(Boolean).join(", ")}</span>
                                  </p>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <label className={labelCls}><Clock size={9} className="mr-1 inline" />Start</label>
                                      <input type="time" value={entry?.start_time || ""} onChange={(e) => updateRoster(idx, { ...entry, start_time: e.target.value })} className={`${fieldInput} [color-scheme:dark]`} />
                                    </div>
                                    <span className="mt-4 text-[11px] text-neutral-700">→</span>
                                    <div className="flex-1">
                                      <label className={labelCls}><Clock size={9} className="mr-1 inline" />End</label>
                                      <input type="time" value={entry?.end_time || ""} onChange={(e) => updateRoster(idx, { ...entry, end_time: e.target.value })} className={`${fieldInput} [color-scheme:dark]`} />
                                    </div>
                                  </div>
                                  {(watchedLineItems?.length || 0) > 0 && (
                                    <div>
                                      <label className={labelCls}>Link to SA Line Item</label>
                                      <select value={entry?.linked_item_index ?? ""} onChange={(e) => {
                                        const v = e.target.value; const i = v === "" ? undefined : parseInt(v);
                                        updateRoster(idx, { ...entry, linked_item_index: i, linked_item_number: i !== undefined ? watchedLineItems?.[i]?.ndis_code : undefined });
                                      }} className={`${fieldInput} [color-scheme:dark]`}>
                                        <option value="" className="bg-[#0A0A0A]">No linkage</option>
                                        {watchedLineItems?.map((li, liIdx) => (
                                          <option key={liIdx} value={liIdx} className="bg-[#0A0A0A]">{li.ndis_code} — ${li.allocated_budget.toLocaleString()}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                              <div className="flex justify-end">
                                <button type="button" onClick={() => removeRoster(idx)} className="text-[10px] text-neutral-800 opacity-0 group-hover:opacity-100 transition-all hover:text-rose-400">Remove</button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>

                      <button type="button" onClick={() => appendRoster({ days: [], start_time: "07:00", end_time: "15:00", linked_item_index: undefined, linked_item_number: undefined })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.06] py-3 text-[12px] text-neutral-600 transition-colors hover:border-white/[0.12] hover:text-neutral-400"
                      ><Plus size={12} /> Add Schedule Block</button>
                    </div>

                    {/* Burn rate card */}
                    {rosterMath.weeklyHours > 0 && totalSABudget > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`rounded-lg border p-4 ${budgetHealth.status === "safe" ? "border-emerald-500/20 bg-emerald-500/[0.03]" : budgetHealth.status === "danger" ? "border-rose-500/20 bg-rose-500/[0.03]" : "border-white/[0.06]"}`}
                      >
                        <div className="flex items-start gap-2.5">
                          {budgetHealth.status === "safe" ? <TrendingUp size={14} className="mt-0.5 text-emerald-500" /> : <AlertTriangle size={14} className="mt-0.5 text-rose-400" />}
                          <div className="flex-1">
                            <p className={`text-[12px] font-medium ${budgetHealth.status === "safe" ? "text-emerald-400" : "text-rose-400"}`}>
                              {budgetHealth.status === "safe" ? `Utilizes ${budgetHealth.pct}% of budget` : `Annual projection exceeds budget by ${budgetHealth.pct - 100}%`}
                            </p>
                            <div className="mt-3 grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-neutral-700">Weekly Hours</p>
                                <p className="font-mono text-[14px] text-neutral-300">{rosterMath.weeklyHours}h</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-neutral-700">Weekly Cost</p>
                                <p className="font-mono text-[14px] text-neutral-300">${rosterMath.weeklyCost.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div>
                                <p className="text-[9px] uppercase tracking-wider text-neutral-700">Annual</p>
                                <p className={`font-mono text-[14px] ${budgetHealth.status === "safe" ? "text-emerald-400" : "text-rose-400"}`}>${rosterMath.annualProjection.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Final submit */}
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} type="submit" disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      Activate Participant
                      <kbd className="ml-1.5 rounded bg-white/15 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </form>
      )}
    </AnimatePresence>
  );
}
