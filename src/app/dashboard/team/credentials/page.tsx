/**
 * @page /dashboard/team/credentials
 * @status COMPLETE
 * @description Team credentials vault with expiry tracking, upload, and verification
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Upload,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  X,
  ChevronDown,
  Calendar,
  User,
  Eye,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  useCredentialsStore,
  useFilteredCredentials,
  getCredentialTypeLabel,
  getExpiryStatus,
  getDaysUntilExpiry,
  type CredentialType,
  type VerificationStatus,
  type CredentialStatusFilter,
  type CreateCredentialParams,
} from "@/lib/credentials-store";
import { useTeamStore } from "@/lib/team-store";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";

/* ── Status Config ─────────────────────────────────────── */

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  verified: { label: "Verified", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  pending: { label: "Pending", icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  expired: { label: "Expired", icon: XCircle, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  expiring: { label: "Expiring Soon", icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

const expiryStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  valid: { label: "Valid", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  expiring: { label: "Expiring Soon", color: "text-amber-400", bg: "bg-amber-500/10" },
  expired: { label: "Expired", color: "text-rose-400", bg: "bg-rose-500/10" },
  unknown: { label: "No Expiry", color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

/* ── Credential Type Lists ────────────────────────────── */

/** Care-sector: prioritise compliance-critical credentials at the top */
const careCredentialTypes: CredentialType[] = [
  "FIRST_AID",
  "NDIS_SCREENING",
  "WWCC",
  "MANUAL_HANDLING",
  "MEDICATION_COMPETENCY",
  "COVID_VACCINATION",
  "POLICE_CHECK",
  "CPR",
  "DRIVERS_LICENSE",
  "OTHER",
];

/** Trades: original ordering */
const tradesCredentialTypes: CredentialType[] = [
  "NDIS_SCREENING",
  "WWCC",
  "FIRST_AID",
  "MANUAL_HANDLING",
  "MEDICATION_COMPETENCY",
  "COVID_VACCINATION",
  "CPR",
  "DRIVERS_LICENSE",
  "POLICE_CHECK",
  "OTHER",
];

/* ── Status Badge ─────────────────────────────────────── */

function StatusBadge({ status }: { status: VerificationStatus }) {
  const config = statusConfig[status] ?? statusConfig.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} border ${config.border}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/* ── Expiry Badge ─────────────────────────────────────── */

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const status = getExpiryStatus(expiryDate);
  const days = getDaysUntilExpiry(expiryDate);
  const config = expiryStatusConfig[status];

  if (status === "unknown") {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
      {status === "expired"
        ? "Expired"
        : status === "expiring"
          ? `${days}d left`
          : expiryDate
            ? new Date(expiryDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
            : "—"}
    </span>
  );
}

/* ── Upload Modal ─────────────────────────────────────── */

function UploadCredentialModal({
  open,
  onClose,
  orgId,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
}) {
  const { t, isCare } = useIndustryLexicon();
  const credentialTypes = isCare ? careCredentialTypes : tradesCredentialTypes;
  const members = useTeamStore((s) => s.members);
  const createCredential = useCredentialsStore((s) => s.createCredential);
  const uploadDocument = useCredentialsStore((s) => s.uploadDocument);

  const [userId, setUserId] = useState("");
  const [credType, setCredType] = useState<CredentialType>("NDIS_SCREENING");
  const [credName, setCredName] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setUserId("");
    setCredType("NDIS_SCREENING");
    setCredName("");
    setIssuedDate("");
    setExpiryDate("");
    setNotes("");
    setFile(null);
    setSaving(false);
  }, []);

  const handleSubmit = async () => {
    if (!userId || !orgId) return;
    setSaving(true);

    const params: CreateCredentialParams = {
      organization_id: orgId,
      user_id: userId,
      credential_type: credType,
      credential_name: credName || undefined,
      issued_date: issuedDate || undefined,
      expiry_date: expiryDate || undefined,
      notes: notes || undefined,
    };

    const cred = await createCredential(params);
    if (cred && file) {
      await uploadDocument(orgId, cred.id, file);
    }

    setSaving(false);
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--card-border)]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Add Credential</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Team Member */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                {isCare ? "Support Worker" : `${t("Team")} Member`}
              </label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="">{isCare ? "Select a support worker..." : "Select a team member..."}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Credential Type */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Credential Type</label>
              <select
                value={credType}
                onChange={(e) => setCredType(e.target.value as CredentialType)}
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                {credentialTypes.map((ct) => (
                  <option key={ct} value={ct}>{getCredentialTypeLabel(ct)}</option>
                ))}
              </select>
            </div>

            {/* Credential Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Certificate Name (optional)</label>
              <input
                value={credName}
                onChange={(e) => setCredName(e.target.value)}
                placeholder="e.g. HLTAID011 Provide First Aid"
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Issued Date</label>
                <input
                  type="date"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Expiry Date</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Document</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-[var(--subtle-bg)] border border-dashed border-[var(--card-border)] rounded-lg text-sm text-[var(--text-muted)] hover:border-[var(--card-border-hover)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Upload className="w-4 h-4" />
                {file ? file.name : "Upload PDF or image"}
              </button>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--card-border)]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!userId || saving}
              className="px-4 py-2 text-sm font-medium bg-[var(--text-primary)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Add Credential"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Credential Row Actions ───────────────────────────── */

function RowActions({
  credentialId,
  documentUrl,
  onDelete,
}: {
  credentialId: string;
  documentUrl: string | null;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-40 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl py-1">
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              <Eye className="w-3.5 h-3.5" />
              View Document
            </a>
          )}
          <button
            onClick={() => {
              onDelete(credentialId);
              setOpen(false);
            }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Summary Cards ────────────────────────────────────── */

function SummaryCards() {
  const allCreds = useCredentialsStore((s) => s.credentials);

  const stats = useMemo(() => {
    const total = allCreds.length;
    const verified = allCreds.filter((c) => c.verification_status === "verified").length;
    const expiring = allCreds.filter((c) => getExpiryStatus(c.expiry_date) === "expiring").length;
    const expired = allCreds.filter((c) => c.verification_status === "expired" || getExpiryStatus(c.expiry_date) === "expired").length;
    const pending = allCreds.filter((c) => c.verification_status === "pending").length;
    return { total, verified, expiring, expired, pending };
  }, [allCreds]);

  const cards = [
    { label: "Total", value: stats.total, icon: Shield, color: "text-[var(--text-primary)]" },
    { label: "Verified", value: stats.verified, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-400" },
    { label: "Expiring", value: stats.expiring, icon: AlertTriangle, color: "text-amber-400" },
    { label: "Expired", value: stats.expired, icon: XCircle, color: "text-rose-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="bg-[var(--card-bg)] border border-[var(--card-border)] r-card p-4" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{card.label}</span>
            </div>
            <p className={`text-2xl font-semibold ${card.color}`}>{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CredentialsPage() {
  const { orgId } = useOrg();
  const { t, isCare } = useIndustryLexicon();
  const credentialTypes = isCare ? careCredentialTypes : tradesCredentialTypes;
  const loading = useCredentialsStore((s) => s.loading);
  const loadFromServer = useCredentialsStore((s) => s.loadFromServer);
  const statusFilter = useCredentialsStore((s) => s.statusFilter);
  const typeFilter = useCredentialsStore((s) => s.typeFilter);
  const memberFilter = useCredentialsStore((s) => s.memberFilter);
  const setStatusFilter = useCredentialsStore((s) => s.setStatusFilter);
  const setTypeFilter = useCredentialsStore((s) => s.setTypeFilter);
  const setMemberFilter = useCredentialsStore((s) => s.setMemberFilter);
  const deleteCredential = useCredentialsStore((s) => s.deleteCredential);
  const members = useTeamStore((s) => s.members);
  const credentials = useFilteredCredentials();

  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  // ── Load credentials on mount ──
  useEffect(() => {
    if (orgId) loadFromServer(orgId);
  }, [orgId, loadFromServer]);

  const searched = useMemo(() => {
    if (!search) return credentials;
    const q = search.toLowerCase();
    return credentials.filter(
      (c) =>
        (c.credential_name?.toLowerCase().includes(q)) ||
        (c.worker_name?.toLowerCase().includes(q)) ||
        getCredentialTypeLabel(c.credential_type).toLowerCase().includes(q)
    );
  }, [credentials, search]);

  const handleDelete = useCallback(async (id: string) => {
    if (confirm("Delete this credential? This cannot be undone.")) {
      await deleteCredential(id);
    }
  }, [deleteCredential]);

  return (
    <>
      <div className="relative flex h-full flex-col bg-[var(--background)]">
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">COMPLIANCE</p>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {isCare ? "Worker Credentials" : "Workforce Credentials"}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {isCare
                  ? "Track support worker certifications, NDIS screenings, and compliance requirements."
                  : `Track and manage ${t("Team").toLowerCase()} member certifications, screenings, and licenses.`}
              </p>
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Credential
            </button>
          </div>

          {/* Summary Cards */}
          <SummaryCards />

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search credentials..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CredentialStatusFilter)}
              className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="rejected">Rejected</option>
              <option value="expiring">Expiring Soon</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as CredentialType | "all")}
              className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="all">All Types</option>
              {credentialTypes.map((ct) => (
                <option key={ct} value={ct}>{getCredentialTypeLabel(ct)}</option>
              ))}
            </select>

            {/* Member Filter */}
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--subtle-bg)] border border-[var(--card-border)] rounded-lg text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] r-card overflow-hidden" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_1fr_140px_140px_120px_110px_40px] gap-4 px-5 py-3 border-b border-[var(--card-border)] text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              <span>{isCare ? "Support Worker" : `${t("Team")} Member`}</span>
              <span>Credential</span>
              <span>Issued</span>
              <span>Expires</span>
              <span>Expiry Status</span>
              <span>Verification</span>
              <span></span>
            </div>

            {/* Loading State */}
            {loading && searched.length === 0 && (
              <div className="px-5 py-12 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full"
                  />
                  Loading credentials...
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && searched.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative flex flex-col items-center justify-center py-24 text-center"
              >
                <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[60px]" />
                <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02]">
                  <Shield size={28} className="text-zinc-600" />
                </div>
                <h3 className="text-[15px] font-medium text-zinc-200">No credentials found</h3>
                <p className="mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-zinc-600">
                  {statusFilter !== "all" || typeFilter !== "all" || memberFilter !== "all"
                    ? "Try adjusting your filters."
                    : isCare
                      ? "Add worker credentials such as NDIS Screening, First Aid, or WWCC to track compliance."
                      : "Add team member credentials to track compliance."}
                </p>
                {statusFilter === "all" && typeFilter === "all" && memberFilter === "all" && (
                  <button
                    onClick={() => setUploadOpen(true)}
                    className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-emerald-500 transition-colors"
                  >
                    <Plus size={14} /> Add First Credential
                  </button>
                )}
              </motion.div>
            )}

            {/* Rows */}
            <AnimatePresence mode="popLayout">
              {searched.map((cred, idx) => {
                const expiryStatus = getExpiryStatus(cred.expiry_date);
                return (
                  <motion.div
                    key={cred.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: idx * 0.02 }}
                    className="grid grid-cols-[1fr_1fr_140px_140px_120px_110px_40px] gap-4 px-5 py-3 items-center border-b border-[var(--card-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Member */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--subtle-bg)] flex items-center justify-center text-xs font-medium text-[var(--text-muted)] shrink-0 overflow-hidden">
                        {cred.worker_avatar ? (
                          <img src={cred.worker_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{cred.worker_name ?? "Unknown"}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{cred.worker_email}</p>
                      </div>
                    </div>

                    {/* Credential */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{getCredentialTypeLabel(cred.credential_type)}</p>
                      {cred.credential_name && (
                        <p className="text-xs text-[var(--text-muted)] truncate">{cred.credential_name}</p>
                      )}
                    </div>

                    {/* Issued */}
                    <span className="text-sm text-[var(--text-secondary)]">
                      {cred.issued_date
                        ? new Date(cred.issued_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </span>

                    {/* Expires */}
                    <span className="text-sm text-[var(--text-secondary)]">
                      {cred.expiry_date
                        ? new Date(cred.expiry_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </span>

                    {/* Expiry Status */}
                    <ExpiryBadge expiryDate={cred.expiry_date} />

                    {/* Verification */}
                    <StatusBadge status={cred.verification_status} />

                    {/* Actions */}
                    <RowActions
                      credentialId={cred.id}
                      documentUrl={cred.document_url}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadCredentialModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        orgId={orgId ?? ""}
      />
    </>
  );
}
