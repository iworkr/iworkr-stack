"use client";

/**
 * @page Intake Review Workbench
 * @route /dashboard/intake/review/[id]
 * @description Project Oracle-Intake: Split-pane HITL verification UI.
 *   Left: Original PDF. Right: AI-extracted data in editable form.
 *   Admin visually verifies and commits to production tables.
 */

import { useState, useEffect, useCallback, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchIntakeSession,
  commitIntakeSession,
  rejectIntakeSession,
  getIntakeDocumentUrl,
  type IntakeSession,
  type NdisExtractedData,
} from "@/app/actions/oracle-intake";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Brain,
  FileText,
  Loader2,
  Shield,
  DollarSign,
  Target,
  User,
  Calendar,
  Hash,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

/* ── Validation Helpers ───────────────────────────────── */

function validateNdisNumber(val: string): string | null {
  const cleaned = val.replace(/\D/g, "");
  if (cleaned.length !== 9) return "Must be exactly 9 digits";
  return null;
}

function validateDate(val: string): string | null {
  if (!val) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return "Format: YYYY-MM-DD";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "Invalid date";
  return null;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);
}

/* ── Field Components ─────────────────────────────────── */

function FormField({
  label,
  icon: Icon,
  value,
  onChange,
  error,
  warning,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  warning?: string | null;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          w-full px-3 py-2 rounded-lg text-sm bg-neutral-900 border transition-colors
          ${error ? "border-red-500/50 text-red-300 focus:ring-red-500/30" : warning ? "border-amber-500/50 text-amber-300" : "border-neutral-700 text-neutral-200 focus:border-emerald-500/50"}
          focus:outline-none focus:ring-1 focus:ring-emerald-500/20
          disabled:opacity-50 disabled:cursor-not-allowed
          placeholder:text-neutral-600
        `}
      />
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
      {warning && !error && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{warning}</p>}
    </div>
  );
}

/* ── Budget Row ───────────────────────────────────────── */

function BudgetRow({
  budget,
  index,
  onChange,
  onRemove,
}: {
  budget: NdisExtractedData["budgets"][0];
  index: number;
  onChange: (field: string, value: string | number) => void;
  onRemove: () => void;
}) {
  const categoryColors: Record<string, string> = {
    CORE: "text-emerald-400 bg-emerald-500/10",
    CAPACITY_BUILDING: "text-blue-400 bg-blue-500/10",
    CAPITAL: "text-purple-400 bg-purple-500/10",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
      <select
        value={budget.category}
        onChange={(e) => onChange("category", e.target.value)}
        className={`px-2 py-1 rounded-md text-xs font-medium border-0 ${categoryColors[budget.category] || "bg-neutral-800 text-neutral-400"}`}
      >
        <option value="CORE">Core</option>
        <option value="CAPACITY_BUILDING">Capacity Building</option>
        <option value="CAPITAL">Capital</option>
      </select>
      <div className="flex-1">
        <input
          type="text"
          value={budget.subcategory || ""}
          onChange={(e) => onChange("subcategory", e.target.value)}
          placeholder="Subcategory"
          className="w-full px-2 py-1 rounded-md text-xs bg-transparent border border-neutral-800 text-neutral-300 focus:outline-none focus:border-neutral-600"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-neutral-500">$</span>
        <input
          type="number"
          step="0.01"
          value={budget.total_amount}
          onChange={(e) => onChange("total_amount", parseFloat(e.target.value) || 0)}
          className="w-28 px-2 py-1 rounded-md text-sm font-mono bg-transparent border border-neutral-800 text-neutral-200 focus:outline-none focus:border-neutral-600 tabular-nums"
        />
      </div>
      <select
        value={budget.management_type || "NDIA"}
        onChange={(e) => onChange("management_type", e.target.value)}
        className="px-2 py-1 rounded-md text-xs bg-neutral-800 text-neutral-400 border-0"
      >
        <option value="NDIA">NDIA Managed</option>
        <option value="PLAN_MANAGED">Plan Managed</option>
        <option value="SELF_MANAGED">Self Managed</option>
      </select>
      <button onClick={onRemove} className="p-1 rounded hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Goal Row ─────────────────────────────────────────── */

function GoalRow({
  goal,
  index,
  onChange,
  onRemove,
}: {
  goal: { goal_text: string; support_category?: string };
  index: number;
  onChange: (field: string, value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800">
      <span className="text-xs text-neutral-600 mt-2 font-mono">{index + 1}.</span>
      <div className="flex-1 space-y-2">
        <textarea
          value={goal.goal_text}
          onChange={(e) => onChange("goal_text", e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 rounded-md text-sm bg-transparent border border-neutral-800 text-neutral-200 focus:outline-none focus:border-neutral-600 resize-none"
        />
        <select
          value={goal.support_category || "CORE"}
          onChange={(e) => onChange("support_category", e.target.value)}
          className="px-2 py-1 rounded-md text-xs bg-neutral-800 text-neutral-400 border-0"
        >
          <option value="CORE">Core</option>
          <option value="CAPACITY_BUILDING">Capacity Building</option>
          <option value="CAPITAL">Capital</option>
        </select>
      </div>
      <button onClick={onRemove} className="p-1 rounded hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors mt-1">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ── Collapsible Section ──────────────────────────────── */

function Section({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-neutral-200">
          <Icon className="w-4 h-4 text-emerald-400" />
          {title}
          {count != null && (
            <span className="text-xs text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded-full">{count}</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Review Page ─────────────────────────────────── */

export default function IntakeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const router = useRouter();
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;

  const [session, setSession] = useState<IntakeSession | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [commitResult, setCommitResult] = useState<{ success: boolean; error?: string; participant_id?: string } | null>(null);

  // Editable extracted data
  const [formData, setFormData] = useState<NdisExtractedData>({
    participant_first_name: "",
    participant_last_name: "",
    ndis_number: "",
    plan_start_date: "",
    plan_end_date: "",
    budgets: [],
    goals: [],
  });

  // Load session and PDF URL
  useEffect(() => {
    async function load() {
      if (!orgId) return;
      const sess = await fetchIntakeSession(sessionId, orgId);
      if (sess) {
        setSession(sess);
        if (sess.extracted_data) {
          setFormData(sess.extracted_data);
        }
        const urlResult = await getIntakeDocumentUrl(sess.file_path);
        if (urlResult.url) setPdfUrl(urlResult.url);
      }
      setLoading(false);
    }
    load();
  }, [sessionId, orgId]);

  // Form field updater
  const updateField = useCallback((field: keyof NdisExtractedData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Budget management
  const updateBudget = useCallback((index: number, field: string, value: string | number) => {
    setFormData((prev) => {
      const budgets = [...prev.budgets];
      budgets[index] = { ...budgets[index], [field]: value };
      return { ...prev, budgets };
    });
  }, []);

  const addBudget = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      budgets: [...prev.budgets, { category: "CORE", total_amount: 0, management_type: "NDIA" }],
    }));
  }, []);

  const removeBudget = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      budgets: prev.budgets.filter((_, i) => i !== index),
    }));
  }, []);

  // Goal management
  const updateGoal = useCallback((index: number, field: string, value: string) => {
    setFormData((prev) => {
      const goals = [...(prev.goals || [])];
      goals[index] = { ...goals[index], [field]: value };
      return { ...prev, goals };
    });
  }, []);

  const addGoal = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      goals: [...(prev.goals || []), { goal_text: "", support_category: "CORE" }],
    }));
  }, []);

  const removeGoal = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      goals: (prev.goals || []).filter((_, i) => i !== index),
    }));
  }, []);

  // Commit handler
  const handleCommit = useCallback(async () => {
    if (!orgId) return;
    setCommitting(true);
    const result = await commitIntakeSession(sessionId, orgId, formData, reviewNotes || undefined);
    setCommitResult(result);
    setCommitting(false);
    if (result.success) {
      setTimeout(() => router.replace("/dashboard/intake"), 2000);
    }
  }, [orgId, sessionId, formData, reviewNotes, router]);

  // Reject handler
  const handleReject = useCallback(async () => {
    if (!orgId || !rejectReason.trim()) return;
    setRejecting(true);
    await rejectIntakeSession(sessionId, orgId, rejectReason);
    setRejecting(false);
    router.replace("/dashboard/intake");
  }, [orgId, sessionId, rejectReason, router]);

  // Computed values
  const totalBudget = formData.budgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const ndisError = formData.ndis_number ? validateNdisNumber(formData.ndis_number) : null;
  const startDateError = formData.plan_start_date ? validateDate(formData.plan_start_date) : null;
  const endDateError = formData.plan_end_date ? validateDate(formData.plan_end_date) : null;
  const hasErrors = !!ndisError || !!startDateError || !!endDateError || formData.budgets.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-neutral-500">Session not found</p>
        <Link href="/dashboard/intake" className="text-sm text-emerald-400 hover:text-emerald-300">
          Back to Intake
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/intake"
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Verification Workbench
            </h1>
            <p className="text-xs text-neutral-500">{session.original_filename}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session.confidence_score != null && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-neutral-300 font-medium">
                AI Confidence: <span className="tabular-nums">{session.confidence_score}%</span>
              </span>
            </div>
          )}

          {session.ai_model_used && (
            <span className="text-xs text-neutral-500 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800">
              {session.ai_model_used}
            </span>
          )}
        </div>
      </div>

      {/* Validation Warnings Banner */}
      {session.validation_warnings && session.validation_warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/20 flex-shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              {session.validation_warnings.map((w: string, i: number) => (
                <p key={i} className="text-xs text-amber-300">{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Split Pane Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: PDF Viewer */}
        <div className="w-1/2 border-r border-neutral-800 flex flex-col">
          <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2 flex-shrink-0">
            <FileText className="w-4 h-4 text-red-400" />
            <span className="text-xs text-neutral-400 font-medium">Source Document</span>
          </div>
          <div className="flex-1 bg-neutral-950">
            {pdfUrl ? (
              <embed
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                type="application/pdf"
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-neutral-600">Loading PDF...</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Editable Form */}
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-neutral-400 font-medium flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" />
              AI Extracted Data — Verify & Edit
            </span>
            <span className="text-xs text-neutral-600">
              Total: <span className="text-emerald-400 font-medium tabular-nums">{formatCurrency(totalBudget)}</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Participant Details */}
            <Section title="Participant Details" icon={User}>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="First Name"
                  value={formData.participant_first_name}
                  onChange={(v) => updateField("participant_first_name", v)}
                  placeholder="First name"
                />
                <FormField
                  label="Last Name"
                  value={formData.participant_last_name}
                  onChange={(v) => updateField("participant_last_name", v)}
                  placeholder="Last name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="NDIS Number"
                  icon={Hash}
                  value={formData.ndis_number}
                  onChange={(v) => updateField("ndis_number", v)}
                  error={ndisError}
                  placeholder="123456789"
                />
                <FormField
                  label="Date of Birth"
                  icon={Calendar}
                  value={formData.date_of_birth || ""}
                  onChange={(v) => updateField("date_of_birth", v)}
                  type="date"
                />
              </div>
              <FormField
                label="Primary Disability"
                value={formData.primary_disability || ""}
                onChange={(v) => updateField("primary_disability", v)}
                placeholder="e.g. Intellectual Disability, Autism Spectrum Disorder"
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Support Coordinator"
                  value={formData.support_coordinator_name || ""}
                  onChange={(v) => updateField("support_coordinator_name", v)}
                  placeholder="Name if listed"
                />
                <FormField
                  label="Plan Manager"
                  value={formData.plan_manager_name || ""}
                  onChange={(v) => updateField("plan_manager_name", v)}
                  placeholder="Name if listed"
                />
              </div>
            </Section>

            {/* Plan Dates */}
            <Section title="Plan Period" icon={Calendar}>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Plan Start Date"
                  icon={Calendar}
                  value={formData.plan_start_date}
                  onChange={(v) => updateField("plan_start_date", v)}
                  error={startDateError}
                  type="date"
                />
                <FormField
                  label="Plan End Date"
                  icon={Calendar}
                  value={formData.plan_end_date}
                  onChange={(v) => updateField("plan_end_date", v)}
                  error={endDateError}
                  type="date"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-medium">Plan Management</label>
                <select
                  value={formData.plan_management_type || "NDIA_MANAGED"}
                  onChange={(e) => updateField("plan_management_type", e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-neutral-900 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="NDIA_MANAGED">NDIA Managed</option>
                  <option value="PLAN_MANAGED">Plan Managed</option>
                  <option value="SELF_MANAGED">Self Managed</option>
                </select>
              </div>
            </Section>

            {/* Budgets */}
            <Section title="Funding Budgets" icon={DollarSign} count={formData.budgets.length}>
              {formData.budgets.map((budget, i) => (
                <BudgetRow
                  key={i}
                  budget={budget}
                  index={i}
                  onChange={(f, v) => updateBudget(i, f, v)}
                  onRemove={() => removeBudget(i)}
                />
              ))}
              <button
                onClick={addBudget}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-neutral-700 text-xs text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors w-full justify-center"
              >
                <Plus className="w-3 h-3" /> Add Budget Category
              </button>
              {formData.budgets.length > 0 && (
                <div className="flex justify-end pt-2 border-t border-neutral-800">
                  <span className="text-sm text-neutral-300 font-medium">
                    Total: <span className="text-emerald-400 tabular-nums">{formatCurrency(totalBudget)}</span>
                  </span>
                </div>
              )}
            </Section>

            {/* Goals */}
            <Section title="NDIS Goals" icon={Target} count={formData.goals?.length || 0}>
              {(formData.goals || []).map((goal, i) => (
                <GoalRow
                  key={i}
                  goal={goal}
                  index={i}
                  onChange={(f, v) => updateGoal(i, f, v)}
                  onRemove={() => removeGoal(i)}
                />
              ))}
              <button
                onClick={addGoal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-neutral-700 text-xs text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors w-full justify-center"
              >
                <Plus className="w-3 h-3" /> Add Goal
              </button>
            </Section>

            {/* Review Notes */}
            <div className="space-y-1">
              <label className="text-xs text-neutral-400 font-medium">Review Notes (optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                placeholder="Any notes about this review..."
                className="w-full px-3 py-2 rounded-lg text-sm bg-neutral-900 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none placeholder:text-neutral-600"
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 border-t border-neutral-800 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setShowRejectDialog(true)}
              disabled={committing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>

            <div className="flex items-center gap-3">
              {hasErrors && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Fix validation errors
                </span>
              )}
              <button
                onClick={handleCommit}
                disabled={committing || hasErrors}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {committing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Committing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Approve & Import Client
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Commit Result Toast */}
          <AnimatePresence>
            {commitResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`absolute bottom-16 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl border ${
                  commitResult.success
                    ? "bg-emerald-950 border-emerald-500/30"
                    : "bg-red-950 border-red-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  {commitResult.success ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-300 font-medium">
                        Participant imported successfully! Redirecting...
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-sm text-red-300">{commitResult.error}</span>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reject Dialog */}
          <AnimatePresence>
            {showRejectDialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
                onClick={() => setShowRejectDialog(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
                >
                  <h3 className="text-lg font-medium text-neutral-200 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    Reject Intake Session
                  </h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Provide a reason for rejection. The session can be retried later.
                  </p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    placeholder="Reason for rejection..."
                    className="w-full mt-4 px-3 py-2 rounded-lg text-sm bg-neutral-950 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-red-500/50 resize-none placeholder:text-neutral-600"
                  />
                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => setShowRejectDialog(false)}
                      className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={rejecting || !rejectReason.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject Session
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
