"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  ChevronDown,
  MoreHorizontal,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getSilQuoteWorkspaceAction,
  updateSilQuoteBlockAction,
  setSilQuoteStatusAction,
  generateSilRocExcelAction,
  publishSilFamilyPdfAction,
  syncSilQuoteToMasterRosterAction,
  addIrregularSilSupportAction,
  setBlockParticipantShareOverrideAction,
} from "@/app/actions/sil-quoting";
import { useVirtualizer } from "@tanstack/react-virtual";

/* ── Types ────────────────────────────────────────────── */

type Block = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active_workers: number;
  active_participants: number;
  is_sleepover: boolean;
  is_active_night: boolean;
  ndis_line_item_code: string | null;
};

type LineItem = {
  id: string;
  participant_id: string;
  ndis_line_item_code: string;
  total_hours_per_week: number;
  hourly_rate: number;
  weekly_cost: number;
  annual_cost: number;
  is_irregular_support: boolean;
};

type QuoteParticipant = {
  participant_id: string;
  participant_profiles?: {
    id: string;
    preferred_name?: string;
    clients?: { name?: string };
    ndis_number?: string;
  };
};

type WorkspaceData = {
  quote: {
    id: string;
    name: string;
    status: string;
    total_annual_cost: number;
    projected_gross_margin_percent: number;
    care_facilities?: { name?: string };
    updated_at: string;
  };
  participants: QuoteParticipant[];
  blocks: Block[];
  line_items: LineItem[];
};

/* ── Helpers ──────────────────────────────────────────── */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_FLOW = ["draft", "pending_approval", "approved", "submitted_to_ndia"] as const;

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Pending Review",
    approved: "Approved",
    submitted_to_ndia: "Submitted to NDIA",
    rejected: "Rejected",
    archived: "Archived",
  };
  return map[s] || s;
}

function statusStyle(s: string): string {
  const map: Record<string, string> = {
    draft: "border-zinc-500/30 text-zinc-400",
    pending_approval: "border-amber-500/30 text-amber-400",
    approved: "border-emerald-500/30 text-emerald-400",
    submitted_to_ndia: "border-sky-500/30 text-sky-400",
  };
  return map[s] || "border-zinc-500/30 text-zinc-400";
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

function marginColor(pct: number): string {
  if (pct >= 15) return "text-emerald-500";
  if (pct >= 5) return "text-amber-500";
  return "text-rose-500 font-bold";
}

function keyFor(day: number, time: string) {
  return `${day}-${String(time).slice(0, 5)}`;
}

function slotLabel(slot: number) {
  const h = Math.floor((slot * 30) / 60);
  const m = (slot * 30) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function ratioClass(workers: number, participants: number) {
  if (participants <= 0 && workers <= 0) return "bg-zinc-950 border-zinc-900";
  if (participants > 0 && workers <= 0) return "bg-rose-700/70 border-rose-400";
  const ratio = workers / Math.max(participants, 1);
  if (ratio >= 2) return "bg-amber-500/50 border-amber-300";
  if (ratio >= 1) return "bg-blue-500/50 border-blue-300";
  if (ratio >= 0.5) return "bg-blue-800/55 border-blue-500";
  return "bg-zinc-800/80 border-zinc-700";
}

function getParticipantName(p: QuoteParticipant): string {
  return p.participant_profiles?.preferred_name || p.participant_profiles?.clients?.name || p.participant_id.slice(0, 8);
}

/* ── RoC Grid Row ─────────────────────────────────────── */

const MemoizedGridRow = React.memo(function GridRow({
  slot,
  blockMap,
  patchBlock,
}: {
  slot: number;
  blockMap: Map<string, Block>;
  patchBlock: (block: Block, patch: Partial<Block>) => void;
}) {
  const label = slotLabel(slot);
  return (
    <div className="flex">
      <div className="sticky left-0 z-10 flex h-6 w-16 shrink-0 items-center border border-zinc-800 bg-zinc-950 px-2 font-mono text-[10px] text-zinc-500">
        {label}
      </div>
      {Array.from({ length: 7 }).map((_, i) => {
        const block = blockMap.get(keyFor(i + 1, label));
        if (!block)
          return (
            <div key={i} className="h-6 w-20 shrink-0 border border-zinc-900" />
          );
        return (
          <div
            key={i}
            className={`flex h-6 w-20 shrink-0 cursor-pointer items-center justify-center border text-center font-mono text-[10px] ${ratioClass(block.active_workers, block.active_participants)}`}
            onClick={() => void patchBlock(block, { active_workers: (block.active_workers + 1) % 4 })}
            onContextMenu={(e) => {
              e.preventDefault();
              void patchBlock(block, {
                is_sleepover: !block.is_sleepover,
                is_active_night: false,
              });
            }}
            title={`Workers ${block.active_workers}, Participants ${block.active_participants}`}
          >
            {block.active_workers}:{block.active_participants}
          </div>
        );
      })}
    </div>
  );
});

/* ── Virtualized RoC Grid ─────────────────────────────── */

function VirtualizedRoCGrid({
  blockMap,
  patchBlock,
}: {
  blockMap: Map<string, Block>;
  patchBlock: (block: Block, patch: Partial<Block>) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: 48,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 5,
  });

  return (
    <div className="overflow-auto rounded-lg border border-white/5">
      <div className="flex border-b border-white/5 bg-zinc-950/50">
        <div className="sticky left-0 z-10 w-16 shrink-0 bg-zinc-950 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Time
        </div>
        {DAYS.map((d) => (
          <div key={d} className="w-20 shrink-0 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {d}
          </div>
        ))}
      </div>
      <div ref={parentRef} className="h-[500px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MemoizedGridRow slot={virtualRow.index} blockMap={blockMap} patchBlock={patchBlock} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function SilQuoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const quoteId = params.id as string;
  const [pending, startTransition] = useTransition();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);

  const load = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const data = await getSilQuoteWorkspaceAction(quoteId);
      setWorkspace(data as WorkspaceData);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setLoading(false);
  }, [quoteId]);

  useEffect(() => { load(); }, [load]);

  const blockMap = useMemo(() => {
    const map = new Map<string, Block>();
    for (const b of workspace?.blocks || []) {
      map.set(keyFor(b.day_of_week, b.start_time), b as Block);
    }
    return map;
  }, [workspace]);

  const phantomBlocks = useMemo(
    () => (workspace?.blocks || []).filter((b: Block) => b.active_participants > 0 && b.active_workers <= 0),
    [workspace],
  );

  const patchBlock = useCallback(
    async (block: Block, patch: Partial<Block>) => {
      await updateSilQuoteBlockAction({
        quote_id: quoteId,
        block_id: block.id,
        active_workers: patch.active_workers,
        is_sleepover: patch.is_sleepover,
        is_active_night: patch.is_active_night,
        ndis_line_item_code: patch.ndis_line_item_code ?? undefined,
      });
      await load();
    },
    [quoteId, load],
  );

  const setStatus = useCallback(
    async (status: string) => {
      startTransition(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await setSilQuoteStatusAction({ quote_id: quoteId, status: status as any });
        setStatusOpen(false);
        await load();
      });
    },
    [quoteId, load],
  );

  const q = workspace?.quote;
  const margin = Number(q?.projected_gross_margin_percent || 0);
  const annualCost = Number(q?.total_annual_cost || 0);

  const lastSaved = q?.updated_at
    ? new Date(q.updated_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  if (loading && !workspace) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-white animate-spin mx-auto" />
          <p className="text-xs text-zinc-500">Loading financial workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Contextual Header ────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/care/sil-quoting")}
            className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-medium text-white">
              {q?.name || "SIL Quote"} — RoC Generator
            </h1>
          </div>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">
          {lastSaved && `Last auto-saved at ${lastSaved}`}
        </span>
      </div>

      {/* ─── 75 / 25 Split ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Main Canvas (75%) ────────────────────────────── */}
        <div className="w-3/4 h-[calc(100vh-56px)] overflow-y-auto p-8 space-y-6">
          {/* Phantom Block Warning */}
          {phantomBlocks.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <p className="text-xs text-rose-300">
                <strong>{phantomBlocks.length}</strong> blocks have unsupervised participants. Resolve before exporting.
              </p>
            </div>
          )}

          {/* RoC Heatmap Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                Roster of Care — Weekly Heatmap
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const desc = window.prompt("Irregular support description", "Unplanned hospital escorts");
                    const annual = window.prompt("Annual amount", "2000");
                    if (!desc || !annual) return;
                    startTransition(async () => {
                      await addIrregularSilSupportAction({
                        quote_id: quoteId,
                        description: desc,
                        annual_cost: Number(annual),
                      });
                      await load();
                    });
                  }}
                  className="h-7 px-2.5 flex items-center gap-1.5 text-[10px] text-zinc-400 rounded border border-white/5 hover:bg-white/5 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Irregular Support
                </button>
                <button
                  onClick={() => {
                    const p = workspace?.participants?.[0];
                    const b = workspace?.blocks?.[0];
                    if (!p || !b) return;
                    startTransition(async () => {
                      await setBlockParticipantShareOverrideAction({
                        quote_id: quoteId,
                        participant_id: p.participant_id,
                        block_id: b.id,
                        share_override: 0.5,
                      });
                      await load();
                    });
                  }}
                  className="h-7 px-2.5 flex items-center gap-1.5 text-[10px] text-zinc-400 rounded border border-white/5 hover:bg-white/5 transition-colors"
                >
                  <MoreHorizontal className="w-3 h-3" />
                  Split Override
                </button>
              </div>
            </div>

            {workspace && (
              <VirtualizedRoCGrid blockMap={blockMap} patchBlock={patchBlock} />
            )}
          </div>

          {/* Line Items Ledger */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">
              Costed Line Items
            </h3>
            <table className="w-full text-left border-collapse rounded-lg border border-white/5 overflow-hidden">
              <thead>
                <tr className="h-9 border-b border-white/5 bg-zinc-950/50">
                  <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">NDIS Code</th>
                  <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Hrs/Week</th>
                  <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Rate</th>
                  <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Weekly</th>
                  <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Annual</th>
                  <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {(workspace?.line_items || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-zinc-600">
                      No costed line items yet. Edit the heatmap grid to generate costs.
                    </td>
                  </tr>
                )}
                {(workspace?.line_items || []).map((li) => (
                  <tr key={li.id} className="border-b border-white/5 hover:bg-white/[0.02] h-11 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-zinc-300">{li.ndis_line_item_code || "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-300">{Number(li.total_hours_per_week).toFixed(1)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-300">{formatCurrency(Number(li.hourly_rate))}</td>
                    <td className="px-4 py-2 font-mono text-xs text-white">{formatCurrency(Number(li.weekly_cost))}</td>
                    <td className="px-4 py-2 font-mono text-xs text-white font-medium">{formatCurrency(Number(li.annual_cost))}</td>
                    <td className="px-4 py-2">
                      {li.is_irregular_support ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-semibold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          Irregular
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-semibold uppercase bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                          Standard
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-3">
              Quote Participants
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {(workspace?.participants || []).map((p) => (
                <div
                  key={p.participant_id}
                  className="flex items-center gap-3 rounded-lg border border-white/5 bg-zinc-950/50 px-4 py-3"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {getParticipantName(p).slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{getParticipantName(p)}</p>
                    {p.participant_profiles?.ndis_number && (
                      <p className="font-mono text-[10px] text-zinc-500 truncate">
                        NDIS: {p.participant_profiles.ndis_number}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sticky Right Sidebar (25%) ───────────────────── */}
        <div className="w-1/4 h-[calc(100vh-56px)] border-l border-white/5 bg-zinc-950/30 p-6 flex flex-col overflow-y-auto">
          {/* Financial Summary */}
          <div className="mb-8">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-4">
              Financial Summary
            </h4>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-zinc-600 uppercase block">Annual Cost</span>
                <p className="font-mono text-[32px] text-white font-light tracking-tight leading-none mt-1">
                  {formatCurrency(annualCost)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-zinc-600 uppercase block">Gross Margin</span>
                <p className={`font-mono text-2xl leading-none mt-1 ${marginColor(margin)}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* Status Controller */}
          <div className="mb-6 relative">
            <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-2">
              Workflow Status
            </h4>
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              className={`w-full h-9 rounded-md border px-3 flex items-center justify-between text-xs font-medium transition-colors hover:bg-white/5 ${statusStyle(q?.status || "draft")}`}
            >
              <span>{statusLabel(q?.status || "draft")}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
            </button>
            {statusOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-1 rounded-md border border-white/5 bg-zinc-900 py-1 z-10 shadow-xl"
              >
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/5 ${
                      q?.status === s ? "text-white font-medium" : "text-zinc-400"
                    }`}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Primary: Generate NDIS RoC */}
          <button
            disabled={!quoteId || phantomBlocks.length > 0 || pending}
            onClick={() =>
              startTransition(async () => {
                const out = await generateSilRocExcelAction({
                  quote_id: quoteId,
                  organization_id: orgId!,
                });
                if (out?.download_url) window.open(out.download_url, "_blank");
              })
            }
            className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            <FileText className="w-4 h-4" />
            Generate NDIS RoC
          </button>

          {/* Secondary: Publish Family PDF */}
          <button
            disabled={!quoteId || (workspace?.participants?.length || 0) === 0}
            onClick={() =>
              startTransition(async () => {
                const participant = workspace!.participants[0];
                await publishSilFamilyPdfAction({
                  quote_id: quoteId,
                  organization_id: orgId!,
                  participant_id: participant.participant_id,
                });
                setMsg("Family PDF published.");
              })
            }
            className="w-full h-9 mt-3 rounded-md border border-white/5 bg-transparent text-zinc-300 text-xs font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Publish Family PDF
          </button>

          {/* Operational: Sync to Master Roster */}
          <button
            disabled={!quoteId || q?.status !== "approved"}
            onClick={() =>
              startTransition(async () => {
                await syncSilQuoteToMasterRosterAction({ quote_id: quoteId });
                setMsg("Synced to master roster templates.");
              })
            }
            className="w-full h-9 mt-8 rounded-md border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Calendar className="w-3.5 h-3.5" />
            Sync to Master Roster
          </button>

          {/* Facility Info */}
          {q?.care_facilities?.name && (
            <div className="mt-auto pt-6 border-t border-white/5">
              <span className="text-[10px] text-zinc-600 uppercase block">Facility</span>
              <p className="text-sm text-zinc-300 mt-1">{q.care_facilities.name}</p>
            </div>
          )}

          {msg && (
            <p className="mt-4 text-xs text-zinc-400 text-center">{msg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
