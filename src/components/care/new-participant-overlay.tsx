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
  ChevronLeft,
  Sparkles,
  FileText,
  Download,
  Eye,
  Stethoscope,
  CheckCircle2,
  ChevronDown,
  Pill,
  Target,
  Wallet,
  Car,
} from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";
import { useAuthStore } from "@/lib/auth-store";
import { createClient } from "@/lib/supabase/client";
import {
  useIntakeStore,
  participantIntakeSchema,
  INTAKE_DEFAULTS,
  type IntakeFormData,
} from "@/lib/stores/participant-intake-store";

/* ── Types & Config ───────────────────────────────────────── */

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

const DIAGNOSIS_SUGGESTIONS = [
  "Autism Spectrum Disorder",
  "Cerebral Palsy",
  "Down Syndrome",
  "Intellectual Disability",
  "Psychosocial Disability",
  "Multiple Sclerosis",
  "Acquired Brain Injury",
  "Spinal Cord Injury",
  "Hearing Impairment",
  "Vision Impairment",
  "Epilepsy",
  "Muscular Dystrophy",
  "Stroke",
  "Global Developmental Delay",
  "ADHD",
  "Fragile X Syndrome",
  "Spina Bifida",
  "Schizophrenia",
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

const STEP_LABELS = ["Identity", "Care Profile", "Medications & Goals", "Service Agreement", "Schedule", "Funds Management", "Documents"] as const;

const ROUTE_OPTIONS = [
  { value: "oral", label: "Oral" },
  { value: "topical", label: "Topical" },
  { value: "inhaled", label: "Inhaled" },
  { value: "sublingual", label: "Sublingual" },
  { value: "subcutaneous", label: "Subcutaneous" },
  { value: "intramuscular", label: "Intramuscular" },
  { value: "other", label: "Other" },
] as const;

const FREQUENCY_OPTIONS = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "3× daily" },
  { value: "every_morning", label: "Every morning" },
  { value: "every_night", label: "Every night" },
  { value: "weekly", label: "Weekly" },
  { value: "prn", label: "PRN (as needed)" },
  { value: "other", label: "Other" },
] as const;

const GOAL_CATEGORIES = [
  { value: "core", label: "Core" },
  { value: "capacity_building", label: "Capacity Building" },
  { value: "capital", label: "Capital" },
] as const;

const labelCls = "mb-1 block text-[9px] font-medium uppercase tracking-wider text-zinc-600";
const inputCls = "w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]";

/* ── Component ────────────────────────────────────────────── */

export function NewParticipantOverlay({
  open,
  onClose,
  onComplete,
}: NewParticipantOverlayProps) {
  const [step, setStep] = useState(0);
  const [nameLocked, setNameLocked] = useState(false);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ndisItems, setNdisItems] = useState<NDISItem[]>([]);
  const [ndisSearch, setNdisSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const org = useOrg();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const nameRef = useRef<HTMLInputElement>(null);
  const intakeStore = useIntakeStore();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    getValues,
    formState: { errors },
  } = useForm<IntakeFormData>({
    resolver: zodResolver(participantIntakeSchema),
    defaultValues: INTAKE_DEFAULTS,
  });

  const { fields: lineItems, append: appendLineItem, remove: removeLineItem } = useFieldArray({ control, name: "sa_line_items" });
  const { fields: rosterEntries, append: appendRoster, remove: removeRoster, update: updateRoster } = useFieldArray({ control, name: "roster_entries" });
  const { fields: medications, append: appendMed, remove: removeMed } = useFieldArray({ control, name: "medications" });
  const { fields: goals, append: appendGoal, remove: removeGoal } = useFieldArray({ control, name: "goals" });

  const watchedLineItems = watch("sa_line_items");
  const watchedRoster = watch("roster_entries");
  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const fundingType = watch("funding_type");

  const initials = useMemo(() => {
    const f = firstName?.trim()?.[0] ?? "";
    const l = lastName?.trim()?.[0] ?? "";
    return (f + l).toUpperCase();
  }, [firstName, lastName]);

  /* ── NDIS items ─────────────────────────────────────────── */
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

  /* ── Draft resume ───────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      const draft = intakeStore.formData;
      const hasDraft = intakeStore.hasDraft && !!(draft.first_name || draft.last_name);
      if (hasDraft) setShowDraftPrompt(true);
      else resetFresh();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetFresh() {
    reset(INTAKE_DEFAULTS);
    setStep(0);
    setNameLocked(false);
    setDirection(1);
    setSaving(false);
    setSaved(false);
    setNdisSearch("");
    setActiveSearchIndex(null);
    setPdfGenerated(false);
    setGeneratingPdf(false);
    setShowDraftPrompt(false);
    intakeStore.reset();
    setTimeout(() => nameRef.current?.focus(), 150);
  }

  function resumeDraft() {
    const draft = intakeStore.formData as IntakeFormData;
    reset({ ...INTAKE_DEFAULTS, ...draft });
    setStep(intakeStore.currentStep);
    setNameLocked(!!(draft.first_name && draft.last_name));
    setSaving(false);
    setSaved(false);
    setShowDraftPrompt(false);
    setPdfGenerated(false);
    setGeneratingPdf(false);
  }

  /* ── Persist to zustand ─────────────────────────────────── */
  useEffect(() => {
    if (!open || showDraftPrompt) return;
    const sub = watch((data) => intakeStore.setFormData(data as Partial<IntakeFormData>));
    return () => sub.unsubscribe();
  }, [open, showDraftPrompt, watch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !showDraftPrompt) intakeStore.setStep(step);
  }, [step, open, showDraftPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Navigation ─────────────────────────────────────────── */
  const lockName = useCallback(async () => {
    const valid = await trigger(["first_name", "last_name"]);
    if (!valid) return;
    setNameLocked(true);
  }, [trigger]);

  const goNext = useCallback(async () => {
    if (step === 0 && !nameLocked) {
      const valid = await trigger(["first_name", "last_name"]);
      if (!valid) return;
      setNameLocked(true);
    }
    if (step === 0) {
      const valid = await trigger(["funding_type"]);
      if (!valid) return;
    }
    if (step === 3 && fundingType === "plan_managed") {
      const email = getValues("plan_manager_email");
      if (email && email.length > 0) {
        const valid = await trigger(["plan_manager_email"]);
        if (!valid) return;
      }
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, 6));
  }, [step, nameLocked, trigger, fundingType, getValues]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  /* ── Keyboard ───────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeSearchIndex !== null) setActiveSearchIndex(null);
        else onClose();
      }
      if (e.key === "Enter" && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT") return;
        if (step === 0 && !nameLocked) { e.preventDefault(); lockName(); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (step === 6) handleSubmit(onSubmit)();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, activeSearchIndex, step, nameLocked, lockName]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Computed financials ────────────────────────────────── */
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
    return {
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      weeklyCost: Math.round(weeklyCost * 100) / 100,
      annualProjection: Math.round(weeklyCost * 52 * 100) / 100,
    };
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

  /* ── PDF ────────────────────────────────────────────────── */
  useEffect(() => {
    if (step === 6 && !pdfGenerated && !generatingPdf) {
      setGeneratingPdf(true);
    }
  }, [step, pdfGenerated, generatingPdf]);

  useEffect(() => {
    if (!generatingPdf || pdfGenerated) return;
    const t = setTimeout(() => { setPdfGenerated(true); setGeneratingPdf(false); }, 600);
    return () => clearTimeout(t);
  }, [generatingPdf, pdfGenerated]);

  const downloadPdf = useCallback(async (type: "sa" | "cp") => {
    const { pdf } = await import("@react-pdf/renderer");
    const { ServiceAgreementPDF, CareplanPDF } = await import("@/components/care/intake-pdf-templates");
    const d = getValues();
    const orgName = currentOrg?.name || "iWorkr";
    const doc = type === "sa"
      ? <ServiceAgreementPDF data={d} orgName={orgName} />
      : <CareplanPDF data={d} orgName={orgName} />;
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "sa"
      ? `Service_Agreement_${d.first_name}_${d.last_name}.pdf`
      : `Care_Plan_${d.first_name}_${d.last_name}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getValues, currentOrg]);

  const previewPdf = useCallback(async (type: "sa" | "cp") => {
    const { pdf } = await import("@react-pdf/renderer");
    const { ServiceAgreementPDF, CareplanPDF } = await import("@/components/care/intake-pdf-templates");
    const d = getValues();
    const orgName = currentOrg?.name || "iWorkr";
    const doc = type === "sa"
      ? <ServiceAgreementPDF data={d} orgName={orgName} />
      : <CareplanPDF data={d} orgName={orgName} />;
    const blob = await pdf(doc).toBlob();
    window.open(URL.createObjectURL(blob), "_blank");
  }, [getValues, currentOrg]);

  /* ── Submit ─────────────────────────────────────────────── */
  const onSubmit = useCallback(async (data: IntakeFormData) => {
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
        critical_alerts: data.critical_alerts
          ? data.critical_alerts.split("\n").map((a) => a.trim()).filter(Boolean)
          : [],
        mobility_status: data.mobility_status || null,
        communication_type: data.communication_type || null,
        sa_start_date: data.sa_start_date || null,
        sa_end_date: data.sa_end_date || null,
        sa_line_items: (data.sa_line_items || []).map((li) => ({
          ndis_code: li.ndis_code, ndis_name: li.ndis_name,
          unit_rate: li.unit_rate, support_purpose: li.support_purpose,
          allocated_budget: li.allocated_budget,
        })),
        roster_entries: (data.roster_entries || []).map((re) => ({
          days: re.days, start_time: re.start_time, end_time: re.end_time,
          linked_item_number: re.linked_item_number || null, title: null,
        })),
        medications: (data.medications || []).map((m) => ({
          medication_name: m.medication_name, dosage: m.dosage,
          route: m.route || "oral", frequency: m.frequency || "once_daily",
          prescribing_doctor: m.prescribing_doctor || null,
          is_prn: m.is_prn || false,
          special_instructions: m.special_instructions || null,
        })),
        goals: (data.goals || []).map((g) => ({
          title: g.title, description: g.description || null,
          support_category: g.support_category || "core",
          target_outcome: g.target_outcome || null,
        })),
        petty_cash_enabled: data.petty_cash_enabled || false,
        petty_cash_limit: data.petty_cash_limit || 0,
        petty_cash_notes: data.petty_cash_notes?.trim() || null,
        transport_budget_weekly: data.transport_budget_weekly || 0,
        discretionary_fund_notes: data.discretionary_fund_notes?.trim() || null,
      };
      const supabase = createClient();
      const { data: result, error } = await (supabase as any).rpc("create_participant_ecosystem", { p_payload: payload });
      if (error) throw new Error(error.message);
      setSaved(true);
      intakeStore.reset();
      addToast(`${data.first_name} ${data.last_name} activated`, undefined, "success");
      onComplete?.(result?.participant_id ?? "");
      setTimeout(() => onClose(), 500);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Something went wrong", undefined, "error");
    } finally {
      setSaving(false);
    }
  }, [saving, org, addToast, onComplete, onClose, intakeStore]);

  /* ════════════════════════════════════════════════════════════
     STEP RENDERERS
     ════════════════════════════════════════════════════════════ */

  const renderStep0 = () => (
    <>
      {/* Identity hook — same pattern as Create Client */}
      <div className="px-6 pt-5 pb-4">
        {nameLocked ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[12px] font-bold text-emerald-400">
              {initials || <Heart size={14} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[20px] font-medium tracking-tight text-zinc-100">
                {firstName} {lastName}
              </div>
            </div>
            <button onClick={() => setNameLocked(false)} className="rounded-md p-1 text-zinc-600 transition-colors hover:text-zinc-400">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-zinc-700" />
              <div className="flex flex-1 gap-3">
                <input
                  {...register("first_name")}
                  ref={(el) => { register("first_name").ref(el); (nameRef as any).current = el; }}
                  placeholder="First name"
                  autoComplete="off"
                  autoFocus
                  className="w-full bg-transparent text-[22px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
                />
                <input
                  {...register("last_name")}
                  placeholder="Last name"
                  autoComplete="off"
                  className="w-full bg-transparent text-[22px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
                />
              </div>
            </div>
            {(errors.first_name || errors.last_name) && (
              <p className="mt-2 pl-[26px] text-[11px] text-rose-400">{errors.first_name?.message || errors.last_name?.message}</p>
            )}
            {firstName?.trim() && lastName?.trim() && !errors.first_name && !errors.last_name && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 pl-[26px] text-[10px] text-zinc-600">
                Press <kbd className="rounded bg-[var(--subtle-bg)] px-1 py-0.5 font-mono text-[9px] text-zinc-500">Enter</kbd> to confirm
              </motion.p>
            )}
          </div>
        )}
      </div>

      {/* Progressive reveal — details after name lock */}
      <AnimatePresence>
        {nameLocked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border-base)] px-6 py-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <label className={labelCls}>NDIS Number</label>
                  <input {...register("ndis_number")} placeholder="430 123 456" className={inputCls} autoComplete="off" maxLength={11} />
                </div>
                <div>
                  <label className={labelCls}>Date of Birth</label>
                  <input type="date" {...register("date_of_birth")} className={`${inputCls} [color-scheme:dark]`} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input {...register("email")} placeholder="participant@email.com" className={inputCls} type="email" autoComplete="off" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input {...register("phone")} placeholder="0412 345 678" className={inputCls} autoComplete="off" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Preferred Name</label>
                  <input {...register("preferred_name")} placeholder="Optional" className={inputCls} autoComplete="off" />
                </div>
              </div>
            </div>

            {/* Funding type — card selectors */}
            <div className="border-t border-[var(--border-base)] px-6 py-4">
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
                          <motion.button key={ft.value} type="button" whileTap={{ scale: 0.98 }}
                            onClick={() => field.onChange(ft.value)}
                            className={`relative flex flex-col rounded-xl border px-4 py-3.5 text-left transition-all ${
                              active
                                ? "border-white/20 bg-[var(--subtle-bg-hover)]"
                                : "border-[var(--border-base)] bg-[var(--card-bg)] hover:border-[var(--border-active)]"
                            }`}
                          >
                            {active && (
                              <motion.div layoutId="funding-check"
                                className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-white"
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                              >
                                <Check size={10} className="text-black" />
                              </motion.div>
                            )}
                            <span className={`text-[12px] font-medium ${active ? "text-white" : "text-zinc-400"}`}>{ft.label}</span>
                            <span className="mt-0.5 text-[10px] text-zinc-600">{ft.desc}</span>
                          </motion.button>
                        );
                      })}
                    </>
                  )}
                />
              </div>
              {errors.funding_type && <p className="mt-1.5 text-[11px] text-rose-400">{errors.funding_type.message}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  const diagnosisValue = watch("primary_diagnosis") || "";
  const diagnosisSuggestions = useMemo(() => {
    if (!diagnosisValue.trim()) return DIAGNOSIS_SUGGESTIONS.slice(0, 12);
    const q = diagnosisValue.toLowerCase();
    return DIAGNOSIS_SUGGESTIONS.filter((d) => d.toLowerCase().includes(q) && d.toLowerCase() !== q);
  }, [diagnosisValue]);

  const renderStep1 = () => (
    <div className="px-6 py-5 space-y-5">
      <div>
        <label className={labelCls}>Primary Disability / Diagnosis</label>
        <input
          {...register("primary_diagnosis")}
          placeholder="Start typing or select below..."
          autoComplete="off"
          autoFocus
          className={inputCls}
        />
        {diagnosisSuggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {diagnosisSuggestions.map((d) => (
              <button key={d} type="button"
                onClick={() => setValue("primary_diagnosis", d)}
                className="rounded-full px-2.5 py-1 text-[10px] bg-[var(--card-bg)] text-zinc-600 transition-all hover:bg-[var(--subtle-bg-hover)] hover:text-zinc-300"
              >{d}</button>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border-base)] pt-4">
        <label className={labelCls}>Critical Medical Alerts</label>
        <textarea
          {...register("critical_alerts")}
          placeholder={"Seizure risk — administer midazolam if >5min\nAllergy: Penicillin"}
          rows={3}
          className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
        />
        <p className="mt-1 text-[9px] text-zinc-700">One alert per line. Displayed on every shift card.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Mobility</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Controller control={control} name="mobility_status"
              render={({ field }) => (
                <>{MOBILITY_OPTIONS.map((opt) => {
                  const active = field.value === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => field.onChange(active ? "" : opt.value)}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                        active
                          ? "bg-zinc-700 text-zinc-200"
                          : "bg-[var(--card-bg)] text-zinc-600 hover:bg-[var(--subtle-bg-hover)] hover:text-zinc-400"
                      }`}
                    >
                      {active && <Check size={8} className="mr-1 inline" />}
                      {opt.label}
                    </button>
                  );
                })}</>
              )}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Communication</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Controller control={control} name="communication_type"
              render={({ field }) => (
                <>{COMMUNICATION_OPTIONS.map((opt) => {
                  const active = field.value === opt.value;
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => field.onChange(active ? "" : opt.value)}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                        active
                          ? "bg-zinc-700 text-zinc-200"
                          : "bg-[var(--card-bg)] text-zinc-600 hover:bg-[var(--subtle-bg-hover)] hover:text-zinc-400"
                      }`}
                    >
                      {active && <Check size={8} className="mr-1 inline" />}
                      {opt.label}
                    </button>
                  );
                })}</>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Step 2: Medications & Goals ─────────────────────── */
  const renderStep2 = () => (
    <div className="px-6 py-5 space-y-5">
      {/* Medications */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls}><Pill size={8} className="mr-1 inline" />Current Medications</label>
          <button type="button" onClick={() => appendMed({ medication_name: "", dosage: "", route: "oral", frequency: "once_daily", prescribing_doctor: "", is_prn: false, special_instructions: "" })}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          ><Plus size={10} /> Add Medication</button>
        </div>

        {medications.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 py-6 text-center">
            <Pill size={18} className="mx-auto mb-2 text-zinc-700" />
            <p className="text-[11px] text-zinc-600">No medications added yet</p>
            <button type="button" onClick={() => appendMed({ medication_name: "", dosage: "", route: "oral", frequency: "once_daily", prescribing_doctor: "", is_prn: false, special_instructions: "" })}
              className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >+ Add first medication</button>
          </div>
        )}

        <div className="space-y-3">
          {medications.map((med, idx) => (
            <div key={med.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input {...register(`medications.${idx}.medication_name`)} placeholder="e.g. Paracetamol" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Dosage</label>
                    <input {...register(`medications.${idx}.dosage`)} placeholder="e.g. 500mg" className={inputCls} />
                  </div>
                </div>
                <button type="button" onClick={() => removeMed(idx)} className="mt-3 rounded p-1 text-zinc-700 hover:text-rose-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Route</label>
                  <select {...register(`medications.${idx}.route`)} className={`${inputCls} [color-scheme:dark]`}>
                    {ROUTE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Frequency</label>
                  <select {...register(`medications.${idx}.frequency`)} className={`${inputCls} [color-scheme:dark]`}>
                    {FREQUENCY_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Prescriber</label>
                  <input {...register(`medications.${idx}.prescribing_doctor`)} placeholder="Dr..." className={inputCls} />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Controller control={control} name={`medications.${idx}.is_prn`}
                  render={({ field }) => (
                    <button type="button" onClick={() => field.onChange(!field.value)}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] transition-all ${field.value ? "bg-amber-500/15 text-amber-400" : "bg-zinc-800 text-zinc-600 hover:text-zinc-400"}`}
                    >{field.value && <Check size={8} />}PRN</button>
                  )}
                />
                <div className="flex-1">
                  <input {...register(`medications.${idx}.special_instructions`)} placeholder="Special instructions..." className={`${inputCls} text-[11px]`} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="border-t border-[var(--border-base)] pt-4">
        <div className="flex items-center justify-between mb-3">
          <label className={labelCls}><Target size={8} className="mr-1 inline" />NDIS Goals</label>
          <button type="button" onClick={() => appendGoal({ title: "", description: "", support_category: "core", target_outcome: "" })}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
          ><Plus size={10} /> Add Goal</button>
        </div>

        {goals.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-800 py-6 text-center">
            <Target size={18} className="mx-auto mb-2 text-zinc-700" />
            <p className="text-[11px] text-zinc-600">No goals added yet</p>
            <button type="button" onClick={() => appendGoal({ title: "", description: "", support_category: "core", target_outcome: "" })}
              className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >+ Add first goal</button>
          </div>
        )}

        <div className="space-y-3">
          {goals.map((goal, idx) => (
            <div key={goal.id} className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Goal Title</label>
                  <input {...register(`goals.${idx}.title`)} placeholder="e.g. Increase social participation" className={inputCls} />
                </div>
                <button type="button" onClick={() => removeGoal(idx)} className="mt-3 rounded p-1 text-zinc-700 hover:text-rose-400 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Category</label>
                  <div className="flex gap-1.5 mt-1">
                    <Controller control={control} name={`goals.${idx}.support_category`}
                      render={({ field }) => (
                        <>{GOAL_CATEGORIES.map((c) => {
                          const active = field.value === c.value;
                          return (
                            <button key={c.value} type="button" onClick={() => field.onChange(c.value)}
                              className={`rounded-full px-2.5 py-1 text-[10px] transition-all ${active ? "bg-zinc-700 text-zinc-200" : "bg-[var(--card-bg)] text-zinc-600 hover:text-zinc-400"}`}
                            >{active && <Check size={7} className="mr-1 inline" />}{c.label}</button>
                          );
                        })}</>
                      )}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Target Outcome</label>
                  <input {...register(`goals.${idx}.target_outcome`)} placeholder="Measurable outcome..." className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea {...register(`goals.${idx}.description`)} placeholder="Additional details..." rows={2}
                  className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Step 3: Service Agreement (was Step 2) ─────────── */
  const renderStep3 = () => (
    <div className="px-6 py-5 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}><Calendar size={8} className="mr-1 inline" />Agreement Start</label>
          <input type="date" {...register("sa_start_date")} className={`${inputCls} [color-scheme:dark]`} />
        </div>
        <div>
          <label className={labelCls}><Calendar size={8} className="mr-1 inline" />Agreement End</label>
          <input type="date" {...register("sa_end_date")} className={`${inputCls} [color-scheme:dark]`} />
        </div>
      </div>

      <AnimatePresence>
        {fundingType === "plan_managed" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <label className={labelCls}>Plan Manager Email</label>
            <input {...register("plan_manager_email")} placeholder="invoices@planmanager.com.au" type="email" className={inputCls} autoComplete="off" />
            {errors.plan_manager_email && <p className="mt-1 text-[11px] text-rose-400">{errors.plan_manager_email.message}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-[var(--border-base)] pt-4 space-y-2.5">
        <label className={labelCls}>NDIS Line Items</label>
        {lineItems.map((field, idx) => (
          <div key={field.id} className="group rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-3">
                <div className="relative">
                  {watchedLineItems?.[idx]?.ndis_code ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[11px] text-[var(--brand)]">{watchedLineItems[idx].ndis_code}</span>
                        <p className="text-[12px] text-zinc-400">{watchedLineItems[idx].ndis_name}</p>
                      </div>
                      <button type="button"
                        onClick={() => { setValue(`sa_line_items.${idx}.ndis_code`, ""); setValue(`sa_line_items.${idx}.ndis_name`, ""); setValue(`sa_line_items.${idx}.unit_rate`, 0); setValue(`sa_line_items.${idx}.support_purpose`, ""); setActiveSearchIndex(idx); }}
                        className="text-[10px] text-zinc-700 hover:text-zinc-400"
                      >Change</button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 border-b border-[var(--border-base)] pb-1.5">
                        <Search size={12} className="text-zinc-700" />
                        <input type="text" value={activeSearchIndex === idx ? ndisSearch : ""} onFocus={() => setActiveSearchIndex(idx)}
                          onChange={(e) => { setActiveSearchIndex(idx); setNdisSearch(e.target.value); }}
                          placeholder="Search NDIS items..." className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                        />
                      </div>
                      <AnimatePresence>
                        {activeSearchIndex === idx && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-[var(--border-active)] bg-[var(--surface-1)] shadow-xl"
                          >
                            {filteredNDIS.length === 0
                              ? <p className="px-3 py-2 text-[11px] text-zinc-700">No items found</p>
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
                                    <span className="font-mono text-[10px] text-[var(--brand)]">{item.support_item_number}</span>
                                    <p className="text-[11px] text-zinc-400">{item.support_item_name}</p>
                                  </div>
                                  <span className="font-mono text-[11px] text-zinc-600">${item.price_limit_national.toFixed(2)}/hr</span>
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
                    <div className="flex items-center gap-1 border-b border-[var(--border-base)] pb-1.5">
                      <DollarSign size={13} className="text-zinc-700" />
                      <input type="number" step="0.01" {...register(`sa_line_items.${idx}.allocated_budget`, { valueAsNumber: true })}
                        placeholder="50,000" className="flex-1 bg-transparent font-mono text-[14px] text-white outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </div>
                  {watchedLineItems?.[idx]?.unit_rate > 0 && (
                    <p className="pb-2 font-mono text-[11px] text-zinc-600">${watchedLineItems[idx].unit_rate.toFixed(2)}/hr</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => removeLineItem(idx)}
                className="rounded-lg p-1.5 text-zinc-800 opacity-0 group-hover:opacity-100 transition-all hover:text-rose-400"
              ><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        <button type="button"
          onClick={() => appendLineItem({ ndis_code: "", ndis_name: "", unit_rate: 0, support_purpose: "", allocated_budget: 0 })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--card-border)] py-3 text-[12px] text-zinc-600 transition-colors hover:border-[var(--card-border-hover)] hover:text-zinc-400"
        ><Plus size={12} /> Add Line Item</button>
      </div>

      {totalSABudget > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-zinc-600">Total Agreement Value</span>
          <span className="font-mono text-[16px] text-[var(--brand)]">${totalSABudget.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
        </motion.div>
      )}
    </div>
  );

  /* ── Step 4: Schedule (was Step 3) ────────────────────── */
  const renderStep4 = () => (
    <div className="px-6 py-5 space-y-5">
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {rosterEntries.map((field, idx) => {
            const entry = watchedRoster?.[idx];
            const selectedDays = entry?.days || [];
            return (
              <motion.div key={field.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                className="group space-y-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
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
                          className={`flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold transition-all ${
                            sel ? "bg-white text-black" : "border border-[var(--card-border)] text-zinc-600 hover:border-[var(--card-border-hover)] hover:text-zinc-400"
                          }`}
                          title={day.full}
                        >{day.label}</motion.button>
                      );
                    })}
                  </div>
                </div>
                {selectedDays.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                    <p className="text-[11px] text-zinc-600">
                      Every <span className="text-zinc-300">{selectedDays.map((d: string) => DAYS_OF_WEEK.find((dw) => dw.key === d)?.full).filter(Boolean).join(", ")}</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className={labelCls}><Clock size={8} className="mr-1 inline" />Start</label>
                        <input type="time" value={entry?.start_time || ""} onChange={(e) => updateRoster(idx, { ...entry, start_time: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
                      </div>
                      <span className="mt-4 text-[11px] text-zinc-700">&rarr;</span>
                      <div className="flex-1">
                        <label className={labelCls}><Clock size={8} className="mr-1 inline" />End</label>
                        <input type="time" value={entry?.end_time || ""} onChange={(e) => updateRoster(idx, { ...entry, end_time: e.target.value })} className={`${inputCls} [color-scheme:dark]`} />
                      </div>
                    </div>
                    {(watchedLineItems?.length || 0) > 0 && (
                      <div>
                        <label className={labelCls}>Link to SA Line Item</label>
                        <select value={entry?.linked_item_index ?? ""} onChange={(e) => {
                          const v = e.target.value; const i = v === "" ? undefined : parseInt(v);
                          updateRoster(idx, { ...entry, linked_item_index: i, linked_item_number: i !== undefined ? watchedLineItems?.[i]?.ndis_code : undefined });
                        }} className={`${inputCls} [color-scheme:dark]`}>
                          <option value="" className="bg-[var(--surface-1)]">No linkage</option>
                          {watchedLineItems?.map((li, liIdx) => (
                            <option key={liIdx} value={liIdx} className="bg-[var(--surface-1)]">{li.ndis_code} — ${li.allocated_budget.toLocaleString()}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </motion.div>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={() => removeRoster(idx)} className="text-[10px] text-zinc-800 opacity-0 group-hover:opacity-100 transition-all hover:text-rose-400">Remove</button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <button type="button" onClick={() => appendRoster({ days: [], start_time: "07:00", end_time: "15:00", linked_item_index: undefined, linked_item_number: undefined })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--card-border)] py-3 text-[12px] text-zinc-600 transition-colors hover:border-[var(--card-border-hover)] hover:text-zinc-400"
        ><Plus size={12} /> Add Schedule Block</button>
      </div>

      {rosterMath.weeklyHours > 0 && totalSABudget > 0 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg border p-4 ${
            budgetHealth.status === "safe" ? "border-emerald-500/20 bg-emerald-500/[0.03]"
              : budgetHealth.status === "danger" ? "border-amber-500/20 bg-amber-500/[0.03]"
              : "border-[var(--card-border)] bg-[var(--card-bg)]"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {budgetHealth.status === "safe" ? <TrendingUp size={14} className="mt-0.5 text-emerald-500" /> : <AlertTriangle size={14} className="mt-0.5 text-amber-400" />}
            <div className="flex-1">
              <p className={`text-[12px] font-medium ${budgetHealth.status === "safe" ? "text-emerald-400" : "text-amber-400"}`}>
                {budgetHealth.status === "safe"
                  ? `Utilizes ${budgetHealth.pct}% of budget`
                  : `Exceeds budget by ${budgetHealth.pct - 100}% — $${(rosterMath.annualProjection - totalSABudget).toLocaleString("en-AU")} shortfall`}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-zinc-700">Weekly Hours</p>
                  <p className="font-mono text-[14px] text-zinc-300">{rosterMath.weeklyHours}h</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-zinc-700">Weekly Cost</p>
                  <p className="font-mono text-[14px] text-zinc-300">${rosterMath.weeklyCost.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-zinc-700">Annual</p>
                  <p className={`font-mono text-[14px] ${budgetHealth.status === "safe" ? "text-emerald-400" : "text-amber-400"}`}>${rosterMath.annualProjection.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );

  /* ── Step 5: Funds Management ─────────────────────────── */
  const renderStep5 = () => (
    <div className="px-6 py-5 space-y-5">
      <div>
        <label className={labelCls}><Wallet size={8} className="mr-1 inline" />Petty Cash Management</label>
        <p className="text-[10px] text-zinc-700 mb-3">Does the participant have a petty cash float managed by support workers?</p>

        <Controller control={control} name="petty_cash_enabled"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => field.onChange(!field.value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${field.value ? "bg-emerald-500/30" : "bg-zinc-800"}`}
              >
                <div className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${field.value ? "left-5 bg-emerald-400" : "left-0.5 bg-zinc-600"}`} />
              </button>
              <span className="text-[12px] text-zinc-400">{field.value ? "Enabled" : "Disabled"}</span>
            </div>
          )}
        />
      </div>

      <AnimatePresence>
        {watch("petty_cash_enabled") && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }} className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-4 pb-3">
              <div>
                <label className={labelCls}>Weekly Limit ($)</label>
                <input type="number" step="0.01" min="0" {...register("petty_cash_limit", { valueAsNumber: true })}
                  placeholder="50.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Notes / Purpose</label>
                <input {...register("petty_cash_notes")} placeholder="e.g. Groceries, community outings" className={inputCls} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t border-[var(--border-base)] pt-4">
        <label className={labelCls}><Car size={8} className="mr-1 inline" />Transport Budget</label>
        <p className="text-[10px] text-zinc-700 mb-3">Weekly transport allowance claimable under NDIS Core — Transport</p>
        <div>
          <label className={labelCls}>Weekly Budget ($)</label>
          <input type="number" step="0.01" min="0" {...register("transport_budget_weekly", { valueAsNumber: true })}
            placeholder="0.00" className={inputCls} />
        </div>
      </div>

      <div className="border-t border-[var(--border-base)] pt-4">
        <label className={labelCls}><DollarSign size={8} className="mr-1 inline" />Discretionary / Other Funds</label>
        <textarea {...register("discretionary_fund_notes")}
          placeholder={"Any other fund management notes...\ne.g. Nominee manages bank account, direct debit for rent, etc."}
          rows={3} className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
        />
      </div>
    </div>
  );

  /* ── Step 6: Documents (was Step 4) ─────────────────── */
  const renderStep6 = () => (
    <div className="px-6 py-5">
      {generatingPdf && !pdfGenerated ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
          <p className="text-[13px] text-zinc-500">Generating documents&hellip;</p>
        </div>
      ) : pdfGenerated ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Document cards */}
          {[
            { type: "sa" as const, icon: FileText, color: "blue", title: "NDIS Service Agreement", sub: `${firstName} ${lastName} · ${totalSABudget > 0 ? `$${totalSABudget.toLocaleString("en-AU")}` : "No budget set"}` },
            { type: "cp" as const, icon: Stethoscope, color: "rose", title: "Clinical Care Plan", sub: `${firstName} ${lastName} · ${watch("primary_diagnosis") || "No diagnosis"}` },
          ].map((doc) => {
            const Icon = doc.icon;
            return (
              <div key={doc.type} className="flex items-center gap-4 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-4 transition-colors hover:border-[var(--card-border-hover)]">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  doc.color === "blue" ? "bg-blue-500/10 text-blue-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-zinc-200">{doc.title}</p>
                  <p className="text-[11px] text-zinc-600">{doc.sub}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => previewPdf(doc.type)} className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Preview">
                    <Eye size={14} />
                  </button>
                  <button type="button" onClick={() => downloadPdf(doc.type)} className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Download">
                    <Download size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="border-t border-[var(--border-base)] pt-4 mt-4">
            <p className={labelCls}>Summary</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
              {[
                ["Name", `${firstName} ${lastName}`],
                ["NDIS", watch("ndis_number") || "—"],
                ["Funding", FUNDING_TYPES.find(f => f.value === fundingType)?.label || "—"],
                ["Budget", `$${totalSABudget.toLocaleString("en-AU")}`],
                ["Diagnosis", watch("primary_diagnosis") || "—"],
                ["Weekly Hours", `${rosterMath.weeklyHours}h`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-0.5">
                  <span className="text-[11px] text-zinc-600">{label}</span>
                  <span className="text-[11px] text-zinc-300 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  const stepContent = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  return (
    <AnimatePresence>
      {open && (
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
            aria-hidden
          />

          {/* Draft prompt */}
          <AnimatePresence>
            {showDraftPrompt && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center"
              >
                <div className="w-[380px] rounded-lg border border-[var(--card-border)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-deep)]">
                  <p className="text-[14px] font-medium text-zinc-200">Resume Intake?</p>
                  <p className="mt-1.5 text-[12px] text-zinc-500">
                    Incomplete draft for <span className="text-zinc-300">{intakeStore.formData.first_name} {intakeStore.formData.last_name}</span>
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={resetFresh}
                      className="rounded-md px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                    >Discard</button>
                    <button type="button" onClick={resumeDraft}
                      className="rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200"
                    >Resume</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Panel */}
          {!showDraftPrompt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={saved ? { opacity: 0, scale: 0.9 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              layout
              className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-[840px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--surface-2)] shadow-[var(--shadow-deep)]"
              style={{ maxHeight: "85vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
                <span className="text-[12px] text-zinc-500">
                  Participants <span className="text-zinc-700">/</span>{" "}
                  <span className="text-zinc-600">New</span>
                  {step > 0 && (
                    <>
                      {" "}<span className="text-zinc-700">/</span>{" "}
                      <span className="text-zinc-400">{STEP_LABELS[step]}</span>
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">Esc</kbd>
                  <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white" aria-label="Close">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ x: direction > 0 ? 24 : -24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: direction > 0 ? -24 : 24, opacity: 0 }}
                    transition={{
                      x: { type: "spring", stiffness: 400, damping: 35 },
                      opacity: { duration: 0.12 },
                    }}
                  >
                    {stepContent[step]()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-base)] px-5 py-3">
                <div>
                  {step > 0 ? (
                    <button type="button" onClick={goBack}
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-white"
                    >
                      <ChevronLeft size={12} /> Back
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-700">
                      Step {step + 1} of {STEP_LABELS.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {step >= 1 && step < 6 && (
                    <button type="button" onClick={goNext}
                      className="rounded-md px-3 py-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
                    >Skip</button>
                  )}

                  {step < 6 ? (
                    <motion.button type="button" whileTap={{ scale: 0.98 }}
                      onClick={goNext}
                      disabled={step === 0 && !nameLocked}
                      className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {step === 0 ? "Continue" : `Next: ${STEP_LABELS[step + 1]}`}
                      <kbd className="rounded bg-black/10 px-1 py-0.5 font-mono text-[9px]">&#8629;</kbd>
                    </motion.button>
                  ) : (
                    <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={saving || !pdfGenerated}
                      className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {saving ? (
                        <><Loader2 size={13} className="animate-spin" /> Finalizing&hellip;</>
                      ) : saved ? (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                          <Check size={14} />
                        </motion.div>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          Activate Participant
                          <kbd className="rounded bg-black/10 px-1 py-0.5 font-mono text-[9px]">&#8984;&#8629;</kbd>
                        </>
                      )}
                    </motion.button>
                  )}

                  {step >= 1 && step < 6 && (
                    <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Activate Now
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </form>
      )}
    </AnimatePresence>
  );
}
