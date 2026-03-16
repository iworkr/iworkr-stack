"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, CheckCircle2 } from "lucide-react";
import { listWebhookDeadLetters, replayWebhookDeadLetter } from "@/app/actions/superadmin";

type DeadLetter = {
  id: string;
  source: string;
  event_type: string | null;
  failure_reason: string;
  raw_payload: Record<string, unknown>;
  headers: Record<string, unknown> | null;
  is_resolved: boolean;
  created_at: string;
};

export default function DlqPage() {
  const [rows, setRows] = useState<DeadLetter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listWebhookDeadLetters(200, 0);
    if (result.error) {
      setBanner({ kind: "error", msg: result.error });
      setRows([]);
      setLoading(false);
      return;
    }
    const fetched = ((result.data as { rows?: DeadLetter[] } | null)?.rows || []) as DeadLetter[];
    setRows(fetched);
    if (!selectedId && fetched.length > 0) setSelectedId(fetched[0].id);
    if (selectedId && !fetched.find((r) => r.id === selectedId)) {
      setSelectedId(fetched[0]?.id || null);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const onReplay = useCallback(async (id: string) => {
    setReplayingId(id);
    setBanner(null);
    const result = await replayWebhookDeadLetter(id);
    if (result.error) {
      setBanner({ kind: "error", msg: `Replay failed: ${result.error}` });
      setReplayingId(null);
      return;
    }
    const resolved = Boolean((result.data as { resolved?: boolean } | null)?.resolved);
    setBanner({
      kind: "ok",
      msg: resolved ? "Replay succeeded and dead letter resolved." : "Replay completed but remains unresolved.",
    });
    await load();
    setReplayingId(null);
  }, [load]);

  return (
    <div className="min-h-full">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-8 py-5">
        <div>
          <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">DLQ TRIAGE</span>
          <h2 className="mt-0.5 text-[18px] font-semibold text-white">Webhook Dead Letter Queue</h2>
          <p className="text-[10px] text-zinc-600">Unresolved webhook events with replay tooling.</p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 text-[10px] text-zinc-300 hover:bg-white/[0.08]"
          disabled={loading}
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {banner ? (
        <div
          className={`mx-8 mt-5 rounded-md border px-3 py-2 text-xs ${
            banner.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {banner.msg}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-5 p-8">
        <section className="col-span-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
          <div className="border-b border-white/[0.04] px-4 py-3">
            <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">Unresolved Items ({rows.length})</p>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            {rows.map((row) => (
              <button
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className={`block w-full border-b border-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.03] ${
                  selectedId === row.id ? "bg-white/[0.05]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">{row.source}</span>
                  <span className="text-[10px] text-zinc-600">{new Date(row.created_at).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-300">{row.event_type || "unknown"}</p>
                <p className="mt-1 text-[10px] text-rose-300/90">{row.failure_reason}</p>
              </button>
            ))}
            {!loading && rows.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-zinc-600">
                <CheckCircle2 size={14} />
                <span className="text-xs">No unresolved dead letters.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="col-span-8 rounded-xl border border-white/[0.05] bg-white/[0.01]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
            <p className="font-mono text-[10px] tracking-wider text-zinc-500 uppercase">Payload Viewer</p>
            {selected ? (
              <button
                onClick={() => void onReplay(selected.id)}
                disabled={replayingId === selected.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60"
              >
                <RotateCcw size={12} className={replayingId === selected.id ? "animate-spin" : ""} />
                {replayingId === selected.id ? "Replaying..." : "Replay"}
              </button>
            ) : null}
          </div>
          {!selected ? (
            <div className="flex h-[70vh] items-center justify-center text-zinc-600">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={14} />
                Select a dead letter to inspect payload.
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-zinc-500">Source</p>
                  <p className="font-mono text-zinc-200">{selected.source}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Event Type</p>
                  <p className="font-mono text-zinc-200">{selected.event_type || "unknown"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-zinc-500">Failure Reason</p>
                  <p className="font-mono text-rose-300">{selected.failure_reason}</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs text-zinc-500">Headers</p>
                <pre className="max-h-[22vh] overflow-auto rounded-md border border-white/[0.05] bg-black/30 p-3 text-[11px] text-zinc-300">
                  {JSON.stringify(selected.headers || {}, null, 2)}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-xs text-zinc-500">Raw Payload</p>
                <pre className="max-h-[35vh] overflow-auto rounded-md border border-white/[0.05] bg-black/30 p-3 text-[11px] text-zinc-300">
                  {JSON.stringify(selected.raw_payload || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
