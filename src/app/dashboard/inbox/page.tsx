/**
 * @page /dashboard/inbox
 * @status COMPLETE
 * @description Echo-Triage inbox with split-pane triage list and context viewer
 * @dataSource notifications table + contextual entity fetches
 * @lastAudit 2026-03-26
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  CircleDollarSign,
  ShieldAlert,
  MessageSquare,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useInboxStore } from "@/lib/inbox-store";
import { markAllRead } from "@/app/actions/notifications";
import { createClient } from "@/lib/supabase/client";

type CategoryFilter = "all" | "unread" | "jobs" | "finance" | "compliance" | "message" | "system";
type ContextKind = "none" | "job" | "invoice" | "client";

interface ContextState {
  kind: ContextKind;
  loading: boolean;
  data: Record<string, unknown> | null;
}

const FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "jobs", label: "Jobs" },
  { id: "finance", label: "Finance" },
  { id: "compliance", label: "Compliance" },
  { id: "message", label: "Message" },
  { id: "system", label: "System" },
];

function classifyCategory(type: string): Exclude<CategoryFilter, "all" | "unread"> {
  if (type.includes("invoice") || type.includes("finance")) return "finance";
  if (type.includes("compliance") || type.includes("review")) return "compliance";
  if (type.includes("message") || type.includes("mention") || type.includes("chat")) return "message";
  if (type.includes("job") || type.includes("shift") || type.includes("schedule")) return "jobs";
  return "system";
}

function relativeTime(input: string): string {
  const date = new Date(input);
  if (isNaN(date.getTime())) return input;
  const delta = Date.now() - date.getTime();
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function InboxPage() {
  const router = useRouter();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const user = useAuthStore((s) => s.user);
  const orgId = currentOrg?.id;
  const userId = user?.id;

  const items = useInboxStore((s) => s.items);
  const selectedId = useInboxStore((s) => s.selectedId);
  const setSelectedId = useInboxStore((s) => s.setSelectedId);
  const markAsRead = useInboxStore((s) => s.markAsRead);
  const loadFromServer = useInboxStore((s) => s.loadFromServer);

  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [contextState, setContextState] = useState<ContextState>({
    kind: "none",
    loading: false,
    data: null,
  });

  useEffect(() => {
    if (orgId) {
      void loadFromServer(orgId);
    }
  }, [orgId, loadFromServer]);

  const filteredItems = useMemo(() => {
    const base = items.filter((item) => !item.archived);
    if (filter === "all") return base;
    if (filter === "unread") return base.filter((item) => !item.read);
    return base.filter((item) => classifyCategory(item.type) === filter);
  }, [items, filter]);

  const selected = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    if (selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId, setSelectedId]);

  useEffect(() => {
    if (!selected) {
      setContextState({ kind: "none", loading: false, data: null });
      return;
    }

    const supabase = createClient();
    let active = true;
    setContextState((prev) => ({ ...prev, loading: true }));

    const loadContext = async () => {
      if (selected.jobRef) {
        const { data } = await supabase
          .from("jobs")
          .select("id, title, status, priority, scheduled_start")
          .eq("id", selected.jobRef)
          .maybeSingle();
        if (!active) return;
        setContextState({ kind: "job", loading: false, data: (data as Record<string, unknown> | null) ?? null });
        return;
      }

      const entityType = selected.relatedEntityType ?? "";
      const entityId = selected.relatedEntityId ?? selected.referenceId ?? "";

      if ((entityType.includes("invoice") || selected.type.includes("invoice")) && entityId) {
        const { data } = await supabase
          .from("invoices")
          .select("id, invoice_number, status, total, due_date")
          .eq("id", entityId)
          .maybeSingle();
        if (!active) return;
        setContextState({ kind: "invoice", loading: false, data: (data as Record<string, unknown> | null) ?? null });
        return;
      }

      if ((entityType.includes("client") || selected.type === "team_invite") && entityId) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, email, phone, status")
          .eq("id", entityId)
          .maybeSingle();
        if (!active) return;
        setContextState({ kind: "client", loading: false, data: (data as Record<string, unknown> | null) ?? null });
        return;
      }

      setContextState({ kind: "none", loading: false, data: null });
    };

    void loadContext();
    return () => {
      active = false;
    };
  }, [selected]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read && !item.archived).length, [items]);

  const handleOpenItem = (id: string) => {
    setSelectedId(id);
    const item = items.find((i) => i.id === id);
    if (item && !item.read) {
      markAsRead(id);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      useInboxStore.setState((s) => ({
        items: s.items.map((i) => ({ ...i, read: true })),
      }));
    } finally {
      setMarkingAll(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)]">
        <p className="text-[13px] text-zinc-500">Loading inbox…</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.012]" />

      <aside className="relative z-10 flex w-[360px] shrink-0 flex-col border-r border-white/[0.06] bg-black/30">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-emerald-500/80" />
            <h2 className="text-[14px] font-semibold tracking-tight text-white">Echo-Triage</h2>
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              {filteredItems.length}
            </span>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => void handleMarkAllRead()}
              disabled={markingAll}
              className="flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-50"
            >
              <CheckCheck size={11} />
              Mark all read
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-white/[0.06] px-3 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                filter === f.id
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filteredItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-[13px] font-medium text-zinc-400">No notifications</p>
              <p className="mt-1 text-[11px] text-zinc-600">You are fully triaged.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selected?.id === item.id;
              const category = classifyCategory(item.type);
              const categoryIcon =
                category === "jobs" ? Briefcase :
                category === "finance" ? CircleDollarSign :
                category === "compliance" ? ShieldAlert :
                category === "message" ? MessageSquare : Bell;

              const CategoryIcon = categoryIcon;

              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleOpenItem(item.id)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-1.5 w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "border-white/[0.16] bg-white/[0.05]"
                      : "border-white/[0.04] bg-transparent hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-md bg-white/[0.04] p-1.5">
                      <CategoryIcon size={12} className="text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-[12px] font-medium ${item.read ? "text-zinc-400" : "text-white"}`}>
                          {item.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-zinc-600">
                          {relativeTime(item.time)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">{item.body}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>
      </aside>

      <section className="relative z-10 flex flex-1 flex-col">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[15px] font-semibold text-white">Select a notification</p>
            <p className="mt-2 max-w-[280px] text-[12px] text-zinc-600">
              Open an alert from the left pane to inspect context and resolve quickly.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-white/[0.06] bg-black/30 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-white">{selected.title}</h3>
                  <p className="mt-1 text-[12px] text-zinc-500">{selected.body}</p>
                </div>
                {selected.actionUrl && (
                  <button
                    onClick={() => router.push(selected.actionUrl || "/dashboard/inbox")}
                    className="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
                  >
                    Open source
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {contextState.loading ? (
                <div className="h-32 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
              ) : contextState.kind === "job" && contextState.data ? (
                <ContextCard
                  title="Job Context"
                  rows={[
                    ["Title", String(contextState.data.title ?? "-")],
                    ["Status", String(contextState.data.status ?? "-")],
                    ["Priority", String(contextState.data.priority ?? "-")],
                    ["Scheduled", String(contextState.data.scheduled_start ?? "-")],
                  ]}
                />
              ) : contextState.kind === "invoice" && contextState.data ? (
                <ContextCard
                  title="Finance Context"
                  rows={[
                    ["Invoice", String(contextState.data.invoice_number ?? contextState.data.id ?? "-")],
                    ["Status", String(contextState.data.status ?? "-")],
                    ["Total", `$${String(contextState.data.total ?? "0")}`],
                    ["Due", String(contextState.data.due_date ?? "-")],
                  ]}
                />
              ) : contextState.kind === "client" && contextState.data ? (
                <ContextCard
                  title="Client Context"
                  rows={[
                    ["Name", String(contextState.data.name ?? "-")],
                    ["Email", String(contextState.data.email ?? "-")],
                    ["Phone", String(contextState.data.phone ?? "-")],
                    ["Status", String(contextState.data.status ?? "-")],
                  ]}
                />
              ) : (
                <ContextCard
                  title="Alert Context"
                  rows={[
                    ["Type", selected.type],
                    ["Sender", selected.sender],
                    ["Received", selected.time],
                    ["Context", selected.context || "No additional context"],
                  ]}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ContextCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="max-w-2xl rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <h4 className="text-[13px] font-semibold text-white">{title}</h4>
      <div className="mt-3 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 border-b border-white/[0.04] pb-2 text-[12px]">
            <span className="text-zinc-600">{k}</span>
            <span className="text-right text-zinc-300">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
