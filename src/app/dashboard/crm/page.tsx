"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  Phone,
  Mail,
  Building2,
  User,
  ChevronRight,
  DollarSign,
  Clock,
  Tag,
  X,
  Loader2,
  GripVertical,
  TrendingUp,
  Users,
  Sparkles,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/components/app/action-toast";

/* ── Types ───────────────────────────────────────────────── */

interface PipelineClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: "residential" | "commercial" | null;
  status: string;
  pipeline_status: string;
  pipeline_updated_at: string | null;
  estimated_value: number | null;
  tags: string[];
  notes: string | null;
  lead_source: string | null;
  created_at: string;
}

type PipelineStatus =
  | "new_lead"
  | "quoting"
  | "awaiting_approval"
  | "won"
  | "lost";

/* ── Column config ───────────────────────────────────────── */

const COLUMNS: {
  id: PipelineStatus;
  label: string;
  border: string;
  dot: string;
  bg: string;
  text: string;
  emptyText: string;
}[] = [
  {
    id: "new_lead",
    label: "New Lead",
    border: "border-t-sky-500",
    dot: "bg-sky-400",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    emptyText: "New leads land here. Add your first lead to get started.",
  },
  {
    id: "quoting",
    label: "Quoting",
    border: "border-t-amber-500",
    dot: "bg-amber-400",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    emptyText: "Drag leads here once you've started quoting.",
  },
  {
    id: "awaiting_approval",
    label: "Awaiting Approval",
    border: "border-t-violet-500",
    dot: "bg-violet-400",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    emptyText: "Quotes sent and awaiting client approval.",
  },
  {
    id: "won",
    label: "Won",
    border: "border-t-emerald-500",
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    emptyText: "Closed deals appear here. Keep it up!",
  },
  {
    id: "lost",
    label: "Lost",
    border: "border-t-rose-500",
    dot: "bg-rose-400",
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    emptyText: "Lost opportunities. Review to improve your close rate.",
  },
];

const COLUMN_MAP = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

/* ── Helpers ─────────────────────────────────────────────── */

function formatCurrency(cents: number | null): string {
  if (!cents) return "$0";
  return `$${cents.toLocaleString()}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getInitials(name: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const avatarGradients = [
  "from-zinc-600/30 to-zinc-800/30",
  "from-emerald-600/30 to-teal-800/30",
  "from-amber-600/30 to-orange-800/30",
  "from-rose-600/30 to-pink-800/30",
  "from-sky-600/30 to-indigo-800/30",
  "from-violet-600/30 to-purple-800/30",
];

function getGradient(initials: string): string {
  const code = initials.charCodeAt(0) + (initials.charCodeAt(1) || 0);
  return avatarGradients[code % avatarGradients.length];
}

/* ── Page ─────────────────────────────────────────────────── */

export default function CRMPipelinePage() {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();

  const [clients, setClients] = useState<PipelineClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ── Fetch clients ─────────────────────────────────────── */

  const fetchClients = useCallback(async () => {
    if (!orgId) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, email, phone, type, status, pipeline_status, pipeline_updated_at, estimated_value, tags, notes, lead_source, created_at"
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("pipeline_updated_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Failed to fetch pipeline clients:", error);
      return;
    }
    setClients(
      (data ?? []).map((c) => ({
        ...(c as object),
        pipeline_status: (c as { pipeline_status?: string }).pipeline_status || "new_lead",
        tags: (c as { tags?: string[] | null }).tags || [],
        type: (c as { type?: string | null }).type as "residential" | "commercial" | null,
      })) as PipelineClient[]
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  /* ── Realtime subscription ─────────────────────────────── */

  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("crm-pipeline")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clients",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          fetchClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, fetchClients]);

  /* ── Grouped by column ─────────────────────────────────── */

  const columnData = useMemo(() => {
    const grouped: Record<PipelineStatus, PipelineClient[]> = {
      new_lead: [],
      quoting: [],
      awaiting_approval: [],
      won: [],
      lost: [],
    };
    for (const c of clients) {
      const col = (c.pipeline_status as PipelineStatus) || "new_lead";
      if (grouped[col]) grouped[col].push(c);
      else grouped.new_lead.push(c);
    }
    for (const col of Object.keys(grouped) as PipelineStatus[]) {
      grouped[col].sort((a, b) => {
        const aTime = a.pipeline_updated_at || a.created_at;
        const bTime = b.pipeline_updated_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    }
    return grouped;
  }, [clients]);

  /* ── Summary stats ─────────────────────────────────────── */

  const totalPipelineValue = useMemo(
    () =>
      clients
        .filter((c) => c.pipeline_status !== "lost")
        .reduce((sum, c) => sum + (c.estimated_value || 0), 0),
    [clients]
  );

  const wonValue = useMemo(
    () =>
      columnData.won.reduce((sum, c) => sum + (c.estimated_value || 0), 0),
    [columnData.won]
  );

  const conversionRate = useMemo(() => {
    const closed = columnData.won.length + columnData.lost.length;
    if (closed === 0) return 0;
    return Math.round((columnData.won.length / closed) * 100);
  }, [columnData.won.length, columnData.lost.length]);

  /* ── Drag handler ──────────────────────────────────────── */

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, destination, source } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

      const newStatus = destination.droppableId as PipelineStatus;
      const oldStatus = source.droppableId as PipelineStatus;

      // Optimistic update
      setClients((prev) =>
        prev.map((c) =>
          c.id === draggableId
            ? {
                ...c,
                pipeline_status: newStatus,
                pipeline_updated_at: new Date().toISOString(),
              }
            : c
        )
      );

      const supabase = createClient();
      const { error } = await (supabase.from("clients") as any)
        .update({
          pipeline_status: newStatus,
          pipeline_updated_at: new Date().toISOString(),
        })
        .eq("id", draggableId);

      if (error) {
        // Revert on failure
        setClients((prev) =>
          prev.map((c) =>
            c.id === draggableId
              ? { ...c, pipeline_status: oldStatus }
              : c
          )
        );
        addToast("Failed to update pipeline stage");
      }
    },
    [addToast]
  );

  /* ── Add lead handler ──────────────────────────────────── */

  const handleAddLead = useCallback(
    async (form: {
      name: string;
      email: string;
      phone: string;
      type: string;
      lead_source: string;
      estimated_value: string;
      notes: string;
    }) => {
      if (!orgId || !form.name.trim()) return;
      setSaving(true);

      const supabase = createClient();
      const { data, error } = await (supabase.from("clients") as any)
        .insert({
          organization_id: orgId,
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          type: form.type || "residential",
          status: "lead",
          pipeline_status: "new_lead",
          pipeline_updated_at: new Date().toISOString(),
          estimated_value: form.estimated_value
            ? Number(form.estimated_value)
            : null,
          lead_source: form.lead_source.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();

      setSaving(false);

      if (error) {
        addToast("Failed to create lead");
        return;
      }

      if (data) {
        setClients((prev) => [
          {
            ...data,
            pipeline_status: data.pipeline_status || "new_lead",
            tags: data.tags || [],
            type: data.type as "residential" | "commercial" | null,
          },
          ...prev,
        ]);
        addToast(`${form.name} added to pipeline`);
        setAddModalOpen(false);
      }
    },
    [orgId, addToast]
  );

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRight size={10} className="text-zinc-700" />
              <span className="font-medium text-white">Sales Pipeline</span>
            </div>
            <span className="text-[11px] text-zinc-600">
              Drag clients through your sales funnel
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats pills */}
            <div className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1 text-[10px]">
                <DollarSign size={10} className="text-emerald-400" />
                <span className="text-zinc-500">Pipeline</span>
                <span className="font-mono font-medium text-emerald-400">
                  {formatCurrency(totalPipelineValue)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1 text-[10px]">
                <TrendingUp size={10} className="text-emerald-400" />
                <span className="text-zinc-500">Won</span>
                <span className="font-mono font-medium text-emerald-400">
                  {formatCurrency(wonValue)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1 text-[10px]">
                <Sparkles size={10} className="text-violet-400" />
                <span className="text-zinc-500">Close Rate</span>
                <span className="font-mono font-medium text-violet-400">
                  {conversionRate}%
                </span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500 hover:shadow-emerald-900/30"
            >
              <Plus size={12} />
              Add Lead
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Kanban Board ───────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {loading ? (
          <KanbanSkeleton />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-3">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  clients={columnData[col.id]}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* ── Add Lead Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {addModalOpen && (
          <AddLeadModal
            saving={saving}
            onClose={() => setAddModalOpen(false)}
            onSubmit={handleAddLead}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Kanban Column ───────────────────────────────────────── */

function KanbanColumn({
  column,
  clients,
}: {
  column: (typeof COLUMNS)[number];
  clients: PipelineClient[];
}) {
  const totalValue = clients.reduce(
    (sum, c) => sum + (c.estimated_value || 0),
    0
  );

  return (
    <div className="flex h-full w-[280px] min-w-[280px] flex-col">
      {/* Column header */}
      <div
        className={`mb-2 rounded-t-xl border-t-2 ${column.border} bg-zinc-950/60 px-3 py-2.5`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${column.dot}`} />
            <span className="text-[12px] font-semibold text-zinc-200">
              {column.label}
            </span>
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
              {clients.length}
            </span>
          </div>
          {totalValue > 0 && (
            <span className="font-mono text-[10px] text-zinc-600">
              {formatCurrency(totalValue)}
            </span>
          )}
        </div>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2 overflow-y-auto rounded-b-xl p-1.5 transition-colors duration-200 scrollbar-none ${
              snapshot.isDraggingOver
                ? "bg-white/[0.03] ring-1 ring-white/[0.06]"
                : "bg-transparent"
            }`}
          >
            {clients.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Users
                  size={20}
                  className="mb-2 text-zinc-800"
                />
                <p className="max-w-[200px] text-[11px] leading-relaxed text-zinc-700">
                  {column.emptyText}
                </p>
              </div>
            )}

            {clients.map((client, index) => (
              <Draggable
                key={client.id}
                draggableId={client.id}
                index={index}
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    style={dragProvided.draggableProps.style}
                  >
                    <PipelineCard
                      client={client}
                      isDragging={dragSnapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

/* ── Pipeline Card ───────────────────────────────────────── */

function PipelineCard({
  client,
  isDragging,
}: {
  client: PipelineClient;
  isDragging: boolean;
}) {
  const initials = getInitials(client.name);
  const typeCfg = COLUMN_MAP[client.type === "commercial" ? "quoting" : "new_lead"];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group cursor-grab rounded-xl border bg-zinc-950/80 p-3 transition-all duration-150 active:cursor-grabbing ${
        isDragging
          ? "border-white/[0.12] shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] scale-[1.02]"
          : "border-white/[0.04] hover:border-white/[0.08] hover:shadow-lg hover:shadow-black/30"
      }`}
    >
      {/* Top row: avatar + name + grip */}
      <div className="mb-2 flex items-start gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-semibold tracking-wide text-zinc-300 ${getGradient(initials)}`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-zinc-200">
            {client.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {client.type && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
                  client.type === "commercial"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-sky-500/10 text-sky-400"
                }`}
              >
                {client.type === "commercial" ? (
                  <Building2 size={8} />
                ) : (
                  <User size={8} />
                )}
                {client.type.charAt(0).toUpperCase() + client.type.slice(1)}
              </span>
            )}
          </div>
        </div>
        <GripVertical
          size={14}
          className="shrink-0 text-zinc-800 transition-colors group-hover:text-zinc-600"
        />
      </div>

      {/* Contact info */}
      {(client.email || client.phone) && (
        <div className="mb-2 space-y-0.5">
          {client.email && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <Mail size={9} className="shrink-0" />
              <span className="truncate">{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <Phone size={9} className="shrink-0" />
              <span>{client.phone}</span>
            </div>
          )}
        </div>
      )}

      {/* Value + time */}
      <div className="flex items-center justify-between">
        {client.estimated_value ? (
          <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-400">
            <DollarSign size={10} />
            {client.estimated_value.toLocaleString()}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-800">No estimate</span>
        )}
        <span className="flex items-center gap-1 text-[10px] text-zinc-700">
          <Clock size={9} />
          {timeAgo(client.pipeline_updated_at || client.created_at)}
        </span>
      </div>

      {/* Tags */}
      {client.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {client.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-0.5 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-500"
            >
              <Tag size={7} />
              {tag}
            </span>
          ))}
          {client.tags.length > 3 && (
            <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-600">
              +{client.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ── Skeleton Loading ────────────────────────────────────── */

function KanbanSkeleton() {
  return (
    <div className="flex h-full gap-3">
      {COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex h-full w-[280px] min-w-[280px] flex-col"
        >
          <div
            className={`mb-2 rounded-t-xl border-t-2 ${col.border} bg-zinc-950/60 px-3 py-2.5`}
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-zinc-800 animate-pulse" />
              <div className="h-3 w-20 rounded bg-zinc-800 animate-pulse" />
            </div>
          </div>
          <div className="flex-1 space-y-2 p-1.5">
            {[...Array(col.id === "new_lead" ? 3 : col.id === "quoting" ? 2 : 1)].map(
              (_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.04] bg-zinc-950/80 p-3"
                >
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-zinc-800 animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
                      <div className="h-2 w-16 rounded bg-zinc-900 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-2.5 w-14 rounded bg-zinc-900 animate-pulse" />
                    <div className="h-2.5 w-10 rounded bg-zinc-900 animate-pulse" />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Add Lead Modal ──────────────────────────────────────── */

function AddLeadModal({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: {
    name: string;
    email: string;
    phone: string;
    type: string;
    lead_source: string;
    estimated_value: string;
    notes: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    type: "residential",
    lead_source: "",
    estimated_value: "",
    notes: "",
  });
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#0A0A0A] p-6 shadow-2xl"
      >
        {/* Modal header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white">
              Add New Lead
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              Add a new prospect to your sales pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="space-y-3"
        >
          {/* Name */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-zinc-500">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              placeholder="Client or company name"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Type + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                Type
              </label>
              <div className="flex gap-1">
                {(["residential", "commercial"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("type", t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                      form.type === t
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.03]"
                    }`}
                  >
                    {t === "residential" ? (
                      <User size={10} />
                    ) : (
                      <Building2 size={10} />
                    )}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                Lead Source
              </label>
              <input
                value={form.lead_source}
                onChange={(e) => update("lead_source", e.target.value)}
                placeholder="e.g. Referral, Google"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Estimated Value */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-zinc-500">
              Estimated Value
            </label>
            <div className="relative">
              <DollarSign
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                type="number"
                min="0"
                value={form.estimated_value}
                onChange={(e) => update("estimated_value", e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] py-2 pr-3 pl-8 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-zinc-500">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              placeholder="Any initial notes..."
              className="w-full resize-none rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            >
              Cancel
            </button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={!form.name.trim() || saving}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white shadow-lg shadow-emerald-900/20 transition-all duration-200 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              {saving ? "Adding..." : "Add Lead"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
