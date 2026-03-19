"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  X,
  Lock,
  Download,
  Send,
  RefreshCw,
  Calendar,
  User,
  BookOpen,
  WifiOff,
  ChevronRight,
} from "lucide-react";
import {
  createReview,
  getReviews,
  getReviewDetail,
  getReviewDashboardStats,
  startSynthesis,
  saveSynthesisResult,
  updateReviewContent,
  submitForApproval,
  finalizeAndGeneratePdf,
  getCitations,
  type PlanReview,
  type PlanReviewStatus,
  type ReviewCitation,
  type ReviewDashboardStats,
  type SynthesisContext,
} from "@/app/actions/rosetta-synthesis";
import { useAuthStore } from "@/lib/auth-store";

/* ══════════════════════════════════════════════════════════════
   Constants & Config
   ══════════════════════════════════════════════════════════════ */

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

const STATUS_CONFIG: Record<
  PlanReviewStatus,
  { label: string; color: string; bg: string; border: string; dot: string; pulse?: boolean }
> = {
  GENERATING: {
    label: "Generating",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    pulse: true,
  },
  DRAFT: {
    label: "Draft",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
  },
  PENDING_APPROVAL: {
    label: "Pending Approval",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  FINALIZED: {
    label: "Finalized",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
};

const MOOD_COLORS: Record<string, { bg: string; text: string }> = {
  happy: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  content: { bg: "bg-blue-500/10", text: "text-blue-400" },
  neutral: { bg: "bg-zinc-500/10", text: "text-zinc-400" },
  anxious: { bg: "bg-amber-500/10", text: "text-amber-400" },
  agitated: { bg: "bg-orange-500/10", text: "text-orange-400" },
  distressed: { bg: "bg-rose-500/10", text: "text-rose-400" },
  withdrawn: { bg: "bg-violet-500/10", text: "text-violet-400" },
};

const AUTO_SAVE_INTERVAL_MS = 5000;
const CITATION_REGEX = /\{\{cite:([A-Za-z0-9_-]+)\}\}/g;

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateCompact(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
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

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

/** Parse {{cite:NOTE_ID}} markers from markdown and return unique note IDs */
function extractCitationIds(markdown: string): string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(CITATION_REGEX.source, "g");
  while ((match = re.exec(markdown)) !== null) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

/* ══════════════════════════════════════════════════════════════
   Subcomponents
   ══════════════════════════════════════════════════════════════ */

/* ── StatusBadge ─────────────────────────────────────────── */

function StatusBadge({ status }: { status: PlanReviewStatus }) {
  const c = STATUS_CONFIG[status];
  if (!c) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full border",
        c.bg,
        c.color,
        c.border,
        c.pulse && "animate-pulse",
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot, c.pulse && "animate-pulse")} />
      {c.label}
    </span>
  );
}

/* ── TelemetryCard ───────────────────────────────────────── */

function TelemetryCard({
  label,
  value,
  icon: Icon,
  color,
  pulse,
}: {
  label: string;
  value: number;
  icon: typeof Sparkles;
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
        pulse && value > 0 && "animate-pulse border-amber-500/30",
      )}
    >
      {pulse && value > 0 && (
        <div className="absolute inset-0 bg-amber-500/[0.03] pointer-events-none" />
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

/* ── TelemetryRibbon ─────────────────────────────────────── */

function TelemetryRibbon({ stats }: { stats: ReviewDashboardStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl border border-white/[0.04] bg-zinc-950/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const metrics: Array<{
    label: string;
    value: number;
    icon: typeof Sparkles;
    color: string;
    pulse?: boolean;
  }> = [
    { label: "Total Reviews", value: stats.total, icon: BookOpen, color: "text-zinc-300" },
    { label: "Generating", value: stats.generating, icon: Sparkles, color: "text-amber-400", pulse: true },
    { label: "Drafts", value: stats.draft, icon: FileText, color: "text-blue-400" },
    { label: "Pending Approval", value: stats.pending_approval, icon: Clock, color: "text-amber-400" },
    { label: "Finalized", value: stats.finalized, icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 mb-6">
      {metrics.map((m) => (
        <TelemetryCard key={m.label} {...m} />
      ))}
    </div>
  );
}

/* ── Modal Shell ─────────────────────────────────────────── */

function ModalShell({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE_IN_OUT }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className={cn(
              "relative w-full rounded-2xl border border-white/[0.06] bg-[#0C0C0C] p-6 shadow-2xl",
              maxWidth,
            )}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Citation Badge (inline in rendered markdown) ────────── */

function CitationBadge({
  index,
  citationMap,
  onHover,
  onClick,
}: {
  index: number;
  citationMap: Map<number, ReviewCitation>;
  onHover: (citation: ReviewCitation | null) => void;
  onClick: (noteId: string) => void;
}) {
  const citation = citationMap.get(index);
  return (
    <sup
      className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer font-mono text-[11px] hover:bg-emerald-500/20 transition-colors relative inline-block"
      onMouseEnter={() => citation && onHover(citation)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        if (citation?.progress_note_id) {
          onClick(citation.progress_note_id);
        }
      }}
    >
      [{index}]
    </sup>
  );
}

/* ── CitationTooltip ─────────────────────────────────────── */

function CitationTooltip({ citation }: { citation: ReviewCitation | null }) {
  if (!citation) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15, ease: EASE_OUT }}
      className="fixed z-[70] max-w-sm rounded-xl border border-white/[0.06] bg-[#0C0C0C] p-3 shadow-2xl pointer-events-none"
      style={{ bottom: "10%", left: "50%", transform: "translateX(-50%)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
          [{citation.citation_index}]
        </span>
        <span className="text-[10px] font-mono text-zinc-500">
          {formatDate(citation.source_date)}
        </span>
        {citation.source_worker_name && (
          <span className="text-[10px] text-zinc-500">
            — {citation.source_worker_name}
          </span>
        )}
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">
        {citation.source_text_snapshot}
      </p>
    </motion.div>
  );
}

/* ── MoodBadge ───────────────────────────────────────────── */

function MoodBadge({ mood }: { mood: string | null }) {
  if (!mood) return null;
  const config = MOOD_COLORS[mood.toLowerCase()] ?? MOOD_COLORS.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-md capitalize",
        config.bg,
        config.text,
      )}
    >
      {mood}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   Create Review Modal
   ══════════════════════════════════════════════════════════════ */

function CreateReviewModal({
  open,
  onClose,
  orgId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCreated: (review: PlanReview) => void;
}) {
  const [participantId, setParticipantId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!participantId.trim()) {
        setError("Participant ID is required");
        return;
      }
      if (!startDate || !endDate) {
        setError("Start and end dates are required");
        return;
      }
      if (new Date(startDate) >= new Date(endDate)) {
        setError("Start date must be before end date");
        return;
      }

      setCreating(true);
      try {
        const result = await createReview(orgId, participantId.trim(), startDate, endDate);
        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          onCreated(result.data);
          setParticipantId("");
          setStartDate("");
          setEndDate("");
          onClose();
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to create";
        setError(message);
      } finally {
        setCreating(false);
      }
    },
    [orgId, participantId, startDate, endDate, onCreated, onClose],
  );

  return (
    <ModalShell open={open} onClose={onClose} title="New Plan Review">
      <form onSubmit={handleCreate} className="space-y-4">
        {/* Participant ID */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <User size={11} />
            Participant ID
            <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            placeholder="UUID of participant profile"
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 font-mono outline-none placeholder:text-zinc-600 focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Calendar size={11} />
              Start Date
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Calendar size={11} />
              End Date
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE_IN_OUT }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertTriangle size={14} />
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              creating
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25",
            )}
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            Create Review
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   Finalize Confirmation Modal
   ══════════════════════════════════════════════════════════════ */

function FinalizeModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <ModalShell open={open} onClose={onClose} title="Finalize & Mint PDF">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
          <Lock size={16} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-amber-300 font-medium">
              Are you sure? This will lock the document.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Once finalized, the review content will become read-only. An official PDF
              will be generated and stored in the document vault. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all",
              loading
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25",
            )}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Lock size={12} />
            )}
            Finalize & Lock
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   Insufficient Data Error Modal
   ══════════════════════════════════════════════════════════════ */

function InsufficientDataModal({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: string;
}) {
  return (
    <ModalShell open={open} onClose={onClose} title="Insufficient Data">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/[0.06] border border-rose-500/15">
          <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
          <p className="text-sm text-rose-300 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ══════════════════════════════════════════════════════════════
   Review Library Card
   ══════════════════════════════════════════════════════════════ */

function ReviewCard({
  review,
  onClick,
  index,
}: {
  review: PlanReview;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: EASE_OUT,
        delay: Math.min(index * 0.04, 0.4),
      }}
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-white/[0.04] bg-zinc-950/40 p-5 cursor-pointer hover:border-white/[0.08] hover:bg-zinc-950/60 transition-all duration-200"
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <div className="relative space-y-3">
        {/* Top row: name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
              {review.participant_name || "Unknown Participant"}
            </h3>
            {review.participant_ndis_number && (
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                NDIS: {review.participant_ndis_number}
              </p>
            )}
          </div>
          <StatusBadge status={review.status} />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Calendar size={11} className="shrink-0" />
          <span className="font-mono">
            {formatDateCompact(review.review_start_date)} — {formatDateCompact(review.review_end_date)}
          </span>
        </div>

        {/* Footer: notes count + chevron */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {review.total_notes_ingested > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-md">
                <FileText size={10} />
                {review.total_notes_ingested} notes
              </span>
            )}
            {review.total_goals_covered > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-md">
                <BookOpen size={10} />
                {review.total_goals_covered} goals
              </span>
            )}
          </div>
          <ChevronRight
            size={14}
            className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all"
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Evidence Vault — Right Pane
   ══════════════════════════════════════════════════════════════ */

function EvidenceVault({
  notes,
  highlightedNoteId,
  citedNoteIds,
  citationIndexMap,
  searchQuery,
  onSearchChange,
}: {
  notes: SynthesisContext["progress_notes"];
  highlightedNoteId: string | null;
  citedNoteIds: Set<string>;
  citationIndexMap: Map<string, number>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const vaultRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll highlighted note into view
  useEffect(() => {
    if (!highlightedNoteId) return;
    const el = noteRefs.current.get(highlightedNoteId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedNoteId]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        (n.content?.toLowerCase().includes(q)) ||
        (n.summary?.toLowerCase().includes(q)) ||
        (n.worker_name?.toLowerCase().includes(q)) ||
        (n.observations?.toLowerCase().includes(q)),
    );
  }, [notes, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Evidence Vault
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-md">
            {notes.length} notes
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-lg border border-white/[0.04] bg-white/[0.02] pl-8 pr-3 py-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-emerald-500/30 transition-colors"
          />
        </div>
      </div>

      {/* Notes list */}
      <div ref={vaultRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
            <FileText size={20} className="mb-2 opacity-40" />
            <p className="text-xs">
              {searchQuery ? "No matching notes" : "No progress notes in range"}
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredNotes.map((note) => {
              const isHighlighted = highlightedNoteId === note.id;
              const isCited = citedNoteIds.has(note.id);
              const citIndex = citationIndexMap.get(note.id);

              return (
                <div
                  key={note.id}
                  ref={(el) => {
                    if (el) noteRefs.current.set(note.id, el);
                  }}
                  className={cn(
                    "relative rounded-lg border p-3 transition-all duration-300",
                    isHighlighted
                      ? "border-emerald-500/40 bg-emerald-500/[0.06] shadow-lg shadow-emerald-500/5"
                      : "border-white/[0.03] bg-white/[0.01] hover:border-white/[0.06] hover:bg-white/[0.02]",
                  )}
                >
                  {/* Citation index badge */}
                  {isCited && citIndex !== undefined && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-emerald-400">
                        {citIndex}
                      </span>
                    </div>
                  )}

                  {/* Date + Worker */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                      {formatDate(note.date)}
                    </span>
                    {note.worker_name && (
                      <>
                        <span className="text-zinc-700">·</span>
                        <span className="text-[10px] text-zinc-500 truncate">
                          {note.worker_name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Content snippet (3 lines) */}
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                    {note.content || note.summary || note.observations || "No content"}
                  </p>

                  {/* Mood badge */}
                  {note.participant_mood && (
                    <div className="mt-2">
                      <MoodBadge mood={note.participant_mood} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   The Canvas — Left Pane (Content Editor/Viewer)
   ══════════════════════════════════════════════════════════════ */

function TheCanvas({
  review,
  context,
  citations,
  citationMap,
  onStartSynthesis,
  onContentChange,
  onCitationHover,
  onCitationClick,
  synthesisStarting,
  streamingText,
  isStreaming,
  sseError,
}: {
  review: PlanReview;
  context: SynthesisContext | null;
  citations: ReviewCitation[];
  citationMap: Map<number, ReviewCitation>;
  onStartSynthesis: () => void;
  onContentChange: (md: string) => void;
  onCitationHover: (c: ReviewCitation | null) => void;
  onCitationClick: (noteId: string) => void;
  synthesisStarting: boolean;
  streamingText: string;
  isStreaming: boolean;
  sseError: string | null;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const markdown = review.ai_generated_markdown ?? "";
  const status = review.status;

  // Render markdown with citation badges
  const renderedContent = useMemo(() => {
    const source = status === "GENERATING" ? streamingText : markdown;
    if (!source) return null;

    // Split by citation markers and build React nodes
    const parts: Array<string | { noteId: string; index: number }> = [];
    let lastIndex = 0;
    const re = new RegExp(CITATION_REGEX.source, "g");
    let match: RegExpExecArray | null;

    // Build a citation-index-to-noteId map for numbering
    const citationIds = extractCitationIds(source);
    const noteIdToIndex = new Map<string, number>();
    citationIds.forEach((id, i) => noteIdToIndex.set(id, i + 1));

    while ((match = re.exec(source)) !== null) {
      if (match.index > lastIndex) {
        parts.push(source.slice(lastIndex, match.index));
      }
      const noteId = match[1];
      const idx = noteIdToIndex.get(noteId) ?? 0;
      parts.push({ noteId, index: idx });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < source.length) {
      parts.push(source.slice(lastIndex));
    }

    return parts;
  }, [markdown, streamingText, status]);

  // Simple markdown-to-JSX renderer
  const renderMarkdownLine = useCallback(
    (text: string, key: string) => {
      // Headings
      if (text.startsWith("### ")) {
        return (
          <h3 key={key} className="text-base font-semibold text-zinc-100 mt-6 mb-2">
            {text.slice(4)}
          </h3>
        );
      }
      if (text.startsWith("## ")) {
        return (
          <h2 key={key} className="text-lg font-bold text-zinc-50 mt-8 mb-3">
            {text.slice(3)}
          </h2>
        );
      }
      if (text.startsWith("# ")) {
        return (
          <h1 key={key} className="text-xl font-bold text-white mt-8 mb-3">
            {text.slice(2)}
          </h1>
        );
      }
      // Bold
      const processed = text.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-zinc-100 font-semibold">$1</strong>',
      );
      // Bullet
      if (text.startsWith("- ") || text.startsWith("* ")) {
        return (
          <li
            key={key}
            className="text-sm text-zinc-300 leading-relaxed ml-4 list-disc"
            dangerouslySetInnerHTML={{ __html: processed.slice(2) }}
          />
        );
      }
      // Empty line
      if (!text.trim()) return <div key={key} className="h-3" />;
      // Paragraph
      return (
        <p
          key={key}
          className="text-sm text-zinc-300 leading-relaxed mb-2"
          dangerouslySetInnerHTML={{ __html: processed }}
        />
      );
    },
    [],
  );

  // Editable state (for DRAFT / PENDING_APPROVAL)
  const isEditable = status === "DRAFT" || status === "PENDING_APPROVAL";
  const isFinalized = status === "FINALIZED";

  const handleInput = useCallback(() => {
    if (editorRef.current && isEditable) {
      onContentChange(editorRef.current.innerText);
    }
  }, [isEditable, onContentChange]);

  // ── No AI content yet: Big CTA ──
  if (!markdown && !isStreaming && status !== "GENERATING") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-center space-y-6"
        >
          <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sparkles size={32} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">
              Ready to Synthesize
            </h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
              The AI engine will analyze all progress notes and goal observations in
              the date range to generate a comprehensive end-of-plan review with
              cited evidence.
            </p>
          </div>
          {context && (
            <div className="flex items-center justify-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                <FileText size={12} />
                {context.note_count} notes
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                <BookOpen size={12} />
                {context.goal_count} goals
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onStartSynthesis}
            disabled={synthesisStarting}
            className={cn(
              "inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all",
              synthesisStarting
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/10",
            )}
          >
            {synthesisStarting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Synthesize Report
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Streaming / Generated content ──
  return (
    <div className="flex flex-col h-full">
      {/* Streaming indicator */}
      {(isStreaming || status === "GENERATING") && (
        <div className="shrink-0 flex items-center gap-2 px-5 py-2 bg-emerald-500/[0.04] border-b border-emerald-500/10">
          <Sparkles size={13} className="text-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-emerald-400">
            AI is synthesizing your report…
          </span>
          <Loader2 size={11} className="text-emerald-400 animate-spin" />
        </div>
      )}

      {/* SSE error banner */}
      {sseError && (
        <div className="shrink-0 flex items-center gap-2 px-5 py-2 bg-amber-500/[0.06] border-b border-amber-500/15">
          <WifiOff size={13} className="text-amber-400" />
          <span className="text-[11px] font-medium text-amber-400">{sseError}</span>
        </div>
      )}

      {/* Finalized lock banner */}
      {isFinalized && (
        <div className="shrink-0 flex items-center gap-2 px-5 py-2 bg-emerald-500/[0.04] border-b border-emerald-500/10">
          <Lock size={13} className="text-emerald-400" />
          <span className="text-[11px] font-medium text-emerald-400">
            Document is finalized and locked
          </span>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {isEditable && !isStreaming ? (
          /* Editable div */
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className="prose prose-invert prose-sm max-w-none text-zinc-300 leading-relaxed focus:outline-none min-h-[400px]"
            dangerouslySetInnerHTML={{
              __html: markdown
                .replace(/\n/g, "<br/>")
                .replace(
                  /\{\{cite:([A-Za-z0-9_-]+)\}\}/g,
                  (_, noteId: string) => {
                    const citationIds = extractCitationIds(markdown);
                    const idx = citationIds.indexOf(noteId) + 1;
                    return `<sup class="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer font-mono text-[11px] hover:bg-emerald-500/20 transition-colors" data-cite-note="${noteId}" data-cite-index="${idx}">[${idx}]</sup>`;
                  },
                ),
            }}
          />
        ) : (
          /* Read-only rendered content */
          <div className="space-y-0">
            {renderedContent?.map((part, i) => {
              if (typeof part === "string") {
                return part.split("\n").map((line, j) =>
                  renderMarkdownLine(line, `${i}-${j}`),
                );
              }
              return (
                <CitationBadge
                  key={`cite-${i}`}
                  index={part.index}
                  citationMap={citationMap}
                  onHover={onCitationHover}
                  onClick={onCitationClick}
                />
              );
            })}
            {/* Blinking cursor for streaming */}
            {(isStreaming || status === "GENERATING") && (
              <span className="inline-block w-[2px] h-4 bg-emerald-400 animate-pulse ml-0.5 -mb-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Synthesis Studio — Full Split-Pane View
   ══════════════════════════════════════════════════════════════ */

function SynthesisStudio({
  reviewId,
  orgId,
  onBack,
}: {
  reviewId: string;
  orgId: string;
  onBack: () => void;
}) {
  // ── State ──
  const [review, setReview] = useState<(PlanReview & { context?: SynthesisContext }) | null>(null);
  const [citations, setCitations] = useState<ReviewCitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SSE streaming
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sseError, setSseError] = useState<string | null>(null);
  const [synthesisStarting, setSynthesisStarting] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const synthesisStartTimeRef = useRef<number>(0);

  // Modals
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMsg, setErrorModalMsg] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Auto-save
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const pendingContent = useRef<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evidence vault
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);
  const [vaultSearch, setVaultSearch] = useState("");

  // Citation tooltip
  const [hoveredCitation, setHoveredCitation] = useState<ReviewCitation | null>(null);

  // ── Load review data ──
  const loadReview = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewRes, citRes] = await Promise.all([
        getReviewDetail(orgId, reviewId),
        getCitations(reviewId),
      ]);
      if (reviewRes.error) {
        setError(reviewRes.error);
      } else if (reviewRes.data) {
        setReview(reviewRes.data);
        // If currently generating and we have content, show it
        if (reviewRes.data.status === "GENERATING" && reviewRes.data.ai_generated_markdown) {
          setStreamingText(reviewRes.data.ai_generated_markdown);
        }
      }
      if (citRes.data) setCitations(citRes.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [orgId, reviewId]);

  useEffect(() => {
    loadReview();
    return () => {
      // Cleanup SSE on unmount
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [loadReview]);

  // ── Citation maps ──
  const citationMap = useMemo(() => {
    const map = new Map<number, ReviewCitation>();
    for (const c of citations) map.set(c.citation_index, c);
    return map;
  }, [citations]);

  const citedNoteIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of citations) {
      if (c.progress_note_id) set.add(c.progress_note_id);
    }
    return set;
  }, [citations]);

  const citationIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of citations) {
      if (c.progress_note_id) map.set(c.progress_note_id, c.citation_index);
    }
    return map;
  }, [citations]);

  // ── Auto-save logic ──
  const handleContentChange = useCallback(
    (md: string) => {
      pendingContent.current = md;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(async () => {
        if (pendingContent.current !== null) {
          setAutoSaving(true);
          try {
            const res = await updateReviewContent(orgId, reviewId, pendingContent.current);
            if (!res.error) {
              setLastSaved(new Date());
              // Update local review state
              setReview((prev) =>
                prev ? { ...prev, ai_generated_markdown: pendingContent.current ?? prev.ai_generated_markdown } : prev,
              );
            }
          } catch {
            // Silently fail — will retry on next change
          } finally {
            setAutoSaving(false);
            pendingContent.current = null;
          }
        }
      }, AUTO_SAVE_INTERVAL_MS);
    },
    [orgId, reviewId],
  );

  // ── Start Synthesis (SSE) ──
  const handleStartSynthesis = useCallback(async () => {
    setSynthesisStarting(true);
    setSseError(null);
    setStreamingText("");
    synthesisStartTimeRef.current = Date.now();

    try {
      // 1. Validate data + get context
      const result = await startSynthesis(orgId, reviewId);
      if (result.error) {
        setErrorModalMsg(result.error);
        setShowErrorModal(true);
        setSynthesisStarting(false);
        return;
      }
      if (!result.data) {
        setErrorModalMsg("Failed to retrieve synthesis context.");
        setShowErrorModal(true);
        setSynthesisStarting(false);
        return;
      }

      // Update local status
      setReview((prev) => (prev ? { ...prev, status: "GENERATING" as const, context: result.data ?? prev.context } : prev));

      // 2. Get Supabase access token for SSE auth
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? "";

      // 3. Open SSE connection
      const sseUrl = new URL(`${SUPABASE_URL}/functions/v1/synthesize-plan-review`);
      sseUrl.searchParams.set("review_id", reviewId);
      sseUrl.searchParams.set("organization_id", orgId);
      sseUrl.searchParams.set("access_token", accessToken);

      const eventSource = new EventSource(sseUrl.toString());
      sseRef.current = eventSource;
      setIsStreaming(true);
      setSynthesisStarting(false);

      let accumulated = "";

      eventSource.onmessage = (event) => {
        if (event.data === "[DONE]") {
          // Synthesis complete
          eventSource.close();
          sseRef.current = null;
          setIsStreaming(false);

          // Parse citations from accumulated text
          const citationIds = extractCitationIds(accumulated);
          const context = result.data;
          const parsedCitations = citationIds.map((noteId, index) => {
            const note = context?.progress_notes.find((n) => n.id === noteId);
            return {
              citation_index: index + 1,
              progress_note_id: noteId,
              source_date: note?.date,
              source_text_snapshot: truncate(note?.content || note?.summary || "", 200),
              source_worker_name: note?.worker_name ?? undefined,
            };
          });

          const durationMs = Date.now() - synthesisStartTimeRef.current;

          // Save result
          saveSynthesisResult(orgId, reviewId, accumulated, parsedCitations, {
            total_notes_ingested: context?.note_count ?? 0,
            total_goals_covered: context?.goal_count ?? 0,
            generation_duration_ms: durationMs,
          }).then(() => {
            // Reload to get updated review + citations
            loadReview();
          });

          return;
        }

        // Append chunk
        accumulated += event.data;
        setStreamingText(accumulated);
      };

      eventSource.onerror = () => {
        setSseError("Connection interrupted. AI synthesis paused.");
        eventSource.close();
        sseRef.current = null;
        setIsStreaming(false);
        // Preserve text received so far — do NOT clear streamingText

        // If we have accumulated text, try to save what we have
        if (accumulated.length > 100) {
          saveSynthesisResult(orgId, reviewId, accumulated, [], {
            total_notes_ingested: result.data?.note_count ?? 0,
            total_goals_covered: result.data?.goal_count ?? 0,
          }).then(() => loadReview());
        }
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start synthesis";
      setErrorModalMsg(message);
      setShowErrorModal(true);
      setSynthesisStarting(false);
    }
  }, [orgId, reviewId, loadReview]);

  // ── Submit for Approval ──
  const handleSubmitForApproval = useCallback(async () => {
    setSubmittingApproval(true);
    try {
      const res = await submitForApproval(orgId, reviewId);
      if (res.error) {
        setErrorModalMsg(res.error);
        setShowErrorModal(true);
      } else {
        setReview((prev) => (prev ? { ...prev, status: "PENDING_APPROVAL" as const } : prev));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit";
      setErrorModalMsg(message);
      setShowErrorModal(true);
    } finally {
      setSubmittingApproval(false);
    }
  }, [orgId, reviewId]);

  // ── Finalize ──
  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    try {
      const res = await finalizeAndGeneratePdf(orgId, reviewId);
      if (res.error) {
        setErrorModalMsg(res.error);
        setShowErrorModal(true);
      } else {
        setReview((prev) => (prev ? { ...prev, status: "FINALIZED" as const, pdf_storage_path: res.data?.pdf_path ?? null } : prev));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Finalization failed";
      setErrorModalMsg(message);
      setShowErrorModal(true);
    } finally {
      setFinalizing(false);
      setShowFinalizeModal(false);
    }
  }, [orgId, reviewId]);

  // ── Citation interactions ──
  const handleCitationClick = useCallback((noteId: string) => {
    setHighlightedNoteId(noteId);
    // Auto-clear after a few seconds
    setTimeout(() => setHighlightedNoteId(null), 4000);
  }, []);

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-emerald-400 animate-spin" />
          <span className="text-xs text-zinc-500">Loading review…</span>
        </div>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle size={24} className="text-rose-400" />
          <p className="text-sm text-rose-300">{error || "Review not found"}</p>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Back to Reviews
          </button>
        </div>
      </div>
    );
  }

  const notes = review.context?.progress_notes ?? [];
  const participantName = review.participant_name || review.context?.participant?.full_name || "Unknown";
  const ndisNumber = review.participant_ndis_number || review.context?.participant?.ndis_number || null;
  const isReadyForActions = review.status === "DRAFT" || review.status === "PENDING_APPROVAL";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="flex flex-col h-full"
    >
      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-zinc-950/30">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
          >
            <ArrowLeft size={14} />
            Reviews
          </button>
          <div className="w-px h-5 bg-white/[0.06]" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-100 truncate">
              {participantName}
            </h2>
            {ndisNumber && (
              <span className="text-[10px] font-mono text-zinc-500">
                NDIS: {ndisNumber}
              </span>
            )}
          </div>
          <StatusBadge status={review.status} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-save indicator */}
          {autoSaving && (
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <Loader2 size={10} className="animate-spin" />
              Saving…
            </span>
          )}
          {!autoSaving && lastSaved && (
            <span className="text-[10px] text-zinc-600 font-mono">
              Saved {formatDateTime(lastSaved.toISOString())}
            </span>
          )}

          {/* AI indicator */}
          {(isStreaming || review.status === "GENERATING") && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles size={11} className="text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400">AI</span>
            </span>
          )}

          {/* Action buttons */}
          {isReadyForActions && (
            <>
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={submittingApproval || review.status === "PENDING_APPROVAL"}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                  review.status === "PENDING_APPROVAL"
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20",
                )}
              >
                {submittingApproval ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Send size={11} />
                )}
                Submit for Approval
              </button>
              <button
                type="button"
                onClick={() => setShowFinalizeModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <Lock size={11} />
                Finalize & Mint PDF
              </button>
            </>
          )}

          {/* Download button for finalized */}
          {review.status === "FINALIZED" && review.pdf_storage_path && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
            >
              <Download size={11} />
              Download Official PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Split Pane ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane — The Canvas (60%) */}
        <div className="w-[60%] border-r border-white/[0.04] flex flex-col overflow-hidden">
          <TheCanvas
            review={review}
            context={review.context ?? null}
            citations={citations}
            citationMap={citationMap}
            onStartSynthesis={handleStartSynthesis}
            onContentChange={handleContentChange}
            onCitationHover={setHoveredCitation}
            onCitationClick={handleCitationClick}
            synthesisStarting={synthesisStarting}
            streamingText={streamingText}
            isStreaming={isStreaming}
            sseError={sseError}
          />
        </div>

        {/* Right Pane — Evidence Vault (40%) */}
        <div className="w-[40%] flex flex-col overflow-hidden">
          <EvidenceVault
            notes={notes}
            highlightedNoteId={highlightedNoteId}
            citedNoteIds={citedNoteIds}
            citationIndexMap={citationIndexMap}
            searchQuery={vaultSearch}
            onSearchChange={setVaultSearch}
          />
        </div>
      </div>

      {/* ── Citation Tooltip Overlay ── */}
      <AnimatePresence>
        {hoveredCitation && <CitationTooltip citation={hoveredCitation} />}
      </AnimatePresence>

      {/* ── Modals ── */}
      <FinalizeModal
        open={showFinalizeModal}
        onClose={() => setShowFinalizeModal(false)}
        onConfirm={handleFinalize}
        loading={finalizing}
      />
      <InsufficientDataModal
        open={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        message={errorModalMsg}
      />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Review Library — Default View
   ══════════════════════════════════════════════════════════════ */

function ReviewLibrary({
  orgId,
  reviews,
  stats,
  loading,
  onSelectReview,
  onRefresh,
}: {
  orgId: string;
  reviews: PlanReview[];
  stats: ReviewDashboardStats | null;
  loading: boolean;
  onSelectReview: (id: string) => void;
  onRefresh: () => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter(
      (r) =>
        (r.participant_name?.toLowerCase().includes(q)) ||
        (r.participant_ndis_number?.toLowerCase().includes(q)),
    );
  }, [reviews, searchQuery]);

  const handleCreated = useCallback(
    (review: PlanReview) => {
      onRefresh();
      onSelectReview(review.id);
    },
    [onRefresh, onSelectReview],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="space-y-6"
    >
      {/* Telemetry */}
      <TelemetryRibbon stats={stats} />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants…"
            className="w-full rounded-lg border border-white/[0.04] bg-white/[0.02] pl-8 pr-3 py-2 text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-emerald-500/30 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
          >
            <Plus size={14} />
            New Review
          </button>
        </div>
      </div>

      {/* Review grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl border border-white/[0.04] bg-zinc-950/40 animate-pulse"
            />
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/60 border border-white/[0.04] flex items-center justify-center mb-4">
            <BookOpen size={24} className="text-zinc-600" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-400 mb-1">
            {searchQuery ? "No matching reviews" : "No reviews yet"}
          </h3>
          <p className="text-xs text-zinc-600 max-w-sm">
            {searchQuery
              ? "Try a different search term"
              : "Create your first AI end-of-plan review by clicking \"New Review\" above."}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredReviews.map((r, i) => (
            <ReviewCard
              key={r.id}
              review={r}
              onClick={() => onSelectReview(r.id)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateReviewModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        orgId={orgId}
        onCreated={handleCreated}
      />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════════════════════════ */

export default function RosettaSynthesisPage() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);

  // Views
  const [activeView, setActiveView] = useState<"library" | "studio">("library");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  // Library data
  const [reviews, setReviews] = useState<PlanReview[]>([]);
  const [stats, setStats] = useState<ReviewDashboardStats | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(true);

  // ── Load library data ──
  const loadLibraryData = useCallback(async () => {
    if (!orgId) return;
    setLoadingLibrary(true);
    try {
      const [reviewsRes, statsRes] = await Promise.all([
        getReviews(orgId),
        getReviewDashboardStats(orgId),
      ]);
      if (reviewsRes.data) setReviews(reviewsRes.data);
      if (statsRes.data) setStats(statsRes.data);
    } catch {
      // Silently handle — stats might fail if RPC not deployed yet
    } finally {
      setLoadingLibrary(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadLibraryData();
  }, [loadLibraryData]);

  // ── Navigate to studio ──
  const handleSelectReview = useCallback((id: string) => {
    setSelectedReviewId(id);
    setActiveView("studio");
  }, []);

  const handleBackToLibrary = useCallback(() => {
    setActiveView("library");
    setSelectedReviewId(null);
    loadLibraryData();
  }, [loadLibraryData]);

  // ── No org ──
  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-emerald-400 animate-spin" />
          <span className="text-xs text-zinc-500">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#050505]">
      {/* ── Page Header ── */}
      <AnimatePresence mode="wait">
        {activeView === "library" && (
          <motion.div
            key="header"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="shrink-0 px-6 pt-6 pb-4"
          >
            <div className="flex items-center gap-3 mb-1">
              <Sparkles size={20} className="text-emerald-500" />
              <h1 className="text-xl font-bold text-white tracking-tight">
                Rosetta Synthesis
              </h1>
            </div>
            <p className="text-xs text-zinc-500 ml-[32px]">
              AI End-of-Plan Review Engine — Clinical Intelligence
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeView === "library" && (
            <motion.div
              key="library"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="h-full px-6 pb-6 overflow-y-auto custom-scrollbar"
            >
              <ReviewLibrary
                orgId={orgId}
                reviews={reviews}
                stats={stats}
                loading={loadingLibrary}
                onSelectReview={handleSelectReview}
                onRefresh={loadLibraryData}
              />
            </motion.div>
          )}

          {activeView === "studio" && selectedReviewId && (
            <motion.div
              key="studio"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="h-full"
            >
              <SynthesisStudio
                reviewId={selectedReviewId}
                orgId={orgId}
                onBack={handleBackToLibrary}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
