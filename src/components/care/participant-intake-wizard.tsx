/**
 * @component ParticipantIntakeWizard
 * @status COMPLETE
 * @description Multi-step wizard for NDIS participant intake with validation and progress tracking
 * @lastAudit 2026-03-22
 */
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Users,
  Heart,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  AlertTriangle,
  Check,
  Search,
  Loader2,
} from "lucide-react";
import {
  createParticipantIntake,
  updateParticipantIntake,
  createServiceAgreement,
} from "@/app/actions/participants";
import { validateNDISNumber, formatNDISNumber } from "@/lib/ndis-utils";

/* ── Types ────────────────────────────────────────────── */

interface ParticipantIntakeWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (participantId: string) => void;
  orgId: string;
  agencies: { id: string; name: string; type: string }[];
}

type WizardStep = 0 | 1 | 2 | 3;

interface Step1Data {
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  ndisNumber: string;
  primaryDiagnosis: string;
  diagnosisSearch: string;
  email: string;
  phone: string;
  address: string;
  addressLat: number | null;
  addressLng: number | null;
}

interface NomineeData {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface Step2Data {
  isSelfDecisionMaker: boolean;
  nominee: NomineeData;
  planManagerId: string;
  supportCoordinatorId: string;
  fundingManagementType: "ndia_managed" | "plan_managed" | "self_managed" | "";
}

interface Step3Data {
  mobilityStatus: string;
  communicationType: string;
  criticalAlerts: string[];
  alertInput: string;
  additionalNotes: string;
}

interface Step4Data {
  agreementTitle: string;
  startDate: string;
  endDate: string;
  fundingManagementType: string;
  coreSupports: string;
  capacityBuilding: string;
  capitalSupports: string;
}

/* ── Constants ────────────────────────────────────────── */

const STEP_LABELS = ["Identity", "Care Network", "Clinical Baseline", "Service Agreement"] as const;
const STEP_ICONS = [User, Users, Heart, DollarSign] as const;

const DIAGNOSES = [
  "Autism Spectrum Disorder",
  "Cerebral Palsy",
  "Acquired Brain Injury",
  "Intellectual Disability",
  "Down Syndrome",
  "Multiple Sclerosis",
  "Parkinson's Disease",
  "Spinal Cord Injury",
  "Psychosocial Disability",
  "Traumatic Brain Injury",
  "Vision Impairment",
  "Hearing Impairment",
  "Physical Disability",
  "Other",
] as const;

const MOBILITY_OPTIONS = [
  "independent",
  "mobility_aid",
  "wheelchair",
  "hoist_required",
] as const;

const MOBILITY_LABELS: Record<string, string> = {
  independent: "Independent",
  mobility_aid: "Mobility Aid",
  wheelchair: "Wheelchair",
  hoist_required: "Hoist Required",
};

const COMMUNICATION_OPTIONS = [
  "verbal",
  "non_verbal",
  "uses_aac_device",
  "limited_verbal",
] as const;

const COMMUNICATION_LABELS: Record<string, string> = {
  verbal: "Verbal",
  non_verbal: "Non-Verbal",
  uses_aac_device: "Uses AAC Device",
  limited_verbal: "Limited Verbal",
};

const SUGGESTED_ALERTS = [
  "Choking Risk",
  "Flight Risk",
  "Severe Allergies",
  "Epilepsy",
  "Aggression Risk",
  "Falls Risk",
  "Aspiration Risk",
  "Elopement Risk",
] as const;

const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-Binary",
  "Prefer Not to Say",
  "Other",
] as const;

const FUNDING_TYPES = [
  { value: "ndia_managed", label: "NDIA Managed", desc: "NDIA pays providers directly" },
  { value: "plan_managed", label: "Plan Managed", desc: "Plan manager handles payments" },
  { value: "self_managed", label: "Self Managed", desc: "Participant manages own funds" },
] as const;

const INPUT_CLASS =
  "w-full bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors";

const LABEL_CLASS =
  "mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500";

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);

/* ── Inline Combobox ──────────────────────────────────── */

function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchValue,
  onSearchChange,
  labelMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  /** Optional map from option value → display label */
  labelMap?: Record<string, string>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const getLabel = (opt: string) => labelMap?.[opt] ?? opt;

  const search = searchValue ?? "";
  const filteredOptions = useMemo(() => {
    if (!search) return [...options];
    const q = search.toLowerCase();
    return options.filter((o) => (labelMap?.[o] ?? o).toLowerCase().includes(q));
  }, [options, search, labelMap]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={isOpen ? search : (value ? getLabel(value) : "")}
          onChange={(e) => {
            if (onSearchChange) onSearchChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`${INPUT_CLASS} pl-9`}
        />
      </div>
      <AnimatePresence>
        {isOpen && filteredOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-[#0A0A0A] shadow-2xl scrollbar-none"
          >
            {filteredOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  if (onSearchChange) onSearchChange("");
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-zinc-800 ${
                  value === opt ? "text-blue-400 bg-blue-500/5" : "text-zinc-300"
                }`}
              >
                {getLabel(opt)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Tag Input ────────────────────────────────────────── */

function TagInput({
  tags,
  onAdd,
  onRemove,
  inputValue,
  onInputChange,
  suggestions,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  inputValue: string;
  onInputChange: (v: string) => void;
  suggestions: readonly string[];
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const availableSuggestions = useMemo(() => {
    return suggestions.filter(
      (s) =>
        !tags.includes(s) &&
        s.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [suggestions, tags, inputValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      onAdd(inputValue.trim());
      onInputChange("");
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className={LABEL_CLASS}>Critical Alerts</label>

      {/* Existing tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/25 px-2 py-0.5 text-[11px] font-medium text-red-400"
            >
              <AlertTriangle size={10} />
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 rounded hover:bg-red-500/20 p-0.5 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          onInputChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        placeholder="Type alert and press Enter..."
        className={INPUT_CLASS}
      />

      {/* Suggestions */}
      <AnimatePresence>
        {showSuggestions && availableSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-[#0A0A0A] shadow-2xl scrollbar-none"
          >
            {availableSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onAdd(s);
                  onInputChange("");
                  setShowSuggestions(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <AlertTriangle size={12} className="text-red-400/60" />
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ██  Participant Intake Wizard
   ══════════════════════════════════════════════════════════ */

export function ParticipantIntakeWizard({
  open,
  onClose,
  onComplete,
  orgId,
  agencies,
}: ParticipantIntakeWizardProps) {
  /* ── Step state ─────────────────────────────────────── */
  const [currentStep, setCurrentStep] = useState<WizardStep>(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);

  /* ── Step 1: Identity ───────────────────────────────── */
  const [step1, setStep1] = useState<Step1Data>({
    firstName: "",
    lastName: "",
    preferredName: "",
    dateOfBirth: "",
    gender: "",
    ndisNumber: "",
    primaryDiagnosis: "",
    diagnosisSearch: "",
    email: "",
    phone: "",
    address: "",
    addressLat: null,
    addressLng: null,
  });
  const [ndisValid, setNdisValid] = useState<boolean | null>(null);

  /* ── Step 2: Care Network ───────────────────────────── */
  const [step2, setStep2] = useState<Step2Data>({
    isSelfDecisionMaker: true,
    nominee: { name: "", relationship: "", phone: "", email: "" },
    planManagerId: "",
    supportCoordinatorId: "",
    fundingManagementType: "",
  });

  /* ── Step 3: Clinical Baseline ──────────────────────── */
  const [step3, setStep3] = useState<Step3Data>({
    mobilityStatus: "",
    communicationType: "",
    criticalAlerts: [],
    alertInput: "",
    additionalNotes: "",
  });

  /* ── Step 4: Service Agreement ──────────────────────── */
  const [step4, setStep4] = useState<Step4Data>({
    agreementTitle: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    fundingManagementType: "",
    coreSupports: "",
    capacityBuilding: "",
    capitalSupports: "",
  });

  /* ── Derived agencies ───────────────────────────────── */
  const planManagers = useMemo(
    () => agencies.filter((a) => a.type === "plan_manager"),
    [agencies]
  );
  const supportCoordinators = useMemo(
    () => agencies.filter((a) => a.type === "support_coordinator"),
    [agencies]
  );

  /* ── Budget total ───────────────────────────────────── */
  const budgetTotal = useMemo(() => {
    const core = parseFloat(step4.coreSupports) || 0;
    const cap = parseFloat(step4.capacityBuilding) || 0;
    const capital = parseFloat(step4.capitalSupports) || 0;
    return core + cap + capital;
  }, [step4.coreSupports, step4.capacityBuilding, step4.capitalSupports]);

  /* ── NDIS number handling ───────────────────────────── */
  function handleNDISChange(raw: string) {
    // Only allow digits and spaces
    const cleaned = raw.replace(/[^\d\s]/g, "");
    const digitsOnly = cleaned.replace(/\s/g, "");

    // Limit to 9 digits
    if (digitsOnly.length > 9) return;

    // Auto-format
    const formatted = digitsOnly.length === 9 ? formatNDISNumber(digitsOnly) : cleaned;
    setStep1((prev) => ({ ...prev, ndisNumber: formatted }));

    // Validate
    if (digitsOnly.length === 0) {
      setNdisValid(null);
    } else if (digitsOnly.length === 9) {
      setNdisValid(validateNDISNumber(digitsOnly));
    } else {
      setNdisValid(false);
    }
  }

  /* ── Auto-generate agreement title ──────────────────── */
  useEffect(() => {
    if (currentStep === 3) {
      const name = [step1.firstName, step1.lastName].filter(Boolean).join(" ");
      const year = new Date().getFullYear();
      setStep4((prev) => ({
        ...prev,
        agreementTitle: name ? `SA - ${name} - ${year}` : "",
        fundingManagementType: step2.fundingManagementType || prev.fundingManagementType,
      }));
    }
  }, [currentStep, step1.firstName, step1.lastName, step2.fundingManagementType]);

  /* ── Reset on close ─────────────────────────────────── */
  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setDirection(1);
      setSaving(false);
      setError(null);
      setParticipantId(null);
      setNdisValid(null);
      setStep1({
        firstName: "",
        lastName: "",
        preferredName: "",
        dateOfBirth: "",
        gender: "",
        ndisNumber: "",
        primaryDiagnosis: "",
        diagnosisSearch: "",
        email: "",
        phone: "",
        address: "",
        addressLat: null,
        addressLng: null,
      });
      setStep2({
        isSelfDecisionMaker: true,
        nominee: { name: "", relationship: "", phone: "", email: "" },
        planManagerId: "",
        supportCoordinatorId: "",
        fundingManagementType: "",
      });
      setStep3({
        mobilityStatus: "",
        communicationType: "",
        criticalAlerts: [],
        alertInput: "",
        additionalNotes: "",
      });
      setStep4({
        agreementTitle: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        fundingManagementType: "",
        coreSupports: "",
        capacityBuilding: "",
        capitalSupports: "",
      });
    }
  }, [open]);

  /* ── Validation per step ────────────────────────────── */
  const step1Valid = useMemo(() => {
    const hasName = step1.firstName.trim() && step1.lastName.trim();
    const ndisOk =
      step1.ndisNumber.trim() === "" || ndisValid === true;
    return !!hasName && ndisOk;
  }, [step1.firstName, step1.lastName, step1.ndisNumber, ndisValid]);

  const step2Valid = useMemo(() => {
    if (!step2.isSelfDecisionMaker) {
      return step2.nominee.name.trim().length > 0;
    }
    return true;
  }, [step2.isSelfDecisionMaker, step2.nominee.name]);

  const step3Valid = true; // All optional

  const step4Valid = useMemo(() => {
    return step4.startDate.trim().length > 0 && step4.endDate.trim().length > 0;
  }, [step4.startDate, step4.endDate]);

  const canAdvance = [step1Valid, step2Valid, step3Valid, step4Valid][currentStep];

  /* ── Save step to DB ────────────────────────────────── */
  const saveStep = useCallback(
    async (step: WizardStep) => {
      setSaving(true);
      setError(null);

      try {
        if (step === 0) {
          // Create participant
          const result = await createParticipantIntake({
            organization_id: orgId,
            first_name: step1.firstName.trim(),
            last_name: step1.lastName.trim(),
            preferred_name: step1.preferredName.trim() || undefined,
            date_of_birth: step1.dateOfBirth || undefined,
            gender: step1.gender || undefined,
            ndis_number: step1.ndisNumber || undefined,
            primary_diagnosis: step1.primaryDiagnosis || undefined,
            email: step1.email.trim() || undefined,
            phone: step1.phone.trim() || undefined,
            address: step1.address.trim() || undefined,
            address_lat: step1.addressLat ?? undefined,
            address_lng: step1.addressLng ?? undefined,
          });

          if (!result.success) {
            setError(result.error || "Failed to create participant");
            return false;
          }

          setParticipantId(result.participant_id!);
          return true;
        }

        if (!participantId) {
          setError("Participant ID missing. Please restart the wizard.");
          return false;
        }

        if (step === 1) {
          const result = await updateParticipantIntake(participantId, "step_2", {
            primary_nominee: !step2.isSelfDecisionMaker ? step2.nominee : null,
            plan_manager_id: step2.planManagerId || null,
            support_coordinator_id: step2.supportCoordinatorId || null,
            management_type: step2.fundingManagementType || null,
          });

          if (!result.success) {
            setError(result.error || "Failed to save care network");
            return false;
          }
          return true;
        }

        if (step === 2) {
          const result = await updateParticipantIntake(participantId, "step_3", {
            mobility_status: step3.mobilityStatus || null,
            communication_type: step3.communicationType || null,
            critical_alerts: step3.criticalAlerts,
            triggers_and_risks: step3.additionalNotes || null,
          });

          if (!result.success) {
            setError(result.error || "Failed to save clinical baseline");
            return false;
          }
          return true;
        }

        if (step === 3) {
          // Final step — create service agreement then complete
          const agreementResult = await createServiceAgreement({
            organization_id: orgId,
            participant_id: participantId,
            title: step4.agreementTitle || `SA - ${step1.firstName} ${step1.lastName} - ${new Date().getFullYear()}`,
            start_date: step4.startDate,
            end_date: step4.endDate,
            funding_management_type: step4.fundingManagementType || step2.fundingManagementType || "ndia_managed",
            category_allocations: {
              core: parseFloat(step4.coreSupports) || 0,
              capacity_building: parseFloat(step4.capacityBuilding) || 0,
              capital: parseFloat(step4.capitalSupports) || 0,
            },
          });

          if (!agreementResult.success) {
            setError(agreementResult.error || "Failed to create service agreement");
            return false;
          }

          // Mark intake complete
          await updateParticipantIntake(participantId, "complete", {});
          return true;
        }

        return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [orgId, step1, step2, step3, step4, participantId]
  );

  /* ── Navigation ─────────────────────────────────────── */
  const handleNext = useCallback(async () => {
    if (!canAdvance || saving) return;

    const success = await saveStep(currentStep);
    if (!success) return;

    if (currentStep === 3) {
      // Final step — completed
      onComplete(participantId!);
      return;
    }

    setDirection(1);
    setCurrentStep((prev) => Math.min(prev + 1, 3) as WizardStep);
  }, [canAdvance, saving, saveStep, currentStep, participantId, onComplete]);

  const handleBack = useCallback(() => {
    if (currentStep === 0) return;
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 0) as WizardStep);
  }, [currentStep]);

  /* ── Keyboard shortcuts ─────────────────────────────── */
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleNext();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleNext, onClose]);

  /* ── Progress ───────────────────────────────────────── */
  const progressPct = ((currentStep + 1) / 4) * 100;

  if (!open) return null;

  /* ══════════════════════════════════════════════════════
     ██  RENDER
     ══════════════════════════════════════════════════════ */

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ─────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl"
            onClick={onClose}
            aria-hidden
          />

          {/* ── Modal container ──────────────────────── */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 5 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0A0A0A] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Participant Intake Wizard"
            >
              {/* ── Progress bar ──────────────────────── */}
              <div className="h-0.5 w-full bg-zinc-900">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              {/* ── Header ────────────────────────────── */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-white">
                    Participant Intake
                  </h2>
                  <p className="mt-0.5 text-[12px] text-zinc-500">
                    Step {currentStep + 1} of 4 — {STEP_LABELS[currentStep]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ── Step indicators ───────────────────── */}
              <div className="flex items-center gap-1 px-6 pb-4">
                {STEP_LABELS.map((label, i) => {
                  const Icon = STEP_ICONS[i];
                  const isComplete = i < currentStep;
                  const isCurrent = i === currentStep;
                  return (
                    <React.Fragment key={label}>
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                          isComplete
                            ? "bg-blue-500/10 text-blue-400"
                            : isCurrent
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-600"
                        }`}
                      >
                        {isComplete ? (
                          <Check size={10} className="text-blue-400" />
                        ) : (
                          <Icon size={10} />
                        )}
                        <span className="hidden sm:inline">{label}</span>
                      </div>
                      {i < 3 && (
                        <div
                          className={`h-px flex-1 transition-colors ${
                            i < currentStep ? "bg-blue-500/30" : "bg-zinc-800"
                          }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* ── Step content ──────────────────────── */}
              <div className="flex-1 overflow-y-auto px-6 pb-4 scrollbar-none">
                <AnimatePresence mode="wait" custom={direction}>
                  {/* ────── STEP 1: Identity & Demographics ────── */}
                  {currentStep === 0 && (
                    <motion.div
                      key="step-0"
                      custom={direction}
                      variants={SLIDE_VARIANTS}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      {/* Name row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>
                            First Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={step1.firstName}
                            onChange={(e) => setStep1((p) => ({ ...p, firstName: e.target.value }))}
                            placeholder="First name"
                            className={INPUT_CLASS}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>
                            Last Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={step1.lastName}
                            onChange={(e) => setStep1((p) => ({ ...p, lastName: e.target.value }))}
                            placeholder="Last name"
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>

                      {/* Preferred Name + DOB */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>Preferred Name</label>
                          <input
                            type="text"
                            value={step1.preferredName}
                            onChange={(e) => setStep1((p) => ({ ...p, preferredName: e.target.value }))}
                            placeholder="Preferred name"
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Date of Birth</label>
                          <input
                            type="date"
                            value={step1.dateOfBirth}
                            onChange={(e) => setStep1((p) => ({ ...p, dateOfBirth: e.target.value }))}
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>

                      {/* Gender + NDIS Number */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>Gender</label>
                          <select
                            value={step1.gender}
                            onChange={(e) => setStep1((p) => ({ ...p, gender: e.target.value }))}
                            className={INPUT_CLASS}
                          >
                            <option value="">Select gender...</option>
                            {GENDER_OPTIONS.map((g) => (
                              <option key={g} value={g.toLowerCase().replace(/\s/g, "_")}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>NDIS Number</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={step1.ndisNumber}
                              onChange={(e) => handleNDISChange(e.target.value)}
                              placeholder="XXX XXX XXX"
                              className={`${INPUT_CLASS} font-mono tabular-nums ${
                                ndisValid === false && step1.ndisNumber.trim()
                                  ? "!border-red-500 !ring-red-500/30 !ring-1"
                                  : ndisValid === true
                                  ? "!border-emerald-500/50"
                                  : ""
                              }`}
                            />
                            {ndisValid === true && (
                              <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                            )}
                            {ndisValid === false && step1.ndisNumber.trim() && (
                              <X size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
                            )}
                          </div>
                          {ndisValid === false && step1.ndisNumber.trim() && (
                            <p className="mt-1 text-[10px] text-red-400">
                              NDIS number must be exactly 9 digits
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Primary Diagnosis */}
                      <Combobox
                        label="Primary Diagnosis"
                        value={step1.primaryDiagnosis}
                        onChange={(v) => setStep1((p) => ({ ...p, primaryDiagnosis: v }))}
                        options={DIAGNOSES}
                        placeholder="Search diagnosis..."
                        searchValue={step1.diagnosisSearch}
                        onSearchChange={(v) => setStep1((p) => ({ ...p, diagnosisSearch: v }))}
                      />

                      {/* Email + Phone */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>Email</label>
                          <input
                            type="email"
                            value={step1.email}
                            onChange={(e) => setStep1((p) => ({ ...p, email: e.target.value }))}
                            placeholder="email@example.com"
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>Phone</label>
                          <input
                            type="tel"
                            value={step1.phone}
                            onChange={(e) => setStep1((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="04XX XXX XXX"
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>

                      {/* Address */}
                      <div>
                        <label className={LABEL_CLASS}>Address</label>
                        <input
                          type="text"
                          value={step1.address}
                          onChange={(e) => setStep1((p) => ({ ...p, address: e.target.value }))}
                          placeholder="Street address, suburb, state"
                          className={INPUT_CLASS}
                        />
                        {/* Hidden lat/lng fields — populated by geocoder */}
                        <input type="hidden" value={step1.addressLat ?? ""} />
                        <input type="hidden" value={step1.addressLng ?? ""} />
                      </div>
                    </motion.div>
                  )}

                  {/* ────── STEP 2: Care Network ────── */}
                  {currentStep === 1 && (
                    <motion.div
                      key="step-1"
                      custom={direction}
                      variants={SLIDE_VARIANTS}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-5"
                    >
                      {/* Decision-maker toggle */}
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-white">
                              Self Decision-Maker
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              Is the participant their own decision-maker?
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={step2.isSelfDecisionMaker}
                            onClick={() =>
                              setStep2((p) => ({
                                ...p,
                                isSelfDecisionMaker: !p.isSelfDecisionMaker,
                              }))
                            }
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                              step2.isSelfDecisionMaker
                                ? "bg-blue-500"
                                : "bg-zinc-700"
                            }`}
                          >
                            <motion.div
                              layout
                              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                              animate={{ left: step2.isSelfDecisionMaker ? 22 : 2 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>

                        {/* Nominee fields */}
                        <AnimatePresence>
                          {!step2.isSelfDecisionMaker && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
                                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                                  Primary Nominee / Guardian
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={LABEL_CLASS}>
                                      Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={step2.nominee.name}
                                      onChange={(e) =>
                                        setStep2((p) => ({
                                          ...p,
                                          nominee: { ...p.nominee, name: e.target.value },
                                        }))
                                      }
                                      placeholder="Full name"
                                      className={INPUT_CLASS}
                                    />
                                  </div>
                                  <div>
                                    <label className={LABEL_CLASS}>Relationship</label>
                                    <input
                                      type="text"
                                      value={step2.nominee.relationship}
                                      onChange={(e) =>
                                        setStep2((p) => ({
                                          ...p,
                                          nominee: { ...p.nominee, relationship: e.target.value },
                                        }))
                                      }
                                      placeholder="e.g. Parent, Sibling"
                                      className={INPUT_CLASS}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={LABEL_CLASS}>Phone</label>
                                    <input
                                      type="tel"
                                      value={step2.nominee.phone}
                                      onChange={(e) =>
                                        setStep2((p) => ({
                                          ...p,
                                          nominee: { ...p.nominee, phone: e.target.value },
                                        }))
                                      }
                                      placeholder="04XX XXX XXX"
                                      className={INPUT_CLASS}
                                    />
                                  </div>
                                  <div>
                                    <label className={LABEL_CLASS}>Email</label>
                                    <input
                                      type="email"
                                      value={step2.nominee.email}
                                      onChange={(e) =>
                                        setStep2((p) => ({
                                          ...p,
                                          nominee: { ...p.nominee, email: e.target.value },
                                        }))
                                      }
                                      placeholder="email@example.com"
                                      className={INPUT_CLASS}
                                    />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Plan Manager */}
                      <div>
                        <label className={LABEL_CLASS}>Plan Manager</label>
                        <div className="flex gap-2">
                          <select
                            value={step2.planManagerId}
                            onChange={(e) =>
                              setStep2((p) => ({ ...p, planManagerId: e.target.value }))
                            }
                            className={`${INPUT_CLASS} flex-1`}
                          >
                            <option value="">No plan manager</option>
                            {planManagers.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            title="Add new plan manager"
                          >
                            <Plus size={12} />
                            <span className="hidden sm:inline">Add New</span>
                          </button>
                        </div>
                      </div>

                      {/* Support Coordinator */}
                      <div>
                        <label className={LABEL_CLASS}>Support Coordinator</label>
                        <div className="flex gap-2">
                          <select
                            value={step2.supportCoordinatorId}
                            onChange={(e) =>
                              setStep2((p) => ({
                                ...p,
                                supportCoordinatorId: e.target.value,
                              }))
                            }
                            className={`${INPUT_CLASS} flex-1`}
                          >
                            <option value="">No support coordinator</option>
                            {supportCoordinators.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                            title="Add new support coordinator"
                          >
                            <Plus size={12} />
                            <span className="hidden sm:inline">Add New</span>
                          </button>
                        </div>
                      </div>

                      {/* Funding Management Type */}
                      <div>
                        <label className={LABEL_CLASS}>Funding Management Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {FUNDING_TYPES.map((ft) => (
                            <button
                              key={ft.value}
                              type="button"
                              onClick={() =>
                                setStep2((p) => ({
                                  ...p,
                                  fundingManagementType: ft.value as Step2Data["fundingManagementType"],
                                }))
                              }
                              className={`rounded-lg border p-3 text-left transition-all ${
                                step2.fundingManagementType === ft.value
                                  ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20"
                                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
                              }`}
                            >
                              <p
                                className={`text-[12px] font-medium ${
                                  step2.fundingManagementType === ft.value
                                    ? "text-blue-400"
                                    : "text-zinc-300"
                                }`}
                              >
                                {ft.label}
                              </p>
                              <p className="mt-0.5 text-[10px] text-zinc-500">
                                {ft.desc}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ────── STEP 3: Clinical Baseline & Risk Matrix ────── */}
                  {currentStep === 2 && (
                    <motion.div
                      key="step-2"
                      custom={direction}
                      variants={SLIDE_VARIANTS}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-5"
                    >
                      {/* Mobility Status */}
                      <div>
                        <Combobox
                          label="Mobility Status"
                          value={step3.mobilityStatus}
                          onChange={(v) => setStep3((p) => ({ ...p, mobilityStatus: v }))}
                          options={MOBILITY_OPTIONS}
                          placeholder="Select mobility level..."
                          labelMap={MOBILITY_LABELS}
                        />
                        {/* Hoist warning */}
                        <AnimatePresence>
                          {step3.mobilityStatus === "hoist_required" && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
                                <div>
                                  <p className="text-[12px] font-medium text-amber-300">
                                    Manual Handling Credential Required
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-amber-400/70">
                                    All assigned support workers must hold a current manual
                                    handling / hoist operation credential. Smart Match will
                                    filter for this automatically.
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Communication */}
                      <Combobox
                        label="Communication"
                        value={step3.communicationType}
                        onChange={(v) => setStep3((p) => ({ ...p, communicationType: v }))}
                        options={COMMUNICATION_OPTIONS}
                        placeholder="Select communication type..."
                        labelMap={COMMUNICATION_LABELS}
                      />

                      {/* Critical Alerts */}
                      <TagInput
                        tags={step3.criticalAlerts}
                        onAdd={(tag) =>
                          setStep3((p) => ({
                            ...p,
                            criticalAlerts: p.criticalAlerts.includes(tag)
                              ? p.criticalAlerts
                              : [...p.criticalAlerts, tag],
                          }))
                        }
                        onRemove={(tag) =>
                          setStep3((p) => ({
                            ...p,
                            criticalAlerts: p.criticalAlerts.filter((t) => t !== tag),
                          }))
                        }
                        inputValue={step3.alertInput}
                        onInputChange={(v) => setStep3((p) => ({ ...p, alertInput: v }))}
                        suggestions={SUGGESTED_ALERTS}
                      />

                      {/* Additional Notes */}
                      <div>
                        <label className={LABEL_CLASS}>Additional Notes</label>
                        <textarea
                          value={step3.additionalNotes}
                          onChange={(e) =>
                            setStep3((p) => ({ ...p, additionalNotes: e.target.value }))
                          }
                          placeholder="Any additional clinical notes, behavioural triggers, or risk context..."
                          rows={4}
                          className={`${INPUT_CLASS} resize-none`}
                        />
                      </div>
                    </motion.div>
                  )}

                  {/* ────── STEP 4: Service Agreement & Funding ────── */}
                  {currentStep === 3 && (
                    <motion.div
                      key="step-3"
                      custom={direction}
                      variants={SLIDE_VARIANTS}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-5"
                    >
                      {/* Agreement Title */}
                      <div>
                        <label className={LABEL_CLASS}>Agreement Title</label>
                        <input
                          type="text"
                          value={step4.agreementTitle}
                          onChange={(e) =>
                            setStep4((p) => ({ ...p, agreementTitle: e.target.value }))
                          }
                          placeholder="SA - Participant Name - Year"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLASS}>
                            Start Date <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            value={step4.startDate}
                            onChange={(e) =>
                              setStep4((p) => ({ ...p, startDate: e.target.value }))
                            }
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLASS}>
                            End Date <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="date"
                            value={step4.endDate}
                            onChange={(e) =>
                              setStep4((p) => ({ ...p, endDate: e.target.value }))
                            }
                            className={INPUT_CLASS}
                          />
                        </div>
                      </div>

                      {/* Pre-filled funding type */}
                      <div>
                        <label className={LABEL_CLASS}>Funding Management Type</label>
                        <div className="grid grid-cols-3 gap-2">
                          {FUNDING_TYPES.map((ft) => (
                            <button
                              key={ft.value}
                              type="button"
                              onClick={() =>
                                setStep4((p) => ({
                                  ...p,
                                  fundingManagementType: ft.value,
                                }))
                              }
                              className={`rounded-lg border p-3 text-left transition-all ${
                                step4.fundingManagementType === ft.value
                                  ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20"
                                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50"
                              }`}
                            >
                              <p
                                className={`text-[12px] font-medium ${
                                  step4.fundingManagementType === ft.value
                                    ? "text-blue-400"
                                    : "text-zinc-300"
                                }`}
                              >
                                {ft.label}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Budget Allocation */}
                      <div>
                        <label className={LABEL_CLASS}>Budget Allocation</label>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
                          {/* Header */}
                          <div className="grid grid-cols-2 gap-4 px-4 py-2.5 bg-zinc-900/60 border-b border-zinc-800">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                              Category
                            </span>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 text-right">
                              Amount (AUD)
                            </span>
                          </div>

                          {/* Core Supports */}
                          <div className="grid grid-cols-2 items-center gap-4 px-4 py-3 border-b border-zinc-800/50">
                            <span className="text-[13px] text-zinc-300">Core Supports</span>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={step4.coreSupports}
                                onChange={(e) =>
                                  setStep4((p) => ({ ...p, coreSupports: e.target.value }))
                                }
                                placeholder="0.00"
                                className={`${INPUT_CLASS} pl-7 text-right font-mono tabular-nums`}
                              />
                            </div>
                          </div>

                          {/* Capacity Building */}
                          <div className="grid grid-cols-2 items-center gap-4 px-4 py-3 border-b border-zinc-800/50">
                            <span className="text-[13px] text-zinc-300">Capacity Building</span>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={step4.capacityBuilding}
                                onChange={(e) =>
                                  setStep4((p) => ({ ...p, capacityBuilding: e.target.value }))
                                }
                                placeholder="0.00"
                                className={`${INPUT_CLASS} pl-7 text-right font-mono tabular-nums`}
                              />
                            </div>
                          </div>

                          {/* Capital Supports */}
                          <div className="grid grid-cols-2 items-center gap-4 px-4 py-3 border-b border-zinc-800/50">
                            <span className="text-[13px] text-zinc-300">Capital Supports</span>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={step4.capitalSupports}
                                onChange={(e) =>
                                  setStep4((p) => ({ ...p, capitalSupports: e.target.value }))
                                }
                                placeholder="0.00"
                                className={`${INPUT_CLASS} pl-7 text-right font-mono tabular-nums`}
                              />
                            </div>
                          </div>

                          {/* Total */}
                          <div className="grid grid-cols-2 items-center gap-4 px-4 py-3 bg-zinc-900/60">
                            <span className="text-[13px] font-semibold text-white">
                              Total Budget
                            </span>
                            <span className="text-right text-[15px] font-bold font-mono tabular-nums text-blue-400">
                              {fmtCurrency(budgetTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Error banner ──────────────────────── */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-6 mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                      <AlertTriangle size={14} className="shrink-0 text-red-400" />
                      <p className="text-[12px] text-red-400">{error}</p>
                      <button
                        type="button"
                        onClick={() => setError(null)}
                        className="ml-auto shrink-0 text-red-400/60 hover:text-red-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Footer / Navigation ───────────────── */}
              <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
                <div>
                  {currentStep > 0 ? (
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                    >
                      <ChevronLeft size={14} />
                      Back
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Keyboard hint */}
                  <span className="hidden sm:inline text-[10px] text-zinc-600 font-mono">
                    {currentStep < 3 ? "⌘ + Enter to continue" : "⌘ + Enter to complete"}
                  </span>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance || saving}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving...
                      </>
                    ) : currentStep === 3 ? (
                      <>
                        <Check size={14} />
                        Complete Intake
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
