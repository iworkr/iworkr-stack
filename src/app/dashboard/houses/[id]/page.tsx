/**
 * @page /dashboard/houses/[id]
 * @status COMPLETE
 * @description SIL house detail with participants, staff, notes, and maintenance tabs
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Users, DollarSign, Wrench, MessageSquare, ChevronLeft,
  Plus, Pin, PinOff, ArrowLeft, ArrowRight, Clock, UserPlus,
  Loader2, AlertTriangle, ShieldCheck, Crown, X, Minus,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchHouseDetail, fetchHouseParticipants, fetchHouseStaff,
  fetchHouseNotes, createHouseNote, toggleNotePin,
  fetchPettyCashLog, deductPettyCash, topUpPettyCash,
  fetchHouseRoster, addParticipantToHouse, addStaffToHouse,
  removeParticipantFromHouse, removeStaffFromHouse, updateStaffRole,
  type CareHouse, type HouseStaffMember, type HouseNote, type PettyCashEntry,
} from "@/app/actions/care-houses";
import { fetchParticipants } from "@/app/actions/participants";

type Tab = "roster" | "team" | "notes" | "finances" | "residents";

export default function HouseDetailPage() {
  const { id: houseId } = useParams<{ id: string }>();
  const { orgId } = useOrg();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("roster");
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: house } = useQuery<CareHouse | null>({
    queryKey: ["care-house", houseId],
    queryFn: () => fetchHouseDetail(houseId),
    staleTime: 60_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["house-participants", houseId],
    queryFn: () => fetchHouseParticipants(houseId),
    staleTime: 60_000,
  });

  const { data: staff = [] } = useQuery<HouseStaffMember[]>({
    queryKey: ["house-staff", houseId],
    queryFn: () => fetchHouseStaff(houseId),
    staleTime: 60_000,
  });

  const { data: notes = [] } = useQuery<HouseNote[]>({
    queryKey: ["house-notes", houseId],
    queryFn: () => fetchHouseNotes(houseId),
    staleTime: 30_000,
  });

  const { data: pettyCashLog = [] } = useQuery<PettyCashEntry[]>({
    queryKey: ["house-petty-cash", houseId],
    queryFn: () => fetchPettyCashLog(houseId),
    staleTime: 30_000,
  });

  const weekDates = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() + 1 + weekOffset * 7);
    const from = start.toISOString();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59);
    const to = end.toISOString();
    return { from, to, startLabel: start.toLocaleDateString("en-AU", { month: "short", day: "numeric" }), endLabel: end.toLocaleDateString("en-AU", { month: "short", day: "numeric" }) };
  }, [weekOffset]);

  const { data: roster = [] } = useQuery({
    queryKey: ["house-roster", houseId, orgId, weekDates.from, weekDates.to],
    queryFn: () => fetchHouseRoster(houseId, orgId!, weekDates.from, weekDates.to),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const leader = staff.find((s) => s.role === "leader");
  const coreTeam = staff.filter((s) => s.role === "core_team");
  const floatPool = staff.filter((s) => s.role === "float_pool");

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "roster", label: "Roster", icon: <Clock size={13} /> },
    { id: "residents", label: "Residents", icon: <Users size={13} />, count: participants.length },
    { id: "team", label: "Team", icon: <ShieldCheck size={13} />, count: staff.length },
    { id: "notes", label: "Notes", icon: <MessageSquare size={13} />, count: notes.length },
    { id: "finances", label: "Petty Cash", icon: <DollarSign size={13} /> },
  ];

  if (!house) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <Loader2 size={20} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Header */}
      <div className="border-b border-zinc-800/60 px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.push("/dashboard/houses")} className="text-zinc-500 hover:text-white">
            <ChevronLeft size={16} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
            <Home size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white">{house.name}</h1>
            {house.address?.line1 && <p className="text-[10px] text-zinc-500">{house.address.line1}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                tab === t.id ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1 text-[9px] text-zinc-600">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "roster" && <RosterTab roster={roster} weekDates={weekDates} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />}
        {tab === "residents" && <ResidentsTab houseId={houseId} participants={participants} orgId={orgId!} qc={qc} />}
        {tab === "team" && <TeamTab houseId={houseId} leader={leader} coreTeam={coreTeam} floatPool={floatPool} orgId={orgId!} qc={qc} />}
        {tab === "notes" && <NotesTab houseId={houseId} notes={notes} qc={qc} />}
        {tab === "finances" && <FinancesTab houseId={houseId} house={house} pettyCashLog={pettyCashLog} qc={qc} />}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ Roster Tab ━━━━━━━━━━━━━━━━━━━ */

function RosterTab({ roster, weekDates, weekOffset, setWeekOffset }: { roster: any[]; weekDates: any; weekOffset: number; setWeekOffset: (n: number) => void }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const shiftsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of days) map[d] = [];
    for (const s of roster) {
      const date = new Date(s.start_time);
      const dayIdx = (date.getDay() + 6) % 7;
      const dayKey = days[dayIdx];
      if (dayKey) map[dayKey].push(s);
    }
    return map;
  }, [roster]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-white">House Roster</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 hover:text-white"><ArrowLeft size={12} /></button>
          <span className="text-[11px] text-zinc-400">{weekDates.startLabel} — {weekDates.endLabel}</span>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="rounded-lg border border-zinc-800 p-1.5 text-zinc-500 hover:text-white"><ArrowRight size={12} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day} className="rounded-xl border border-zinc-800/50 bg-[#0A0A0A] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">{day}</div>
            {shiftsByDay[day].length === 0 ? (
              <p className="text-[10px] text-zinc-700 italic">No shifts</p>
            ) : (
              <div className="space-y-1.5">
                {shiftsByDay[day].map((s: any) => {
                  const start = new Date(s.start_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
                  const end = new Date(s.end_time).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
                  const filled = !!s.technician_id;
                  return (
                    <div key={s.id} className={`rounded-lg px-2 py-1.5 text-[10px] ${filled ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                      <div className="text-zinc-400">{start}–{end}</div>
                      <div className={filled ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                        {filled ? s.worker_name || "Assigned" : "UNFILLED"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {roster.length > 0 && (
        <div className="mt-4 flex items-center gap-4 text-[11px]">
          <span className="text-zinc-500">{roster.length} total shifts</span>
          <span className="text-emerald-400">{roster.filter((s: any) => s.technician_id).length} filled</span>
          <span className="text-amber-400">{roster.filter((s: any) => !s.technician_id).length} unfilled</span>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ Residents Tab ━━━━━━━━━━━━━━━━━ */

function ResidentsTab({ houseId, participants, orgId, qc }: { houseId: string; participants: any[]; orgId: string; qc: any }) {
  const [adding, setAdding] = useState(false);

  const { data: allParticipants } = useQuery({
    queryKey: ["all-participants-for-house", orgId],
    queryFn: () => fetchParticipants(orgId, { limit: 100 }),
    enabled: !!adding,
  });

  const addMut = useMutation({
    mutationFn: (pid: string) => addParticipantToHouse(houseId, pid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["house-participants"] }); setAdding(false); },
  });

  const removeMut = useMutation({
    mutationFn: (pid: string) => removeParticipantFromHouse(houseId, pid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["house-participants"] }),
  });

  const existingIds = new Set(participants.map((p: any) => p.participant_id));
  const available = (allParticipants as any)?.data?.filter((p: any) => !existingIds.has(p.id)) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-white">Residents ({participants.length})</h2>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-zinc-200">
          <UserPlus size={12} /> Add Resident
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4">
              <p className="text-[11px] text-zinc-400 mb-2">Select a participant to add to this house:</p>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {available.length === 0 && <p className="text-[10px] text-zinc-600">No available participants</p>}
                {available.map((p: any) => (
                  <button key={p.id} onClick={() => addMut.mutate(p.id)}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-zinc-800/50">
                    <span className="text-[12px] text-white">{p.client_name || `${p.first_name} ${p.last_name}`}</span>
                    <Plus size={12} className="text-zinc-500" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {participants.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-[#0A0A0A] px-4 py-3">
            <div>
              <p className="text-[13px] font-medium text-white">{p.participant_name}</p>
              {p.ndis_number && <p className="text-[10px] text-zinc-500">NDIS: {p.ndis_number}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-zinc-600">Since {new Date(p.move_in_date).toLocaleDateString("en-AU")}</span>
              <button onClick={() => removeMut.mutate(p.participant_id)} className="text-zinc-700 hover:text-red-400"><X size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ Team Tab ━━━━━━━━━━━━━━━━━━━━━ */

function TeamTab({ houseId, leader, coreTeam, floatPool, orgId, qc }: { houseId: string; leader?: HouseStaffMember; coreTeam: HouseStaffMember[]; floatPool: HouseStaffMember[]; orgId: string; qc: any }) {
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState<"leader" | "core_team" | "float_pool">("core_team");

  const addMut = useMutation({
    mutationFn: (workerId: string) => addStaffToHouse(houseId, workerId, newRole),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["house-staff"] }); setAdding(false); },
  });

  const removeMut = useMutation({
    mutationFn: (workerId: string) => removeStaffFromHouse(houseId, workerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["house-staff"] }),
  });

  const roleMut = useMutation({
    mutationFn: ({ workerId, role }: { workerId: string; role: "leader" | "core_team" | "float_pool" }) =>
      updateStaffRole(houseId, workerId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["house-staff"] }),
  });

  const roleColors = {
    leader: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: <Crown size={12} className="text-amber-400" /> },
    core_team: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: <ShieldCheck size={12} className="text-emerald-400" /> },
    float_pool: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", icon: <Users size={12} className="text-blue-400" /> },
  };

  const renderSection = (title: string, members: HouseStaffMember[], role: keyof typeof roleColors) => {
    const style = roleColors[role];
    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          {style.icon}
          <h3 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">{title}</h3>
          <span className="text-[10px] text-zinc-700">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <p className="text-[10px] text-zinc-700 italic pl-5">No one assigned</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className={`flex items-center justify-between rounded-xl border ${style.border} ${style.bg} px-4 py-2.5`}>
                <p className={`text-[12px] font-medium ${style.text}`}>{m.worker_name}</p>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => roleMut.mutate({ workerId: m.worker_id, role: e.target.value as any })}
                    className="bg-transparent text-[10px] text-zinc-500 outline-none cursor-pointer"
                  >
                    <option value="leader">Leader</option>
                    <option value="core_team">Core Team</option>
                    <option value="float_pool">Float Pool</option>
                  </select>
                  <button onClick={() => removeMut.mutate(m.worker_id)} className="text-zinc-700 hover:text-red-400"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-white">Team Composition</h2>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-zinc-200">
          <UserPlus size={12} /> Add Staff
        </button>
      </div>

      {renderSection("House Leader", leader ? [leader] : [], "leader")}
      {renderSection("Core Team", coreTeam, "core_team")}
      {renderSection("Float Pool", floatPool, "float_pool")}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ Notes Tab ━━━━━━━━━━━━━━━━━━━━ */

function NotesTab({ houseId, notes, qc }: { houseId: string; notes: HouseNote[]; qc: any }) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"shift_handover" | "maintenance" | "groceries" | "general">("general");
  const [pinned, setPinned] = useState(false);

  const createMut = useMutation({
    mutationFn: () => createHouseNote(houseId, content, category, pinned),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["house-notes"] }); setContent(""); setPinned(false); },
  });

  const pinMut = useMutation({
    mutationFn: ({ noteId, pin }: { noteId: string; pin: boolean }) => toggleNotePin(noteId, pin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["house-notes"] }),
  });

  const catIcons: Record<string, React.ReactNode> = {
    shift_handover: <Clock size={10} className="text-blue-400" />,
    maintenance: <Wrench size={10} className="text-amber-400" />,
    groceries: <DollarSign size={10} className="text-emerald-400" />,
    general: <MessageSquare size={10} className="text-zinc-400" />,
  };

  const catColors: Record<string, string> = {
    shift_handover: "border-blue-500/20 bg-blue-500/5",
    maintenance: "border-amber-500/20 bg-amber-500/5",
    groceries: "border-emerald-500/20 bg-emerald-500/5",
    general: "border-zinc-800/50 bg-[#0A0A0A]",
  };

  return (
    <div>
      {/* Compose */}
      <div className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4 mb-4">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a house note..."
          className="w-full bg-transparent text-[13px] text-white placeholder:text-zinc-600 outline-none resize-none h-16" />
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as any)}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-[10px] text-zinc-400 outline-none">
              <option value="general">General</option>
              <option value="shift_handover">Shift Handover</option>
              <option value="maintenance">Maintenance</option>
              <option value="groceries">Groceries</option>
            </select>
            <button onClick={() => setPinned(!pinned)} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] ${pinned ? "bg-amber-500/10 text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}>
              <Pin size={10} /> {pinned ? "Pinned" : "Pin"}
            </button>
          </div>
          <button onClick={() => createMut.mutate()} disabled={!content.trim() || createMut.isPending}
            className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black hover:bg-zinc-200 disabled:opacity-40">Post</button>
        </div>
      </div>

      {/* Notes feed */}
      <div className="space-y-2">
        {notes.map((n) => (
          <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`rounded-xl border ${catColors[n.category]} p-4 ${n.is_pinned ? "ring-1 ring-amber-500/30" : ""}`}
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {catIcons[n.category]}
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{n.category.replace("_", " ")}</span>
                {n.is_pinned && <Pin size={10} className="text-amber-400" />}
              </div>
              <button onClick={() => pinMut.mutate({ noteId: n.id, pin: !n.is_pinned })} className="text-zinc-700 hover:text-zinc-400">
                {n.is_pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
            </div>
            <p className="text-[13px] text-white leading-relaxed">{n.content}</p>
            <p className="text-[9px] text-zinc-600 mt-2">{n.author_name} · {new Date(n.created_at).toLocaleString("en-AU")}</p>
          </motion.div>
        ))}
        {notes.length === 0 && <p className="text-center text-[11px] text-zinc-600 py-10">No notes yet. Post the first one above.</p>}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━ Finances Tab ━━━━━━━━━━━━━━━━━━ */

function FinancesTab({ houseId, house, pettyCashLog, qc }: { houseId: string; house: CareHouse; pettyCashLog: PettyCashEntry[]; qc: any }) {
  const [mode, setMode] = useState<"deduct" | "topup" | null>(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("groceries");

  const deductMut = useMutation({
    mutationFn: () => deductPettyCash(houseId, parseFloat(amount), desc, cat),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["house-petty-cash"] });
      qc.invalidateQueries({ queryKey: ["care-house"] });
      setMode(null); setAmount(""); setDesc("");
    },
  });

  const topUpMut = useMutation({
    mutationFn: () => topUpPettyCash(houseId, parseFloat(amount), desc || "Top-up"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["house-petty-cash"] });
      qc.invalidateQueries({ queryKey: ["care-house"] });
      setMode(null); setAmount(""); setDesc("");
    },
  });

  return (
    <div>
      {/* Balance Card */}
      <div className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-6 mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Petty Cash Balance</p>
        <p className="text-3xl font-bold text-white">${Number(house.petty_cash_balance).toFixed(2)}</p>
        <div className="flex items-center gap-2 mt-4">
          <button onClick={() => setMode("deduct")} className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-[11px] font-medium text-red-400 hover:bg-red-500/20">
            <Minus size={12} /> Deduct
          </button>
          <button onClick={() => setMode("topup")} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20">
            <Plus size={12} /> Top Up
          </button>
        </div>
      </div>

      {/* Deduct / Top-up form */}
      <AnimatePresence>
        {mode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="rounded-xl border border-zinc-800 bg-[#0A0A0A] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-white">{mode === "deduct" ? "Record Deduction" : "Top Up Balance"}</h3>
                <button onClick={() => setMode(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Amount ($)</label>
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="50.00"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[13px] text-white outline-none focus:border-zinc-600" />
                </div>
                {mode === "deduct" && (
                  <div>
                    <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Category</label>
                    <select value={cat} onChange={(e) => setCat(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[13px] text-white outline-none">
                      <option value="groceries">Groceries</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="transport">Transport</option>
                      <option value="activities">Activities</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">Description</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={mode === "deduct" ? "e.g. Weekly groceries" : "e.g. Monthly top-up"}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-[13px] text-white outline-none focus:border-zinc-600" />
              </div>
              <div className="flex justify-end">
                <button
                  disabled={!amount || parseFloat(amount) <= 0 || (mode === "deduct" && !desc.trim())}
                  onClick={() => mode === "deduct" ? deductMut.mutate() : topUpMut.mutate()}
                  className={`rounded-lg px-4 py-2 text-[11px] font-medium disabled:opacity-40 ${
                    mode === "deduct" ? "bg-red-500 text-white hover:bg-red-600" : "bg-emerald-500 text-white hover:bg-emerald-600"
                  }`}
                >{mode === "deduct" ? "Record Deduction" : "Add Funds"}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction history */}
      <h3 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Transaction History</h3>
      <div className="space-y-1.5">
        {pettyCashLog.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-zinc-800/30 bg-[#0A0A0A] px-4 py-2.5">
            <div>
              <p className="text-[12px] text-white">{e.description}</p>
              <p className="text-[9px] text-zinc-600">{e.author_name} · {new Date(e.created_at).toLocaleString("en-AU")} · {e.category}</p>
            </div>
            <div className="text-right">
              <p className={`text-[13px] font-semibold ${e.amount < 0 ? "text-red-400" : "text-emerald-400"}`}>
                {e.amount < 0 ? "-" : "+"}${Math.abs(e.amount).toFixed(2)}
              </p>
              <p className="text-[9px] text-zinc-600">Bal: ${Number(e.balance_after).toFixed(2)}</p>
            </div>
          </div>
        ))}
        {pettyCashLog.length === 0 && <p className="text-center text-[11px] text-zinc-600 py-8">No transactions yet.</p>}
      </div>
    </div>
  );
}
