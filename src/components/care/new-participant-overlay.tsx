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
  Shield,
  TrendingUp,
} from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
// NDIS validation used elsewhere — keeping import path reference
// import { validateNDISNumber, formatNDISNumber } from "@/lib/ndis-utils";
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
  { id: 0, label: "Identity", description: "Who are they?" },
  { id: 1, label: "Care Profile", description: "What do they need?" },
  { id: 2, label: "Service Agreement", description: "Allocate their funding" },
  { id: 3, label: "Master Schedule", description: "When do they need support?" },
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
   ZOD SCHEMA — THE 4-STEP STATE MACHINE
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
  // Step 1: Identity
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  preferred_name: z.string().optional(),
  ndis_number: z.string().optional(),
  funding_type: z.string().min(1, "Select a funding type"),
  date_of_birth: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),

  // Step 2: Care Profile
  primary_diagnosis: z.string().optional(),
  critical_alerts: z.string().optional(),
  mobility_status: z.string().optional(),
  communication_type: z.string().optional(),

  // Step 3: Service Agreement
  sa_start_date: z.string().optional(),
  sa_end_date: z.string().optional(),
  sa_line_items: z.array(lineItemSchema),

  // Step 4: Master Schedule
  roster_entries: z.array(rosterEntrySchema),
});

type FormData = z.infer<typeof formSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const stageVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.1 } },
};

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
};

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
      sa_end_date: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString().split("T")[0],
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
  // const watchedFunding = watch("funding_type"); // reserved for future conditional rendering

  // ── Load NDIS catalogue ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    (supabase as any)
      .from("ndis_support_items")
      .select(
        "support_item_number, support_item_name, support_category_name, unit, price_limit_national, support_purpose"
      )
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
      setNdisSearch("");
      setActiveSearchIndex(null);
    }
  }, [open, reset]);

  // ── Keyboard: Escape ─────────────────────────────────────────────────────
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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, activeSearchIndex]);

  // ── Step navigation ──────────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    let valid = true;
    if (step === 0) {
      valid = await trigger(["first_name", "last_name", "funding_type"]);
    }
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
    () =>
      (watchedLineItems || []).reduce(
        (sum, li) => sum + (li.allocated_budget || 0),
        0
      ),
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

      // Find linked item rate
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
    const depleteMonth =
      rosterMath.weeklyCost > 0
        ? Math.floor(totalSABudget / (rosterMath.weeklyCost * 4.33))
        : 0;

    if (rosterMath.annualProjection <= totalSABudget) {
      return { status: "safe" as const, pct, depleteMonth: 12 };
    }
    return { status: "danger" as const, pct, depleteMonth };
  }, [totalSABudget, rosterMath]);

  // ── NDIS search filter ───────────────────────────────────────────────────
  const filteredNDIS = useMemo(() => {
    if (!ndisSearch.trim()) return ndisItems.slice(0, 20);
    const q = ndisSearch.toLowerCase();
    return ndisItems
      .filter(
        (item) =>
          item.support_item_number.toLowerCase().includes(q) ||
          item.support_item_name.toLowerCase().includes(q) ||
          item.support_category_name.toLowerCase().includes(q)
      )
      .slice(0, 20);
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
            ? data.critical_alerts
                .split("\n")
                .map((a) => a.trim())
                .filter(Boolean)
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
        const { data: result, error } = await (supabase as any).rpc(
          "create_participant_ecosystem",
          { p_payload: payload }
        );

        if (error) throw new Error(error.message);

        const participantId = result?.participant_id;
        addToast(
          `${data.first_name} ${data.last_name} activated${
            data.sa_line_items.length > 0 ? " with Service Agreement" : ""
          }${data.roster_entries.length > 0 ? " & Master Schedule" : ""}`,
          undefined,
          "success"
        );

        onComplete?.(participantId);
        setTimeout(() => onClose(), 300);
      } catch (e: any) {
        console.error("[NewParticipantOverlay] submit failed:", e);
        addToast(
          e?.message || "Failed to create participant",
          undefined,
          "error"
        );
      } finally {
        setSaving(false);
      }
    },
    [saving, org, addToast, onComplete, onClose]
  );

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER HELPERS
     ═════════════════════════════════════════════════════════════════════════ */

  const inputClass =
    "w-full bg-transparent border-b-2 border-white/10 pb-3 text-[22px] font-light text-white outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500";

  const inputSmClass =
    "w-full bg-transparent border-b border-white/10 pb-2 text-[15px] text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500";

  const labelClass = "block text-[11px] font-medium uppercase tracking-widest text-zinc-600 mb-2";

  /* ─── Step 1: Identity ──────────────────────────────────────────────────── */
  const renderStep1 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-[36px] font-light tracking-tight text-white leading-tight">
          Let&apos;s set up a new participant.
        </h2>
        <p className="mt-2 text-[14px] text-zinc-500">
          Enter their identity details and NDIS funding arrangement.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>First Name</label>
          <input
            {...register("first_name")}
            placeholder="Jane"
            className={inputClass}
            autoComplete="off"
            autoFocus
          />
          {errors.first_name && (
            <p className="mt-1.5 text-[11px] text-red-400">{errors.first_name.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Last Name</label>
          <input
            {...register("last_name")}
            placeholder="Mitchell"
            className={inputClass}
            autoComplete="off"
          />
          {errors.last_name && (
            <p className="mt-1.5 text-[11px] text-red-400">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>Preferred Name</label>
          <input
            {...register("preferred_name")}
            placeholder="Optional"
            className={inputSmClass}
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelClass}>NDIS Number</label>
          <input
            {...register("ndis_number")}
            placeholder="430 123 456"
            className={inputSmClass}
            autoComplete="off"
            maxLength={11}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>Date of Birth</label>
          <input
            type="date"
            {...register("date_of_birth")}
            className={`${inputSmClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            {...register("email")}
            placeholder="jane@example.com"
            className={inputSmClass}
            type="email"
            autoComplete="off"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Funding Type</label>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Controller
            control={control}
            name="funding_type"
            render={({ field }) => (
              <>
                {FUNDING_TYPES.map((ft) => (
                  <motion.button
                    key={ft.value}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => field.onChange(ft.value)}
                    className={`relative rounded-xl p-4 text-left transition-all ${
                      field.value === ft.value
                        ? "border-2 border-emerald-500/60 bg-emerald-500/[0.06]"
                        : "border border-white/[0.06] bg-white/[0.02] hover:border-white/10"
                    }`}
                  >
                    {field.value === ft.value && (
                      <motion.div
                        layoutId="funding-check"
                        className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500"
                      >
                        <Check size={11} className="text-black" />
                      </motion.div>
                    )}
                    <p className="text-[13px] font-medium text-white">{ft.label}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">{ft.desc}</p>
                  </motion.button>
                ))}
              </>
            )}
          />
        </div>
        {errors.funding_type && (
          <p className="mt-2 text-[11px] text-red-400">{errors.funding_type.message}</p>
        )}
      </div>
    </div>
  );

  /* ─── Step 2: Care Profile ──────────────────────────────────────────────── */
  const renderStep2 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-[36px] font-light tracking-tight text-white leading-tight">
          What are their critical care needs?
        </h2>
        <p className="mt-2 text-[14px] text-zinc-500">
          Capture clinical baseline data — this drives safety alerts across all shifts.
        </p>
      </div>

      <div>
        <label className={labelClass}>Primary Diagnosis</label>
        <input
          {...register("primary_diagnosis")}
          placeholder="e.g. Cerebral Palsy, Autism Spectrum Disorder"
          className={inputClass}
          autoComplete="off"
        />
      </div>

      <div>
        <label className={labelClass}>Critical Medical Alerts</label>
        <textarea
          {...register("critical_alerts")}
          placeholder={"Seizure risk — administer midazolam if >5min\nNPO after 8pm\nAllergy: Penicillin"}
          rows={4}
          className={`${inputSmClass} resize-none border-b-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[14px] leading-relaxed`}
        />
        <p className="mt-1.5 text-[10px] text-zinc-600">One alert per line. These appear on every shift card.</p>
      </div>

      <div>
        <label className={labelClass}>Mobility</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Controller
            control={control}
            name="mobility_status"
            render={({ field }) => (
              <>
                {MOBILITY_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => field.onChange(field.value === opt.value ? "" : opt.value)}
                    className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                      field.value === opt.value
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                        : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </>
            )}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Communication</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Controller
            control={control}
            name="communication_type"
            render={({ field }) => (
              <>
                {COMMUNICATION_OPTIONS.map((opt) => (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => field.onChange(field.value === opt.value ? "" : opt.value)}
                    className={`rounded-full px-4 py-2 text-[12px] font-medium transition-all ${
                      field.value === opt.value
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                        : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </motion.button>
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
    <div className="space-y-6">
      <div>
        <h2 className="text-[36px] font-light tracking-tight text-white leading-tight">
          Let&apos;s allocate their funding.
        </h2>
        <p className="mt-2 text-[14px] text-zinc-500">
          Build the Service Agreement — add NDIS line items and allocate budgets.
        </p>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>
            <Calendar size={10} className="mr-1 inline" />
            SA Start Date
          </label>
          <input
            type="date"
            {...register("sa_start_date")}
            className={`${inputSmClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label className={labelClass}>
            <Calendar size={10} className="mr-1 inline" />
            SA End Date
          </label>
          <input
            type="date"
            {...register("sa_end_date")}
            className={`${inputSmClass} [color-scheme:dark]`}
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-3">
        {lineItems.map((field, idx) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-4">
                {/* NDIS Item Search */}
                <div className="relative">
                  <label className={labelClass}>NDIS Support Item</label>
                  {watchedLineItems?.[idx]?.ndis_code ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-mono text-[12px] text-emerald-400">
                          {watchedLineItems[idx].ndis_code}
                        </p>
                        <p className="text-[13px] text-zinc-300">
                          {watchedLineItems[idx].ndis_name}
                        </p>
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
                        className="text-[11px] text-zinc-600 hover:text-zinc-400"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Search size={14} className="text-zinc-600" />
                        <input
                          type="text"
                          value={activeSearchIndex === idx ? ndisSearch : ""}
                          onFocus={() => setActiveSearchIndex(idx)}
                          onChange={(e) => {
                            setActiveSearchIndex(idx);
                            setNdisSearch(e.target.value);
                          }}
                          placeholder="Search NDIS items by code or name..."
                          className="flex-1 bg-transparent text-[13px] text-zinc-300 outline-none placeholder:text-zinc-700"
                        />
                      </div>
                      <AnimatePresence>
                        {activeSearchIndex === idx && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#0A0A0A] shadow-xl"
                          >
                            {filteredNDIS.length === 0 ? (
                              <p className="p-3 text-[12px] text-zinc-600">No items found</p>
                            ) : (
                              filteredNDIS.map((item) => (
                                <button
                                  key={item.support_item_number}
                                  type="button"
                                  onClick={() => {
                                    setValue(
                                      `sa_line_items.${idx}.ndis_code`,
                                      item.support_item_number
                                    );
                                    setValue(
                                      `sa_line_items.${idx}.ndis_name`,
                                      item.support_item_name
                                    );
                                    setValue(
                                      `sa_line_items.${idx}.unit_rate`,
                                      item.price_limit_national
                                    );
                                    setValue(
                                      `sa_line_items.${idx}.support_purpose`,
                                      item.support_purpose
                                    );
                                    setActiveSearchIndex(null);
                                    setNdisSearch("");
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                                >
                                  <div className="flex-1">
                                    <span className="font-mono text-[11px] text-emerald-400/80">
                                      {item.support_item_number}
                                    </span>
                                    <p className="text-[12px] text-zinc-300">
                                      {item.support_item_name}
                                    </p>
                                  </div>
                                  <span className="font-mono text-[12px] text-zinc-500">
                                    ${item.price_limit_national.toFixed(2)}/hr
                                  </span>
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
                    <label className={labelClass}>Allocated Budget</label>
                    <div className="flex items-center gap-1 border-b border-white/10 pb-2">
                      <DollarSign size={16} className="text-zinc-600" />
                      <input
                        type="number"
                        step="0.01"
                        {...register(`sa_line_items.${idx}.allocated_budget`, {
                          valueAsNumber: true,
                        })}
                        placeholder="50,000"
                        className="flex-1 bg-transparent text-[18px] font-mono font-light text-white outline-none placeholder:text-zinc-700"
                      />
                    </div>
                  </div>
                  {watchedLineItems?.[idx]?.unit_rate > 0 && (
                    <div className="pb-3 text-right">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-600">Hourly Rate</p>
                      <p className="font-mono text-[14px] text-zinc-400">
                        ${watchedLineItems[idx].unit_rate.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeLineItem(idx)}
                className="mt-6 rounded-lg p-2 text-zinc-700 transition-colors hover:bg-white/[0.04] hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            appendLineItem({
              ndis_code: "",
              ndis_name: "",
              unit_rate: 0,
              support_purpose: "",
              allocated_budget: 0,
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] py-4 text-[13px] text-zinc-600 transition-colors hover:border-white/15 hover:text-zinc-400"
        >
          <Plus size={14} />
          Add Line Item
        </motion.button>
      </div>

      {/* Total */}
      {totalSABudget > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between rounded-xl bg-white/[0.02] px-5 py-4"
        >
          <span className="text-[13px] text-zinc-500">Total Agreement Value</span>
          <span className="font-mono text-[22px] font-light text-emerald-400">
            ${totalSABudget.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
          </span>
        </motion.div>
      )}
    </div>
  );

  /* ─── Step 4: Master Schedule ───────────────────────────────────────────── */
  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-[36px] font-light tracking-tight text-white leading-tight">
          When do they need support?
        </h2>
        <p className="mt-2 text-[14px] text-zinc-500">
          Build their weekly recurring schedule — this becomes the Master Roster blueprint.
        </p>
      </div>

      {/* Roster Entries */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {rosterEntries.map((field, idx) => {
            const entry = watchedRoster?.[idx];
            const selectedDays = entry?.days || [];

            return (
              <motion.div
                key={field.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-5"
              >
                {/* Day Selector */}
                <div>
                  <label className={labelClass}>Support Days</label>
                  <div className="mt-2 flex gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = selectedDays.includes(day.key);
                      return (
                        <motion.button
                          key={day.key}
                          type="button"
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            const current = entry?.days || [];
                            const updated = isSelected
                              ? current.filter((d: string) => d !== day.key)
                              : [...current, day.key];
                            updateRoster(idx, { ...entry, days: updated });
                          }}
                          className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-semibold transition-all ${
                            isSelected
                              ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                              : "bg-white/[0.04] text-zinc-600 hover:bg-white/[0.08] hover:text-zinc-400"
                          }`}
                          title={day.full}
                        >
                          {day.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Time Range */}
                {selectedDays.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4"
                  >
                    <p className="text-[13px] text-zinc-500">
                      Every{" "}
                      <span className="text-white">
                        {selectedDays
                          .map((d: string) => DAYS_OF_WEEK.find((dw) => dw.key === d)?.full)
                          .filter(Boolean)
                          .join(" and ")}
                      </span>
                    </p>

                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className={labelClass}>
                          <Clock size={10} className="mr-1 inline" />
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={entry?.start_time || ""}
                          onChange={(e) =>
                            updateRoster(idx, { ...entry, start_time: e.target.value })
                          }
                          className={`${inputSmClass} [color-scheme:dark]`}
                        />
                      </div>
                      <span className="mt-5 text-zinc-600">to</span>
                      <div className="flex-1">
                        <label className={labelClass}>
                          <Clock size={10} className="mr-1 inline" />
                          End Time
                        </label>
                        <input
                          type="time"
                          value={entry?.end_time || ""}
                          onChange={(e) =>
                            updateRoster(idx, { ...entry, end_time: e.target.value })
                          }
                          className={`${inputSmClass} [color-scheme:dark]`}
                        />
                      </div>
                    </div>

                    {/* Link to SA Item */}
                    {(watchedLineItems?.length || 0) > 0 && (
                      <div>
                        <label className={labelClass}>Link to SA Line Item</label>
                        <select
                          value={entry?.linked_item_index ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const itemIdx = val === "" ? undefined : parseInt(val);
                            const itemNumber =
                              itemIdx !== undefined
                                ? watchedLineItems?.[itemIdx]?.ndis_code
                                : undefined;
                            updateRoster(idx, {
                              ...entry,
                              linked_item_index: itemIdx,
                              linked_item_number: itemNumber,
                            });
                          }}
                          className="w-full bg-transparent border-b border-white/10 pb-2 text-[13px] text-zinc-300 outline-none [color-scheme:dark]"
                        >
                          <option value="" className="bg-[#0A0A0A]">
                            No linkage
                          </option>
                          {watchedLineItems?.map((li, liIdx) => (
                            <option key={liIdx} value={liIdx} className="bg-[#0A0A0A]">
                              {li.ndis_code} — ${li.allocated_budget.toLocaleString()}
                            </option>
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
                    className="text-[11px] text-zinc-700 transition-colors hover:text-red-400"
                  >
                    Remove schedule
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() =>
            appendRoster({
              days: [],
              start_time: "07:00",
              end_time: "15:00",
              linked_item_index: undefined,
              linked_item_number: undefined,
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] py-4 text-[13px] text-zinc-600 transition-colors hover:border-white/15 hover:text-zinc-400"
        >
          <Plus size={14} />
          Add Schedule Block
        </motion.button>
      </div>

      {/* ── Predictive Burn Rate ─────────────────────────────────────────────── */}
      {rosterMath.weeklyHours > 0 && totalSABudget > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-5 ${
            budgetHealth.status === "safe"
              ? "border-emerald-500/20 bg-emerald-500/[0.04]"
              : budgetHealth.status === "danger"
              ? "border-red-500/20 bg-red-500/[0.04]"
              : "border-white/[0.06] bg-white/[0.02]"
          }`}
        >
          <div className="flex items-start gap-3">
            {budgetHealth.status === "safe" ? (
              <TrendingUp size={18} className="mt-0.5 text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="mt-0.5 text-red-400" />
            )}
            <div className="flex-1">
              <p
                className={`text-[13px] font-medium ${
                  budgetHealth.status === "safe" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {budgetHealth.status === "safe"
                  ? `This schedule utilizes ${budgetHealth.pct}% of the allocated budget. Safe to proceed.`
                  : `Warning: This schedule will cost $${rosterMath.annualProjection.toLocaleString()} annually, but the SA only has $${totalSABudget.toLocaleString()} allocated. Budget depletes in Month ${budgetHealth.depleteMonth}.`}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">Weekly Hours</p>
                  <p className="font-mono text-[18px] font-light text-white">
                    {rosterMath.weeklyHours}h
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">Weekly Cost</p>
                  <p className="font-mono text-[18px] font-light text-white">
                    ${rosterMath.weeklyCost.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                    Annual Projection
                  </p>
                  <p
                    className={`font-mono text-[18px] font-light ${
                      budgetHealth.status === "safe" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    $
                    {rosterMath.annualProjection.toLocaleString("en-AU", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Hours summary even without budget */}
      {rosterMath.weeklyHours > 0 && totalSABudget === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between rounded-xl bg-white/[0.02] px-5 py-4"
        >
          <span className="text-[13px] text-zinc-500">Total Weekly Hours</span>
          <span className="font-mono text-[18px] font-light text-white">
            {rosterMath.weeklyHours}h / week
          </span>
        </motion.div>
      )}
    </div>
  );

  /* ═════════════════════════════════════════════════════════════════════════
     MAIN RENDER
     ═════════════════════════════════════════════════════════════════════════ */

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <AnimatePresence>
      {open && (
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.15 }}
            onClick={onClose}
          >
            {/* ── Stage ───────────────────────────────────────────────── */}
            <motion.div
              className="relative flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl"
              variants={stageVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Progress Bar ───────────────────────────────────────── */}
              <div className="h-1 w-full bg-white/[0.06]">
                <motion.div
                  className="h-full bg-emerald-500"
                  initial={false}
                  animate={{ width: `${((step + 1) / 4) * 100}%` }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              {/* ── Header ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-8 pt-5 pb-2">
                <div className="flex items-center gap-3">
                  {STEPS.map((s, i) => (
                    <React.Fragment key={s.id}>
                      {i > 0 && (
                        <ChevronRight size={12} className="text-zinc-800" />
                      )}
                      <span
                        className={`text-[11px] font-medium tracking-wide ${
                          i === step
                            ? "text-white"
                            : i < step
                            ? "text-emerald-500/60"
                            : "text-zinc-700"
                        }`}
                      >
                        {s.label}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── Step Content (scrollable) ──────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={step}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.15 },
                    }}
                  >
                    {stepContent[step]()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* ── Footer ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between border-t border-white/[0.04] px-8 py-4">
                <div>
                  {step > 0 && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={goBack}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] text-zinc-500 transition-colors hover:text-white"
                    >
                      <ChevronLeft size={14} />
                      Back
                    </motion.button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {step < 3 ? (
                    <>
                      {step >= 2 && (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            // Skip remaining steps and submit
                            handleSubmit(onSubmit)();
                          }}
                          className="rounded-lg px-4 py-2 text-[13px] text-zinc-500 transition-colors hover:text-white"
                        >
                          Skip & Create
                        </motion.button>
                      )}
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={goNext}
                        className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-colors hover:bg-zinc-200"
                      >
                        Next: {STEPS[step + 1]?.label}
                        <ChevronRight size={14} />
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.98 }}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Shield size={14} />
                          Activate Participant & Roster
                          <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-mono">
                            ⌘↵
                          </kbd>
                        </>
                      )}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </form>
      )}
    </AnimatePresence>
  );
}
