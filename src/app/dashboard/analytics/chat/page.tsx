"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Send,
  Loader2,
  Brain,
  Database,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart,
  Table2,
  Clock,
  Sparkles,
  MessageSquare,
  Plus,
  Trash2,
  AlertTriangle,
  Code2,
  ChevronDown,
  ChevronUp,
  Activity,
  X,
} from "lucide-react";
import { BarChart, LineChart, DonutChart } from "@/components/analytics/dynamic-chart-renderer";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";
import {
  createChatSession,
  getChatSessions,
  getChatMessages,
  saveChatMessage,
  deleteChatSession,
  getLastRefreshTimestamp,
} from "@/app/actions/panopticon-chat";
import type { RenderingPayload } from "@/lib/schemas/panopticon-chat";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sql_query?: string;
  data_result?: Record<string, unknown>[];
  row_count?: number;
  rendering?: RenderingPayload;
  executive_summary?: string;
  processing_ms?: number;
  phase?: string;
  error?: string;
}

interface Session {
  id: string;
  title: string;
  message_count: number;
  updated_at: string;
}

type StreamPhase = "analyzing" | "writing_sql" | "fetching" | "rendering" | "retrying" | null;

const SUGGESTED_QUERIES = [
  "Compare gross margin by job category for the last 6 months",
  "Which 5 technicians had the highest overtime hours last quarter?",
  "Show monthly revenue trend for the past 12 months",
  "What is the average utilization rate by branch?",
  "Compare NDIS burn rates across all participants this month",
  "Which job categories have the worst quote accuracy?",
  "Show total labor cost vs billable hours by worker",
  "What was our total revenue last quarter?",
];

const PHASE_LABELS: Record<string, { icon: typeof Brain; label: string; color: string }> = {
  analyzing: { icon: Brain, label: "Analyzing question semantics...", color: "text-violet-400" },
  writing_sql: { icon: Code2, label: "Writing optimized SQL query...", color: "text-blue-400" },
  fetching: { icon: Database, label: "Fetching data from Panopticon Warehouse...", color: "text-emerald-400" },
  rendering: { icon: BarChart3, label: "Rendering visualizations...", color: "text-amber-400" },
  retrying: { icon: AlertTriangle, label: "Self-healing: fixing SQL...", color: "text-rose-400" },
};

/* ═══════════════════════════════════════════════════════════
   Dynamic Chart Renderer
   ═══════════════════════════════════════════════════════════ */

function DynamicChartRenderer({
  data,
  rendering,
}: {
  data: Record<string, unknown>[];
  rendering: RenderingPayload;
}) {
  if (!data?.length || !rendering) return null;

  const yKeys = rendering.y_axis_keys?.length
    ? rendering.y_axis_keys
    : [rendering.y_axis_key];
  const colors = ["emerald", "blue", "amber", "violet", "rose", "cyan"];

  switch (rendering.chart_type) {
    case "BAR_CHART":
      return (
        <BarChart
          data={data}
          index={rendering.x_axis_key}
          categories={yKeys}
          colors={colors.slice(0, yKeys.length)}
          className="h-72 mt-4"
          showAnimation
          showLegend={yKeys.length > 1}
        />
      );
    case "LINE_CHART":
      return (
        <LineChart
          data={data}
          index={rendering.x_axis_key}
          categories={yKeys}
          colors={colors.slice(0, yKeys.length)}
          className="h-72 mt-4"
          showAnimation
          showLegend={yKeys.length > 1}
        />
      );
    case "DONUT_CHART":
      return (
        <DonutChart
          data={data}
          category={rendering.y_axis_key}
          index={rendering.x_axis_key}
          colors={colors}
          className="h-72 mt-4"
          showAnimation
        />
      );
    case "METRIC_CARD": {
      const val = data[0]?.[rendering.y_axis_key];
      return (
        <div className="mt-4 p-6 bg-white/[0.03] border border-white/10 rounded-xl text-center">
          <p className="text-4xl font-bold text-white">
            {typeof val === "number" ? val.toLocaleString() : String(val ?? "—")}
          </p>
          <p className="text-sm text-neutral-500 mt-1">{rendering.title ?? rendering.y_axis_key}</p>
        </div>
      );
    }
    default:
      return <DataTableFallback data={data} />;
  }
}

function DataTableFallback({ data }: { data: Record<string, unknown>[] }) {
  if (!data?.length) return null;
  const columns = Object.keys(data[0]);
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left text-neutral-500 font-medium uppercase tracking-widest">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-neutral-300">
                  {row[col] != null ? String(row[col]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 50 && (
        <p className="px-3 py-2 text-[10px] text-neutral-600">Showing 50 of {data.length} rows</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════ */

export default function PanopticonChatPage() {
  const { orgId } = useOrg();
  const toast = useToastStore();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<StreamPhase>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggested = SUGGESTED_QUERIES;

  const loadSessions = useCallback(async () => {
    if (!orgId) return;
    const res = await getChatSessions(orgId);
    setSessions(res.data);
  }, [orgId]);

  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!orgId) return;
      const res = await getChatMessages(orgId, sessionId);
      setMessages(
        (res.data ?? []).map((m) => ({
          id: String(m.id),
          role: String(m.role) as ChatMsg["role"],
          content: String(m.content ?? ""),
          sql_query: m.sql_query as string | undefined,
          data_result: m.data_result as Record<string, unknown>[] | undefined,
          row_count: m.row_count as number | undefined,
          rendering: m.rendering as RenderingPayload | undefined,
          executive_summary: m.executive_summary as string | undefined,
          processing_ms: m.processing_ms as number | undefined,
        }))
      );
    },
    [orgId]
  );

  useEffect(() => {
    loadSessions();
    if (orgId) {
      getLastRefreshTimestamp(orgId).then((r) => setLastRefresh(r.data));
    }
  }, [loadSessions, orgId]);

  useEffect(() => {
    if (activeSession) loadMessages(activeSession);
  }, [activeSession, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  const startNewSession = async () => {
    if (!orgId) return;
    const res = await createChatSession(orgId);
    if (res.data) {
      setActiveSession(res.data.id);
      setMessages([]);
      loadSessions();
    }
  };

  const handleSubmit = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || !orgId || streaming) return;
    setInput("");

    let sid = activeSession;
    if (!sid) {
      const res = await createChatSession(orgId, q.slice(0, 60));
      if (!res.data) {
        toast.addToast(res.error ?? "Failed to create session", undefined, "error");
        return;
      }
      sid = res.data.id;
      setActiveSession(sid);
      loadSessions();
    }

    await saveChatMessage(orgId, sid, { role: "user", content: q });

    const userMsg: ChatMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);

    setStreaming(true);
    setPhase("analyzing");

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/panopticon-text-to-sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
            apikey: supabaseKey ?? "",
          },
          body: JSON.stringify({
            question: q,
            organization_id: orgId,
            session_id: sid,
            stream: true,
          }),
        }
      );

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to analytics engine");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const payload = JSON.parse(line.slice(6));

              if (currentEvent === "status") {
                setPhase(payload.phase as StreamPhase);
              } else if (currentEvent === "result") {
                setPhase(null);
                const assistantMsg: ChatMsg = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: payload.rendering?.executive_summary ?? "",
                  sql_query: payload.sql_query,
                  data_result: payload.data,
                  row_count: payload.row_count,
                  rendering: payload.rendering,
                  executive_summary: payload.rendering?.executive_summary,
                  processing_ms: payload.processing_ms,
                };
                setMessages((prev) => [...prev, assistantMsg]);
              } else if (currentEvent === "error") {
                setPhase(null);
                const errMsg: ChatMsg = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: payload.message ?? "An error occurred",
                  error: payload.sql_error,
                };
                setMessages((prev) => [...prev, errMsg]);
              }
            } catch {
              // skip malformed SSE data
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      setPhase(null);
      const errMsg: ChatMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: err instanceof Error ? err.message : "Connection error",
        error: "true",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setStreaming(false);
      setPhase(null);
      loadSessions();
    }
  };

  if (!orgId) return null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-[#050505]">
      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="shrink-0 border-r border-white/[0.06] bg-[#0A0A0A] overflow-hidden flex flex-col"
          >
            <div className="p-3 border-b border-white/[0.06]">
              <button
                onClick={startNewSession}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/15 transition-colors"
              >
                <Plus size={14} /> New Conversation
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    activeSession === s.id
                      ? "bg-white/[0.06] text-white"
                      : "text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-300"
                  }`}
                  onClick={() => setActiveSession(s.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare size={12} className="shrink-0" />
                    <span className="text-xs truncate">{s.title ?? "Untitled"}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!orgId) return;
                      deleteChatSession(orgId, s.id).then(() => {
                        if (activeSession === s.id) {
                          setActiveSession(null);
                          setMessages([]);
                        }
                        loadSessions();
                      });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 size={10} className="text-neutral-600 hover:text-rose-400" />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-[10px] text-neutral-600 text-center py-8">No conversations yet</p>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {showSidebar ? <X size={14} className="text-neutral-500" /> : <MessageSquare size={14} className="text-neutral-500" />}
            </button>
            <div>
              <h1 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" />
                Panopticon Chat
              </h1>
              <p className="text-[10px] text-neutral-600">Ask anything about your business data</p>
            </div>
          </div>
          {lastRefresh && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-full">
              <Clock size={10} className="text-neutral-600" />
              <span className="text-[10px] text-neutral-600">
                Data as of {new Date(lastRefresh).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
          {messages.length === 0 && !streaming && (
            <EmptyState
              suggested={suggested}
              onSelect={(q) => handleSubmit(q)}
            />
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Streaming indicator */}
          {phase && (
            <StreamingIndicator phase={phase} />
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="max-w-3xl mx-auto relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask anything about your margins, utilization, or budgets..."
              disabled={streaming}
              className="w-full px-4 py-3 pr-12 text-sm bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-all disabled:opacity-50"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={streaming || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-30"
            >
              {streaming ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */

function EmptyState({ suggested, onSelect }: { suggested: string[]; onSelect: (q: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto text-center pt-16"
    >
      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <Sparkles size={28} className="text-emerald-400" />
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">Ask your data anything</h2>
      <p className="text-sm text-neutral-500 mb-8 max-w-md mx-auto">
        Panopticon Chat translates your questions into precise SQL queries, executes them securely against your analytics warehouse, and visualizes the results instantly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {suggested.slice(0, 6).map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="text-left px-4 py-3 text-xs text-neutral-400 bg-white/[0.03] border border-white/[0.06] rounded-lg hover:border-emerald-500/20 hover:bg-emerald-500/5 hover:text-emerald-400 transition-all"
          >
            <Search size={10} className="inline-block mr-2 opacity-50" />
            {q}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function StreamingIndicator({ phase }: { phase: StreamPhase }) {
  if (!phase) return null;
  const config = PHASE_LABELS[phase];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 ml-10"
    >
      <div className={`p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] ${config.color}`}>
        <Icon size={14} className="animate-pulse" />
      </div>
      <span className={`text-sm ${config.color} animate-pulse`}>{config.label}</span>
    </motion.div>
  );
}

function MessageBubble({ msg }: { msg: ChatMsg }) {
  const [showSql, setShowSql] = useState(false);

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="max-w-lg px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl rounded-br-sm">
          <p className="text-sm text-emerald-100">{msg.content}</p>
        </div>
      </motion.div>
    );
  }

  const hasChart = msg.data_result?.length && msg.rendering;
  const hasError = msg.error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        {hasError ? (
          <AlertTriangle size={14} className="text-rose-400" />
        ) : (
          <Sparkles size={14} className="text-emerald-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {/* Executive summary */}
        {msg.executive_summary && (
          <p className="text-sm text-neutral-200 leading-relaxed mb-3">{msg.executive_summary}</p>
        )}

        {/* Error */}
        {hasError && !msg.executive_summary && (
          <p className="text-sm text-rose-300">{msg.content}</p>
        )}

        {/* Chart */}
        {hasChart && (
          <div className="p-4 bg-[#0A0A0A] border border-white/[0.06] rounded-xl">
            {msg.rendering?.title && (
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest mb-1">
                {msg.rendering.title}
              </p>
            )}
            <DynamicChartRenderer
              data={msg.data_result!}
              rendering={msg.rendering!}
            />
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {msg.row_count != null && (
            <span className="text-[10px] text-neutral-600 flex items-center gap-1">
              <Activity size={9} /> {msg.row_count} rows
            </span>
          )}
          {msg.processing_ms != null && (
            <span className="text-[10px] text-neutral-600 flex items-center gap-1">
              <Clock size={9} /> {(msg.processing_ms / 1000).toFixed(1)}s
            </span>
          )}
          {msg.rendering?.chart_type && (
            <ChartTypeBadge type={msg.rendering.chart_type} />
          )}
          {msg.sql_query && (
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-[10px] text-neutral-600 hover:text-neutral-400 flex items-center gap-1 transition-colors"
            >
              <Code2 size={9} /> {showSql ? "Hide" : "Show"} SQL
              {showSql ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
          )}
        </div>

        {/* SQL Panel */}
        <AnimatePresence>
          {showSql && msg.sql_query && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-2 p-3 bg-black/40 border border-white/[0.06] rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto"
            >
              {msg.sql_query}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ChartTypeBadge({ type }: { type: string }) {
  const icons: Record<string, typeof BarChart3> = {
    BAR_CHART: BarChart3,
    LINE_CHART: LineChartIcon,
    DONUT_CHART: PieChart,
    DATA_TABLE: Table2,
    METRIC_CARD: Activity,
  };
  const Icon = icons[type] ?? BarChart3;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-600">
      <Icon size={9} /> {type.replace("_", " ")}
    </span>
  );
}
