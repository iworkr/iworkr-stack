"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  X,
  Clock,
  Receipt,
  Play,
  Square,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  listCoordinationEntriesAction,
  createCoordinationEntryAction,
  listCoordinationParticipantsAction,
  getCoordinationLedgerSummaryAction,
} from "@/app/actions/coordination";

/* ── Types ────────────────────────────────────────────── */

type CoordEntry = {
  id: string;
  participant_id: string;
  start_time: string;
  end_time: string;
  raw_duration_minutes: number;
  billable_units: number;
  ndis_line_item: string;
  hourly_rate: number;
  total_charge: number;
  billable_charge: number;
  activity_type: string;
  case_note: string;
  status: string;
  created_at: string;
  participant_profiles?: {
    preferred_name?: string;
    full_name?: string;
    clients?: { name?: string };
    ndis_number?: string;
  } | null;
};

type Participant = { id: string; name: string };

type TabFilter = "all" | "unbilled" | "invoiced" | "draft";

type Summary = {
  weekly_billable_hours: number;
  unbilled_wip: number;
  invoiced_mtd: number;
  draft_entries: number;
};

/* ── Helpers ──────────────────────────────────────────── */

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

function getParticipantName(e: CoordEntry): string {
  return e.participant_profiles?.preferred_name || e.participant_profiles?.full_name || e.participant_profiles?.clients?.name || "Participant";
}

function getInitials(name: string): string {
  const p = name.split(" ").filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return (p[0]?.[0] || "?").toUpperCase();
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
  const e = new Date(end).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${s} – ${e}`;
}

function activityLabel(t: string): string {
  const map: Record<string, string> = { phone: "Phone Call", email: "Email / Correspondence", research: "Research", meeting: "Meeting", report_writing: "Report Writing", travel: "Travel", other: "Other" };
  return map[t] || t;
}

function statusLabel(s: string): string {
  const m: Record<string, string> = { draft: "Draft", unbilled: "Unbilled", invoiced: "Invoiced", paid: "Paid" };
  return m[s] || s;
}

function statusStyle(s: string): string {
  const m: Record<string, string> = {
    draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    unbilled: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    invoiced: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
  return m[s] || m.draft;
}

function matchesTab(e: CoordEntry, tab: TabFilter): boolean {
  if (tab === "all") return true;
  if (tab === "invoiced") return e.status === "invoiced" || e.status === "paid";
  return e.status === tab;
}

/* ── MetricNode ───────────────────────────────────────── */

function MetricNode({ label, value, danger, pulse }: { label: string; value: string | number; danger?: boolean; pulse?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
        <span className={`font-mono text-xl leading-none ${danger ? "text-amber-500 font-bold" : "text-white"}`}>{value}</span>
      </div>
    </div>
  );
}

/* ── SkeletonRow ──────────────────────────────────────── */

const SK = [
  { a: "w-28", b: "w-40", c: "w-20", d: "w-16" },
  { a: "w-36", b: "w-32", c: "w-24", d: "w-20" },
  { a: "w-24", b: "w-36", c: "w-20", d: "w-16" },
  { a: "w-32", b: "w-28", c: "w-24", d: "w-20" },
  { a: "w-28", b: "w-40", c: "w-20", d: "w-16" },
  { a: "w-36", b: "w-32", c: "w-24", d: "w-20" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SK[idx % SK.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse" /><div className={`h-3 ${s.a} bg-zinc-900 rounded-sm animate-pulse`} /></div></td>
      <td className="px-4 py-3"><div className="space-y-1.5"><div className={`h-3 ${s.b} bg-zinc-900 rounded-sm animate-pulse`} /><div className="h-2 w-44 bg-zinc-900/60 rounded-sm animate-pulse" /></div></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.c} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.d} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── EmptyState ───────────────────────────────────────── */

function EmptyState({ tab, onLog }: { tab: TabFilter; onLog: () => void }) {
  const isClean = tab === "unbilled";
  return (
    <tr><td colSpan={6}>
      <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
        {isClean ? (
          <>
            <Receipt className="w-8 h-8 text-emerald-500/50 mb-4" />
            <p className="text-[15px] text-white font-medium">No unbilled entries.</p>
            <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">All your logged coordination time has been successfully invoiced.</p>
          </>
        ) : (
          <>
            <Clock className="w-8 h-8 text-zinc-800 mb-4" />
            <p className="text-[15px] text-white font-medium">No entries found.</p>
            <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">Start logging your coordination time to build the billing ledger.</p>
            <button onClick={onLog} className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95">Log Time</button>
          </>
        )}
      </div>
    </td></tr>
  );
}

/* ── LogTimeSlideOver ─────────────────────────────────── */

function LogTimeSlideOver({
  open,
  onClose,
  orgId,
  participants,
  onSaved,
  editEntry,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  participants: Participant[];
  onSaved: () => void;
  editEntry: CoordEntry | null;
}) {
  const [form, setForm] = useState({
    participant_id: "",
    start_time: "",
    end_time: "",
    ndis_line_item: "07_002_0106_8_3",
    hourly_rate: "65.09",
    activity_type: "phone" as string,
    case_note: "",
    status: "unbilled" as "draft" | "unbilled",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [useTimer, setUseTimer] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<Date | null>(null);

  // Populate form from editEntry
  useEffect(() => {
    if (editEntry) {
      setForm({
        participant_id: editEntry.participant_id,
        start_time: editEntry.start_time ? new Date(editEntry.start_time).toISOString().slice(0, 16) : "",
        end_time: editEntry.end_time ? new Date(editEntry.end_time).toISOString().slice(0, 16) : "",
        ndis_line_item: editEntry.ndis_line_item || "07_002_0106_8_3",
        hourly_rate: String(editEntry.hourly_rate || 65.09),
        activity_type: editEntry.activity_type || "phone",
        case_note: editEntry.case_note || "",
        status: "unbilled",
      });
    }
  }, [editEntry]);

  const durationMins = useMemo(() => {
    if (useTimer) return Math.floor(timerSeconds / 60);
    if (!form.start_time || !form.end_time) return 0;
    return Math.max(0, Math.round((new Date(form.end_time).getTime() - new Date(form.start_time).getTime()) / 60000));
  }, [form.start_time, form.end_time, useTimer, timerSeconds]);

  const startTimer = () => {
    timerStartRef.current = new Date();
    setTimerRunning(true);
    setTimerSeconds(0);
    timerRef.current = setInterval(() => {
      if (timerStartRef.current) {
        setTimerSeconds(Math.floor((Date.now() - timerStartRef.current.getTime()) / 1000));
      }
    }, 1000);
  };

  const stopTimer = () => {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerStartRef.current) {
      const end = new Date();
      setForm((s) => ({
        ...s,
        start_time: timerStartRef.current!.toISOString().slice(0, 16),
        end_time: end.toISOString().slice(0, 16),
      }));
    }
  };

  // Cleanup
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleSave = async (asDraft: boolean) => {
    if (!form.participant_id || !form.case_note || form.case_note.length < 30) {
      setError("Participant and a case note (min 30 chars) are required.");
      return;
    }
    if (!form.start_time || !form.end_time) {
      setError("Start and end time are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createCoordinationEntryAction({
        organization_id: orgId,
        participant_id: form.participant_id,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        ndis_line_item: form.ndis_line_item,
        hourly_rate: Number(form.hourly_rate) || 65.09,
        activity_type: form.activity_type as "phone" | "email" | "research" | "meeting" | "report_writing" | "travel" | "other",
        case_note: form.case_note,
      });
      onSaved();
      onClose();
      // Reset
      setForm({ participant_id: "", start_time: "", end_time: "", ndis_line_item: "07_002_0106_8_3", hourly_rate: "65.09", activity_type: "phone", case_note: "", status: "unbilled" });
      setTimerSeconds(0);
      setUseTimer(false);
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  };

  const timerDisplay = `${String(Math.floor(timerSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed right-0 top-0 bottom-0 z-50 w-[450px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-base font-medium text-white">{editEntry ? "Edit Entry" : "Log Coordination Time"}</h2>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500"><X className="w-4 h-4" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Live Timer Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Use Live Timer</span>
                <button
                  onClick={() => { setUseTimer(!useTimer); if (timerRunning) stopTimer(); }}
                  className={`relative w-10 h-5 rounded-full transition-colors ${useTimer ? "bg-emerald-500" : "bg-zinc-800"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useTimer ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {useTimer && (
                <div className="text-center py-4 rounded-lg border border-white/5 bg-zinc-900/50">
                  <p className="font-mono text-4xl text-white tracking-wider">{timerDisplay}</p>
                  <div className="mt-3 flex justify-center gap-3">
                    {!timerRunning ? (
                      <button onClick={startTimer} className="h-8 px-4 rounded-md bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500 transition-colors"><Play className="w-3 h-3" />Start</button>
                    ) : (
                      <button onClick={stopTimer} className="h-8 px-4 rounded-md bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500 transition-colors"><Square className="w-3 h-3" />Stop</button>
                    )}
                  </div>
                </div>
              )}

              {/* Participant */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Participant</label>
                <select value={form.participant_id} onChange={(e) => setForm((s) => ({ ...s, participant_id: e.target.value }))} className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700">
                  <option value="">Select participant…</option>
                  {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Date/Time */}
              {!useTimer && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Start</label>
                    <input type="datetime-local" value={form.start_time} onChange={(e) => setForm((s) => ({ ...s, start_time: e.target.value }))} className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">End</label>
                    <input type="datetime-local" value={form.end_time} onChange={(e) => setForm((s) => ({ ...s, end_time: e.target.value }))} className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700" />
                  </div>
                </div>
              )}

              {/* Duration (read-only) */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Duration</label>
                <div className="h-9 rounded-md border border-white/5 bg-zinc-900/50 px-3 flex items-center font-mono text-sm text-white">
                  {formatDuration(durationMins)}
                </div>
              </div>

              {/* Activity Type */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Activity Type</label>
                <select value={form.activity_type} onChange={(e) => setForm((s) => ({ ...s, activity_type: e.target.value }))} className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700">
                  {["phone", "email", "research", "meeting", "report_writing", "travel", "other"].map((t) => <option key={t} value={t}>{activityLabel(t)}</option>)}
                </select>
              </div>

              {/* NDIS Line Item */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">NDIS Support Item</label>
                <input value={form.ndis_line_item} onChange={(e) => setForm((s) => ({ ...s, ndis_line_item: e.target.value }))} placeholder="07_002_0106_8_3" className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white font-mono placeholder:text-zinc-600 outline-none focus:border-zinc-700" />
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Hourly Rate ($)</label>
                <input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm((s) => ({ ...s, hourly_rate: e.target.value }))} className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white font-mono placeholder:text-zinc-600 outline-none focus:border-zinc-700" />
              </div>

              {/* Case Note */}
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Case Note</label>
                <textarea
                  value={form.case_note}
                  onChange={(e) => setForm((s) => ({ ...s, case_note: e.target.value }))}
                  rows={5}
                  placeholder="Detail the actions taken, outcomes achieved, and next steps..."
                  className="w-full rounded-md border border-white/5 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 resize-none leading-relaxed"
                />
                <span className="text-[10px] text-zinc-600 mt-1 block">{form.case_note.length}/8000 (min 30)</span>
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-[#050505] shrink-0 flex gap-3">
              <button onClick={() => handleSave(true)} disabled={saving} className="w-1/3 h-10 rounded-md border border-white/5 text-zinc-400 text-xs font-medium hover:bg-white/5 transition-colors disabled:opacity-50">Save as Draft</button>
              <button onClick={() => handleSave(false)} disabled={saving} className="w-2/3 h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50">{saving ? "Saving…" : "Finalize Entry"}</button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CoordinationLedgerPage() {
  const { orgId } = useOrg();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<CoordEntry[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [summary, setSummary] = useState<Summary>({ weekly_billable_hours: 0, unbilled_wip: 0, invoiced_mtd: 0, draft_entries: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CoordEntry | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [rows, parts, sum] = await Promise.all([
        listCoordinationEntriesAction({ organization_id: orgId }),
        listCoordinationParticipantsAction(orgId),
        getCoordinationLedgerSummaryAction(orgId),
      ]);
      setEntries((rows || []) as CoordEntry[]);
      setParticipants(parts as Participant[]);
      setSummary(sum);
    } catch { /* silent */ }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = entries.filter((e) => matchesTab(e, tab));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        getParticipantName(e).toLowerCase().includes(q) ||
        (e.case_note?.toLowerCase().includes(q)) ||
        (e.activity_type?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entries, tab, search]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All Entries" },
    { key: "unbilled", label: "Unbilled WIP" },
    { key: "invoiced", label: "Invoiced" },
    { key: "draft", label: "Drafts" },
  ];

  const handleRowClick = (e: CoordEntry) => {
    setEditEntry(e);
    setSlideOpen(true);
  };

  const handleLogNew = () => {
    setEditEntry(null);
    setSlideOpen(true);
  };

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">Financials & PRODA</span>
          <span className="mx-2 text-zinc-700">→</span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 font-semibold select-none">Coordination Ledger</span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${tab === t.key ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, participants…" className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors" />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors"><SlidersHorizontal className="w-3 h-3" />Filters</button>
          <button onClick={handleLogNew} className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"><Clock className="w-3 h-3 inline-block mr-1.5 -mt-px" />Log Time</button>
        </div>
      </div>

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="flex items-center h-16 px-8 border-b border-white/5 bg-zinc-950/30 shrink-0 overflow-x-auto gap-0">
        <MetricNode label="Weekly Billable Hours" value={`${summary.weekly_billable_hours}h`} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Unbilled WIP (Value)" value={formatCurrency(summary.unbilled_wip)} danger={summary.unbilled_wip > 5000} pulse={summary.unbilled_wip > 5000} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Invoiced MTD" value={formatCurrency(summary.invoiced_mtd)} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Draft Entries" value={summary.draft_entries} />
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Participant</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Activity / Note</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Date & Time</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Duration & Item</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Status</th>
              <th className="px-4 w-[5%]" />
            </tr>
          </thead>
          <tbody>
            {loading && entries.length === 0 && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} idx={i} />)}
            {!loading && filtered.length === 0 && <EmptyState tab={tab} onLog={handleLogNew} />}
            {!loading && filtered.map((e) => {
              const name = getParticipantName(e);
              const ndisNum = e.participant_profiles?.ndis_number;
              const mins = Number(e.raw_duration_minutes || 0);
              return (
                <tr key={e.id} onClick={() => handleRowClick(e)} className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16">
                  {/* Participant */}
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-zinc-400 font-medium">{getInitials(name)}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-zinc-100 font-medium truncate block">{name}</span>
                        {ndisNum && <span className="text-[10px] font-mono text-zinc-500 truncate block">NDIS: {ndisNum}</span>}
                      </div>
                    </div>
                  </td>
                  {/* Activity / Note */}
                  <td className="px-4 py-3 min-w-0">
                    <span className="text-[13px] text-white font-medium block truncate">{activityLabel(e.activity_type)}</span>
                    <span className="text-xs text-zinc-400 block truncate max-w-[250px]">{e.case_note?.slice(0, 80) || "—"}{(e.case_note?.length || 0) > 80 ? "…" : ""}</span>
                  </td>
                  {/* Date & Time */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-300 block">{formatDate(e.start_time)}</span>
                    <span className="font-mono text-[11px] text-zinc-500 block">{formatTimeRange(e.start_time, e.end_time)}</span>
                  </td>
                  {/* Duration & Item */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-[13px] text-white block">{formatDuration(mins)}</span>
                    <span className="font-mono text-[10px] text-zinc-500 block">{e.ndis_line_item || "—"}</span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${statusStyle(e.status)}`}>{statusLabel(e.status)}</span>
                  </td>
                  {/* Action */}
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── LogTime SlideOver ────────────────────────────── */}
      <LogTimeSlideOver open={slideOpen} onClose={() => { setSlideOpen(false); setEditEntry(null); }} orgId={orgId || ""} participants={participants} onSaved={load} editEntry={editEntry} />
    </div>
  );
}
