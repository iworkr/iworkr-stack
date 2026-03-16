"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Pause, Square, Timer, Plus, X, Clock3, Save, Keyboard, AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/hooks/use-org";
import { useChronosStore, type ChronosActivityType, type ChronosTimer } from "@/lib/chronos-store";
import { createCoordinationEntryAction, listCoordinationParticipantsAction } from "@/app/actions/coordination";

const DEFAULT_LINE_ITEM = "07_001_0106_8_3";
const DEFAULT_RATE = 95.0;

const activities: Array<{ value: ChronosActivityType; label: string }> = [
  { value: "phone", label: "Phone Call" },
  { value: "email", label: "Email" },
  { value: "research", label: "Research" },
  { value: "meeting", label: "Case Conference" },
  { value: "report_writing", label: "Report Writing" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function billingFromMs(ms: number, hourlyRate: number) {
  const rawMinutes = Math.max(1, Math.floor(ms / 60000));
  const billableUnits = Math.ceil(rawMinutes / 6);
  const billableHours = billableUnits * 0.1;
  const totalCharge = Number((billableHours * hourlyRate).toFixed(2));
  return { rawMinutes, billableUnits, billableHours, totalCharge };
}

function extractParticipantContext(pathname: string): string | null {
  const m = pathname.match(/\/dashboard\/(?:care\/)?participants\/([^/]+)/);
  return m?.[1] || null;
}

export function ChronosFAB() {
  const pathname = usePathname();
  const { orgId } = useOrg();
  const supabase = useMemo(() => createClient(), []);
  const [expanded, setExpanded] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState("");
  const [contextParticipant, setContextParticipant] = useState<{ id: string; name: string } | null>(null);
  const [autoPauseBanner, setAutoPauseBanner] = useState<string | null>(null);

  const timers = useChronosStore((s) => s.timers);
  const selectedTimerId = useChronosStore((s) => s.selectedTimerId);
  const selectTimer = useChronosStore((s) => s.selectTimer);
  const startTimer = useChronosStore((s) => s.startTimer);
  const pauseTimer = useChronosStore((s) => s.pauseTimer);
  const resumeTimer = useChronosStore((s) => s.resumeTimer);
  const stopTimer = useChronosStore((s) => s.stopTimer);
  const removeTimer = useChronosStore((s) => s.removeTimer);
  const updateTimerDraft = useChronosStore((s) => s.updateTimerDraft);
  const elapsedMs = useChronosStore((s) => s.elapsedMs);
  const runningTimerCount = useChronosStore((s) => s.runningTimerCount);
  const setLastInteractionNow = useChronosStore((s) => s.setLastInteractionNow);
  const lastInteractionAtIso = useChronosStore((s) => s.lastInteractionAtIso);

  const selectedTimer = timers.find((t) => t.id === selectedTimerId) || null;
  const activeCount = runningTimerCount();

  useEffect(() => {
    const i = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const participantId = extractParticipantContext(pathname);
    if (!participantId) return;
    if (contextParticipant?.id === participantId) return;
    void (async () => {
      const { data } = await supabase
        .from("participant_profiles")
        .select("id, preferred_name, clients(name)")
        .eq("id", participantId)
        .maybeSingle();
      if (!data) return;
      setContextParticipant({
        id: data.id as string,
        name: ((data as any).preferred_name as string | null) || ((data as any).clients?.name as string) || "Participant",
      });
    })();
  }, [pathname, supabase, contextParticipant?.id]);

  useEffect(() => {
    if (!expanded || !orgId) return;
    void (async () => {
      const list = await listCoordinationParticipantsAction(orgId, search);
      setParticipants(list);
    })();
  }, [expanded, orgId, search]);

  useEffect(() => {
    const handler = () => setLastInteractionNow();
    const keys = ["mousemove", "keydown", "click", "scroll"];
    keys.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => keys.forEach((e) => window.removeEventListener(e, handler));
  }, [setLastInteractionNow]);

  useEffect(() => {
    const check = setInterval(() => {
      if (!lastInteractionAtIso) return;
      const inactiveMs = Date.now() - new Date(lastInteractionAtIso).getTime();
      if (inactiveMs < 120 * 60 * 1000) return;
      const running = timers.filter((t) => t.status === "running");
      if (running.length === 0) return;
      running.forEach((t) => pauseTimer(t.id, true));
      setAutoPauseBanner(`Chronos auto-paused ${running.length} timer(s) after 120 minutes inactivity.`);
    }, 10000);
    return () => clearInterval(check);
  }, [lastInteractionAtIso, timers, pauseTimer]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (!selectedTimer) {
        if (!contextParticipant) {
          setExpanded(true);
          setError("Open a participant profile first or choose participant in Chronos.");
          return;
        }
        const id = startTimer({
          participantId: contextParticipant.id,
          participantName: contextParticipant.name,
          activityType: "phone",
          ndisLineItem: DEFAULT_LINE_ITEM,
          hourlyRate: DEFAULT_RATE,
          metadata: { source: "shortcut", route: pathname },
        });
        selectTimer(id);
        setExpanded(true);
        return;
      }
      if (selectedTimer.status === "running") stopTimer(selectedTimer.id);
      else if (selectedTimer.status === "paused") resumeTimer(selectedTimer.id);
      else removeTimer(selectedTimer.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTimer, contextParticipant, pathname, startTimer, stopTimer, resumeTimer, removeTimer, selectTimer]);

  async function saveTimer(timer: ChronosTimer) {
    if (!orgId) return;
    const ms = elapsedMs(timer.id);
    const end = new Date();
    const start = new Date(end.getTime() - ms);
    setSaving(true);
    setError(null);
    try {
      await createCoordinationEntryAction({
        organization_id: orgId,
        participant_id: timer.participantId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        ndis_line_item: timer.ndisLineItem,
        hourly_rate: timer.hourlyRate,
        activity_type: timer.activityType,
        case_note: timer.caseNoteDraft,
        metadata: timer.metadata,
      });
      removeTimer(timer.id);
      setExpanded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function startContextTimer() {
    if (!contextParticipant) {
      setError("Choose a participant before starting Chronos.");
      return;
    }
    const id = startTimer({
      participantId: contextParticipant.id,
      participantName: contextParticipant.name,
      activityType: "phone",
      ndisLineItem: DEFAULT_LINE_ITEM,
      hourlyRate: DEFAULT_RATE,
      metadata: { source: "contextual", route: pathname },
    });
    selectTimer(id);
    setExpanded(true);
  }

  const selectedElapsed = selectedTimer ? elapsedMs(selectedTimer.id) : 0;
  const selectedBilling = selectedTimer ? billingFromMs(selectedElapsed, selectedTimer.hourlyRate) : null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70]">
      <div className="pointer-events-auto">
        {autoPauseBanner && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {autoPauseBanner}
          </div>
        )}

        <div
          className={`rounded-2xl border bg-zinc-950/95 backdrop-blur-xl shadow-2xl transition-all ${
            activeCount > 0 ? "border-cyan-400/60 ring-1 ring-cyan-400/35" : "border-zinc-800"
          } ${expanded ? "w-[420px]" : "w-[280px]"}`}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/[0.06]"
            >
              <Timer size={14} />
              Chronos
            </button>
            <div className="font-mono text-xs text-zinc-400">{activeCount} active</div>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={startContextTimer} className="rounded-md p-1.5 text-zinc-300 hover:bg-white/[0.06]">
                <Plus size={14} />
              </button>
              <button onClick={() => setManualOpen((v) => !v)} className="rounded-md p-1.5 text-zinc-300 hover:bg-white/[0.06]">
                <Clock3 size={14} />
              </button>
            </div>
          </div>

          {!expanded && (
            <div className="border-t border-zinc-800 px-3 py-2">
              <p className="font-mono text-sm text-zinc-200">{selectedTimer ? fmtClock(selectedElapsed) : "00:00:00"}</p>
              <p className="text-[11px] text-zinc-500">
                {selectedTimer ? `${selectedTimer.participantName} • ${selectedTimer.activityType}` : "Cmd+Shift+S to start"}
              </p>
            </div>
          )}

          {expanded && (
            <div className="border-t border-zinc-800 p-3">
              <div className="mb-2 flex flex-wrap gap-1">
                {timers.map((timer) => (
                  <button
                    key={timer.id}
                    onClick={() => selectTimer(timer.id)}
                    className={`rounded-md px-2 py-1 text-[11px] ${
                      selectedTimer?.id === timer.id ? "bg-cyan-500/20 text-cyan-200" : "bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    {timer.participantName} · {fmtClock(elapsedMs(timer.id))}
                  </button>
                ))}
              </div>

              {!selectedTimer && (
                <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
                  No timer selected. Start one with <span className="font-mono">Cmd+Shift+S</span>.
                </div>
              )}

              {selectedTimer && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={selectedTimer.participantName}
                      onChange={(e) =>
                        updateTimerDraft(selectedTimer.id, {
                          participantName: e.target.value,
                        })
                      }
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                      placeholder="Participant"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                      placeholder="Search participant..."
                    />
                  </div>

                  {search.trim().length > 1 && (
                    <div className="max-h-24 overflow-auto rounded-md border border-zinc-800 bg-zinc-900">
                      {participants.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            updateTimerDraft(selectedTimer.id, {
                              participantId: p.id,
                              participantName: p.name,
                            });
                            setSearch("");
                          }}
                          className="block w-full border-b border-zinc-800 px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedTimer.activityType}
                      onChange={(e) => updateTimerDraft(selectedTimer.id, { activityType: e.target.value as ChronosActivityType })}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                    >
                      {activities.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <input
                      value={selectedTimer.ndisLineItem}
                      onChange={(e) => updateTimerDraft(selectedTimer.id, { ndisLineItem: e.target.value })}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-200"
                      placeholder="NDIS line item"
                    />
                  </div>

                  <div className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-2">
                    <div className="font-mono text-base text-zinc-100">{fmtClock(selectedElapsed)}</div>
                    {selectedBilling && (
                      <div className="text-[11px] text-zinc-400">
                        {selectedBilling.rawMinutes}m to {selectedBilling.billableUnits} units ({selectedBilling.billableHours.toFixed(1)}h) to ${selectedBilling.totalCharge.toFixed(2)}
                      </div>
                    )}
                  </div>

                  {selectedTimer.status !== "ready_to_save" && (
                    <div className="flex items-center gap-1">
                      {selectedTimer.status === "running" ? (
                        <button onClick={() => pauseTimer(selectedTimer.id)} className="rounded-md bg-zinc-800 px-2 py-1.5 text-xs text-zinc-100"><Pause size={12} className="inline mr-1" />Pause</button>
                      ) : (
                        <button onClick={() => resumeTimer(selectedTimer.id)} className="rounded-md bg-cyan-600 px-2 py-1.5 text-xs text-white"><Play size={12} className="inline mr-1" />Resume</button>
                      )}
                      <button onClick={() => stopTimer(selectedTimer.id)} className="rounded-md bg-amber-600 px-2 py-1.5 text-xs text-white"><Square size={12} className="inline mr-1" />Stop</button>
                      <button onClick={() => removeTimer(selectedTimer.id)} className="ml-auto rounded-md px-2 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"><X size={12} className="inline mr-1" />Close</button>
                    </div>
                  )}

                  {selectedTimer.status === "ready_to_save" && (
                    <>
                      <textarea
                        value={selectedTimer.caseNoteDraft}
                        onChange={(e) => updateTimerDraft(selectedTimer.id, { caseNoteDraft: e.target.value })}
                        className="h-20 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
                        placeholder="Minimum 30 characters clinical case note..."
                      />
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <Keyboard size={12} />
                        Cmd+Shift+S saves/closes selected timer.
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void saveTimer(selectedTimer)}
                          disabled={saving || selectedTimer.caseNoteDraft.trim().length < 30}
                          className="rounded-md bg-emerald-600 px-2 py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          <Save size={12} className="inline mr-1" />
                          Save to Ledger
                        </button>
                        {selectedTimer.caseNoteDraft.trim().length < 30 && (
                          <span className="text-[11px] text-amber-300">Case note must be at least 30 characters.</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {manualOpen && orgId && (
                <ManualLogPanel
                  orgId={orgId}
                  participants={participants}
                  onSaved={() => {
                    setManualOpen(false);
                    setExpanded(false);
                  }}
                  onError={(msg) => setError(msg)}
                />
              )}

              {error && (
                <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
                  <AlertTriangle size={12} className="mr-1 inline" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <span className="hidden">{tick}</span>
    </div>
  );
}

function ManualLogPanel({
  orgId,
  participants,
  onSaved,
  onError,
}: {
  orgId: string;
  participants: Array<{ id: string; name: string }>;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [participantId, setParticipantId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [activityType, setActivityType] = useState<ChronosActivityType>("other");
  const [note, setNote] = useState("");
  const [lineItem, setLineItem] = useState(DEFAULT_LINE_ITEM);
  const [rate, setRate] = useState(String(DEFAULT_RATE));
  const [saving, setSaving] = useState(false);

  const projected = useMemo(() => {
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (!s || !e || e <= s) return null;
    const ms = e.getTime() - s.getTime();
    return billingFromMs(ms, Number(rate || "0"));
  }, [start, end, rate]);

  async function save() {
    try {
      if (!participantId) throw new Error("Select participant.");
      if (!start || !end) throw new Error("Start and end time required.");
      if (note.trim().length < 30) throw new Error("Case note must be at least 30 characters.");
      setSaving(true);
      await createCoordinationEntryAction({
        organization_id: orgId,
        participant_id: participantId,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        ndis_line_item: lineItem,
        hourly_rate: Number(rate),
        activity_type: activityType,
        case_note: note,
        metadata: { source: "manual_log", participant_name: participantName },
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900 p-2">
      <p className="mb-2 text-xs font-medium text-zinc-300">Manual Log</p>
      <select
        value={participantId}
        onChange={(e) => {
          const id = e.target.value;
          const p = participants.find((x) => x.id === id);
          setParticipantId(id);
          setParticipantName(p?.name || "");
        }}
        className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200"
      >
        <option value="">Select participant</option>
        {participants.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200" />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200" />
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <select value={activityType} onChange={(e) => setActivityType(e.target.value as ChronosActivityType)} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200">
          {activities.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <input value={lineItem} onChange={(e) => setLineItem(e.target.value)} className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200" />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} className="mb-2 h-16 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200" placeholder="Case note (min 30 chars)" />
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          {projected
            ? `${projected.rawMinutes}m -> ${projected.billableUnits} units (${projected.billableHours.toFixed(1)}h) -> $${projected.totalCharge.toFixed(2)}`
            : "Projected billing will appear here"}
        </span>
        <button onClick={() => void save()} disabled={saving} className="rounded-md bg-emerald-600 px-2 py-1 text-white disabled:opacity-50">Save</button>
      </div>
    </div>
  );
}

