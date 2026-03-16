"use client";

import { useEffect, useMemo, useState, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Download,
  X,
  FileText,
  Flag,
  ChevronRight,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  acknowledgeShiftNoteSubmissionAction,
  listShiftNoteSubmissionsAction,
} from "@/app/actions/care-shift-notes";

/* ── Types ────────────────────────────────────────────── */

type ShiftNote = {
  id: string;
  status: string;
  template_version: number;
  participant_signature_exemption_reason?: string | null;
  flags?: { requires_review?: boolean } | null;
  submission_data?: Record<string, unknown> | null;
  created_at?: string | null;
  profiles?: { full_name?: string | null } | null;
  participant_profiles?: { preferred_name?: string | null; full_name?: string | null } | null;
  shift_note_templates?: { name?: string | null; version?: number | null } | null;
  schedule_blocks?: { start_time?: string | null; end_time?: string | null; title?: string | null } | null;
};

type StatusFilter = "all" | "pending" | "flagged";

/* ── Helpers ──────────────────────────────────────────── */

function resolveParticipantName(note: ShiftNote): string {
  return note.participant_profiles?.preferred_name || note.participant_profiles?.full_name || "Unknown Participant";
}

function resolveWorkerName(note: ShiftNote): string {
  return note.profiles?.full_name || "Unknown Worker";
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function formatShiftTime(note: ShiftNote): string {
  const start = note.schedule_blocks?.start_time;
  const end = note.schedule_blocks?.end_time;
  if (!start) return "—";
  try {
    const s = new Date(start);
    const dateStr = s.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
    const startTime = s.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
    if (end) {
      const e = new Date(end);
      const endTime = e.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
      return `${dateStr} · ${startTime} – ${endTime}`;
    }
    return `${dateStr} · ${startTime}`;
  } catch {
    return "—";
  }
}

function formatDateHeader(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function extractSnippet(data: Record<string, unknown> | null | undefined): string {
  if (!data || typeof data !== "object") return "No content";
  const values = Object.values(data);
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) {
      return val.length > 60 ? val.substring(0, 60) + "…" : val;
    }
  }
  return "No content";
}

function formatJsonKey(key: string): string {
  return key.replace(/[_-]/g, " ").toUpperCase();
}

function matchesStatusFilter(note: ShiftNote, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") {
    return note.status === "submitted" || note.status === "review_required" || note.status === "pending";
  }
  if (filter === "flagged") {
    return note.status === "flagged" || Boolean(note.flags?.requires_review);
  }
  return true;
}

/* ── Status Badge ─────────────────────────────────────── */

function StatusBadge({ status, flags }: { status: string; flags?: { requires_review?: boolean } | null }) {
  const isFlagged = status === "flagged" || Boolean(flags?.requires_review);
  const isPending = status === "submitted" || status === "review_required" || status === "pending";
  const isReviewed = status === "reviewed";

  if (isFlagged) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-rose-500/10 text-rose-400 border-rose-500/20">
        Flagged
      </span>
    );
  }
  if (isPending) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
        Pending
      </span>
    );
  }
  if (isReviewed) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
        Reviewed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border bg-zinc-500/10 text-zinc-500 border-zinc-500/20">
      {status}
    </span>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL = [
  { p: "w-28", w: "w-24", t: "w-40", s: "w-48" },
  { p: "w-32", w: "w-20", t: "w-36", s: "w-44" },
  { p: "w-24", w: "w-28", t: "w-44", s: "w-40" },
  { p: "w-36", w: "w-24", t: "w-32", s: "w-52" },
  { p: "w-28", w: "w-32", t: "w-40", s: "w-44" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SKEL[idx % SKEL.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse" />
          <div className={`h-3 ${s.p} bg-zinc-900 rounded-sm animate-pulse`} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-900 animate-pulse" />
          <div className={`h-3 ${s.w} bg-zinc-900 rounded-sm animate-pulse`} />
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${s.t} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.s} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState() {
  return (
    <tr>
      <td colSpan={5}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <FileText className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-[15px] text-white font-medium">No shift notes found.</p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            Notes submitted by workers during their shifts will appear here for triage and review.
          </p>
        </div>
      </td>
    </tr>
  );
}

/* ── Reading Room Slide-Over ──────────────────────────── */

function ShiftNoteSlideOver({
  note,
  onClose,
  onStatusChange,
  isMutating,
}: {
  note: ShiftNote | null;
  onClose: () => void;
  onStatusChange: (id: string, status: "reviewed" | "flagged") => void;
  isMutating?: boolean;
}) {
  if (!note) return null;

  const participantName = resolveParticipantName(note);
  const workerName = resolveWorkerName(note);
  const dateStr = formatDateHeader(note.schedule_blocks?.start_time || note.created_at);
  const payload = note.submission_data || {};
  const isAlreadyReviewed = note.status === "reviewed";
  const isFlagged = note.status === "flagged" || Boolean(note.flags?.requires_review);

  return (
    <AnimatePresence>
      {note && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[500px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-[#050505] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                  <span className="text-xs text-zinc-400 font-medium">{getInitials(participantName)}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-medium text-white truncate">
                    Shift Note: {participantName}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Authored by {workerName} on {dateStr}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Parser */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Shift Info */}
              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                  Shift Details
                </h4>
                <p className="font-mono text-xs text-zinc-300">{formatShiftTime(note)}</p>
                {note.shift_note_templates?.name && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Template: {note.shift_note_templates.name} v{note.template_version}
                  </p>
                )}
              </div>

              {/* Dynamic JSON → Typography Blocks */}
              {Object.entries(payload).map(([key, value]) => {
                // Skip internal/meta keys
                if (key.startsWith("_") || key === "template_version") return null;
                const displayValue = typeof value === "string"
                  ? value
                  : typeof value === "boolean"
                    ? (value ? "Yes" : "No")
                    : typeof value === "number"
                      ? String(value)
                      : Array.isArray(value)
                        ? value.join(", ")
                        : value !== null && typeof value === "object"
                          ? JSON.stringify(value, null, 2)
                          : "N/A";

                return (
                  <div key={key} className="flex flex-col">
                    <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                      {formatJsonKey(key)}
                    </h4>
                    {typeof value === "object" && value !== null && !Array.isArray(value) ? (
                      <pre className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                        {displayValue}
                      </pre>
                    ) : (
                      <p className="text-zinc-200 text-sm leading-relaxed">
                        {displayValue || "N/A"}
                      </p>
                    )}
                  </div>
                );
              })}

              {Object.keys(payload).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-500">No structured data in this submission.</p>
                </div>
              )}

              {/* Signature Info */}
              {note.participant_signature_exemption_reason && (
                <div>
                  <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
                    Signature Exemption
                  </h4>
                  <p className="text-sm text-amber-400 leading-relaxed">
                    {note.participant_signature_exemption_reason}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-950 flex gap-3 shrink-0">
              <button
                onClick={() => onStatusChange(note.id, "flagged")}
                disabled={isFlagged || isMutating}
                className="w-1/3 h-10 rounded-md border border-rose-500/20 bg-transparent text-rose-500 text-xs font-medium hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Flag className="w-3 h-3" />
                {isMutating ? "Saving..." : "Flag Note"}
              </button>
              <button
                onClick={() => onStatusChange(note.id, "reviewed")}
                disabled={isAlreadyReviewed || isMutating}
                className="w-2/3 h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isMutating ? "Saving..." : isAlreadyReviewed ? "Already Reviewed" : "Mark as Reviewed"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CareShiftNotesReviewPage() {
  const { orgId } = useOrg();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<ShiftNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusFilter>("all");
  const [selectedNote, setSelectedNote] = useState<ShiftNote | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await listShiftNoteSubmissionsAction(orgId);
      setItems(data as ShiftNote[]);
    } catch (err) {
      console.error("Failed to load shift notes:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { refresh(); }, [refresh]);

  /* ── Derived counts ──────────────────────────────────── */
  const statusCounts = useMemo(() => {
    let pending = 0;
    let flagged = 0;
    for (const n of items) {
      if (n.status === "submitted" || n.status === "review_required" || n.status === "pending") pending++;
      if (n.status === "flagged" || n.flags?.requires_review) flagged++;
    }
    return { all: items.length, pending, flagged };
  }, [items]);

  /* ── Filtered list ───────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = items.filter((n) => matchesStatusFilter(n, tab));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) => {
        const participant = resolveParticipantName(n).toLowerCase();
        const worker = resolveWorkerName(n).toLowerCase();
        const snippet = extractSnippet(n.submission_data).toLowerCase();
        return participant.includes(q) || worker.includes(q) || snippet.includes(q);
      });
    }
    return list;
  }, [items, tab, search]);

  /* ── Status change handler ───────────────────────────── */
  const handleStatusChange = (noteId: string, status: "reviewed" | "flagged") => {
    startTransition(async () => {
      try {
        await acknowledgeShiftNoteSubmissionAction(noteId, status);
        // Optimistically update local state
        setItems((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, status, flags: status === "flagged" ? { requires_review: true } : n.flags }
              : n
          )
        );
        setSelectedNote(null);
        // Re-fetch from DB to confirm server state
        refresh();
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    });
  };

  const tabs: { key: StatusFilter; label: string; count: number; countColor?: string }[] = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "pending", label: "Pending Review", count: statusCounts.pending, countColor: "text-amber-500" },
    { key: "flagged", label: "Flagged", count: statusCounts.flagged, countColor: "text-rose-500" },
  ];

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs + Tabs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Clinical & Safety
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />

          {/* Pill Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  tab === t.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 font-mono text-[10px] ${t.countColor || "text-zinc-500"}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Filter + Export */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, workers, participants…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          <button className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95">
            <Download className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            Export Logs
          </button>
        </div>
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-0 pt-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 border-b border-white/5">
                <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Participant</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Worker</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Shift Time</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Note Snippet</th>
                <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[10%]">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading Skeletons */}
              {loading && items.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
              }

              {/* Empty State */}
              {!loading && filtered.length === 0 && <EmptyState />}

              {/* Data Rows */}
              {!loading && filtered.map((note) => {
                const participantName = resolveParticipantName(note);
                const workerName = resolveWorkerName(note);

                return (
                  <tr
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                  >
                    {/* Col 1: Participant */}
                    <td className="px-8 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <span className="text-[10px] text-zinc-400 font-medium">{getInitials(participantName)}</span>
                        </div>
                        <span className="text-sm text-zinc-100 font-medium truncate">{participantName}</span>
                      </div>
                    </td>

                    {/* Col 2: Worker */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <span className="text-[8px] text-zinc-500 font-medium">{getInitials(workerName)}</span>
                        </div>
                        <span className="text-[13px] text-zinc-300 truncate">{workerName}</span>
                      </div>
                    </td>

                    {/* Col 3: Shift Time */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-zinc-300">{formatShiftTime(note)}</span>
                    </td>

                    {/* Col 4: Note Snippet */}
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-zinc-400 truncate block max-w-xs">
                        {extractSnippet(note.submission_data)}
                      </span>
                    </td>

                    {/* Col 5: Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={note.status} flags={note.flags} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Reading Room Slide-Over ──────────────────────── */}
      <ShiftNoteSlideOver
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onStatusChange={handleStatusChange}
        isMutating={isPending}
      />
    </div>
  );
}
