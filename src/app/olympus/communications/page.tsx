"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Omni-Communications Ledger
   Global communication_logs browse, JSON inspector, pagination
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  Copy,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { listGlobalCommunications } from "@/app/actions/olympus-comms";

type CommChannel = "voice_call" | "email" | "sms" | "portal_message";
type CommDirection = "inbound" | "outbound";
type CommStatus =
  | "missed"
  | "completed"
  | "voicemail"
  | "delivered"
  | "bounced"
  | "in_progress"
  | "ringing"
  | "failed";

interface CommunicationRow {
  id: string;
  workspace_id: string;
  channel: CommChannel;
  direction: CommDirection;
  status: CommStatus;
  from_address?: string | null;
  to_address?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  from_name?: string | null;
  to_name?: string | null;
  subject?: string | null;
  body_preview?: string | null;
  duration_seconds?: number | null;
  external_id?: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  organizations?: { name: string | null; slug: string | null } | null;
}

const PAGE_SIZE = 50;

const CHANNEL_FILTER = [
  { value: "", label: "All" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "voice_call", label: "Voice" },
  { value: "portal_message", label: "Push" },
] as const;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "missed", label: "Missed" },
  { value: "completed", label: "Completed" },
  { value: "voicemail", label: "Voicemail" },
  { value: "delivered", label: "Delivered" },
  { value: "bounced", label: "Bounced" },
  { value: "in_progress", label: "In progress" },
  { value: "ringing", label: "Ringing" },
  { value: "failed", label: "Failed" },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "All directions" },
  { value: "inbound", label: "Inbound" },
  { value: "outbound", label: "Outbound" },
];

function channelIcon(ch: CommChannel) {
  switch (ch) {
    case "voice_call":
      return <Phone size={12} className="text-zinc-400" />;
    case "email":
      return <Mail size={12} className="text-zinc-400" />;
    case "sms":
      return <MessageSquare size={12} className="text-zinc-400" />;
    case "portal_message":
      return <Bell size={12} className="text-zinc-400" />;
    default:
      return <MessageSquare size={12} className="text-zinc-400" />;
  }
}

function channelLabel(ch: CommChannel) {
  switch (ch) {
    case "voice_call":
      return "Voice";
    case "email":
      return "Email";
    case "sms":
      return "SMS";
    case "portal_message":
      return "Portal";
    default:
      return ch;
  }
}

function statusBadgeClass(status: CommStatus) {
  switch (status) {
    case "delivered":
    case "completed":
      return "bg-emerald-500/15 text-emerald-400/90 border-emerald-500/25";
    case "failed":
    case "bounced":
    case "missed":
      return "bg-red-500/12 text-red-400/90 border-red-500/20";
    case "ringing":
    case "in_progress":
      return "bg-amber-500/12 text-amber-300/90 border-amber-500/25";
    case "voicemail":
      return "bg-violet-500/12 text-violet-300/80 border-violet-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border-zinc-600/30";
  }
}

function recipientLabel(row: CommunicationRow) {
  const from =
    row.from_name ||
    row.from_number ||
    row.from_address ||
    "";
  const to =
    row.to_name ||
    row.to_number ||
    row.to_address ||
    "";
  if (row.direction === "outbound") {
    return to || from || "—";
  }
  return from || to || "—";
}

function JsonValue({ value, depth }: { value: unknown; depth: number }) {
  const pad = depth * 14;
  if (value === null) {
    return <span className="text-zinc-500">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-purple-400">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-cyan-400">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-amber-200/90">&quot;{value}&quot;</span>;
  }
  if (Array.isArray(value)) {
    return (
      <span>
        <span className="text-zinc-500">[</span>
        {value.length === 0 ? null : (
          <span className="block" style={{ paddingLeft: pad }}>
            {value.map((v, i) => (
              <div key={i} className="leading-relaxed">
                <JsonValue value={v} depth={depth + 1} />
                {i < value.length - 1 ? <span className="text-zinc-600">,</span> : null}
              </div>
            ))}
          </span>
        )}
        <span className="text-zinc-500">]</span>
      </span>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-zinc-500">{"{}"}</span>;
    }
    return (
      <span>
        <span className="text-zinc-500">{"{"}</span>
        <span className="block" style={{ paddingLeft: pad }}>
          {entries.map(([k, v], i) => (
            <div key={k} className="leading-relaxed">
              <span className="text-emerald-400/90">&quot;{k}&quot;</span>
              <span className="text-zinc-600">: </span>
              <JsonValue value={v} depth={depth + 1} />
              {i < entries.length - 1 ? <span className="text-zinc-600">,</span> : null}
            </div>
          ))}
        </span>
        <span className="text-zinc-500">{"}"}</span>
      </span>
    );
  }
  return <span className="text-zinc-500">{String(value)}</span>;
}

function DeliveryTimeline({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return null;
  const candidates = [
    metadata.delivery_timeline,
    metadata.deliveryTimeline,
    metadata.events,
    metadata.delivery_events,
  ];
  const tl = candidates.find((x) => Array.isArray(x)) as unknown[] | undefined;
  if (!tl || tl.length === 0) return null;

  return (
    <div className="mt-6 border-t border-[#222] pt-4">
      <p className="mb-2 font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
        Delivery timeline
      </p>
      <ul className="space-y-2">
        {tl.map((ev, i) => (
          <li
            key={i}
            className="rounded border border-[#222] bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-[10px] text-zinc-400"
          >
            {typeof ev === "object" && ev !== null
              ? JSON.stringify(ev)
              : String(ev)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OlympusCommunicationsPage() {
  const [rows, setRows] = useState<CommunicationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [direction, setDirection] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CommunicationRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 320);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listGlobalCommunications({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        channel: channel || undefined,
        status: status || undefined,
        direction: direction || undefined,
        search: debouncedSearch || undefined,
      });
      setRows((res.data as unknown as CommunicationRow[]) || []);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, channel, status, direction, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, channel, status, direction]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const copyJson = useCallback(() => {
    if (!selected) return;
    const json = JSON.stringify(
      {
        ...selected,
        metadata: selected.metadata ?? {},
      },
      null,
      2,
    );
    void navigator.clipboard.writeText(json);
  }, [selected]);

  const formattedTime = useMemo(() => {
    return (iso: string) => {
      try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } catch {
        return iso;
      }
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 bg-black text-white">
      <div
        className={`flex min-h-0 flex-col border-r border-[#222] ${selected ? "w-[58%]" : "w-full"}`}
      >
        <div className="flex items-center justify-between border-b border-[#222] px-6 py-4">
          <div>
            <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
              COMMUNICATIONS
            </span>
            <h1 className="mt-0.5 text-[17px] font-semibold tracking-tight">
              Omni-Channel Ledger
              <span className="ml-2 text-[12px] font-normal text-zinc-600">{total} events</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-[#222] text-zinc-500 transition-colors hover:border-[#333] hover:text-zinc-300"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="border-b border-[#222] px-6 py-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search MessageSid, phone, email, subject…"
              className="w-full rounded-lg border border-[#222] bg-[#0a0a0a] py-2 pl-9 pr-3 text-[12px] text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors focus:border-red-500/30"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#222] px-6 py-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-lg border border-[#222] bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-[10px] text-zinc-300 outline-none focus:border-red-500/30"
          >
            {CHANNEL_FILTER.map((o) => (
              <option key={o.label} value={o.value}>
                Channel: {o.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-[#222] bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-[10px] text-zinc-300 outline-none focus:border-red-500/30"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="rounded-lg border border-[#222] bg-[#0a0a0a] px-2.5 py-1.5 font-mono text-[10px] text-zinc-300 outline-none focus:border-red-500/30"
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#222] bg-black/95 px-6 py-2 backdrop-blur">
            <span className="w-[120px] shrink-0 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Time
            </span>
            <span className="w-[140px] shrink-0 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Workspace
            </span>
            <span className="w-[100px] shrink-0 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Channel
            </span>
            <span className="w-[72px] shrink-0 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Dir
            </span>
            <span className="min-w-[140px] flex-1 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Recipient
            </span>
            <span className="w-[100px] shrink-0 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Status
            </span>
            <span className="min-w-[160px] flex-1 font-mono text-[9px] font-bold tracking-wider text-zinc-600 uppercase">
              Preview
            </span>
          </div>

          {loading && (
            <div className="px-6 py-6 font-mono text-[11px] text-zinc-600">Loading ledger…</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="px-6 py-6 font-mono text-[11px] text-zinc-600">No events match.</div>
          )}
          {!loading &&
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row)}
                className={`flex w-full items-center gap-2 border-b border-[#222] px-6 py-2.5 text-left font-mono text-[11px] transition-colors hover:bg-[#0a0a0a] ${
                  selected?.id === row.id ? "bg-[#0c0c0c]" : ""
                }`}
              >
                <span className="w-[120px] shrink-0 text-zinc-500">{formattedTime(row.created_at)}</span>
                <span className="w-[140px] shrink-0 truncate text-zinc-400">
                  {row.organizations?.name || row.organizations?.slug || row.workspace_id.slice(0, 8)}
                </span>
                <span className="flex w-[100px] shrink-0 items-center gap-1.5 text-zinc-300">
                  {channelIcon(row.channel)}
                  <span>{channelLabel(row.channel)}</span>
                </span>
                <span className="flex w-[72px] shrink-0 items-center gap-1 text-zinc-400">
                  {row.direction === "inbound" ? (
                    <ArrowDownLeft size={12} className="text-emerald-500/80" />
                  ) : (
                    <ArrowUpRight size={12} className="text-sky-400/80" />
                  )}
                  {row.direction === "inbound" ? "In" : "Out"}
                </span>
                <span className="min-w-[140px] flex-1 truncate text-zinc-300">{recipientLabel(row)}</span>
                <span className="w-[100px] shrink-0">
                  <span
                    className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                  >
                    {row.status.replace(/_/g, " ")}
                  </span>
                </span>
                <span className="min-w-[160px] flex-1 truncate text-zinc-500">
                  {row.subject || row.body_preview || "—"}
                </span>
              </button>
            ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#222] px-6 py-4">
          <span className="font-mono text-[10px] text-zinc-600">
            Page {page + 1} / {totalPages} · {PAGE_SIZE} per page
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex items-center gap-1 rounded border border-[#222] px-2.5 py-1 font-mono text-[10px] text-zinc-400 disabled:opacity-30 hover:border-[#333]"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded border border-[#222] px-2.5 py-1 font-mono text-[10px] text-zinc-400 disabled:opacity-30 hover:border-[#333]"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 35 }}
            className="flex w-[42%] min-w-[320px] flex-col border-l border-[#222] bg-black"
          >
            <div className="flex items-center justify-between border-b border-[#222] px-4 py-3">
              <div>
                <p className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
                  JSON inspector
                </p>
                <p className="font-mono text-[11px] text-zinc-500">{selected.id}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={copyJson}
                  className="flex items-center gap-1 rounded border border-[#222] px-2.5 py-1 font-mono text-[10px] text-zinc-400 hover:border-[#333] hover:text-zinc-200"
                >
                  <Copy size={12} /> Copy
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#222] text-zinc-500 hover:border-[#333] hover:text-zinc-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <pre className="whitespace-pre-wrap break-words font-mono text-[9px] leading-relaxed text-zinc-300">
                <JsonValue value={selected.metadata ?? {}} depth={0} />
              </pre>
              <DeliveryTimeline metadata={selected.metadata} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
