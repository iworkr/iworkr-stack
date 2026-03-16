"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Glasshouse — Coordinator Sanitization Gate
   Note Review Queue: Raw clinical notes → family-safe daily updates
   ═══════════════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from "react";
import {
  FileText,
  RefreshCw,
  Send,
  Sparkles,
  Eye,
  User,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import {
  getPendingFamilyNotes,
  publishToGlasshouse,
  type PendingNote,
} from "@/app/actions/glasshouse";
import { useOrg } from "@/lib/hooks/use-org";

export default function NoteReviewPage() {
  const { orgId } = useOrg();
  const [notes, setNotes] = useState<PendingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<PendingNote | null>(null);
  const [familyTitle, setFamilyTitle] = useState("");
  const [familySummary, setFamilySummary] = useState("");
  const [publishing, setPublishing] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const pending = await getPendingFamilyNotes(orgId);
      setNotes(pending);
    } catch {
      setNotes([]);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const handleSelectNote = (note: PendingNote) => {
    setSelectedNote(note);
    setFamilyTitle(`${note.participant_name}'s Visit Update`);
    setFamilySummary(note.family_facing_narrative || "");
  };

  const handleAutoSummarize = () => {
    if (!selectedNote) return;
    // Simple client-side transformation — in production, this calls the LLM
    const raw = selectedNote.content;
    const sanitized = raw
      .replace(/\b(absconded|elopement|escalated|dysregulated|restraint|PRN|prn)\b/gi, (match) => {
        const replacements: Record<string, string> = {
          absconded: "left the area",
          elopement: "left the area",
          escalated: "became overwhelmed",
          dysregulated: "had a difficult moment",
          restraint: "support",
          PRN: "as-needed medication",
          prn: "as-needed medication",
        };
        return replacements[match.toLowerCase()] || match;
      })
      .replace(/\b(de-escalation|deescalation)\b/gi, "calming strategies");
    setFamilySummary(sanitized);
  };

  const [publishError, setPublishError] = useState("");

  const handlePublish = async () => {
    if (!selectedNote || !familyTitle || !familySummary) return;
    setPublishing(true);
    try {
      await publishToGlasshouse({
        progress_note_id: selectedNote.id,
        participant_id: selectedNote.participant_id,
        organization_id: orgId || "",
        title: familyTitle,
        sanitized_content: familySummary,
        shift_id: selectedNote.shift_id || undefined,
      });
      setSelectedNote(null);
      setFamilyTitle("");
      setFamilySummary("");
      await loadNotes();
    } catch (e) {
      setPublishError(`Failed to publish: ${e instanceof Error ? e.message : String(e)}`);
    }
    setPublishing(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 text-white">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 ring-1 ring-teal-500/20">
            <Eye size={20} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Family Note Review</h1>
            <p className="text-[11px] text-zinc-500">
              Sanitize and publish worker notes to the Family Portal
            </p>
          </div>
        </div>
        <button
          onClick={loadNotes}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-white"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Pending Notes Queue */}
        <div>
          <h2 className="mb-3 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Pending Notes ({notes.length})
          </h2>
          {notes.length === 0 && !loading && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
              <p className="text-sm text-zinc-400">All notes have been reviewed.</p>
            </div>
          )}
          <div className="space-y-2">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selectedNote?.id === note.id
                    ? "border-teal-500/30 bg-teal-500/5"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User size={12} className="text-zinc-500" />
                  <span className="text-[11px] text-zinc-400">{note.worker_name}</span>
                  <span className="text-zinc-700">·</span>
                  <Calendar size={10} className="text-zinc-500" />
                  <span className="text-[11px] text-zinc-500">
                    {new Date(note.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-200">
                  {note.participant_name}
                </p>
                <p className="mt-1 line-clamp-2 text-[12px] text-zinc-400">
                  {note.content}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Sanitization Editor */}
        <div>
          {!selectedNote ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
              <FileText size={28} className="mx-auto mb-2 text-zinc-700" />
              <p className="text-sm text-zinc-500">Select a note to review and publish.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              {/* Raw note (read-only) */}
              <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Raw Worker Note (Internal Only)
              </h3>
              <div className="mb-4 rounded-lg border border-zinc-700/50 bg-zinc-950 p-3 text-sm text-zinc-400 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                {selectedNote.content}
              </div>

              {/* Family-safe editor */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  Family Portal Summary
                </h3>
                <button
                  onClick={handleAutoSummarize}
                  className="flex items-center gap-1 rounded-lg bg-teal-500/10 border border-teal-500/30 px-2.5 py-1 text-[10px] text-teal-400 hover:bg-teal-500/20 transition"
                >
                  <Sparkles size={10} />
                  Auto-Sanitize
                </button>
              </div>

              <input
                type="text"
                value={familyTitle}
                onChange={(e) => setFamilyTitle(e.target.value)}
                placeholder="Title (e.g. 'Community Access Update')"
                className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none"
              />

              <textarea
                value={familySummary}
                onChange={(e) => setFamilySummary(e.target.value)}
                placeholder="Write a warm, family-friendly summary. Avoid clinical jargon. Focus on positives and progress."
                className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none min-h-[120px]"
              />

              <button
                onClick={() => { setPublishError(""); handlePublish(); }}
                disabled={publishing || !familySummary}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition"
              >
                <Send size={14} />
                {publishing ? "Publishing..." : "Publish to Family Portal"}
              </button>
              {publishError && (
                <p className="mt-2 text-xs text-rose-400">{publishError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
