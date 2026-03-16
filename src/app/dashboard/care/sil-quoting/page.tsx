"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useOrg } from "@/lib/hooks/use-org";
import {
  addIrregularSilSupportAction,
  createSilQuoteAction,
  generateSilRocExcelAction,
  getSilQuoteWorkspaceAction,
  listSilQuotesAction,
  paintParticipantAbsenceAction,
  publishSilFamilyPdfAction,
  setBlockParticipantShareOverrideAction,
  setSilQuoteStatusAction,
  syncSilQuoteToMasterRosterAction,
  updateSilQuoteBlockAction,
} from "@/app/actions/sil-quoting";
import { listCareFacilitiesAction, listFacilityParticipantsAction } from "@/app/actions/care-routines";
import { AlertTriangle, FileSpreadsheet, RefreshCcw, Save, Send } from "lucide-react";

type QuoteSummary = {
  id: string;
  name: string;
  status: string;
  total_annual_cost: number;
  projected_gross_margin_percent: number;
  care_facilities?: { name?: string };
};

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

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function SilQuotingPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [workspace, setWorkspace] = useState<any>(null);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [newQuote, setNewQuote] = useState({
    facility_id: "",
    name: "",
    base_week_start: "",
    source_mode: "master_roster" as "master_roster" | "blank",
    participant_ids: [] as string[],
  });

  const [absence, setAbsence] = useState({
    participant_id: "",
    day_of_week: 1,
    start_time: "09:00",
    end_time: "15:00",
  });

  useEffect(() => {
    if (!orgId) return;
    startTransition(async () => {
      const [q, f, p] = await Promise.all([
        listSilQuotesAction(orgId),
        listCareFacilitiesAction(orgId),
        listFacilityParticipantsAction(orgId),
      ]);
      setQuotes((q || []) as QuoteSummary[]);
      setFacilities(f || []);
      setParticipants(p || []);
      if ((q || []).length > 0) setSelectedQuoteId((q as QuoteSummary[])[0].id);
    });
  }, [orgId]);

  useEffect(() => {
    if (!selectedQuoteId) return;
    startTransition(async () => {
      const data = await getSilQuoteWorkspaceAction(selectedQuoteId);
      setWorkspace(data);
    });
  }, [selectedQuoteId]);

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

  async function refreshSelected() {
    if (!selectedQuoteId) return;
    const data = await getSilQuoteWorkspaceAction(selectedQuoteId);
    setWorkspace(data);
  }

  async function createQuote() {
    if (!orgId || !newQuote.facility_id || !newQuote.name || newQuote.participant_ids.length === 0) return;
    setMsg("");
    startTransition(async () => {
      try {
        const quote = await createSilQuoteAction({
          organization_id: orgId,
          facility_id: newQuote.facility_id,
          name: newQuote.name,
          base_week_start: newQuote.base_week_start || new Date().toISOString().slice(0, 10),
          participant_ids: newQuote.participant_ids,
          source_mode: newQuote.source_mode,
        });
        setSelectedQuoteId(quote.id);
        const all = await listSilQuotesAction(orgId);
        setQuotes((all || []) as QuoteSummary[]);
        setMsg("Quote created.");
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  }

  async function patchBlock(block: Block, patch: Partial<Block>) {
    await updateSilQuoteBlockAction({
      quote_id: selectedQuoteId,
      block_id: block.id,
      active_workers: patch.active_workers,
      is_sleepover: patch.is_sleepover,
      is_active_night: patch.is_active_night,
      ndis_line_item_code: patch.ndis_line_item_code ?? undefined,
    });
    await refreshSelected();
  }

  return (
    <main className="min-h-screen bg-[#050505] p-6 text-zinc-100">
      <div className="mx-auto grid max-w-[1500px] grid-cols-12 gap-4">
        <section className="col-span-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">Project Architect</h2>
          <p className="mb-3 text-sm">SIL Quoting & RoC Generator</p>

          <div className="space-y-2">
            <select className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs" value={newQuote.facility_id} onChange={(e) => setNewQuote((s) => ({ ...s, facility_id: e.target.value }))}>
              <option value="">Select facility</option>
              {facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs" placeholder="Quote name" value={newQuote.name} onChange={(e) => setNewQuote((s) => ({ ...s, name: e.target.value }))} />
            <input type="date" className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs" value={newQuote.base_week_start} onChange={(e) => setNewQuote((s) => ({ ...s, base_week_start: e.target.value }))} />
            <select className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs" value={newQuote.source_mode} onChange={(e) => setNewQuote((s) => ({ ...s, source_mode: e.target.value as "master_roster" | "blank" }))}>
              <option value="master_roster">Import from Master Roster</option>
              <option value="blank">Blank Slate</option>
            </select>
            <div className="max-h-36 overflow-auto rounded border border-zinc-800 bg-zinc-900 p-2">
              {participants.map((p: any) => {
                const checked = newQuote.participant_ids.includes(p.id);
                return (
                  <label key={p.id} className="mb-1 flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setNewQuote((s) => ({
                        ...s,
                        participant_ids: e.target.checked
                          ? [...s.participant_ids, p.id]
                          : s.participant_ids.filter((id) => id !== p.id),
                      }))}
                    />
                    {p.preferred_name || p.id}
                  </label>
                );
              })}
            </div>
            <button onClick={() => void createQuote()} className="w-full rounded bg-emerald-600 px-2 py-1.5 text-xs text-white">+ New SIL Quote</button>
          </div>

          <div className="mt-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Existing Quotes</p>
            <div className="max-h-56 space-y-1 overflow-auto">
              {quotes.map((q) => (
                <button key={q.id} onClick={() => setSelectedQuoteId(q.id)} className={`w-full rounded border px-2 py-1.5 text-left text-xs ${selectedQuoteId === q.id ? "border-cyan-400 bg-cyan-500/10" : "border-zinc-800 bg-zinc-900"}`}>
                  <div className="flex items-center justify-between">
                    <span>{q.name}</span>
                    <span className="font-mono text-[10px]">{q.status}</span>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-500">${Number(q.total_annual_cost || 0).toFixed(0)}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="col-span-7 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm">{workspace?.quote?.name || "Select a quote"}</h3>
            <button onClick={() => void refreshSelected()} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"><RefreshCcw className="mr-1 inline h-3 w-3" />Refresh</button>
          </div>

          {workspace && (
            <VirtualizedRoCGrid blockMap={blockMap} patchBlock={patchBlock} />
          )}

          {workspace && (
            <div className="mt-3 rounded border border-zinc-800 bg-zinc-900 p-2">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500">Absence Painter</p>
              <div className="grid grid-cols-5 gap-2">
                <select className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" value={absence.participant_id} onChange={(e) => setAbsence((s) => ({ ...s, participant_id: e.target.value }))}>
                  <option value="">Participant</option>
                  {workspace.participants.map((p: any) => (
                    <option key={p.participant_id} value={p.participant_id}>
                      {p.participant_profiles?.preferred_name || p.participant_profiles?.clients?.name || p.participant_id}
                    </option>
                  ))}
                </select>
                <select className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" value={absence.day_of_week} onChange={(e) => setAbsence((s) => ({ ...s, day_of_week: Number(e.target.value) }))}>
                  {days.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </select>
                <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" value={absence.start_time} onChange={(e) => setAbsence((s) => ({ ...s, start_time: e.target.value }))} />
                <input className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs" value={absence.end_time} onChange={(e) => setAbsence((s) => ({ ...s, end_time: e.target.value }))} />
                <button
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                  onClick={() => startTransition(async () => {
                    await paintParticipantAbsenceAction({
                      quote_id: selectedQuoteId,
                      participant_id: absence.participant_id,
                      day_of_week: absence.day_of_week,
                      start_time: absence.start_time,
                      end_time: absence.end_time,
                      is_present: false,
                    });
                    await refreshSelected();
                  })}
                >
                  Paint Absence
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="col-span-2 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <h4 className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Margin Telemetry</h4>
          <p className="text-xs text-zinc-400">Annual Cost</p>
          <p className="font-mono text-lg">${Number(workspace?.quote?.total_annual_cost || 0).toFixed(2)}</p>
          <p className="text-xs text-zinc-400">Gross Margin</p>
          <p className={`font-mono text-lg ${Number(workspace?.quote?.projected_gross_margin_percent || 0) < 0 ? "text-rose-300" : "text-emerald-300"}`}>
            {Number(workspace?.quote?.projected_gross_margin_percent || 0).toFixed(2)}%
          </p>

          {phantomBlocks.length > 0 && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
              <AlertTriangle className="mr-1 inline h-3 w-3" />
              Cannot export: unsupervised participants detected ({phantomBlocks.length} blocks).
            </div>
          )}

          <div className="space-y-1">
            <button
              disabled={!selectedQuoteId}
              onClick={() => startTransition(async () => {
                await setSilQuoteStatusAction({ quote_id: selectedQuoteId, status: "pending_approval" });
                await refreshSelected();
              })}
              className="w-full rounded border border-zinc-700 px-2 py-1 text-xs"
            >
              <Send className="mr-1 inline h-3 w-3" /> Mark Pending
            </button>
            <button
              disabled={!selectedQuoteId}
              onClick={() => startTransition(async () => {
                await setSilQuoteStatusAction({ quote_id: selectedQuoteId, status: "approved" });
                await refreshSelected();
              })}
              className="w-full rounded border border-emerald-500/40 bg-emerald-600/20 px-2 py-1 text-xs"
            >
              <Save className="mr-1 inline h-3 w-3" /> Approve
            </button>
            <button
              disabled={!selectedQuoteId || phantomBlocks.length > 0 || pending}
              onClick={() => startTransition(async () => {
                const out = await generateSilRocExcelAction({ quote_id: selectedQuoteId, organization_id: orgId! });
                if (out?.download_url) window.open(out.download_url, "_blank");
              })}
              className="w-full rounded border border-cyan-500/40 bg-cyan-600/20 px-2 py-1 text-xs"
            >
              <FileSpreadsheet className="mr-1 inline h-3 w-3" /> Generate NDIS RoC
            </button>
            <button
              disabled={!selectedQuoteId || workspace?.participants?.length === 0}
              onClick={() => startTransition(async () => {
                const participant = workspace.participants[0];
                await publishSilFamilyPdfAction({
                  quote_id: selectedQuoteId,
                  organization_id: orgId!,
                  participant_id: participant.participant_id,
                });
                setMsg("Family PDF generated and published for signature.");
              })}
              className="w-full rounded border border-zinc-700 px-2 py-1 text-xs"
            >
              Publish Family PDF
            </button>
            <button
              disabled={!selectedQuoteId}
              onClick={() => startTransition(async () => {
                const desc = window.prompt("Irregular support description", "Unplanned hospital escorts");
                const annual = window.prompt("Annual amount", "2000");
                if (!desc || !annual) return;
                await addIrregularSilSupportAction({
                  quote_id: selectedQuoteId,
                  description: desc,
                  annual_cost: Number(annual),
                });
                await refreshSelected();
              })}
              className="w-full rounded border border-zinc-700 px-2 py-1 text-xs"
            >
              Add Irregular Support
            </button>
            <button
              disabled={!selectedQuoteId}
              onClick={() => startTransition(async () => {
                const participant = workspace?.participants?.[0];
                const block = workspace?.blocks?.[0];
                if (!participant || !block) return;
                await setBlockParticipantShareOverrideAction({
                  quote_id: selectedQuoteId,
                  participant_id: participant.participant_id,
                  block_id: block.id,
                  share_override: 0.5,
                });
                await refreshSelected();
              })}
              className="w-full rounded border border-zinc-700 px-2 py-1 text-xs"
            >
              Demo Split Override
            </button>
            <button
              disabled={!selectedQuoteId}
              onClick={() => startTransition(async () => {
                await syncSilQuoteToMasterRosterAction({ quote_id: selectedQuoteId });
                setMsg("Synced to master roster templates.");
              })}
              className="w-full rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs"
            >
              Sync to Master Roster
            </button>
          </div>

          {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        </section>
      </div>
    </main>
  );
}

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
        if (!block) return <div key={i} className="h-6 w-20 shrink-0 border border-zinc-900" />;
        return (
          <div
            key={i}
            className={`flex h-6 w-20 shrink-0 cursor-pointer items-center justify-center border text-center text-[10px] ${ratioClass(block.active_workers, block.active_participants)}`}
            onClick={() => void patchBlock(block, { active_workers: (block.active_workers + 1) % 4 })}
            onContextMenu={(e) => {
              e.preventDefault();
              void patchBlock(block, { is_sleepover: !block.is_sleepover, is_active_night: false });
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
    <div className="overflow-auto">
      <div className="flex border-b border-zinc-800">
        <div className="sticky left-0 z-10 w-16 shrink-0 bg-zinc-950 px-2 py-1 text-[10px] font-semibold">Time</div>
        {days.map((d) => (
          <div key={d} className="w-20 shrink-0 px-2 py-1 text-center text-[10px] font-semibold">{d}</div>
        ))}
      </div>
      <div ref={parentRef} className="h-[600px] overflow-auto">
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
