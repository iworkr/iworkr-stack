"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  X,
  FileText,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createSilQuoteAction,
  listSilQuotesAction,
} from "@/app/actions/sil-quoting";
import {
  listCareFacilitiesAction,
  listFacilityParticipantsAction,
} from "@/app/actions/care-routines";
import { useRouter } from "next/navigation";

/* ── Types ────────────────────────────────────────────── */

type QuoteSummary = {
  id: string;
  name: string;
  status: string;
  facility_id: string;
  total_annual_cost: number;
  projected_gross_margin_percent: number;
  care_facilities?: { name?: string };
  created_at: string;
};

type TabFilter = "all" | "draft" | "pending_approval" | "approved";

/* ── Helpers ──────────────────────────────────────────── */

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

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    archived: "Archived",
  };
  return map[s] || s;
}

function statusStyle(s: string): string {
  const map: Record<string, string> = {
    draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    pending_approval: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return map[s] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

/* ── Metric Node ──────────────────────────────────────── */

function MetricNode({
  label,
  value,
  danger,
  pulse,
}: {
  label: string;
  value: string;
  danger?: boolean;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
        )}
        <span
          className={`font-mono text-xl leading-none ${danger ? "text-amber-500 font-bold" : "text-white"}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

const SKEL = [
  { a: "w-36", b: "w-24", c: "w-20" },
  { a: "w-28", b: "w-32", c: "w-16" },
  { a: "w-40", b: "w-20", c: "w-24" },
  { a: "w-32", b: "w-28", c: "w-20" },
  { a: "w-36", b: "w-24", c: "w-16" },
  { a: "w-28", b: "w-32", c: "w-24" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const s = SKEL[idx % SKEL.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3"><div className={`h-3 ${s.a} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className={`h-3 ${s.b} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3">
        <div className="flex -space-x-2">
          {[0, 1, 2].map((i) => <div key={i} className="w-7 h-7 rounded-full bg-zinc-900 animate-pulse border-2 border-[#050505]" />)}
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${s.c} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-3 w-12 bg-zinc-900 rounded-sm animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={7}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 mt-8">
          <FileText className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-[15px] text-white font-medium">No SIL quotes found.</p>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-sm text-center">
            Create your first SIL quote to begin generating Rosters of Care and financial projections.
          </p>
          <button
            onClick={onAdd}
            className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            + New SIL Quote
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Creation Slide-Over ──────────────────────────────── */

function CreateQuoteSlideOver({
  open,
  onClose,
  orgId,
  facilities,
  participants,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  facilities: { id: string; name: string }[];
  participants: { id: string; preferred_name?: string; full_name?: string }[];
  onCreated: (id: string) => void;
}) {
  const [form, setForm] = useState({
    facility_id: "",
    name: "",
    base_week_start: "",
    source_mode: "master_roster" as "master_roster" | "blank",
    participant_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!form.facility_id || !form.name || form.participant_ids.length === 0) {
      setError("All fields are required. Select at least one participant.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const quote = await createSilQuoteAction({
        organization_id: orgId,
        facility_id: form.facility_id,
        name: form.name,
        base_week_start: form.base_week_start || new Date().toISOString().slice(0, 10),
        participant_ids: form.participant_ids,
        source_mode: form.source_mode,
      });
      onCreated(quote.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
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
            className="fixed right-0 top-0 bottom-0 z-50 w-[400px] bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-medium text-white">New SIL Quote</h2>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/5 text-zinc-500"><X className="w-4 h-4" /></button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Facility */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Facility</label>
                <select
                  value={form.facility_id}
                  onChange={(e) => setForm((s) => ({ ...s, facility_id: e.target.value }))}
                  className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700"
                >
                  <option value="">Select facility…</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Quote Name */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Quote Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="e.g. Oceanview SIL 2026"
                  className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Base Week Start</label>
                <input
                  type="date"
                  value={form.base_week_start}
                  onChange={(e) => setForm((s) => ({ ...s, base_week_start: e.target.value }))}
                  className="w-full h-9 rounded-md border border-white/5 bg-zinc-900 px-3 text-xs text-white outline-none focus:border-zinc-700"
                />
              </div>

              {/* Source Mode */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">Import Mode</label>
                <div className="flex gap-2">
                  {(["master_roster", "blank"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setForm((s) => ({ ...s, source_mode: mode }))}
                      className={`flex-1 h-9 rounded-md text-xs font-medium transition-colors border ${
                        form.source_mode === mode
                          ? "bg-white/10 text-white border-white/10"
                          : "bg-transparent text-zinc-400 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {mode === "master_roster" ? "From Master Roster" : "Blank Slate"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participants */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold block mb-1.5">
                  Participants ({form.participant_ids.length} selected)
                </label>
                <div className="max-h-44 overflow-y-auto rounded-md border border-white/5 bg-zinc-900 p-2 space-y-1">
                  {participants.length === 0 && (
                    <p className="text-xs text-zinc-600 text-center py-2">No participants available.</p>
                  )}
                  {participants.map((p) => {
                    const checked = form.participant_ids.includes(p.id);
                    const name = p.preferred_name || p.full_name || p.id.slice(0, 8);
                    return (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              participant_ids: e.target.checked
                                ? [...s.participant_ids, p.id]
                                : s.participant_ids.filter((id) => id !== p.id),
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-zinc-700 accent-white"
                        />
                        <span className="text-xs text-zinc-300">{name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-400">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-zinc-950 shrink-0">
              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full h-10 rounded-md bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Initializing…" : "Initialize Quote Engine"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

type SilQuotingData = {
  quotes: QuoteSummary[];
  facilities: { id: string; name: string }[];
  participants: { id: string; preferred_name?: string; full_name?: string }[];
};

export default function SilQuotingPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("all");
  const [slideOpen, setSlideOpen] = useState(false);

  const { data: silData, isLoading: loading } = useQuery<SilQuotingData>({
    queryKey: ["care", "silQuoting", orgId],
    queryFn: async () => {
      const [q, f, p] = await Promise.all([
        listSilQuotesAction(orgId!),
        listCareFacilitiesAction(orgId!),
        listFacilityParticipantsAction(orgId!),
      ]);
      return {
        quotes: (q || []) as QuoteSummary[],
        facilities: (f || []).map((x: any) => ({ id: x.id, name: x.name || "Unnamed" })),
        participants: (p || []).map((x: any) => ({
          id: x.id,
          preferred_name: x.preferred_name,
          full_name: x.full_name,
        })),
      };
    },
    enabled: !!orgId,
  });

  const quotes = silData?.quotes ?? [];
  const facilities = silData?.facilities ?? [];
  const participants = silData?.participants ?? [];

  /* ── Computed Metrics ────────────────────────────────── */
  const metrics = useMemo(() => {
    const active = quotes.filter((q) => ["approved", "pending_approval"].includes(q.status));
    const pipelineValue = active.reduce((s, q) => s + Number(q.total_annual_cost || 0), 0);
    const margins = quotes.filter((q) => q.total_annual_cost > 0).map((q) => Number(q.projected_gross_margin_percent || 0));
    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    const pendingCount = quotes.filter((q) => q.status === "pending_approval").length;
    return { pipelineValue, avgMargin, pendingCount };
  }, [quotes]);

  /* ── Filtered List ───────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = quotes;
    if (tab !== "all") list = list.filter((q) => q.status === tab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.care_facilities?.name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [quotes, tab, search]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All Quotes" },
    { key: "draft", label: "Drafts" },
    { key: "pending_approval", label: "Pending Approval" },
    { key: "approved", label: "Active" },
  ];

  const handleCreated = useCallback(
    (id: string) => {
      router.push(`/dashboard/care/sil-quoting/${id}`);
    },
    [router],
  );

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumbs + Tabs */}
        <div className="flex items-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Financials & PRODA
          </span>
          <span className="mx-2 text-zinc-700">→</span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 font-semibold select-none">
            SIL Quoting
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  tab === t.key
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Actions */}
        <div className="flex items-center gap-3">
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotes, facilities…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>
          <button
            onClick={() => setSlideOpen(true)}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            New SIL Quote
          </button>
        </div>
      </div>

      {/* ─── Telemetry Ribbon ────────────────────────────── */}
      <div className="flex items-center h-16 px-8 border-b border-white/5 bg-zinc-950/30 shrink-0 overflow-x-auto gap-0">
        <MetricNode label="Total Pipeline Value" value={formatCurrency(metrics.pipelineValue)} />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode
          label="Avg Gross Margin"
          value={`${metrics.avgMargin.toFixed(1)}%`}
          danger={metrics.avgMargin < 10}
          pulse={metrics.avgMargin < 10 && metrics.avgMargin > 0}
        />
        <div className="w-px h-8 bg-white/5 mx-6 shrink-0" />
        <MetricNode label="Pending Approvals" value={String(metrics.pendingCount)} />
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Quote Name</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[20%]">Facility</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Participants</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Annual Cost</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[10%]">Margin</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[10%]">Status</th>
              <th className="px-4 w-[5%]" />
            </tr>
          </thead>
          <tbody>
            {/* Loading Skeletons */}
            {loading && quotes.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            }

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
              <EmptyState onAdd={() => setSlideOpen(true)} />
            )}

            {/* Data Rows */}
            {!loading && filtered.map((q) => {
              const margin = Number(q.projected_gross_margin_percent || 0);
              const facility = q.care_facilities?.name || "Unknown";
              return (
                <tr
                  key={q.id}
                  onClick={() => router.push(`/dashboard/care/sil-quoting/${q.id}`)}
                  className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                >
                  {/* Quote Name */}
                  <td className="px-8 py-3">
                    <span className="text-sm text-white font-medium">{q.name}</span>
                  </td>

                  {/* Facility */}
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-zinc-400">{facility}</span>
                  </td>

                  {/* Participants */}
                  <td className="px-4 py-3">
                    <div className="flex -space-x-2">
                      {/* Show up to 3 initials */}
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-[#050505] flex items-center justify-center"
                        >
                          <span className="text-[9px] text-zinc-400 font-medium">
                            {getInitials(q.name.split(" ")[i] || q.name)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Annual Cost */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-[13px] text-white">
                      {formatCurrency(Number(q.total_annual_cost || 0))}
                    </span>
                  </td>

                  {/* Margin */}
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[13px] ${marginColor(margin)}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${statusStyle(q.status)}`}>
                      {statusLabel(q.status)}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Creation Slide-Over ──────────────────────────── */}
      <CreateQuoteSlideOver
        open={slideOpen}
        onClose={() => setSlideOpen(false)}
        orgId={orgId || ""}
        facilities={facilities}
        participants={participants}
        onCreated={handleCreated}
      />
    </div>
  );
}
