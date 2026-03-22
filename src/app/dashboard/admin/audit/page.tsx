/**
 * @page /dashboard/admin/audit
 * @status COMPLETE
 * @description Admin audit log viewer with session history, export, and copy-link actions
 * @dataSource react-query via fetchAuditSessionsAction
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  FileText,
  Link2,
  Calendar,
  User,
  Copy,
  Check,
  Download,
  Trash2,
  Loader2,
  Clock,
  Eye,
  Lock,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import {
  createAuditSessionAction,
  fetchAuditSessionsAction,
} from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

type ScopeType = "participant" | "organization" | "date_range";

interface AuditSession {
  id: string;
  organization_id: string;
  scope_type: ScopeType;
  scope_participant_id?: string | null;
  scope_date_from?: string | null;
  scope_date_to?: string | null;
  title?: string | null;
  generated_by: string;
  magic_link_token: string;
  expires_at: string;
  access_count: number;
  watermark_text?: string | null;
  status?: string;
  created_at: string;
}

/* ── Formatters ───────────────────────────────────────── */

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ── Copy Button ──────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ── Bento Action Card ────────────────────────────────── */

function ActionCard({
  title,
  description,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-base)] rounded-xl p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border-base)] bg-white/[0.02] ${iconColor}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ── Scope Badge ──────────────────────────────────────── */

function ScopeBadge({ scope }: { scope: ScopeType }) {
  const config: Record<ScopeType, { label: string; color: string }> = {
    participant: { label: "Participant", color: "bg-[#3B82F6]/10 text-[#3B82F6]" },
    organization: { label: "Organization", color: "bg-violet-500/10 text-violet-400" },
    date_range: { label: "Date Range", color: "bg-amber-500/10 text-amber-400" },
  };
  const c = config[scope];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${c.color}`}>
      {c.label}
    </span>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-4 border-b border-[var(--border-base)] animate-pulse">
      <div className="w-36 h-3 rounded bg-white/5" />
      <div className="w-16 h-4 rounded bg-white/5" />
      <div className="w-20 h-3 rounded bg-white/5" />
      <div className="w-24 h-3 rounded bg-white/5" />
      <div className="w-8 h-3 rounded bg-white/5" />
      <div className="w-16 h-6 rounded bg-white/5" />
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function AuditCommandCenterPage() {
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading: loading } = useQuery<AuditSession[]>({
    queryKey: queryKeys.admin.audit(orgId!),
    queryFn: async () => {
      const data = await fetchAuditSessionsAction(orgId!);
      return (data as AuditSession[]) ?? [];
    },
    enabled: !!orgId,
  });

  // Dossier form state
  const [dossierParticipant, setDossierParticipant] = useState("");
  const [dossierDateFrom, setDossierDateFrom] = useState("");
  const [dossierDateTo, setDossierDateTo] = useState("");
  const [dossierGenerating, setDossierGenerating] = useState(false);

  // Audit pack state
  const [packDateFrom, setPackDateFrom] = useState("");
  const [packDateTo, setPackDateTo] = useState("");
  const [packGenerating, setPackGenerating] = useState(false);

  // Magic link state
  const [linkScope, setLinkScope] = useState<ScopeType>("participant");
  const [linkParticipant, setLinkParticipant] = useState("");
  const [linkDateFrom, setLinkDateFrom] = useState("");
  const [linkDateTo, setLinkDateTo] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkGenerating, setLinkGenerating] = useState(false);

  const invalidateAudit = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.audit(orgId!) });

  /* ── Handlers ─── */

  const handleGenerateDossier = async () => {
    if (!orgId || !dossierParticipant) return;
    setDossierGenerating(true);
    try {
      await createAuditSessionAction({
        organization_id: orgId,
        scope_type: "participant",
        scope_participant_id: dossierParticipant,
        scope_date_from: dossierDateFrom || undefined,
        scope_date_to: dossierDateTo || undefined,
        title: `Participant Dossier — ${dossierParticipant.slice(0, 8)}`,
      });
      await invalidateAudit();
      setDossierParticipant("");
      setDossierDateFrom("");
      setDossierDateTo("");
    } catch (err) {
      console.error("Failed to generate dossier:", err);
    } finally {
      setDossierGenerating(false);
    }
  };

  const handleGeneratePack = async () => {
    if (!orgId) return;
    setPackGenerating(true);
    try {
      await createAuditSessionAction({
        organization_id: orgId,
        scope_type: "organization",
        scope_date_from: packDateFrom || undefined,
        scope_date_to: packDateTo || undefined,
        title: "Organization Audit Pack",
      });
      await invalidateAudit();
      setPackDateFrom("");
      setPackDateTo("");
    } catch (err) {
      console.error("Failed to generate audit pack:", err);
    } finally {
      setPackGenerating(false);
    }
  };

  const handleCreateLink = async () => {
    if (!orgId) return;
    setLinkGenerating(true);
    try {
      const session = await createAuditSessionAction({
        organization_id: orgId,
        scope_type: linkScope,
        scope_participant_id: linkScope === "participant" ? linkParticipant : undefined,
        scope_date_from: linkDateFrom || undefined,
        scope_date_to: linkDateTo || undefined,
        title: `Auditor Access — ${linkScope}`,
      });
      const token = (session as AuditSession).magic_link_token;
      const url = `${window.location.origin}/audit/${token}`;
      setGeneratedLink(url);
      await invalidateAudit();
    } catch (err) {
      console.error("Failed to create magic link:", err);
    } finally {
      setLinkGenerating(false);
    }
  };

  const isExpired = (d: string) => new Date(d) < new Date();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(59,130,246,0.03) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#3B82F6] mb-1">AUDIT COMMAND CENTER</p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            Compliance & Audit Tools
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Generate dossiers, audit packs, and secure access links for auditors.
          </p>
        </div>

        {/* Bento Grid — Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Participant Dossier */}
          <ActionCard
            title="Generate Participant Dossier"
            description="Full participant record export"
            icon={User}
            iconColor="text-[#3B82F6]"
          >
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t("Participant")} ID</label>
                <input
                  value={dossierParticipant}
                  onChange={(e) => setDossierParticipant(e.target.value)}
                  placeholder="Select participant..."
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">From</label>
                  <input
                    type="date"
                    value={dossierDateFrom}
                    onChange={(e) => setDossierDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">To</label>
                  <input
                    type="date"
                    value={dossierDateTo}
                    onChange={(e) => setDossierDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
              </div>
              <button
                onClick={handleGenerateDossier}
                disabled={!dossierParticipant || dossierGenerating}
                className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB] w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {dossierGenerating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="w-3.5 h-3.5" /> Generate</>
                )}
              </button>
            </div>
          </ActionCard>

          {/* Card 2: Organization Audit Pack */}
          <ActionCard
            title="Generate Organization Audit Pack"
            description="Full organization compliance bundle"
            icon={Shield}
            iconColor="text-violet-400"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">From</label>
                  <input
                    type="date"
                    value={packDateFrom}
                    onChange={(e) => setPackDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">To</label>
                  <input
                    type="date"
                    value={packDateTo}
                    onChange={(e) => setPackDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                Includes: incidents, care plans, observations, medication records, credential compliance, and shift logs.
              </p>
              <button
                onClick={handleGeneratePack}
                disabled={packGenerating}
                className="stealth-btn-brand bg-violet-500 hover:bg-violet-600 w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {packGenerating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                ) : (
                  <><Shield className="w-3.5 h-3.5" /> Generate Pack</>
                )}
              </button>
            </div>
          </ActionCard>

          {/* Card 3: Auditor Access Link */}
          <ActionCard
            title="Create Auditor Access Link"
            description="Time-limited, read-only magic link"
            icon={Link2}
            iconColor="text-amber-400"
          >
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Scope</label>
                <select
                  value={linkScope}
                  onChange={(e) => {
                    setLinkScope(e.target.value as ScopeType);
                    setGeneratedLink(null);
                  }}
                  className="w-full px-2.5 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                >
                  <option value="participant">{t("Participant")}</option>
                  <option value="organization">Organization</option>
                  <option value="date_range">Date Range</option>
                </select>
              </div>
              {linkScope === "participant" && (
                <div>
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">{t("Participant")} ID</label>
                  <input
                    value={linkParticipant}
                    onChange={(e) => setLinkParticipant(e.target.value)}
                    placeholder="Enter participant ID..."
                    className="w-full px-2.5 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
              )}
              {(linkScope === "date_range" || linkScope === "organization") && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">From</label>
                    <input
                      type="date"
                      value={linkDateFrom}
                      onChange={(e) => setLinkDateFrom(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">To</label>
                    <input
                      type="date"
                      value={linkDateTo}
                      onChange={(e) => setLinkDateTo(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleCreateLink}
                disabled={linkGenerating || (linkScope === "participant" && !linkParticipant)}
                className="stealth-btn-brand bg-amber-500 hover:bg-amber-600 w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {linkGenerating ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                ) : (
                  <><Link2 className="w-3.5 h-3.5" /> Generate Link</>
                )}
              </button>

              {/* Generated Link */}
              <AnimatePresence>
                {generatedLink && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="mt-2"
                  >
                    <label className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">Magic Link (72h expiry)</label>
                    <div className="flex items-center gap-1 border border-[#3B82F6]/30 bg-[#3B82F6]/5 rounded-lg px-3 py-2">
                      <Lock className="w-3 h-3 text-[#3B82F6] shrink-0" />
                      <input
                        readOnly
                        value={generatedLink}
                        className="flex-1 bg-transparent text-xs font-mono text-[#3B82F6] outline-none"
                      />
                      <CopyButton text={generatedLink} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ActionCard>
        </div>

        {/* History Table */}
        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
            Audit Session History
          </h2>
          <div className="bg-[var(--surface-1)] border border-[var(--border-base)] rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-3 border-b border-[var(--border-base)]">
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Title</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Scope</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Generated</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Expires</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] text-center">Views</span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] text-[var(--text-muted)] text-right">Actions</span>
            </div>

            {/* Loading */}
            {loading && sessions.length === 0 && (
              <div>
                {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            )}

            {/* Empty State */}
            {!loading && sessions.length === 0 && (
              <div className="py-16 text-center">
                <Shield className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium text-[var(--text-primary)]">No audit sessions yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs mx-auto">
                  Use the tools above to generate your first audit dossier or access link.
                </p>
              </div>
            )}

            {/* Rows */}
            <AnimatePresence>
              {sessions.map((session, idx) => {
                const expired = isExpired(session.expires_at);
                return (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-4 items-center border-b border-[var(--border-base)] last:border-b-0 hover:bg-white/[0.02] transition-colors ${expired ? "opacity-50" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{session.title || "Untitled Session"}</p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{session.id.slice(0, 12)}…</p>
                    </div>
                    <ScopeBadge scope={session.scope_type} />
                    <span className="text-xs text-[var(--text-muted)]">{fmtDate(session.created_at)}</span>
                    <span className={`text-xs ${expired ? "text-rose-400" : "text-[var(--text-muted)]"}`}>
                      {expired ? "Expired" : fmtDate(session.expires_at)}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)] text-center">{session.access_count}</span>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="p-1.5 rounded-md hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                        title="Revoke access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
