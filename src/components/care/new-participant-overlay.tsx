"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
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
} from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToastStore } from "@/components/app/action-toast";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface NewParticipantOverlayProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (participantId: string) => void;
}

const STEPS = [
  { id: 0, label: "Identity" },
  { id: 1, label: "Care Profile" },
  { id: 2, label: "Service Agreement" },
  { id: 3, label: "Master Schedule" },
] as const;

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

/* ═══════════════════════════════════════════════════════════════════════════
   NDIS ITEM TYPE
   ═══════════════════════════════════════════════════════════════════════════ */

interface NDISItem {
  support_item_number: string;
  support_item_name: string;
  support_category_name: string;
  unit: string;
  price_limit_national: number;
  support_purpose: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ZOD SCHEMA
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export function NewParticipantOverlay({
  open,
  onClose,
  onComplete,
}: NewParticipantOverlayProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ndisItems, setNdisItems] = useState<NDISItem[]>([]);
  const [ndisSearch, setNdisSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const org = useOrg();

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
      first_name: "",
      last_name: "",
      preferred_name: "",
      ndis_number: "",
      funding_type: "",
      date_of_birth: "",
      email: "",
      phone: "",
      primary_diagnosis: "",
      critical_alerts: "",
      mobility_status: "",
      communication_type: "",
      sa_start_date: new Date().toISOString().split("T")[0],
      sa_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      sa_line_items: [],
      roster_entries: [],
    },
  });

  const {
    fields: lineItems,
    append: appendLineItem,
    remove: removeLineItem,
  } = useFieldArray({ control, name: "sa_line_items" });

  const {
    fields: rosterEntries,
    append: appendRoster,
    remove: removeRoster,
    update: updateRoster,
  } = useFieldArray({ control, name: "roster_entries" });

  const watchedLineItems = watch("sa_line_items");
  const watchedRoster = watch("roster_entries");

  // ── Load NDIS catalogue ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    (supabase as ReturnType<typeof createClient> & { from: (t: string) => any })
      .from("ndis_support_items")
      .select("support_item_number, support_item_name, support_category_name, unit, price_limit_national, support_purpose")
      .eq("is_active", true)
      .order("support_item_number")
      .then(({ data }: { data: NDISItem[] | null }) => {
        if (data) setNdisItems(data);
      });
  }, [open]);

  // ── Reset on open ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      reset();
      setStep(0);
      setDirection(1);
      setSaving(false);
      setSaved(false);
      setNdisSearch("");
      setActiveSearchIndex(null);
    }
  }, [open, reset]);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeSearchIndex !== null) {
          setActiveSearchIndex(null);
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (step === 3) {
          handleSubmit(onSubmit)();
        } else {
          goNext();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, activeSearchIndex, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step navigation ──────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    let valid = true;
    if (step === 0) valid = await trigger(["first_name", "last_name", "funding_type"]);
    if (!valid) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, 3));
  }, [step, trigger]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  // ── Total SA budget ──────────────────────────────────────────────────────
  const totalSABudget = useMemo(
    () => (watchedLineItems || []).reduce((sum, li) => sum + (li.allocated_budget || 0), 0),
    [watchedLineItems]
  );

  // ── Roster math ──────────────────────────────────────────────────────────
  const rosterMath = useMemo(() => {
    if (!watchedRoster || watchedRoster.length === 0)
      return { weeklyHours: 0, weeklyCost: 0, annualProjection: 0 };

    let weeklyHours = 0;
    let weeklyCost = 0;

    for (const entry of watchedRoster) {
      if (!entry.start_time || !entry.end_time || !entry.days?.length) continue;
      const [sh, sm] = entry.start_time.split(":").map(Number);
      const [eh, em] = entry.end_time.split(":").map(Number);
      const hoursPerShift = (eh + em / 60) - (sh + sm / 60);
      if (hoursPerShift <= 0) continue;
      const daysCount = entry.days.length;
      weeklyHours += hoursPerShift * daysCount;
      if (entry.linked_item_index !== undefined && watchedLineItems?.[entry.linked_item_index]) {
        const rate = watchedLineItems[entry.linked_item_index].unit_rate || 0;
        weeklyCost += hoursPerShift * daysCount * rate;
      }
    }

    return {
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      weeklyCost: Math.round(weeklyCost * 100) / 100,
      annualProjection: Math.round(weeklyCost * 52 * 100) / 100,
    };
  }, [watchedRoster, watchedLineItems]);

  // ── Budget health ────────────────────────────────────────────────────────
  const budgetHealth = useMemo(() => {
    if (totalSABudget <= 0 || rosterMath.annualProjection <= 0)
      return { status: "neutral" as const, pct: 0, depleteMonth: 0 };
    const pct = Math.round((rosterMath.annualProjection / totalSABudget) * 100);
    const depleteMonth = rosterMath.weeklyCost > 0 ? Math.floor(totalSABudget / (rosterMath.weeklyCost * 4.33)) : 0;
    if (rosterMath.annualProjection <= totalSABudget) return { status: "safe" as const, pct, depleteMonth: 12 };
    return { status: "danger" as const, pct, depleteMonth };
  }, [totalSABudget, rosterMath]);

  // ── NDIS search filter ───────────────────────────────────────────────────
  const filteredNDIS = useMemo(() => {
    if (!ndisSearch.trim()) return ndisItems.slice(0, 20);
    const q = ndisSearch.toLowerCase();
    return ndisItems.filter((item) =>
      item.support_item_number.toLowerCase().includes(q) ||
      item.support_item_name.toLowerCase().includes(q) ||
      item.support_category_name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [ndisSearch, ndisItems]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (data: FormData) => {
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
            ndis_code: li.ndis_code,
            ndis_name: li.ndis_name,
            unit_rate: li.unit_rate,
            support_purpose: li.support_purpose,
            allocated_budget: li.allocated_budget,
          })),
          roster_entries: (data.roster_entries || []).map((re) => ({
            days: re.days,
            start_time: re.start_time,
            end_time: re.end_time,
            linked_item_number: re.linked_item_number || null,
            title: null,
          })),
        };

        const supabase = createClient();
        const { data: result, error } = await (supabase as ReturnType<typeof createClient> & { rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: Record<string, string> | null; error: { message: string } | null }> }).rpc(
          "create_participant_ecosystem",
          { p_payload: payload }
        );

        if (error) throw new Error(error.message);

        const participantId = result?.participant_id ?? "";
        setSaved(true);
        addToast(
          `${data.first_name} ${data.last_name} activated${data.sa_line_items.length > 0 ? " with SA" : ""}${data.roster_entries.length > 0 ? " & Schedule" : ""}`,
          undefined,
          "success"
        );

        onComplete?.(participantId);
        setTimeout(() => onClose(), 400);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        console.error("[NewParticipantOverlay] submit failed:", e);
        addToast(msg, undefined, "error");
      } finally {
        setSaving(false);
      }
    },
    [saving, org, addToast, onComplete, onClose]
  );

  /* ═════════════════════════════════════════════════════════════════════════
     SHARED INPUT CLASSES — mirrors Trade sector patterns exactly
     ═════════════════════════════════════════════════════════════════════════ */

  // Hero input — like job title / client name
  const heroInput = "w-full bg-transparent text-[22px] font-medium tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700";
  // Field input — underline style like create-client-modal
  const fieldInput = "w-full border-b border-[var(--border-base)] bg-transparent pb-2 text-[13px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-[var(--brand)]";
  // Tiny uppercase label
  const labelCls = "block text-[9px] font-medium uppercase tracking-wider text-zinc-600 mb-1.5";

  /* ─── Step 1: Identity ──────────────────────────────────────────────────── */
  const renderStep1 = () => (
    <div className="space-y-6 px-6 py-5">
      {/* Hero name input — like Create Client's name input */}
      <div className="grid grid-cols-2 gap-5">
        <input
          {...register("first_name")}
          placeholder="First name"
          className={heroInput}
          autoComplete="off"
          autoFocus
        />
        <input
          {...register("last_name")}
          placeholder="Last name"
          className={heroInput}
          autoComplete="off"
        />
      </div>
      {(errors.first_name || errors.last_name) && (
        <p className="text-[11px] text-red-400">
          {errors.first_name?.message || errors.last_name?.message}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-[var(--border-base)]" />

      {/* Detail fields — underline style */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <div>
          <label className={labelCls}>Preferred Name</label>
          <input {...register("preferred_name")} placeholder="Optional" className={fieldInput} autoComplete="off" />
        </div>
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
          <input {...register("email")} placeholder="jane@example.com" className={fieldInput} type="email" autoComplete="off" />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input {...register("phone")} placeholder="0412 345 678" className={fieldInput} autoComplete="off" />
        </div>
      </div>

      {/* Funding Type — card selector like Client Type selector */}
      <div>
        <label className={labelCls}>Funding Type</label>
        <div className="mt-2 grid grid-cols-3 gap-2.5">
          <Controller
            control={control}
            name="funding_type"
            render={({ field }) => (
              <>
                {FUNDING_TYPES.map((ft) => {
                  const active = field.value === ft.value;
                  return (
                    <motion.button
                      key={ft.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => field.onChange(ft.value)}
                      className={`relative rounded-lg p-3 text-left transition-all ${
                        active
                          ? "border border-[var(--brand)] bg-[var(--brand)]/[0.06]"
                          : "border border-[var(--card-border)] bg-white/[0.01] hover:border-[var(--card-border-hover)]"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="funding-check"
                          className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand)]"
                        >
                          <Check size={9} className="text-black" />
                        </motion.div>
                      )}
                      <p className={`text-[12px] font-medium ${active ? "text-white" : "text-zinc-400"}`}>{ft.label}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-600">{ft.desc}</p>
                    </motion.button>
                  );
                })}
              </>
            )}
          />
        </div>
        {errors.funding_type && <p className="mt-1.5 text-[11px] text-red-400">{errors.funding_type.message}</p>}
      </div>
    </div>
  );

  /* ─── Step 2: Care Profile ──────────────────────────────────────────────── */
  const renderStep2 = () => (
    <div className="space-y-5 px-6 py-5">
      {/* Hero diagnosis input */}
      <input
        {...register("primary_diagnosis")}
        placeholder="Primary diagnosis..."
        className={heroInput}
        autoComplete="off"
        autoFocus
      />

      <div className="h-px bg-[var(--border-base)]" />

      {/* Critical alerts */}
      <div>
        <label className={labelCls}>Critical Medical Alerts</label>
        <textarea
          {...register("critical_alerts")}
          placeholder={"Seizure risk — administer midazolam if >5min\nAllergy: Penicillin"}
          rows={3}
          className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-zinc-400 outline-none placeholder:text-zinc-700"
        />
        <p className="mt-1 text-[9px] text-zinc-700">One alert per line. These appear on every shift card.</p>
      </div>

      {/* Mobility — pill buttons like property pills */}
      <div>
        <label className={labelCls}>Mobility</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Controller
            control={control}
            name="mobility_status"
            render={({ field }) => (
              <>
                {MOBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(field.value === opt.value ? "" : opt.value)}
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                      field.value === opt.value
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-[var(--card-border)] text-zinc-500 hover:border-[var(--card-border-hover)] hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </>
            )}
          />
        </div>
      </div>

      {/* Communication */}
      <div>
        <label className={labelCls}>Communication</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Controller
            control={control}
            name="communication_type"
            render={({ field }) => (
              <>
                {COMMUNICATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(field.value === opt.value ? "" : opt.value)}
                    className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                      field.value === opt.value
                        ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                        : "border-[var(--card-border)] text-zinc-500 hover:border-[var(--card-border-hover)] hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </>
            )}
          />
        </div>
      </div>
    </div>
  );

  /* ─── Step 3: Service Agreement ─────────────────────────────────────────── */
  const renderStep3 = () => (
    <div className="space-y-5 px-6 py-5">
      {/* Date Range */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>
            <Calendar size={9} className="mr-1 inline" />SA Start Date
          </label>
          <input type="date" {...register("sa_start_date")} className={`${fieldInput} [color-scheme:dark]`} />
        </div>
        <div>
          <label className={labelCls}>
            <Calendar size={9} className="mr-1 inline" />SA End Date
          </label>
          <input type="date" {...register("sa_end_date")} className={`${fieldInput} [color-scheme:dark]`} />
        </div>
      </div>

      <div className="h-px bg-[var(--border-base)]" />

      {/* Line Items */}
      <div className="space-y-2.5">
        <label className={labelCls}>NDIS Line Items</label>

        {lineItems.map((field, idx) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="group rounded-lg border border-[var(--card-border)] bg-white/[0.01] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-3">
                {/* NDIS Item Search */}
                <div className="relative">
                  {watchedLineItems?.[idx]?.ndis_code ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[11px] text-[var(--brand)]">{watchedLineItems[idx].ndis_code}</span>
                        <p className="text-[12px] text-zinc-400">{watchedLineItems[idx].ndis_name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setValue(`sa_line_items.${idx}.ndis_code`, "");
                          setValue(`sa_line_items.${idx}.ndis_name`, "");
                          setValue(`sa_line_items.${idx}.unit_rate`, 0);
                          setValue(`sa_line_items.${idx}.support_purpose`, "");
                          setActiveSearchIndex(idx);
                        }}
                        className="text-[10px] text-zinc-700 hover:text-zinc-400"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 border-b border-[var(--border-base)] pb-1.5">
                        <Search size={12} className="text-zinc-700" />
                        <input
                          type="text"
                          value={activeSearchIndex === idx ? ndisSearch : ""}
                          onFocus={() => setActiveSearchIndex(idx)}
                          onChange={(e) => {
                            setActiveSearchIndex(idx);
                            setNdisSearch(e.target.value);
                          }}
                          placeholder="Search NDIS items..."
                          className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                        />
                      </div>
                      <AnimatePresence>
                        {activeSearchIndex === idx && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-[var(--border-active)] bg-[var(--surface-1)] shadow-xl"
                          >
                            {filteredNDIS.length === 0 ? (
                              <p className="px-3 py-2 text-[11px] text-zinc-700">No items found</p>
                            ) : (
                              filteredNDIS.map((item) => (
                                <button
                                  key={item.support_item_number}
                                  type="button"
                                  onClick={() => {
                                    setValue(`sa_line_items.${idx}.ndis_code`, item.support_item_number);
                                    setValue(`sa_line_items.${idx}.ndis_name`, item.support_item_name);
                                    setValue(`sa_line_items.${idx}.unit_rate`, item.price_limit_national);
                                    setValue(`sa_line_items.${idx}.support_purpose`, item.support_purpose);
                                    setActiveSearchIndex(null);
                                    setNdisSearch("");
                                  }}
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                                >
                                  <div className="flex-1">
                                    <span className="font-mono text-[10px] text-[var(--brand)]">{item.support_item_number}</span>
                                    <p className="text-[11px] text-zinc-400">{item.support_item_name}</p>
                                  </div>
                                  <span className="font-mono text-[11px] text-zinc-600">${item.price_limit_national.toFixed(2)}/hr</span>
                                </button>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Budget */}
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className={labelCls}>Budget</label>
                    <div className="flex items-center gap-1 border-b border-[var(--border-base)] pb-1.5">
                      <DollarSign size={13} className="text-zinc-700" />
                      <input
                        type="number"
                        step="0.01"
                        {...register(`sa_line_items.${idx}.allocated_budget`, { valueAsNumber: true })}
                        placeholder="50,000"
                        className="flex-1 bg-transparent font-mono text-[14px] text-white outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </div>
                  {watchedLineItems?.[idx]?.unit_rate > 0 && (
                    <p className="pb-2 font-mono text-[11px] text-zinc-600">${watchedLineItems[idx].unit_rate.toFixed(2)}/hr</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeLineItem(idx)}
                className="rounded-lg p-1.5 text-zinc-800 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </motion.div>
        ))}

        <button
          type="button"
          onClick={() => appendLineItem({ ndis_code: "", ndis_name: "", unit_rate: 0, support_purpose: "", allocated_budget: 0 })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--card-border)] py-3 text-[12px] text-zinc-600 transition-colors hover:border-[var(--card-border-hover)] hover:text-zinc-400"
        >
          <Plus size={12} />
          Add Line Item
        </button>
      </div>

      {/* Total */}
      {totalSABudget > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between pt-2"
        >
          <span className="text-[12px] text-zinc-600">Total Agreement Value</span>
          <span className="font-mono text-[16px] text-[var(--brand)]">
            ${totalSABudget.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </span>
        </motion.div>
      )}
    </div>
  );

  /* ─── Step 4: Master Schedule ───────────────────────────────────────────── */
  const renderStep4 = () => (
    <div className="space-y-5 px-6 py-5">
      {/* Roster Entries */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {rosterEntries.map((field, idx) => {
            const entry = watchedRoster?.[idx];
            const selectedDays = entry?.days || [];

            return (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="group space-y-4 rounded-lg border border-[var(--card-border)] bg-white/[0.01] p-4"
              >
                {/* Day Selector */}
                <div>
                  <label className={labelCls}>Support Days</label>
                  <div className="mt-1.5 flex gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = selectedDays.includes(day.key);
                      return (
                        <motion.button
                          key={day.key}
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => {
                            const current = entry?.days || [];
                            const updated = isSelected
                              ? current.filter((d: string) => d !== day.key)
                              : [...current, day.key];
                            updateRoster(idx, { ...entry, days: updated });
                          }}
                          className={`flex h-9 w-9 items-center justify-center rounded-md text-[12px] font-semibold transition-all ${
                            isSelected
                              ? "bg-[var(--brand)] text-black"
                              : "border border-[var(--card-border)] text-zinc-600 hover:border-[var(--card-border-hover)] hover:text-zinc-400"
                          }`}
                          title={day.full}
                        >
                          {day.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Range — appears when days selected */}
                {selectedDays.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3"
                  >
                    <p className="text-[11px] text-zinc-600">
                      Every{" "}
                      <span className="text-zinc-300">
                        {selectedDays.map((d: string) => DAYS_OF_WEEK.find((dw) => dw.key === d)?.full).filter(Boolean).join(", ")}
                      </span>
                    </p>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className={labelCls}><Clock size={9} className="mr-1 inline" />Start</label>
                        <input
                          type="time"
                          value={entry?.start_time || ""}
                          onChange={(e) => updateRoster(idx, { ...entry, start_time: e.target.value })}
                          className={`${fieldInput} [color-scheme:dark]`}
                        />
                      </div>
                      <span className="mt-4 text-[11px] text-zinc-700">→</span>
                      <div className="flex-1">
                        <label className={labelCls}><Clock size={9} className="mr-1 inline" />End</label>
                        <input
                          type="time"
                          value={entry?.end_time || ""}
                          onChange={(e) => updateRoster(idx, { ...entry, end_time: e.target.value })}
                          className={`${fieldInput} [color-scheme:dark]`}
                        />
                      </div>
                    </div>

                    {/* Link to SA Item */}
                    {(watchedLineItems?.length || 0) > 0 && (
                      <div>
                        <label className={labelCls}>Link to SA Line Item</label>
                        <select
                          value={entry?.linked_item_index ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const itemIdx = val === "" ? undefined : parseInt(val);
                            const itemNumber = itemIdx !== undefined ? watchedLineItems?.[itemIdx]?.ndis_code : undefined;
                            updateRoster(idx, { ...entry, linked_item_index: itemIdx, linked_item_number: itemNumber });
                          }}
                          className={`${fieldInput} [color-scheme:dark]`}
                        >
                          <option value="" className="bg-[var(--surface-1)]">No linkage</option>
                          {watchedLineItems?.map((li, liIdx) => (
                            <option key={liIdx} value={liIdx} className="bg-[var(--surface-1)]">{li.ndis_code} — ${li.allocated_budget.toLocaleString()}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Remove */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRoster(idx)}
                    className="text-[10px] text-zinc-800 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => appendRoster({ days: [], start_time: "07:00", end_time: "15:00", linked_item_index: undefined, linked_item_number: undefined })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--card-border)] py-3 text-[12px] text-zinc-600 transition-colors hover:border-[var(--card-border-hover)] hover:text-zinc-400"
        >
          <Plus size={12} />
          Add Schedule Block
        </button>
      </div>

      {/* ── Burn Rate Card ───────────────────────────────────────────────────── */}
      {rosterMath.weeklyHours > 0 && totalSABudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg border p-4 ${
            budgetHealth.status === "safe"
              ? "border-emerald-500/20 bg-emerald-500/[0.03]"
              : budgetHealth.status === "danger"
              ? "border-red-500/20 bg-red-500/[0.03]"
              : "border-[var(--card-border)] bg-white/[0.01]"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {budgetHealth.status === "safe" ? (
              <TrendingUp size={14} className="mt-0.5 text-emerald-500" />
            ) : (
              <AlertTriangle size={14} className="mt-0.5 text-red-400" />
            )}
            <div className="flex-1">
              <p className={`text-[12px] font-medium ${budgetHealth.status === "safe" ? "text-emerald-400" : "text-red-400"}`}>
                {budgetHealth.status === "safe"
                  ? `Utilizes ${budgetHealth.pct}% of budget. Safe to proceed.`
                  : `$${rosterMath.annualProjection.toLocaleString()}/yr exceeds $${totalSABudget.toLocaleString()} budget. Depletes Month ${budgetHealth.depleteMonth}.`}
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
                  <p className={`font-mono text-[14px] ${budgetHealth.status === "safe" ? "text-emerald-400" : "text-red-400"}`}>
                    ${rosterMath.annualProjection.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {rosterMath.weeklyHours > 0 && totalSABudget === 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[12px] text-zinc-600">Total Weekly Hours</span>
          <span className="font-mono text-[14px] text-zinc-300">{rosterMath.weeklyHours}h / week</span>
        </div>
      )}
    </div>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     MAIN RENDER — mirrors create-client-modal / create-job-modal exactly
     ═════════════════════════════════════════════════════════════════════════ */

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <AnimatePresence>
      {open && (
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ── Backdrop (sibling, not parent — matches Trade pattern) ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
            aria-hidden
          />

          {/* ── Stage (centered, bordered, surfaced — Trade DNA) ───────── */}
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
            {/* ── Progress Bar ──────────────────────────────────────────── */}
            <div className="h-[2px] w-full bg-white/[0.04]">
              <motion.div
                className="h-full bg-[var(--brand)]"
                initial={false}
                animate={{ width: `${((step + 1) / 4) * 100}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>

            {/* ── Header (Trade breadcrumb style) ──────────────────────── */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-zinc-500">Participants</span>
                <span className="text-[12px] text-zinc-700">/</span>
                <span className="text-[12px] text-zinc-600">New Participant</span>
                <ChevronRight size={10} className="mx-1 text-zinc-800" />
                {STEPS.map((s, i) => (
                  <React.Fragment key={s.id}>
                    {i > 0 && <span className="text-[10px] text-zinc-800">·</span>}
                    <span
                      className={`text-[10px] ${
                        i === step ? "font-medium text-white" : i < step ? "text-[var(--brand)]" : "text-zinc-700"
                      }`}
                    >
                      {s.label}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">Esc</kbd>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── Scrollable Body ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
                  transition={{
                    x: { type: "spring", stiffness: 400, damping: 35 },
                    opacity: { duration: 0.12 },
                  }}
                >
                  {stepContent[step]()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Footer (Trade pattern — border-t, px-5 py-3) ─────────── */}
            <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-base)] px-5 py-3">
              <div>
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-white"
                  >
                    <ChevronLeft size={12} />
                    Back
                  </button>
                ) : (
                  <span className="text-[11px] text-zinc-700">Step {step + 1} of 4</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* Skip button on steps 2-3 */}
                {step >= 1 && step < 3 && (
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-md px-3 py-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
                  >
                    Skip
                  </button>
                )}

                {step < 3 ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={goNext}
                    className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-zinc-200"
                  >
                    Next: {STEPS[step + 1]?.label}
                    <ChevronRight size={12} />
                  </motion.button>
                ) : (
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.98 }}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-md bg-[var(--brand)] px-4 py-2 text-[13px] font-medium text-black transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        Activate Participant
                        <kbd className="ml-1.5 rounded bg-white/15 px-1 py-0.5 font-mono text-[9px]">⌘↵</kbd>
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        </form>
      )}
    </AnimatePresence>
  );
}
