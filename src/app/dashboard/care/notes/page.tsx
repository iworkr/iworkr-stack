"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Archive } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  acknowledgeShiftNoteSubmissionAction,
  listShiftNoteSubmissionsAction,
} from "@/app/actions/care-shift-notes";

export default function CareShiftNotesReviewPage() {
  const { orgId } = useOrg();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<
    Array<{
      id: string;
      status: string;
      template_version: number;
      participant_signature_exemption_reason?: string | null;
      flags?: { requires_review?: boolean };
      submission_data?: Record<string, unknown>;
      profiles?: { full_name?: string | null };
      shift_note_templates?: { name?: string | null };
      schedule_blocks?: { start_time?: string | null; end_time?: string | null };
    }>
  >([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!orgId) return;
    setItems(await listShiftNoteSubmissionsAction(orgId));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void load();
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const worker = String(item.profiles?.full_name || "").toLowerCase();
      const template = String(item.shift_note_templates?.name || "").toLowerCase();
      const status = String(item.status || "").toLowerCase();
      return worker.includes(q) || template.includes(q) || status.includes(q);
    });
  }, [items, query]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Project Rosetta</p>
          <h1 className="text-xl font-semibold text-zinc-100">Shift Note Review Terminal</h1>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by worker/template/status"
          className="w-72 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>

      <div className="grid gap-2">
        {filtered.length === 0 && <p className="text-sm text-zinc-500">No submissions found.</p>}
        {filtered.map((item) => {
          const requiresReview =
            item.status === "review_required" ||
            Boolean(item.participant_signature_exemption_reason) ||
            Boolean(item.flags?.requires_review);

          return (
            <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {item.shift_note_templates?.name || "Template"} v{item.template_version}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Worker: {item.profiles?.full_name || "Unknown"} · Status: {item.status}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Shift window: {item.schedule_blocks?.start_time || "n/a"} -{" "}
                    {item.schedule_blocks?.end_time || "n/a"}
                  </p>
                  {requiresReview && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
                      <AlertTriangle size={12} />
                      Needs review: signature exemption or flagged values.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isPending || item.status === "reviewed"}
                    onClick={() =>
                      startTransition(async () => {
                        await acknowledgeShiftNoteSubmissionAction(item.id, "reviewed");
                        await load();
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} />
                    Mark Reviewed
                  </button>
                  <button
                    disabled={isPending || item.status === "archived"}
                    onClick={() =>
                      startTransition(async () => {
                        await acknowledgeShiftNoteSubmissionAction(item.id, "archived");
                        await load();
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
                  >
                    <Archive size={12} />
                    Archive
                  </button>
                </div>
              </div>
              <pre className="mt-3 max-h-44 overflow-auto rounded-lg border border-zinc-800 bg-black/40 p-2 text-[11px] text-zinc-400">
                {JSON.stringify(item.submission_data || {}, null, 2)}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
