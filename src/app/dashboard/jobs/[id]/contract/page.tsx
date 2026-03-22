/**
 * @page /dashboard/jobs/[id]/contract
 * @status COMPLETE
 * @description Commercial contract builder with SOV lines, variations, and lock workflow
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText, Plus, Trash2, Lock, Check, X, Calendar,
  Loader2, ArrowRight, Send, Shield,
  AlertTriangle, Layers, GitBranch,
  CheckCircle2, ArrowLeft, ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  createCommercialContract, getContractForJob, lockContract,
  getSOVLines, upsertSOVLine, deleteSOVLine, addVariation,
  generateClaim, getClaimsForContract, getClaimWithLines,
  updateClaimLine, calculateClaimSummary, submitClaim,
  certifyClaim, syncClaimToXero,
} from "@/app/actions/aegis-contract";

/* ── Types ─────────────────────────────────────────────────── */

interface Contract {
  id: string;
  job_id: string;
  contract_number?: string;
  client_name?: string;
  project_name?: string;
  total_contract_value: number;
  retention_percentage: number;
  retention_cap_percentage?: number;
  contract_date?: string;
  status: string;
  total_retention_held?: number;
  retention_released?: number;
  created_at: string;
}

interface SOVLine {
  id: string;
  contract_id: string;
  item_code: string;
  description: string;
  scheduled_value: number;
  sort_order: number;
}

interface Claim {
  id: string;
  contract_id: string;
  claim_number: number;
  status: string;
  period_start?: string;
  period_end: string;
  total_completed_to_date?: number;
  retention_to_date?: number;
  total_earned_less_retention?: number;
  less_previous_certificates?: number;
  current_payment_due?: number;
  gross_completed_previously?: number;
  certified_amount?: number;
  certified_by_name?: string;
  xero_invoice_id?: string;
  submitted_at?: string;
  certified_at?: string;
  created_at: string;
}

interface ClaimLine {
  id: string;
  claim_id: string;
  sov_id: string;
  previously_completed: number;
  work_completed_this_period: number;
  materials_stored_this_period: number;
  total_completed_to_date: number;
  percent_complete: number;
  balance_to_finish: number;
  schedule_of_values: {
    item_code: string;
    description: string;
    scheduled_value: number;
  };
}

interface ClaimWithLines extends Claim {
  lines: ClaimLine[];
}

interface Variation {
  id: string;
  description: string;
  value: number;
  variation_ref?: string;
  created_at: string;
}

/* ── Helpers ───────────────────────────────────────────────── */

function fmt(val: number | null | undefined): string {
  const n = Number(val ?? 0);
  return `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}k`;
  return fmt(val);
}

function pct(val: number): string {
  return `${val.toFixed(2)}%`;
}

function dateStr(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

const CLAIM_STATUS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:              { label: "Draft",         bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  SUBMITTED:          { label: "Submitted",     bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  CERTIFIED_FULL:     { label: "Certified",     bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  CERTIFIED_PARTIAL:  { label: "Part Certified",bg: "bg-sky-500/10",     text: "text-sky-400",     border: "border-sky-500/20" },
  INVOICED:           { label: "Invoiced",      bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/20" },
};

const CONTRACT_STATUS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:                   { label: "Draft",                bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  ACTIVE:                  { label: "Active",               bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  PRACTICAL_COMPLETION:    { label: "Practical Completion", bg: "bg-sky-500/10",     text: "text-sky-400",     border: "border-sky-500/20" },
  DLP:                     { label: "DLP",                  bg: "bg-violet-500/10",  text: "text-violet-400",  border: "border-violet-500/20" },
  CLOSED:                  { label: "Closed",               bg: "bg-zinc-500/10",    text: "text-zinc-600",    border: "border-zinc-500/15" },
};

type TabKey = "sov" | "claims" | "variations";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "sov",        label: "Schedule of Values", icon: <Layers size={14} /> },
  { key: "claims",     label: "Progress Claims",    icon: <FileText size={14} /> },
  { key: "variations", label: "Variations",          icon: <GitBranch size={14} /> },
];

const ease = [0.16, 1, 0.3, 1] as const;

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function ContractPage() {
  const params = useParams();
  const jobId = params.id as string;
  const orgId = useAuthStore((s) => s.currentOrg?.id) ?? null;

  /* ── Global state ─────────────────────────────────────────── */
  const [contract, setContract] = useState<Contract | null>(null);
  const [sovLines, setSovLines] = useState<SOVLine[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("sov");
  /* ── Load contract ────────────────────────────────────────── */
  const loadContract = useCallback(async () => {
    if (!orgId || !jobId) return;
    setLoading(true);
    const { data } = await getContractForJob(jobId, orgId);
    setContract(data);
    if (data) {
      const [sovRes, claimsRes] = await Promise.all([
        getSOVLines(data.id, orgId),
        getClaimsForContract(data.id, orgId),
      ]);
      setSovLines(sovRes.data || []);
      setClaims(claimsRes.data || []);
    }
    setLoading(false);
  }, [orgId, jobId]);

  useEffect(() => { loadContract(); }, [loadContract]);

  /* ── Loading / no org guard ───────────────────────────────── */
  if (!orgId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
          <span className="text-[12px] text-zinc-600">Loading contract…</span>
        </div>
      </div>
    );
  }

  /* ── No contract → setup form ────────────────────────────── */
  if (!contract) {
    return <ContractSetup jobId={jobId} orgId={orgId} onCreated={loadContract} />;
  }

  const contractStatus = CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.DRAFT;
  const isLocked = contract.status !== "DRAFT";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <FileText size={16} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
                  {contract.contract_number || "Commercial Contract"}
                </h1>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border ${contractStatus.bg} ${contractStatus.text} ${contractStatus.border}`}>
                  {contractStatus.label}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {contract.client_name || "—"} · Contract Value{" "}
                <span className="font-mono text-zinc-400">{fmt(contract.total_contract_value)}</span>
                {" "}· Retention {contract.retention_percentage}%
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                tab === t.key
                  ? "bg-white/[0.06] text-zinc-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {tab === "sov" && (
            <motion.div key="sov" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease }}>
              <SOVBuilder contract={contract} sovLines={sovLines} setSovLines={setSovLines} orgId={orgId} onRefresh={loadContract} isLocked={isLocked} />
            </motion.div>
          )}
          {tab === "claims" && (
            <motion.div key="claims" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease }}>
              <ProgressClaimsTab contract={contract} claims={claims} setClaims={setClaims} orgId={orgId} onRefresh={loadContract} />
            </motion.div>
          )}
          {tab === "variations" && (
            <motion.div key="variations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease }}>
              <VariationsTab contract={contract} orgId={orgId} onRefresh={loadContract} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CONTRACT SETUP FORM
   ══════════════════════════════════════════════════════════════ */

function ContractSetup({ jobId, orgId, onCreated }: { jobId: string; orgId: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    totalContractValue: "",
    retentionPercentage: "5",
    retentionCapPercentage: "5",
    contractNumber: "",
    clientName: "",
    contractDate: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const tcv = parseFloat(form.totalContractValue);
    if (!tcv || tcv <= 0) { setError("Enter a valid contract value"); return; }
    const rp = parseFloat(form.retentionPercentage);
    if (isNaN(rp) || rp < 0 || rp > 100) { setError("Retention must be 0–100%"); return; }

    setSaving(true);
    setError(null);
    const res = await createCommercialContract({
      orgId,
      jobId,
      totalContractValue: tcv,
      retentionPercentage: rp,
      retentionCapPercentage: parseFloat(form.retentionCapPercentage) || 5,
      contractNumber: form.contractNumber || undefined,
      clientName: form.clientName || undefined,
      contractDate: form.contractDate || undefined,
    });
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onCreated();
  };

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] focus:bg-[rgba(255,255,255,0.02)] transition-all duration-150";
  const labelCls = "block text-[11px] font-medium text-zinc-500 mb-1.5";

  return (
    <div className="flex h-full items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="w-full max-w-lg rounded-xl border border-white/[0.06] bg-zinc-950/60 p-8"
        style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)" }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
            <FileText size={18} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Convert to Commercial Contract</h2>
            <p className="text-[12px] text-zinc-500">Set up AIA-style progress claims, retention &amp; SOV</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Row 1: Value + Retention */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Total Contract Value *</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-mono text-zinc-500">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={form.totalContractValue}
                  onChange={(e) => setForm({ ...form, totalContractValue: e.target.value })}
                  className={`${inputCls} pl-7 font-mono`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Retention %</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={form.retentionPercentage}
                  onChange={(e) => setForm({ ...form, retentionPercentage: e.target.value })}
                  className={`${inputCls} pr-7 font-mono`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500">%</span>
              </div>
            </div>
          </div>

          {/* Row 2: Retention Cap + Contract Number */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Retention Cap %</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={form.retentionCapPercentage}
                  onChange={(e) => setForm({ ...form, retentionCapPercentage: e.target.value })}
                  className={`${inputCls} pr-7 font-mono`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-500">%</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Contract Number</label>
              <input
                type="text"
                placeholder="e.g. CC-2026-001"
                value={form.contractNumber}
                onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Row 3: Client + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Client Name</label>
              <input
                type="text"
                placeholder="Head contractor / client"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Contract Date</label>
              <input
                type="date"
                value={form.contractDate}
                onChange={(e) => setForm({ ...form, contractDate: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-400">
            <AlertTriangle size={12} /> {error}
          </motion.div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
            style={{ borderRadius: "var(--radius-button)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Create Contract
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SOV BUILDER
   ══════════════════════════════════════════════════════════════ */

function SOVBuilder({
  contract, sovLines, setSovLines, orgId, onRefresh, isLocked,
}: {
  contract: Contract;
  sovLines: SOVLine[];
  setSovLines: (lines: SOVLine[]) => void;
  orgId: string;
  onRefresh: () => void;
  isLocked: boolean;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  const sovTotal = useMemo(() => sovLines.reduce((s, l) => s + l.scheduled_value, 0), [sovLines]);
  const variance = useMemo(() => contract.total_contract_value - sovTotal, [contract.total_contract_value, sovTotal]);
  const isBalanced = Math.abs(variance) < 0.01;

  /* ── Add line ─────────────────────────────────────────────── */
  const addLine = async () => {
    const nextCode = `${String(sovLines.length + 1).padStart(3, "0")}`;
    const res = await upsertSOVLine(contract.id, orgId, {
      item_code: nextCode,
      description: "",
      scheduled_value: 0,
      sort_order: sovLines.length,
    });
    if (res.data) setSovLines([...sovLines, res.data]);
  };

  /* ── Update line field ────────────────────────────────────── */
  const updateLine = async (line: SOVLine, field: keyof SOVLine, value: string | number) => {
    const updated = { ...line, [field]: value };
    const idx = sovLines.findIndex((l) => l.id === line.id);
    const next = [...sovLines];
    next[idx] = updated;
    setSovLines(next);

    // Debounce save
    setSaving(line.id);
    await upsertSOVLine(contract.id, orgId, {
      id: line.id,
      item_code: updated.item_code,
      description: updated.description,
      scheduled_value: typeof updated.scheduled_value === "string" ? parseFloat(updated.scheduled_value) || 0 : updated.scheduled_value,
      sort_order: updated.sort_order,
    });
    setSaving(null);
  };

  /* ── Delete line ──────────────────────────────────────────── */
  const removeLine = async (lineId: string) => {
    setSovLines(sovLines.filter((l) => l.id !== lineId));
    await deleteSOVLine(lineId, orgId);
  };

  /* ── Lock & Activate ──────────────────────────────────────── */
  const handleLock = async () => {
    if (!isBalanced) return;
    setLocking(true);
    await lockContract(contract.id, orgId);
    setLocking(false);
    onRefresh();
  };

  const inputCls = "w-full bg-transparent px-2 py-1.5 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:bg-white/[0.02] transition-all";

  return (
    <div className="flex flex-col">
      {/* Table header */}
      <div className="sticky top-0 z-10 grid grid-cols-[80px_1fr_160px_48px] gap-px border-b border-white/[0.06] bg-zinc-950 px-6">
        <div className="py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Code</div>
        <div className="py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Description</div>
        <div className="py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Scheduled Value</div>
        <div />
      </div>

      {/* Lines */}
      <div className="flex-1 px-6">
        <AnimatePresence>
          {sovLines.map((line, i) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease, delay: i * 0.02 }}
              className="group grid grid-cols-[80px_1fr_160px_48px] gap-px border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
            >
              <input
                value={line.item_code}
                onChange={(e) => updateLine(line, "item_code", e.target.value)}
                disabled={isLocked}
                className={`${inputCls} font-mono text-zinc-400`}
                placeholder="001"
              />
              <input
                value={line.description}
                onChange={(e) => updateLine(line, "description", e.target.value)}
                disabled={isLocked}
                className={inputCls}
                placeholder="Enter description…"
              />
              <input
                type="number"
                value={line.scheduled_value}
                onChange={(e) => updateLine(line, "scheduled_value", parseFloat(e.target.value) || 0)}
                disabled={isLocked}
                className={`${inputCls} text-right font-mono`}
                placeholder="0.00"
              />
              <div className="flex items-center justify-center">
                {!isLocked && (
                  <button
                    onClick={() => removeLine(line.id)}
                    className="rounded p-1 text-zinc-700 opacity-0 transition-all group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                {saving === line.id && <Loader2 size={10} className="animate-spin text-zinc-600" />}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add line button */}
        {!isLocked && (
          <button
            onClick={addLine}
            className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
          >
            <Plus size={12} /> Add line item
          </button>
        )}

        {sovLines.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02]">
              <Layers size={20} className="text-zinc-600" />
            </div>
            <h3 className="text-[14px] font-medium text-zinc-300">No schedule of values</h3>
            <p className="mt-1 text-[12px] text-zinc-600">Add line items that make up the total contract value</p>
            {!isLocked && (
              <button
                onClick={addLine}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.1]"
              >
                <Plus size={12} /> Add first item
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      {sovLines.length > 0 && (
        <div className={`sticky bottom-0 z-10 border-t px-6 py-3 transition-colors duration-200 ${
          isBalanced
            ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : "border-rose-500/20 bg-rose-500/[0.04]"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">SOV Total</div>
                <div className={`font-mono text-[14px] font-medium ${isBalanced ? "text-emerald-400" : "text-rose-400"}`}>
                  {fmt(sovTotal)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Contract Value</div>
                <div className="font-mono text-[14px] font-medium text-zinc-300">{fmt(contract.total_contract_value)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Variance</div>
                <div className={`font-mono text-[14px] font-medium ${isBalanced ? "text-emerald-400" : "text-rose-400"}`}>
                  {variance > 0 ? "+" : ""}{fmt(variance)}
                </div>
              </div>
            </div>

            {!isLocked && (
              <button
                onClick={handleLock}
                disabled={!isBalanced || locking}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
                  isBalanced
                    ? "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
                style={{ borderRadius: "var(--radius-button)" }}
              >
                {locking ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Lock &amp; Activate
              </button>
            )}

            {isLocked && (
              <div className="flex items-center gap-1.5 text-[12px] text-emerald-400">
                <CheckCircle2 size={14} /> Locked &amp; Active
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS CLAIMS TAB
   ══════════════════════════════════════════════════════════════ */

function ProgressClaimsTab({
  contract, claims, setClaims, orgId, onRefresh,
}: {
  contract: Contract;
  claims: Claim[];
  setClaims: (claims: Claim[]) => void;
  orgId: string;
  onRefresh: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split("T")[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithLines | null>(null);
  const [loadingClaim, setLoadingClaim] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    const res = await generateClaim(contract.id, orgId, periodEnd);
    if (!res.error) {
      const claimsRes = await getClaimsForContract(contract.id, orgId);
      setClaims(claimsRes.data || []);
    }
    setGenerating(false);
    setShowDatePicker(false);
  };

  const openClaim = async (claimId: string) => {
    setLoadingClaim(claimId);
    const res = await getClaimWithLines(claimId, orgId);
    if (res.data) setSelectedClaim(res.data as ClaimWithLines);
    setLoadingClaim(null);
  };

  return (
    <div className="relative">
      {/* Header actions */}
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            Progress Claims
          </span>
          <span className="ml-2 text-[11px] text-zinc-600">({claims.length})</span>
        </div>

        <div className="relative flex items-center gap-2">
          {showDatePicker && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-transparent px-2 py-1 text-[12px] text-zinc-300 outline-none focus:border-white/[0.15]"
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-medium text-black transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Generate
              </button>
              <button onClick={() => setShowDatePicker(false)} className="rounded p-1 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300">
                <X size={14} />
              </button>
            </motion.div>
          )}

          {!showDatePicker && contract.status !== "DRAFT" && (
            <button
              onClick={() => setShowDatePicker(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-transparent px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.04]"
              style={{ borderRadius: "var(--radius-button)" }}
            >
              <Plus size={12} /> Generate Claim
            </button>
          )}
        </div>
      </div>

      {/* Claims list */}
      {claims.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02]">
            <FileText size={20} className="text-zinc-600" />
          </div>
          <h3 className="text-[14px] font-medium text-zinc-300">No claims yet</h3>
          <p className="mt-1 max-w-xs text-[12px] text-zinc-600">
            {contract.status === "DRAFT"
              ? "Lock the SOV to activate the contract, then generate your first progress claim."
              : "Generate your first progress claim to get started."}
          </p>
        </div>
      ) : (
        <div className="px-6">
          <div className="overflow-hidden rounded-lg border border-white/[0.06]">
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_120px_140px_140px] border-b border-white/[0.06] bg-zinc-950/60">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">#</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Period</div>
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Status</div>
              <div className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Payment Due</div>
              <div className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Certified</div>
            </div>

            {/* Rows */}
            {claims.map((claim, i) => {
              const status = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.DRAFT;
              return (
                <motion.button
                  key={claim.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03, ease }}
                  onClick={() => openClaim(claim.id)}
                  className="group grid w-full grid-cols-[60px_1fr_120px_140px_140px] border-b border-white/[0.04] text-left transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-center px-3 py-3 font-mono text-[12px] text-zinc-400">
                    {loadingClaim === claim.id ? <Loader2 size={12} className="animate-spin text-zinc-500" /> : `#${claim.claim_number}`}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-3">
                    <Calendar size={12} className="text-zinc-600" />
                    <span className="text-[12px] text-zinc-300">{dateStr(claim.period_end)}</span>
                  </div>
                  <div className="flex items-center px-3 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border ${status.bg} ${status.text} ${status.border}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-end px-3 py-3 font-mono text-[12px] text-zinc-200">
                    {fmt(claim.current_payment_due)}
                  </div>
                  <div className="flex items-center justify-end px-3 py-3 font-mono text-[12px] text-zinc-500">
                    {claim.certified_amount ? fmt(claim.certified_amount) : "—"}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Claim Editor slide-over */}
      <AnimatePresence>
        {selectedClaim && (
          <ClaimEditor
            claim={selectedClaim}
            contract={contract}
            orgId={orgId}
            onClose={() => { setSelectedClaim(null); onRefresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CLAIM EDITOR (SLIDE-OVER)
   ══════════════════════════════════════════════════════════════ */

function ClaimEditor({
  claim: initialClaim, contract, orgId, onClose,
}: {
  claim: ClaimWithLines;
  contract: Contract;
  orgId: string;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<ClaimLine[]>(initialClaim.lines);
  const [claim, setClaim] = useState<ClaimWithLines>(initialClaim);
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [certifying, setCertifying] = useState(false);
  const [certifyAmount, setCertifyAmount] = useState("");
  const [showCertify, setShowCertify] = useState(false);
  const [syncing, setSyncing] = useState(false);

  /* ── Client-side reactive summary ─────────────────────────── */
  const summary = useMemo(() => {
    const totalCompletedStored = lines.reduce((s, l) => s + l.total_completed_to_date, 0);
    const retentionRate = contract.retention_percentage / 100;
    const retention = totalCompletedStored * retentionRate;
    const earnedLessRetention = totalCompletedStored - retention;
    const prevCertificates = lines.reduce((s, l) => s + l.previously_completed, 0);
    const grossPrev = prevCertificates;
    const retentionPrev = grossPrev * retentionRate;
    const previousPayments = grossPrev - retentionPrev;
    const currentPaymentDue = earnedLessRetention - previousPayments;

    return {
      totalCompletedStored,
      retention,
      earnedLessRetention,
      previousPayments,
      currentPaymentDue,
    };
  }, [lines, contract.retention_percentage]);

  /* ── Update a claim line (reactive + debounced save) ──────── */
  const updateLineField = useCallback(async (
    lineId: string,
    field: "percent_complete" | "work_completed_this_period" | "materials_stored_this_period",
    rawValue: number,
  ) => {
    setLines((prev) => {
      return prev.map((l) => {
        if (l.id !== lineId) return l;

        const sv = l.schedule_of_values.scheduled_value;
        const prevCompleted = l.previously_completed || 0;
        let work = l.work_completed_this_period;
        let stored = l.materials_stored_this_period;

        if (field === "percent_complete") {
          // Clamp to 0–100
          const pct = Math.min(100, Math.max(0, rawValue));
          const totalNeeded = (pct / 100) * sv;
          work = Math.max(0, totalNeeded - prevCompleted - stored);
        } else if (field === "work_completed_this_period") {
          work = Math.max(0, rawValue);
        } else if (field === "materials_stored_this_period") {
          stored = Math.max(0, rawValue);
        }

        const totalCompleted = prevCompleted + work + stored;
        const pctComplete = sv > 0 ? (totalCompleted / sv) * 100 : 0;
        const balance = sv - totalCompleted;

        return {
          ...l,
          work_completed_this_period: work,
          materials_stored_this_period: stored,
          total_completed_to_date: totalCompleted,
          percent_complete: Math.round(pctComplete * 100) / 100,
          balance_to_finish: balance,
        };
      });
    });

    // Persist to server
    setSavingLine(lineId);
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    const sv = line.schedule_of_values.scheduled_value;
    const prevCompleted = line.previously_completed || 0;
    let workVal = line.work_completed_this_period;
    let storedVal = line.materials_stored_this_period;

    if (field === "percent_complete") {
      const pctClamped = Math.min(100, Math.max(0, rawValue));
      const totalNeeded = (pctClamped / 100) * sv;
      workVal = Math.max(0, totalNeeded - prevCompleted - storedVal);
    } else if (field === "work_completed_this_period") {
      workVal = Math.max(0, rawValue);
    } else if (field === "materials_stored_this_period") {
      storedVal = Math.max(0, rawValue);
    }

    await updateClaimLine(lineId, orgId, {
      work_completed_this_period: workVal,
      materials_stored_this_period: storedVal,
    });
    setSavingLine(null);
  }, [lines, orgId]);

  /* ── Submit claim ─────────────────────────────────────────── */
  const handleSubmit = async () => {
    setSubmitting(true);
    await submitClaim(claim.id, orgId);
    setClaim({ ...claim, status: "SUBMITTED" });
    setSubmitting(false);
  };

  /* ── Certify claim ────────────────────────────────────────── */
  const handleCertify = async () => {
    const amt = parseFloat(certifyAmount);
    if (isNaN(amt) || amt <= 0) return;
    setCertifying(true);
    await certifyClaim(claim.id, orgId, amt, "Certifier");
    setClaim({ ...claim, status: amt < (summary.currentPaymentDue) ? "CERTIFIED_PARTIAL" : "CERTIFIED_FULL", certified_amount: amt });
    setCertifying(false);
    setShowCertify(false);
  };

  /* ── Sync to Xero ─────────────────────────────────────────── */
  const handleSync = async () => {
    setSyncing(true);
    await syncClaimToXero(claim.id, orgId);
    setClaim({ ...claim, status: "INVOICED" });
    setSyncing(false);
  };

  const isEditable = claim.status === "DRAFT";
  const claimStatus = CLAIM_STATUS[claim.status] ?? CLAIM_STATUS.DRAFT;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-white/[0.08] bg-[#0A0A0A] shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-zinc-300">
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold tracking-tight text-zinc-100">
                  Progress Claim #{claim.claim_number}
                </h2>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide border ${claimStatus.bg} ${claimStatus.text} ${claimStatus.border}`}>
                  {claimStatus.label}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Period ending {dateStr(claim.period_end)} · {contract.contract_number}
              </p>
            </div>
          </div>
        </div>

        {/* AIA claim grid */}
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-950/80">
                  <th className="whitespace-nowrap px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-zinc-600">Item</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-600">Scheduled Value</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-600">Previously Claimed</th>
                  <th className="whitespace-nowrap px-3 py-2 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-600">% Complete</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-600">Work This Period</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-600">Materials Stored</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-600">Total Completed</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-[9px] font-bold uppercase tracking-widest text-zinc-600">Balance to Finish</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const sv = line.schedule_of_values.scheduled_value;
                  const overBilled = line.total_completed_to_date > sv;
                  const cellGlow = overBilled ? "ring-1 ring-rose-500/40 bg-rose-500/[0.06]" : "";

                  return (
                    <tr key={line.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.015]">
                      {/* Item description */}
                      <td className="px-3 py-2">
                        <div className="text-[12px] text-zinc-300">{line.schedule_of_values.description || "—"}</div>
                        <div className="font-mono text-[10px] text-zinc-600">{line.schedule_of_values.item_code}</div>
                      </td>

                      {/* Scheduled Value — read-only */}
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-zinc-400">
                        {fmt(sv)}
                      </td>

                      {/* Previously Claimed — read-only */}
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-zinc-500">
                        {fmt(line.previously_completed)}
                      </td>

                      {/* % Complete — editable */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          value={Math.round(line.percent_complete * 100) / 100}
                          onChange={(e) => updateLineField(line.id, "percent_complete", parseFloat(e.target.value) || 0)}
                          disabled={!isEditable}
                          className={`w-full rounded border border-white/[0.06] bg-transparent px-2 py-1 text-center font-mono text-[12px] text-zinc-200 outline-none transition-all focus:border-emerald-500/40 focus:bg-white/[0.02] disabled:text-zinc-500 ${cellGlow}`}
                        />
                      </td>

                      {/* Work This Period — editable */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.work_completed_this_period}
                          onChange={(e) => updateLineField(line.id, "work_completed_this_period", parseFloat(e.target.value) || 0)}
                          disabled={!isEditable}
                          className={`w-full rounded border border-white/[0.06] bg-transparent px-2 py-1 text-right font-mono text-[12px] text-zinc-200 outline-none transition-all focus:border-emerald-500/40 focus:bg-white/[0.02] disabled:text-zinc-500 ${cellGlow}`}
                        />
                      </td>

                      {/* Materials Stored — editable */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.materials_stored_this_period}
                          onChange={(e) => updateLineField(line.id, "materials_stored_this_period", parseFloat(e.target.value) || 0)}
                          disabled={!isEditable}
                          className={`w-full rounded border border-white/[0.06] bg-transparent px-2 py-1 text-right font-mono text-[12px] text-zinc-200 outline-none transition-all focus:border-emerald-500/40 focus:bg-white/[0.02] disabled:text-zinc-500 ${cellGlow}`}
                        />
                      </td>

                      {/* Total Completed — read-only */}
                      <td className={`px-3 py-2 text-right font-mono text-[12px] ${overBilled ? "text-rose-400" : "text-zinc-300"}`}>
                        {fmt(line.total_completed_to_date)}
                        {savingLine === line.id && <Loader2 size={10} className="ml-1 inline animate-spin text-zinc-600" />}
                      </td>

                      {/* Balance to Finish — read-only */}
                      <td className={`px-3 py-2 text-right font-mono text-[12px] ${line.balance_to_finish < 0 ? "text-rose-400" : "text-zinc-500"}`}>
                        {fmt(line.balance_to_finish)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* AIA Summary */}
          <div className="mx-6 my-6 rounded-xl border border-white/[0.06] bg-zinc-950/60 p-6" style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)" }}>
            <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              AIA Summary — Application for Payment
            </div>

            <div className="space-y-3">
              <SummaryRow label="1. Total Completed & Stored to Date" value={summary.totalCompletedStored} />
              <SummaryRow label={`2. Less Retention (${contract.retention_percentage}%)`} value={-summary.retention} negative />
              <div className="border-t border-white/[0.06] pt-3">
                <SummaryRow label="3. Total Earned Less Retention" value={summary.earnedLessRetention} />
              </div>
              <SummaryRow label="4. Less Previous Certificates" value={-summary.previousPayments} negative />

              <div className="border-t border-emerald-500/20 pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-zinc-200">5. CURRENT PAYMENT DUE</span>
                  <span className="font-mono text-xl font-bold tracking-tight text-emerald-400">
                    {fmt(summary.currentPaymentDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel footer / actions */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-3">
          <div className="flex items-center gap-2">
            {isEditable && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit Claim
              </button>
            )}

            {(claim.status === "SUBMITTED" || claim.status === "DRAFT") && (
              <>
                {showCertify ? (
                  <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-zinc-500">$</span>
                      <input
                        type="number"
                        placeholder="Amount"
                        value={certifyAmount}
                        onChange={(e) => setCertifyAmount(e.target.value)}
                        className="w-32 rounded-lg border border-white/[0.08] bg-transparent py-1.5 pl-6 pr-2 font-mono text-[12px] text-zinc-200 outline-none focus:border-white/[0.15]"
                      />
                    </div>
                    <button
                      onClick={handleCertify}
                      disabled={certifying}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-medium text-black transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
                      style={{ borderRadius: "var(--radius-button)" }}
                    >
                      {certifying ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                      Certify
                    </button>
                    <button onClick={() => setShowCertify(false)} className="rounded p-1 text-zinc-500 hover:text-zinc-300">
                      <X size={14} />
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => { setCertifyAmount(String(Math.round(summary.currentPaymentDue * 100) / 100)); setShowCertify(true); }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-transparent px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.04]"
                    style={{ borderRadius: "var(--radius-button)" }}
                  >
                    <Shield size={12} /> Certify
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(claim.status === "CERTIFIED_FULL" || claim.status === "CERTIFIED_PARTIAL") && !claim.xero_invoice_id && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[12px] font-medium text-sky-400 transition-colors hover:bg-sky-500/20 disabled:opacity-50"
                style={{ borderRadius: "var(--radius-button)" }}
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                Sync to Xero
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              style={{ borderRadius: "var(--radius-button)" }}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Summary Row ─────────────────────────────────────────────── */

function SummaryRow({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-zinc-400">{label}</span>
      <span className={`font-mono text-[13px] font-medium ${negative ? "text-zinc-500" : "text-zinc-200"}`}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   VARIATIONS TAB
   ══════════════════════════════════════════════════════════════ */

function VariationsTab({
  contract, orgId, onRefresh,
}: {
  contract: Contract;
  orgId: string;
  onRefresh: () => void;
}) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", value: "", ref: "" });
  const [saving, setSaving] = useState(false);

  /* Note: Variations could be fetched from SOV or a variations table.
     For now we use addVariation which calls the RPC. We'll show a minimal UI. */

  const handleAdd = async () => {
    const val = parseFloat(form.value);
    if (!form.description.trim() || isNaN(val)) return;

    setSaving(true);
    const res = await addVariation(contract.id, orgId, form.description, val, form.ref || undefined);
    if (!res.error) {
      setVariations([...variations, {
        id: res.data?.id || crypto.randomUUID(),
        description: form.description,
        value: val,
        variation_ref: form.ref || undefined,
        created_at: new Date().toISOString(),
      }]);
      setForm({ description: "", value: "", ref: "" });
      setShowForm(false);
      onRefresh();
    }
    setSaving(false);
  };

  const inputCls = "w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[rgba(255,255,255,0.15)] focus:bg-[rgba(255,255,255,0.02)] transition-all duration-150";

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          Variations &amp; Change Orders
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-transparent px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.04]"
          style={{ borderRadius: "var(--radius-button)" }}
        >
          <Plus size={12} /> Add Variation
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease }}
            className="overflow-hidden"
          >
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-zinc-950/60 p-4" style={{ boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.05)" }}>
              <div className="grid grid-cols-[1fr_120px_100px] gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500">Description *</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Additional scope, change order…"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500">Value *</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-zinc-500">$</span>
                    <input
                      type="number"
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      placeholder="0.00"
                      className={`${inputCls} pl-7 font-mono`}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-zinc-500">Ref</label>
                  <input
                    value={form.ref}
                    onChange={(e) => setForm({ ...form, ref: e.target.value })}
                    placeholder="VO-01"
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                  style={{ borderRadius: "var(--radius-button)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.description.trim() || !form.value}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50"
                  style={{ borderRadius: "var(--radius-button)" }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add Variation
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variations list */}
      {variations.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02]">
            <GitBranch size={20} className="text-zinc-600" />
          </div>
          <h3 className="text-[14px] font-medium text-zinc-300">No variations</h3>
          <p className="mt-1 text-[12px] text-zinc-600">Add variations to adjust the contract scope and value</p>
        </div>
      )}

      {variations.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <div className="grid grid-cols-[80px_1fr_120px_100px] border-b border-white/[0.06] bg-zinc-950/60">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Ref</div>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Description</div>
            <div className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Value</div>
            <div className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Date</div>
          </div>
          {variations.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, delay: i * 0.03, ease }}
              className="grid grid-cols-[80px_1fr_120px_100px] border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center px-3 py-2.5 font-mono text-[11px] text-zinc-500">{v.variation_ref || "—"}</div>
              <div className="flex items-center px-3 py-2.5 text-[12px] text-zinc-300">{v.description}</div>
              <div className={`flex items-center justify-end px-3 py-2.5 font-mono text-[12px] ${v.value >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {v.value >= 0 ? "+" : ""}{fmt(v.value)}
              </div>
              <div className="flex items-center justify-end px-3 py-2.5 text-[11px] text-zinc-600">{dateStr(v.created_at)}</div>
            </motion.div>
          ))}

          {/* Variation total */}
          <div className="flex items-center justify-between bg-zinc-950/80 px-3 py-2">
            <span className="text-[11px] font-medium text-zinc-500">Net Variation</span>
            <span className={`font-mono text-[13px] font-medium ${
              variations.reduce((s, v) => s + v.value, 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}>
              {fmt(variations.reduce((s, v) => s + v.value, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
