"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  Wand2,
  RefreshCw,
  Search,
  ChevronRight,
  FileText,
  Loader2,
  X,
  Send,
  Eye,
  Copy,
  ArrowLeft,
  Activity,
  Siren,
  Timer,
  PackageCheck,
  Archive,
  BookCheck,
  Check,
} from "lucide-react";
import {
  getSirsTriageData,
  getSirsIncidents,
  getSirsSubmission,
  runAiSanitization,
  approveSanitizedNotes,
  updateSubmissionFields,
  generateExportPayload,
  markSubmittedToCommission,
  acknowledgeCommission,
} from "@/app/actions/aegis-sirs";
import { useAuthStore } from "@/lib/auth-store";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

type SirsPriority = "P1_24HR" | "P2_5DAY";
type SirsStatus =
  | "PENDING_TRIAGE"
  | "IN_SANITIZATION"
  | "READY_FOR_EXPORT"
  | "SUBMITTED_TO_COMMISSION"
  | "COMMISSION_ACKNOWLEDGED"
  | "CLOSED";

type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type IncidentCategory =
  | "INJURY"
  | "ABUSE"
  | "NEGLECT"
  | "UNAUTHORIZED_RESTRICTIVE_PRACTICE"
  | "PROPERTY_DAMAGE"
  | "MEDICATION_ERROR"
  | "MISSING_PERSON"
  | "DEATH"
  | "OTHER";

interface SirsSubmission {
  id: string;
  incident_id: string;
  organization_id: string;
  compliance_officer_id: string | null;
  raw_worker_notes: string;
  ai_sanitized_draft: string | null;
  final_commission_notes: string | null;
  immediate_actions_taken: string | null;
  police_notified: boolean;
  police_reference_number: string | null;
  family_notified: boolean;
  family_notification_details: string | null;
  participant_ndis_number: string | null;
  participant_name: string | null;
  participant_dob: string | null;
  worker_name: string | null;
  worker_role: string | null;
  incident_datetime: string | null;
  reported_datetime: string | null;
  status: SirsStatus;
  ndis_sirs_reference: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  sanitization_model: string | null;
  sanitization_prompt_version: string | null;
  sanitization_ran_at: string | null;
  export_json: Record<string, unknown> | null;
  export_pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

interface SirsIncident {
  id: string;
  organization_id: string;
  reported_by: string | null;
  participant_id: string | null;
  client_id: string | null;
  location: string | null;
  title: string;
  description: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  injuries_observed: string | null;
  witnesses: unknown[];
  is_sirs_reportable: boolean;
  sirs_priority: SirsPriority | null;
  statutory_deadline: string | null;
  escalation_12h_sent: boolean;
  escalation_4h_sent: boolean;
  escalation_1h_sent: boolean;
  status: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  device_timestamp: string | null;
  attachments: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  sirs_submissions: SirsSubmission[];
}

interface TriageStats {
  total_reportable: number;
  pending_triage: number;
  in_sanitization: number;
  ready_for_export: number;
  submitted: number;
  breached: number;
  critical_4h: number;
  p1_count: number;
  p2_count: number;
}

/* ══════════════════════════════════════════════════════════════
   Constants & Config
   ══════════════════════════════════════════════════════════════ */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

const STATUS_CONFIG: Record<
  SirsStatus,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  PENDING_TRIAGE: {
    label: "Pending Triage",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  IN_SANITIZATION: {
    label: "In Sanitization",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
  },
  READY_FOR_EXPORT: {
    label: "Ready for Export",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  SUBMITTED_TO_COMMISSION: {
    label: "Submitted",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    dot: "bg-zinc-500",
  },
  COMMISSION_ACKNOWLEDGED: {
    label: "Acknowledged",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    dot: "bg-green-500",
  },
  CLOSED: {
    label: "Closed",
    color: "text-zinc-500",
    bg: "bg-zinc-500/8",
    border: "border-zinc-500/15",
    dot: "bg-zinc-600",
  },
};

const PRIORITY_CONFIG: Record<
  SirsPriority,
  { label: string; shortLabel: string; color: string; bg: string; border: string }
> = {
  P1_24HR: {
    label: "Priority 1 — 24 Hour",
    shortLabel: "P1 · 24H",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
  P2_5DAY: {
    label: "Priority 2 — 5 Day",
    shortLabel: "P2 · 5D",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
};

const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { label: string; color: string; bg: string; border: string }
> = {
  LOW: {
    label: "Low",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
  },
  MEDIUM: {
    label: "Medium",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  HIGH: {
    label: "High",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  CRITICAL: {
    label: "Critical",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
};

const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  INJURY: "Injury",
  ABUSE: "Abuse Allegation",
  NEGLECT: "Neglect",
  UNAUTHORIZED_RESTRICTIVE_PRACTICE: "Unauthorized Restrictive Practice",
  PROPERTY_DAMAGE: "Property Damage",
  MEDICATION_ERROR: "Medication Error",
  MISSING_PERSON: "Missing Person",
  DEATH: "Death",
  OTHER: "Other",
};

type TabKey = "active" | "sandbox" | "all";
const TABS: { key: TabKey; label: string; icon: typeof Shield }[] = [
  { key: "active", label: "Active Triage", icon: ShieldAlert },
  { key: "sandbox", label: "Sanitization Sandbox", icon: Wand2 },
  { key: "all", label: "All Incidents", icon: FileText },
];

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ══════════════════════════════════════════════════════════════
   CountdownTimer — The Hero Component
   ══════════════════════════════════════════════════════════════ */

function CountdownTimer({
  deadline,
  size = "lg",
}: {
  deadline: string;
  size?: "sm" | "lg";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const deadlineMs = new Date(deadline).getTime();
  const remainingMs = deadlineMs - now;
  const isBreached = remainingMs < 0;

  const absMs = Math.abs(remainingMs);
  const totalSeconds = Math.floor(absMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hoursRemaining = remainingMs / (1000 * 60 * 60);

  // Color states
  let colorClass = "text-emerald-400";
  let pulseClass = "";
  let bgClass = "";

  if (isBreached) {
    colorClass = "text-rose-500";
    pulseClass = "animate-pulse";
    bgClass = "bg-rose-500/10 rounded-lg px-3 py-1.5";
  } else if (hoursRemaining < 1) {
    colorClass = "text-rose-500";
    pulseClass = "animate-pulse";
  } else if (hoursRemaining < 4) {
    colorClass = "text-rose-500";
    pulseClass = "animate-pulse";
  } else if (hoursRemaining < 12) {
    colorClass = "text-amber-400";
  }

  const timeStr = isBreached
    ? `BREACHED: -${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;

  if (size === "sm") {
    return (
      <span
        className={cn(
          "font-mono text-xs font-bold tabular-nums",
          colorClass,
          pulseClass,
          bgClass
        )}
      >
        {timeStr}
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-2", bgClass, pulseClass)}>
      <Timer
        size={18}
        className={cn(colorClass, isBreached && "animate-pulse")}
      />
      <span
        className={cn(
          "font-mono text-[18px] font-bold tabular-nums tracking-tight",
          colorClass,
          isBreached && "font-bold"
        )}
      >
        {timeStr}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   StatusBadge
   ══════════════════════════════════════════════════════════════ */

function SirsStatusBadge({ status }: { status: SirsStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border",
        c.bg,
        c.color,
        c.border
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   PriorityBadge
   ══════════════════════════════════════════════════════════════ */

function PriorityBadge({ priority }: { priority: SirsPriority | null }) {
  if (!priority) return null;
  const c = PRIORITY_CONFIG[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md border",
        c.bg,
        c.color,
        c.border
      )}
    >
      <Siren size={10} />
      {c.shortLabel}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   SeverityBadge
   ══════════════════════════════════════════════════════════════ */

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const c = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border",
        c.bg,
        c.color,
        c.border
      )}
    >
      {c.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   CategoryBadge
   ══════════════════════════════════════════════════════════════ */

function CategoryBadge({ category }: { category: IncidentCategory }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium text-zinc-400 bg-zinc-800/50 rounded-md border border-zinc-700/30">
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   TelemetryCard
   ══════════════════════════════════════════════════════════════ */

function TelemetryCard({
  label,
  value,
  icon: Icon,
  color,
  pulse,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  color: string;
  pulse?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/[0.04] bg-zinc-950/40 p-4",
        pulse && value > 0 && "animate-pulse border-rose-500/30"
      )}
    >
      {/* Glow */}
      {pulse && value > 0 && (
        <div className="absolute inset-0 bg-rose-500/[0.03] pointer-events-none" />
      )}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        <Icon size={14} className={cn("opacity-60", color)} />
      </div>
      <div className={cn("font-mono text-2xl font-bold tabular-nums", color)}>
        {value}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ToggleField
   ══════════════════════════════════════════════════════════════ */

function ToggleField({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer group">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
            checked ? "bg-emerald-500" : "bg-zinc-700"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
              checked ? "translate-x-4" : "translate-x-0"
            )}
          />
        </button>
        <span className="text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors">
          {label}
        </span>
      </label>
      <AnimatePresence>
        {checked && children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE_IN_OUT }}
            className="overflow-hidden pl-12"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FormInput
   ══════════════════════════════════════════════════════════════ */

const inputCls =
  "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/50 transition-colors";

const errorInputCls =
  "w-full rounded-lg border border-rose-500/50 bg-rose-500/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-rose-500/80 transition-colors";

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(error ? errorInputCls : inputCls, mono && "font-mono")}
      />
      {error && (
        <p className="text-[11px] text-rose-400 font-medium">{error}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Sanitization Sandbox Panel
   ══════════════════════════════════════════════════════════════ */

function SanitizationSandbox({
  incident,
  orgId,
  onBack,
  onRefresh,
}: {
  incident: SirsIncident;
  orgId: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const submission = incident.sirs_submissions?.[0];
  const [sub, setSub] = useState<SirsSubmission | null>(submission ?? null);
  const [sanitizedText, setSanitizedText] = useState(
    submission?.ai_sanitized_draft ?? ""
  );
  const [finalText, setFinalText] = useState(
    submission?.final_commission_notes ?? submission?.ai_sanitized_draft ?? ""
  );
  const [aiRunning, setAiRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportPayload, setExportPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [ndisRef, setNdisRef] = useState(submission?.ndis_sirs_reference ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Statutory fields
  const [policeNotified, setPoliceNotified] = useState(
    submission?.police_notified ?? false
  );
  const [policeRef, setPoliceRef] = useState(
    submission?.police_reference_number ?? ""
  );
  const [familyNotified, setFamilyNotified] = useState(
    submission?.family_notified ?? false
  );
  const [familyDetails, setFamilyDetails] = useState(
    submission?.family_notification_details ?? ""
  );
  const [immediateActions, setImmediateActions] = useState(
    submission?.immediate_actions_taken ?? ""
  );
  const [participantNdis, setParticipantNdis] = useState(
    submission?.participant_ndis_number ?? ""
  );
  const [participantName, setParticipantName] = useState(
    submission?.participant_name ?? ""
  );
  const [workerName, setWorkerName] = useState(
    submission?.worker_name ?? ""
  );
  const [workerRole, setWorkerRole] = useState(
    submission?.worker_role ?? ""
  );

  // Reload submission on mount
  useEffect(() => {
    if (!submission) return;
    setSub(submission);
    setSanitizedText(submission.ai_sanitized_draft ?? "");
    setFinalText(
      submission.final_commission_notes ?? submission.ai_sanitized_draft ?? ""
    );
    setNdisRef(submission.ndis_sirs_reference ?? "");
    setPoliceNotified(submission.police_notified ?? false);
    setPoliceRef(submission.police_reference_number ?? "");
    setFamilyNotified(submission.family_notified ?? false);
    setFamilyDetails(submission.family_notification_details ?? "");
    setImmediateActions(submission.immediate_actions_taken ?? "");
    setParticipantNdis(submission.participant_ndis_number ?? "");
    setParticipantName(submission.participant_name ?? "");
    setWorkerName(submission.worker_name ?? "");
    setWorkerRole(submission.worker_role ?? "");
  }, [submission]);

  const handleAiSanitize = useCallback(async () => {
    if (!sub?.id) return;
    setAiRunning(true);
    try {
      const result = await runAiSanitization(orgId, sub.id);
      if (result.data) {
        setSub(result.data);
        setSanitizedText(result.data.ai_sanitized_draft ?? "");
        setFinalText(result.data.ai_sanitized_draft ?? "");
      }
    } catch (err) {
      console.error("AI sanitization failed:", err);
    } finally {
      setAiRunning(false);
    }
  }, [orgId, sub?.id]);

  const handleApprove = useCallback(async () => {
    if (!sub?.id || !finalText.trim()) return;
    setSaving(true);
    try {
      // Save statutory fields first
      await updateSubmissionFields(orgId, sub.id, {
        police_notified: policeNotified,
        police_reference_number: policeRef || undefined,
        family_notified: familyNotified,
        family_notification_details: familyDetails || undefined,
        immediate_actions_taken: immediateActions || undefined,
        participant_ndis_number: participantNdis || undefined,
        participant_name: participantName || undefined,
        worker_name: workerName || undefined,
        worker_role: workerRole || undefined,
      });

      const result = await approveSanitizedNotes(orgId, sub.id, finalText);
      if (result.data) {
        setSub(result.data);
        onRefresh();
      }
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setSaving(false);
    }
  }, [
    orgId,
    sub?.id,
    finalText,
    policeNotified,
    policeRef,
    familyNotified,
    familyDetails,
    immediateActions,
    participantNdis,
    participantName,
    workerName,
    workerRole,
    onRefresh,
  ]);

  const handleExport = useCallback(async () => {
    if (!sub?.id) return;

    // Validate required fields
    const errors: Record<string, string> = {};
    if (!participantName.trim())
      errors.participantName = "Participant name required";
    if (!participantNdis.trim())
      errors.participantNdis = "NDIS number required";
    if (!workerName.trim()) errors.workerName = "Worker name required";
    if (!workerRole.trim()) errors.workerRole = "Worker role required";
    if (!immediateActions.trim())
      errors.immediateActions = "Immediate actions required";
    if (!finalText.trim()) errors.finalText = "Approved notes required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    // Save fields first
    setExportLoading(true);
    try {
      await updateSubmissionFields(orgId, sub.id, {
        police_notified: policeNotified,
        police_reference_number: policeRef || undefined,
        family_notified: familyNotified,
        family_notification_details: familyDetails || undefined,
        immediate_actions_taken: immediateActions || undefined,
        participant_ndis_number: participantNdis || undefined,
        participant_name: participantName || undefined,
        worker_name: workerName || undefined,
        worker_role: workerRole || undefined,
      });

      const result = await generateExportPayload(orgId, sub.id);
      if (result.data) {
        setExportPayload(result.data as Record<string, unknown>);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExportLoading(false);
    }
  }, [
    orgId,
    sub?.id,
    participantName,
    participantNdis,
    workerName,
    workerRole,
    immediateActions,
    finalText,
    policeNotified,
    policeRef,
    familyNotified,
    familyDetails,
  ]);

  const handleSubmitToCommission = useCallback(async () => {
    if (!sub?.id || !ndisRef.trim()) return;
    setSubmitting(true);
    try {
      const result = await markSubmittedToCommission(orgId, sub.id, ndisRef);
      if (result.data) {
        setSub(result.data);
        onRefresh();
      }
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [orgId, sub?.id, ndisRef, onRefresh]);

  const handleAcknowledge = useCallback(async () => {
    if (!sub?.id) return;
    setAcknowledging(true);
    try {
      const result = await acknowledgeCommission(orgId, sub.id);
      if (result.data) {
        setSub(result.data);
        onRefresh();
      }
    } catch (err) {
      console.error("Acknowledge failed:", err);
    } finally {
      setAcknowledging(false);
    }
  }, [orgId, sub?.id, onRefresh]);

  const handleCopyPayload = useCallback(() => {
    if (exportPayload) {
      navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [exportPayload]);

  const isBreached = useMemo(() => {
    if (!incident.statutory_deadline) return false;
    return new Date(incident.statutory_deadline).getTime() < Date.now();
  }, [incident.statutory_deadline]);

  const subStatus = sub?.status ?? "PENDING_TRIAGE";

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="space-y-6"
    >
      {/* Back header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Triage
        </button>
        <div className="flex-1" />
        <PriorityBadge priority={incident.sirs_priority} />
        <SirsStatusBadge status={subStatus} />
      </div>

      {/* Incident header */}
      <div
        className={cn(
          "rounded-xl border p-5",
          isBreached
            ? "border-rose-500/30 bg-rose-500/[0.04]"
            : "border-white/[0.04] bg-zinc-950/40"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-[15px] font-medium text-zinc-200">
              {incident.title}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <CategoryBadge category={incident.category} />
              <SeverityBadge severity={incident.severity} />
              <span className="text-[11px] text-zinc-600 font-mono">
                {formatDateTime(incident.created_at)}
              </span>
            </div>
          </div>
          {incident.statutory_deadline && (
            <CountdownTimer deadline={incident.statutory_deadline} />
          )}
        </div>
      </div>

      {/* 50/50 Notes Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — Raw Worker Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Raw Worker Notes
            </h4>
            <span className="text-[10px] text-zinc-600 font-mono">
              READ-ONLY
            </span>
          </div>
          <div className="rounded-xl border border-white/[0.04] bg-zinc-900/50 p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
            <pre className="text-[13px] text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
              {sub?.raw_worker_notes || "No raw notes available"}
            </pre>
          </div>
        </div>

        {/* RIGHT — Sanitized Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Sanitized Notes
            </h4>
            {sanitizedText && (
              <span className="text-[10px] text-emerald-500/60 font-mono">
                AI PROCESSED
              </span>
            )}
          </div>
          <textarea
            value={finalText}
            onChange={(e) => setFinalText(e.target.value)}
            placeholder="Run AI Sanitization to generate draft, or type manually..."
            rows={10}
            className={cn(
              "w-full rounded-xl border p-4 text-[13px] text-zinc-200 font-mono whitespace-pre-wrap leading-relaxed bg-zinc-950/30 outline-none resize-none min-h-[200px] max-h-[400px]",
              sanitizedText
                ? "border-emerald-500/20 focus:border-emerald-500/40"
                : "border-white/[0.04] focus:border-white/[0.08]"
            )}
          />
        </div>
      </div>

      {/* AI + Approve Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleAiSanitize}
          disabled={aiRunning || !sub}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
            "border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {aiRunning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Wand2 size={14} />
          )}
          {aiRunning ? "Sanitizing…" : "Run AI Sanitization"}
        </button>

        <button
          onClick={handleApprove}
          disabled={saving || !finalText.trim() || subStatus === "READY_FOR_EXPORT"}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
            "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <CheckCircle2 size={14} />
          )}
          {saving ? "Saving…" : "Approve Final Notes"}
        </button>
      </div>

      {/* Statutory Fields */}
      <div className="rounded-xl border border-white/[0.04] bg-zinc-950/40 p-5 space-y-5">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Statutory Fields
        </h4>

        <div className="space-y-4">
          <ToggleField
            label="Police Notified?"
            checked={policeNotified}
            onChange={setPoliceNotified}
          >
            <FormInput
              label="Police Reference Number"
              value={policeRef}
              onChange={setPoliceRef}
              placeholder="e.g. NSW-2026-00123"
              mono
            />
          </ToggleField>

          <ToggleField
            label="Family / Nominee Notified?"
            checked={familyNotified}
            onChange={setFamilyNotified}
          >
            <textarea
              value={familyDetails}
              onChange={(e) => setFamilyDetails(e.target.value)}
              placeholder="Details of family notification..."
              rows={2}
              className={inputCls + " resize-none"}
            />
          </ToggleField>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Immediate Actions Taken
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={immediateActions}
              onChange={(e) => setImmediateActions(e.target.value)}
              placeholder="Describe all immediate actions taken in response to the incident..."
              rows={3}
              className={cn(
                fieldErrors.immediateActions ? errorInputCls : inputCls,
                "resize-none"
              )}
            />
            {fieldErrors.immediateActions && (
              <p className="text-[11px] text-rose-400 font-medium">
                {fieldErrors.immediateActions}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Participant NDIS Number"
              value={participantNdis}
              onChange={setParticipantNdis}
              placeholder="43xxxxxxxx"
              error={fieldErrors.participantNdis}
              required
              mono
            />
            <FormInput
              label="Participant Name"
              value={participantName}
              onChange={setParticipantName}
              placeholder="Full legal name"
              error={fieldErrors.participantName}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Worker Name"
              value={workerName}
              onChange={setWorkerName}
              placeholder="Support worker name"
              error={fieldErrors.workerName}
              required
            />
            <FormInput
              label="Worker Role"
              value={workerRole}
              onChange={setWorkerRole}
              placeholder="e.g. Support Worker, Team Leader"
              error={fieldErrors.workerRole}
              required
            />
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="rounded-xl border border-white/[0.04] bg-zinc-950/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            SIRS Export
          </h4>
          {subStatus === "READY_FOR_EXPORT" && (
            <span className="text-[10px] text-emerald-500 font-mono font-medium">
              NOTES APPROVED ✓
            </span>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={
            exportLoading ||
            (subStatus !== "READY_FOR_EXPORT" && subStatus !== "IN_SANITIZATION" && subStatus !== "PENDING_TRIAGE")
          }
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
            "border border-white/[0.06] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {exportLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {exportLoading ? "Generating…" : "Generate SIRS Export Payload"}
        </button>

        {/* Export JSON preview */}
        <AnimatePresence>
          {exportPayload && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-mono font-semibold uppercase tracking-widest">
                  Export Payload Preview
                </span>
                <button
                  onClick={handleCopyPayload}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
              </div>
              <pre className="rounded-lg border border-white/[0.04] bg-[#0A0A0A] p-4 text-[12px] text-emerald-400/80 font-mono overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">
                {JSON.stringify(exportPayload, null, 2)}
              </pre>

              {/* Submit to Commission */}
              {subStatus !== "SUBMITTED_TO_COMMISSION" &&
                subStatus !== "COMMISSION_ACKNOWLEDGED" &&
                subStatus !== "CLOSED" && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <FormInput
                        label="NDIS SIRS Reference Number"
                        value={ndisRef}
                        onChange={setNdisRef}
                        placeholder="SIRS-2026-XXXX"
                        mono
                      />
                    </div>
                    <button
                      onClick={handleSubmitToCommission}
                      disabled={submitting || !ndisRef.trim()}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shrink-0",
                        "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      {submitting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      {submitting ? "Submitting…" : "Mark as Submitted"}
                    </button>
                  </div>
                )}

              {/* Acknowledge */}
              {subStatus === "SUBMITTED_TO_COMMISSION" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 pt-2"
                >
                  <div className="flex-1 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-3">
                    <p className="text-[12px] text-emerald-400 font-medium">
                      Submitted to Commission{" "}
                      <span className="text-zinc-500 font-mono">
                        · Ref: {sub?.ndis_sirs_reference}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5 font-mono">
                      {formatDateTime(sub?.submitted_at ?? null)}
                    </p>
                  </div>
                  <button
                    onClick={handleAcknowledge}
                    disabled={acknowledging}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shrink-0",
                      "border border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    {acknowledging ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <BookCheck size={14} />
                    )}
                    {acknowledging ? "Processing…" : "Mark as Acknowledged"}
                  </button>
                </motion.div>
              )}

              {/* Acknowledged confirmation */}
              {(subStatus === "COMMISSION_ACKNOWLEDGED" ||
                subStatus === "CLOSED") && (
                <div className="rounded-lg border border-green-500/10 bg-green-500/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-400" />
                    <p className="text-[12px] text-green-400 font-medium">
                      Commission Acknowledged
                    </p>
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5 font-mono pl-[22px]">
                    Reference: {sub?.ndis_sirs_reference} ·{" "}
                    {formatDateTime(sub?.acknowledged_at ?? null)}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Active Triage Card
   ══════════════════════════════════════════════════════════════ */

function TriageCard({
  incident,
  index,
  onSelect,
}: {
  incident: SirsIncident;
  index: number;
  onSelect: () => void;
}) {
  const sub = incident.sirs_submissions?.[0];
  const subStatus: SirsStatus = sub?.status ?? "PENDING_TRIAGE";
  const isBreached =
    incident.statutory_deadline &&
    new Date(incident.statutory_deadline).getTime() < Date.now() &&
    subStatus !== "SUBMITTED_TO_COMMISSION" &&
    subStatus !== "COMMISSION_ACKNOWLEDGED" &&
    subStatus !== "CLOSED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.04,
        ease: EASE_OUT,
      }}
      className={cn(
        "group relative rounded-xl border p-5 transition-all hover:border-white/[0.08] cursor-pointer",
        isBreached
          ? "border-rose-500/30 bg-rose-500/[0.04] hover:bg-rose-500/[0.06]"
          : "border-white/[0.04] bg-zinc-950/40 hover:bg-zinc-950/60"
      )}
      onClick={onSelect}
    >
      {/* Top row: Priority + Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={incident.sirs_priority} />
          <CategoryBadge category={incident.category} />
        </div>
        <SirsStatusBadge status={subStatus} />
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-medium text-zinc-200 mb-1 line-clamp-2">
        {incident.title}
      </h3>

      {/* Severity + date */}
      <div className="flex items-center gap-2 mb-4">
        <SeverityBadge severity={incident.severity} />
        <span className="text-[11px] text-zinc-600 font-mono">
          {formatDateTime(incident.created_at)}
        </span>
      </div>

      {/* HERO: Countdown Timer */}
      {incident.statutory_deadline && (
        <div
          className={cn(
            "rounded-lg border p-3 mb-4",
            isBreached
              ? "border-rose-500/20 bg-rose-500/[0.06]"
              : "border-white/[0.03] bg-black/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">
              Statutory Deadline
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              {formatDateTime(incident.statutory_deadline)}
            </span>
          </div>
          <div className="mt-2">
            <CountdownTimer deadline={incident.statutory_deadline} />
          </div>
        </div>
      )}

      {/* Open Triage button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors group"
      >
        <Eye size={13} />
        Open Triage
        <ChevronRight
          size={13}
          className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
        />
      </button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   All Incidents Row
   ══════════════════════════════════════════════════════════════ */

function AllIncidentRow({
  incident,
  index,
}: {
  incident: SirsIncident;
  index: number;
}) {
  const sub = incident.sirs_submissions?.[0];
  const subStatus: SirsStatus = sub?.status ?? "PENDING_TRIAGE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.02, ease: EASE_OUT }}
      className="flex items-center gap-4 rounded-lg border border-white/[0.03] bg-zinc-950/30 px-4 py-3 hover:bg-zinc-950/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <PriorityBadge priority={incident.sirs_priority} />
          <h4 className="text-[13px] font-medium text-zinc-300 truncate">
            {incident.title}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={incident.severity} />
          <CategoryBadge category={incident.category} />
          <span className="text-[10px] text-zinc-600 font-mono">
            {formatDate(incident.created_at)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {incident.statutory_deadline && (
          <CountdownTimer deadline={incident.statutory_deadline} size="sm" />
        )}
        <SirsStatusBadge status={subStatus} />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function SirsTriagePage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id) ?? null;
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [incidents, setIncidents] = useState<SirsIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIncident, setSelectedIncident] =
    useState<SirsIncident | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Data Loading ──────────────────────────────────────── */

  const loadData = useCallback(
    async (silent = false) => {
      if (!orgId) return;
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const [triageResult, incidentsResult] = await Promise.allSettled([
          getSirsTriageData(orgId),
          getSirsIncidents(orgId),
        ]);

        if (
          triageResult.status === "fulfilled" &&
          triageResult.value.data
        ) {
          setStats(triageResult.value.data as TriageStats);
        }

        if (
          incidentsResult.status === "fulfilled" &&
          incidentsResult.value.data
        ) {
          setIncidents(incidentsResult.value.data as SirsIncident[]);
        }
      } catch (err) {
        console.error("SIRS data load failed:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30 seconds (statutory compliance — clocks are ticking)
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadData(true);
    }, 30_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadData]);

  /* ── Filtering ─────────────────────────────────────────── */

  const activeIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const sub = inc.sirs_submissions?.[0];
      const status = sub?.status ?? "PENDING_TRIAGE";
      return (
        status !== "SUBMITTED_TO_COMMISSION" &&
        status !== "COMMISSION_ACKNOWLEDGED" &&
        status !== "CLOSED"
      );
    });
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const base =
      activeTab === "active"
        ? activeIncidents
        : activeTab === "all"
          ? incidents
          : activeIncidents;

    if (!q) return base;
    return base.filter(
      (inc) =>
        inc.title.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q)
    );
  }, [activeTab, activeIncidents, incidents, debouncedSearch]);

  /* ── Keyboard shortcut ─────────────────────────────────── */

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (selectedIncident) {
          setSelectedIncident(null);
        } else {
          searchRef.current?.blur();
          setSearch("");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIncident]);

  /* ── Render ────────────────────────────────────────────── */

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <Shield size={32} className="text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-500">
            Select an organization to view SIRS triage
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <div className="mx-auto max-w-[1440px] px-6 py-8 space-y-6">
        {/* ── Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="flex items-start justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Shield size={18} className="text-rose-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
                  SIRS Compliance Triage
                </h1>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Serious Incident Response Scheme — Statutory Compliance Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all",
                "border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]",
                "disabled:opacity-40"
              )}
            >
              <RefreshCw
                size={13}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── Breach Alert Banner ─────────────────────────── */}
        <AnimatePresence>
          {stats && stats.breached > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.98 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <div className="relative overflow-hidden rounded-xl border border-rose-500/30 bg-rose-500/[0.08] animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500/[0.04] via-rose-500/[0.08] to-rose-500/[0.04]" />
                <div className="relative flex items-center gap-3 px-5 py-4">
                  <ShieldAlert size={20} className="text-rose-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-rose-300">
                      ⚠ STATUTORY BREACH: {stats.breached} incident
                      {stats.breached !== 1 ? "s have" : " has"} exceeded{" "}
                      {stats.breached !== 1 ? "their" : "its"} reporting
                      deadline. Immediate action required.
                    </p>
                  </div>
                  <span className="font-mono text-2xl font-bold text-rose-400 tabular-nums shrink-0">
                    {stats.breached}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Telemetry Ribbon ────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.03] bg-zinc-950/30 p-4 animate-pulse h-[88px]"
              />
            ))}
          </div>
        ) : (
          stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <TelemetryCard
                label="Pending Triage"
                value={stats.pending_triage}
                icon={Clock}
                color="text-amber-400"
              />
              <TelemetryCard
                label="In Sanitization"
                value={stats.in_sanitization}
                icon={Wand2}
                color="text-blue-400"
              />
              <TelemetryCard
                label="Ready for Export"
                value={stats.ready_for_export}
                icon={PackageCheck}
                color="text-emerald-400"
              />
              <TelemetryCard
                label="Submitted"
                value={stats.submitted}
                icon={Archive}
                color="text-zinc-400"
              />
              <TelemetryCard
                label="Breached"
                value={stats.breached}
                icon={ShieldAlert}
                color={
                  stats.breached > 0 ? "text-rose-400" : "text-zinc-500"
                }
                pulse={stats.breached > 0}
              />
              <TelemetryCard
                label="Critical <4H"
                value={stats.critical_4h}
                icon={AlertTriangle}
                color={
                  stats.critical_4h > 0 ? "text-rose-400" : "text-zinc-500"
                }
                pulse={stats.critical_4h > 0}
              />
            </div>
          )
        )}

        {/* ── Search + Tab Navigation ─────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.04] bg-zinc-950/40 p-1">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (tab.key !== "sandbox") setSelectedIncident(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
                    isActive
                      ? "bg-white/[0.06] text-zinc-200"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]"
                  )}
                >
                  <TabIcon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search incidents… (press "/")'
              className="w-full rounded-lg border border-white/[0.04] bg-zinc-950/40 pl-9 pr-8 py-2 text-sm text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-emerald-500/30 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Count */}
          <span className="text-[11px] text-zinc-600 font-mono tabular-nums shrink-0">
            {filteredIncidents.length} incident
            {filteredIncidents.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Content Area ────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ACTIVE TRIAGE TAB */}
          {activeTab === "active" && !selectedIncident && (
            <motion.div
              key="active-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.03] bg-zinc-950/30 p-5 animate-pulse h-[240px]"
                    />
                  ))}
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <Shield size={40} className="text-zinc-800" />
                  <p className="text-sm text-zinc-600">
                    {debouncedSearch
                      ? "No incidents match your search"
                      : "No active SIRS incidents require triage"}
                  </p>
                  {debouncedSearch && (
                    <button
                      onClick={() => setSearch("")}
                      className="text-[12px] text-emerald-500 hover:text-emerald-400"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredIncidents.map((incident, index) => (
                    <TriageCard
                      key={incident.id}
                      incident={incident}
                      index={index}
                      onSelect={() => {
                        setSelectedIncident(incident);
                        setActiveTab("sandbox");
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* SANITIZATION SANDBOX TAB */}
          {activeTab === "sandbox" && (
            <motion.div
              key="sandbox-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {selectedIncident ? (
                <SanitizationSandbox
                  incident={selectedIncident}
                  orgId={orgId}
                  onBack={() => {
                    setSelectedIncident(null);
                    setActiveTab("active");
                  }}
                  onRefresh={() => loadData(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <Wand2 size={40} className="text-zinc-800" />
                  <p className="text-sm text-zinc-600">
                    Select an incident from Active Triage to enter the
                    Sanitization Sandbox
                  </p>
                  <button
                    onClick={() => setActiveTab("active")}
                    className="flex items-center gap-1 text-[12px] text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    <ArrowLeft size={12} />
                    Go to Active Triage
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ALL INCIDENTS TAB */}
          {activeTab === "all" && (
            <motion.div
              key="all-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/[0.03] bg-zinc-950/30 h-[68px] animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <FileText size={40} className="text-zinc-800" />
                  <p className="text-sm text-zinc-600">
                    {debouncedSearch
                      ? "No incidents match your search"
                      : "No SIRS-reportable incidents found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="flex items-center gap-4 px-4 py-2">
                    <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                      Incident
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 w-[120px] text-right">
                      Countdown
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 w-[140px] text-right">
                      Status
                    </span>
                  </div>
                  {filteredIncidents.map((incident, index) => (
                    <AllIncidentRow
                      key={incident.id}
                      incident={incident}
                      index={index}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer / Auto-refresh indicator ─────────────── */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.03]">
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-emerald-500/40" />
            <span className="text-[10px] text-zinc-700 font-mono">
              Auto-refresh: 30s · Statutory clock active
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-700 font-mono">
              {stats?.p1_count ?? 0} P1 · {stats?.p2_count ?? 0} P2 ·{" "}
              {stats?.total_reportable ?? 0} Total Reportable
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
