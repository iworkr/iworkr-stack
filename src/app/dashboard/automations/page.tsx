"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Zap,
  Activity,
  Pause,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Terminal,
  ChevronDown,
  Cpu,
  History,
  X,
  Shield,
  Skull,
  Timer,
  ArrowRight,
  ExternalLink,
  Filter,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useAutomationsStore,
  type AutomationsTab,
} from "@/lib/automations-store";
import {
  type FlowCategory,
  type TraceStep,
  type ExecutionRun,
  getCategoryLabel,
} from "@/lib/automations-data";
import { FlowCard } from "@/components/automations/flow-card";
import { useToastStore } from "@/components/app/action-toast";

/* ── Motion variants — staggered page load ──────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: AutomationsTab; label: string; icon: typeof Zap }[] = [
  { id: "flows", label: "Flows", icon: Zap },
  { id: "executions", label: "Executions", icon: History },
  { id: "activity", label: "Activity Log", icon: Terminal },
];

/* ── Status Config ────────────────────────────────────── */

const execStatusConfig = {
  success: { icon: CheckCircle, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]", label: "OK", border: "border-[#00E676]/20" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "ERR", border: "border-red-500/20" },
  skipped: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-500/10", label: "SKIP", border: "border-zinc-500/20" },
};

/* ── Animated Empty State (Lottie-style CSS) ──────────── */

function EmptyState({ onCreateFlow, loading }: { onCreateFlow: () => void; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      {/* Animated circuit board / machine visualization */}
      <div className="relative mb-6">
        {/* Outer pulse ring */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-3xl bg-[#00E676]/10"
          style={{ margin: "-16px" }}
        />
        {/* Middle ring */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute inset-0 rounded-3xl bg-[#00E676]/5"
          style={{ margin: "-8px" }}
        />
        {/* Core icon */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[rgba(0,230,118,0.06)] ring-1 ring-[#00E676]/15"
        >
          <Cpu size={36} strokeWidth={0.8} className="text-[#00E676]" />
        </motion.div>
        {/* Orbiting dots */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
          style={{ margin: "-20px" }}
        >
          <div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#00E676]/60" />
          <div className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#00E676]/30" />
        </motion.div>
        <motion.div
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
          style={{ margin: "-32px" }}
        >
          <div className="absolute left-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#00E676]/40" />
          <div className="absolute right-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#00E676]/20" />
        </motion.div>
      </div>

      <h3 className="text-[16px] font-medium tracking-tight text-zinc-200">
        Automate the Boring Stuff.
      </h3>
      <p className="mt-2 max-w-[300px] text-[12px] leading-relaxed text-zinc-600">
        Build logic flows that send reminders, chase invoices, and notify your team — all on autopilot.
      </p>
      <button
        onClick={onCreateFlow}
        disabled={loading}
        className="mt-6 flex items-center gap-2 rounded-xl bg-[#00E676] px-6 py-2.5 text-[13px] font-medium text-black shadow-[0_0_20px_-6px_rgba(0,230,118,0.15)] transition-all hover:bg-[#00C853] hover:shadow-[0_0_24px_-6px_rgba(0,230,118,0.2)]"
      >
        <Plus size={15} strokeWidth={2} />
        {loading ? "Creating..." : "Create First Flow"}
      </button>
    </motion.div>
  );
}

/* ── Trace Step Component ─────────────────────────────── */

function TraceStepRow({ step, index }: { step: TraceStep; index: number }) {
  const statusColors = {
    passed: { text: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]", dot: "bg-[#00E676]" },
    simulated: { text: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
    failed: { text: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
    skipped: { text: "text-zinc-500", bg: "bg-zinc-500/10", dot: "bg-zinc-500" },
    error: { text: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
  };
  const sc = statusColors[step.status] || statusColors.skipped;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-start gap-3 py-2"
    >
      {/* Connector line + dot */}
      <div className="flex flex-col items-center pt-1">
        <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
        <div className="mt-1 h-full w-px bg-zinc-800" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[11px] font-medium ${sc.text}`}>
            {step.step}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${sc.bg} ${sc.text}`}>
            {step.status}
          </span>
          {step.duration_ms != null && (
            <span className="text-[9px] text-zinc-600">{step.duration_ms}ms</span>
          )}
        </div>
        {step.description && (
          <p className="mt-0.5 text-[10px] text-zinc-500">{step.description}</p>
        )}
        {step.evaluation && (
          <div className="mt-1 rounded bg-black/30 px-2 py-1">
            <p className="font-mono text-[9px] text-zinc-600">{step.evaluation}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Deep Dive Modal ──────────────────────────────────── */

function RunDetailModal({
  run,
  trace,
  traceLoading,
  onClose,
  onViewFlow,
}: {
  run: ExecutionRun;
  trace: TraceStep[];
  traceLoading: boolean;
  onClose: () => void;
  onViewFlow: () => void;
}) {
  const sc = execStatusConfig[run.status];
  const StatusIcon = sc.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${sc.bg}`}>
              <StatusIcon size={16} className={sc.color} />
            </div>
            <div>
              <h2 className="text-[14px] font-medium text-zinc-200">{run.flowTitle}</h2>
              <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                <span>{run.timestamp}</span>
                <span>·</span>
                <span className="font-mono">{run.triggerEventId}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onViewFlow}
              className="flex items-center gap-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-[#00E676]/30 hover:text-zinc-200"
            >
              <ExternalLink size={11} />
              View Flow
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 border-b border-white/[0.06] px-6 py-3">
          <div className="flex items-center gap-1.5">
            <Timer size={12} className="text-zinc-600" />
            <span className="text-[11px] text-zinc-500">Duration:</span>
            <span className="text-[11px] font-medium text-zinc-300">
              {run.executionTimeMs > 0 ? `${run.executionTimeMs}ms` : "< 1ms"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex h-4 items-center rounded-full px-2 text-[9px] font-semibold uppercase tracking-wider ${sc.bg} ${sc.color}`}>
              {run.status}
            </span>
          </div>
          {run.errorDetails && (
            <div className="flex items-center gap-1.5 text-red-400">
              <AlertTriangle size={11} />
              <span className="truncate text-[10px]">{run.errorDetails}</span>
            </div>
          )}
        </div>

        {/* Trace body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {traceLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw size={20} className="text-[#00E676]" />
              </motion.div>
              <p className="mt-3 text-[11px] text-zinc-600">Loading execution trace...</p>
            </div>
          ) : trace.length > 0 ? (
            <div className="space-y-0">
              {trace.map((step, i) => (
                <TraceStepRow key={i} step={step} index={i} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Terminal size={24} strokeWidth={0.8} className="mb-2 text-zinc-800" />
              <p className="text-[12px] text-zinc-600">No trace data available for this execution.</p>
              <p className="mt-1 text-[10px] text-zinc-700">
                Trace data is recorded for runs executed by the automation worker.
              </p>
            </div>
          )}
        </div>

        {/* Footer with raw JSON toggle */}
        {trace.length > 0 && (
          <div className="border-t border-white/[0.06] px-6 py-3">
            <details className="group">
              <summary className="cursor-pointer text-[10px] font-medium text-zinc-600 transition-colors hover:text-zinc-400">
                Raw trace JSON
              </summary>
              <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/40 p-3">
                <pre className="font-mono text-[9px] leading-relaxed text-zinc-600">
                  {JSON.stringify(trace, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Executions Tab Content ───────────────────────────── */

function ExecutionsTab() {
  const router = useRouter();
  const { runs, runsLoading, loadRuns, fetchRunTrace, searchQuery, flows } = useAutomationsStore();
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);
  const [traceData, setTraceData] = useState<TraceStep[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "skipped">("all");
  const [flowFilter, setFlowFilter] = useState<string>("all");

  // Load runs on mount
  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleOpenDetail = useCallback(async (run: ExecutionRun) => {
    setSelectedRun(run);
    // If run already has trace data in its object, use it
    if (run.trace && run.trace.length > 0) {
      setTraceData(run.trace);
    } else {
      // Fetch full trace from server
      setTraceLoading(true);
      const { trace, error } = await fetchRunTrace(run.id);
      if (!error) setTraceData(trace);
      setTraceLoading(false);
    }
  }, [fetchRunTrace]);

  const handleCloseDetail = useCallback(() => {
    setSelectedRun(null);
    setTraceData([]);
  }, []);

  const filteredRuns = useMemo(() => {
    let items = runs;
    if (statusFilter !== "all") {
      items = items.filter((r) => r.status === statusFilter);
    }
    if (flowFilter !== "all") {
      items = items.filter((r) => r.automationId === flowFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (r) =>
          r.flowTitle.toLowerCase().includes(q) ||
          r.triggerEventId.toLowerCase().includes(q) ||
          (r.errorDetails && r.errorDetails.toLowerCase().includes(q))
      );
    }
    return items;
  }, [runs, statusFilter, flowFilter, searchQuery]);

  // Stats
  const successCount = useMemo(() => runs.filter((r) => r.status === "success").length, [runs]);
  const failedCount = useMemo(() => runs.filter((r) => r.status === "failed").length, [runs]);
  const avgDuration = useMemo(() => {
    const durations = runs.filter((r) => r.executionTimeMs > 0);
    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((sum, r) => sum + r.executionTimeMs, 0) / durations.length);
  }, [runs]);

  // Unique flows for filter dropdown
  const flowOptions = useMemo(() => {
    const seen = new Map<string, string>();
    runs.forEach((r) => { if (!seen.has(r.automationId)) seen.set(r.automationId, r.flowTitle); });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [runs]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      {/* Stats bar */}
      <motion.div
        variants={itemVariants}
        className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(0,230,118,0.08)]">
            <History size={13} className="text-[#00E676]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">Total Runs</p>
            <p className="text-[14px] font-semibold text-zinc-200">{runs.length}</p>
          </div>
        </div>

        <div className="h-8 w-px bg-white/[0.06]" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(0,230,118,0.08)]">
            <CheckCircle size={13} className="text-[#00E676]" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">Success</p>
            <p className="text-[14px] font-semibold text-[#00E676]">{successCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
            <XCircle size={13} className="text-red-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">Failed</p>
            <p className="text-[14px] font-semibold text-red-400">{failedCount}</p>
          </div>
        </div>

        <div className="h-8 w-px bg-white/[0.06]" />

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
            <Timer size={13} className="text-zinc-400" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">Avg Duration</p>
            <p className="text-[14px] font-semibold text-zinc-300">
              {avgDuration > 0 ? `${avgDuration}ms` : "—"}
            </p>
          </div>
        </div>

        {/* Right side: filters */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Filter size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-7 appearance-none rounded-lg border border-white/[0.08] bg-white/[0.03] pl-7 pr-6 text-[10px] text-zinc-400 outline-none transition-colors focus:border-[#00E676]/30"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          <div className="relative">
            <Zap size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
            <select
              value={flowFilter}
              onChange={(e) => setFlowFilter(e.target.value)}
              className="h-7 max-w-[180px] appearance-none truncate rounded-lg border border-white/[0.08] bg-white/[0.03] pl-7 pr-6 text-[10px] text-zinc-400 outline-none transition-colors focus:border-[#00E676]/30"
            >
              <option value="all">All Flows</option>
              {flowOptions.map((f) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          <button
            onClick={() => loadRuns()}
            className="flex h-7 items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 text-[10px] text-zinc-500 transition-colors hover:border-[#00E676]/30 hover:text-zinc-300"
          >
            <RefreshCw size={10} className={runsLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Data grid header */}
      <motion.div
        variants={itemVariants}
        className="sticky top-0 z-10 grid grid-cols-12 gap-3 rounded-t-lg bg-[#050505]/90 px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-600 backdrop-blur-md"
      >
        <span className="col-span-1">STS</span>
        <span className="col-span-3">Flow</span>
        <span className="col-span-2">Event ID</span>
        <span className="col-span-2">Timestamp</span>
        <span className="col-span-1">Duration</span>
        <span className="col-span-2">Error</span>
        <span className="col-span-1"></span>
      </motion.div>

      {/* Data rows */}
      {runsLoading && runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RefreshCw size={20} className="text-[#00E676]" />
          </motion.div>
          <p className="mt-3 text-[11px] text-zinc-600">Loading execution history...</p>
        </div>
      ) : (
        <AnimatePresence>
          {filteredRuns.map((run, i) => {
            const sc = execStatusConfig[run.status];
            const StatusIcon = sc.icon;
            const isFailed = run.status === "failed";

            return (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.015, duration: 0.25 }}
                onClick={() => handleOpenDetail(run)}
                className={`group grid cursor-pointer grid-cols-12 items-center gap-3 rounded-lg border border-transparent px-4 py-2.5 font-mono transition-all duration-150 hover:border-white/[0.06] hover:bg-white/[0.02] ${
                  isFailed ? "bg-red-500/[0.02]" : ""
                }`}
              >
                {/* Status */}
                <div className="col-span-1">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${sc.bg}`}>
                    <StatusIcon size={12} className={sc.color} />
                  </div>
                </div>

                {/* Flow name */}
                <div className="col-span-3">
                  <p className={`truncate text-[12px] font-medium ${isFailed ? "text-red-400" : "text-zinc-300"}`}>
                    {run.flowTitle}
                  </p>
                </div>

                {/* Event ID */}
                <div className="col-span-2">
                  <span className="truncate text-[10px] text-zinc-600">{run.triggerEventId || "—"}</span>
                </div>

                {/* Timestamp */}
                <div className="col-span-2">
                  <p className="text-[11px] text-zinc-600">{run.timestamp}</p>
                </div>

                {/* Duration */}
                <div className="col-span-1">
                  <span className="text-[10px] text-zinc-600">
                    {run.executionTimeMs > 0 ? `${run.executionTimeMs}ms` : "< 1ms"}
                  </span>
                </div>

                {/* Error */}
                <div className="col-span-2">
                  {run.errorDetails ? (
                    <span className="truncate text-[10px] text-red-400/70">{run.errorDetails}</span>
                  ) : (
                    <span className="text-[10px] text-zinc-800">—</span>
                  )}
                </div>

                {/* Detail arrow */}
                <div className="col-span-1 flex justify-end">
                  <ArrowRight size={12} className="text-zinc-700 transition-colors group-hover:text-[#00E676]" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      {filteredRuns.length === 0 && !runsLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <History size={24} strokeWidth={0.8} className="mb-2 text-zinc-800" />
          <p className="text-[12px] text-zinc-600">No execution runs found.</p>
          <p className="mt-1 text-[10px] text-zinc-700">
            {runs.length === 0
              ? "Runs will appear here as your automations execute."
              : "Try adjusting your filters."}
          </p>
        </div>
      )}

      {/* Deep dive modal */}
      <AnimatePresence>
        {selectedRun && (
          <RunDetailModal
            run={selectedRun}
            trace={traceData}
            traceLoading={traceLoading}
            onClose={handleCloseDetail}
            onViewFlow={() => {
              router.push(`/dashboard/automations/${selectedRun.automationId}`);
              handleCloseDetail();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

export default function AutomationsPage() {
  const router = useRouter();
  const {
    flows,
    logs,
    runs,
    stats,
    activeTab,
    searchQuery,
    masterPaused,
    setActiveTab,
    setSearchQuery,
    toggleMasterPauseServer,
    createFlowServer,
  } = useAutomationsStore();
  const { addToast } = useToastStore();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [masterPauseLoading, setMasterPauseLoading] = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);

  const handleMasterPause = useCallback(async () => {
    if (masterPauseLoading) return;
    setMasterPauseLoading(true);
    const wasP = masterPaused;
    const { error } = await toggleMasterPauseServer();
    if (error) addToast(`Failed: ${error}`);
    else addToast(wasP ? "All flows resumed" : "All flows paused");
    setMasterPauseLoading(false);
  }, [masterPaused, masterPauseLoading, toggleMasterPauseServer, addToast]);

  const handleNewFlow = useCallback(async () => {
    if (creatingFlow) return;
    setCreatingFlow(true);
    const { data, error } = await createFlowServer({
      name: "Untitled Flow",
      category: "operations",
    });
    if (error) {
      addToast(`Failed to create flow: ${error}`);
    } else if (data) {
      addToast("New flow created");
      router.push(`/dashboard/automations/${data.id}`);
    }
    setCreatingFlow(false);
  }, [creatingFlow, createFlowServer, addToast, router]);

  /* ── Stats ──────────────────────────────────────────── */
  const activeCount = useMemo(
    () => flows.filter((f) => f.status === "active").length,
    [flows]
  );
  const totalRuns = useMemo(
    () => flows.reduce((sum, f) => sum + f.metrics.runs24h, 0),
    [flows]
  );

  /* ── Filtering ──────────────────────────────────────── */
  const filteredFlows = useMemo(() => {
    let items = flows.filter((f) => f.status !== "archived");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.category.includes(q)
      );
    }
    return items.sort((a, b) => {
      const order = { active: 0, paused: 1, draft: 2, archived: 3 };
      return (order[a.status] || 3) - (order[b.status] || 3);
    });
  }, [flows, searchQuery]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.flowTitle.toLowerCase().includes(q) ||
        l.triggerSource.toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  /* ── Group by category ──────────────────────────────── */
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filteredFlows> = {};
    filteredFlows.forEach((f) => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, [filteredFlows]);

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header — Staggered Fade-In ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="border-b border-white/[0.06] px-4 pb-0 pt-4 md:px-6 md:pt-5"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[15px] font-medium tracking-tight text-zinc-200">Logic Core</h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">
              Build logic flows that run your business on autopilot.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-4 pr-3">
              <div className="flex items-center gap-1.5">
                <Zap size={12} className="text-[#00E676]" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{activeCount}</span> Active
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-[#00E676]" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{totalRuns.toLocaleString()}</span> runs/24h
                </span>
              </div>
              {/* Circuit Breaker indicator */}
              {stats && !!(stats as unknown as Record<string, unknown>).circuit_breaker_active && (
                <div className="flex items-center gap-1.5">
                  <Shield size={12} className="text-amber-400" />
                  <span className="text-[11px] text-amber-400">Throttled</span>
                </div>
              )}
              {/* Dead Letter count */}
              {(() => {
                const dlCount = stats ? Number((stats as unknown as Record<string, unknown>).dead_letter_count) || 0 : 0;
                if (dlCount <= 0) return null;
                return (
                  <div className="flex items-center gap-1.5">
                    <Skull size={12} className="text-red-400" />
                    <span className="text-[11px] text-red-400">{dlCount} dead</span>
                  </div>
                );
              })()}
            </div>

            {/* Master Pause — PRD: Neon green toggle style */}
            <button
              onClick={handleMasterPause}
              disabled={masterPauseLoading}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition-all ${
                masterPaused
                  ? "border-[#00E676]/30 bg-[rgba(0,230,118,0.08)] text-[#00E676] hover:bg-[rgba(0,230,118,0.12)]"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
              } ${masterPauseLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {masterPaused ? <Play size={12} /> : <Pause size={12} />}
              {masterPauseLoading ? "Saving..." : masterPaused ? "Resume All" : "Pause All"}
            </button>

            {/* Search — PRD: ghost input, green focus glow */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flows..."
                className="h-8 w-48 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-[#00E676]/30 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.15)]"
              />
            </div>

            {/* New Flow — PRD: Neon Green, black text, NO BLUE */}
            <button
              onClick={handleNewFlow}
              disabled={creatingFlow}
              className={`flex h-8 items-center gap-1.5 rounded-lg bg-[#00E676] px-4 text-[12px] font-medium text-black transition-all duration-200 hover:bg-[#00C853] ${
                creatingFlow ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <Plus size={13} strokeWidth={2} />
              {creatingFlow ? "Creating..." : "New Flow"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${
                  isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Icon size={13} strokeWidth={1.5} />
                {tab.label}
                {tab.id === "activity" && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/[0.06] px-1 text-[9px] font-medium text-zinc-500">
                    {logs.length}
                  </span>
                )}
                {tab.id === "executions" && runs.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(0,230,118,0.08)] px-1 text-[9px] font-medium text-[#00E676]">
                    {runs.length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="automations-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#00E676]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === "flows" ? (
          /* ── Flow Grid with staggered animation ──── */
          Object.keys(grouped).length > 0 ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              {Object.entries(grouped).map(([category, items]) => (
                <motion.div key={category} variants={itemVariants} className="mb-8">
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                      {getCategoryLabel(category as FlowCategory)}
                    </h2>
                    <div className="h-px flex-1 bg-white/[0.04]" />
                    <span className="text-[10px] text-zinc-700">{items.length}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((flow, i) => (
                      <FlowCard key={flow.id} flow={flow} index={i} />
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : flows.length === 0 && !searchQuery ? (
            /* ── PRD: Beautiful animated empty state ── */
            <EmptyState onCreateFlow={handleNewFlow} loading={creatingFlow} />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <Zap size={28} strokeWidth={0.8} className="mb-3 text-zinc-800" />
              <p className="text-[13px] text-zinc-500">No flows found.</p>
              <p className="mt-1 text-[11px] text-zinc-700">Try adjusting your search.</p>
            </motion.div>
          )
        ) : activeTab === "executions" ? (
          /* ── Execution History Tab ─────────────────── */
          <ExecutionsTab />
        ) : (
          /* ── Activity Log (Terminal Style) ────────── */
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            {/* Terminal header — sticky glassmorphism */}
            <motion.div
              variants={itemVariants}
              className="sticky top-0 z-10 grid grid-cols-12 gap-3 rounded-t-lg bg-[#050505]/90 px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-600 backdrop-blur-md"
            >
              <span className="col-span-1">STS</span>
              <span className="col-span-3">Flow</span>
              <span className="col-span-2">Source</span>
              <span className="col-span-3">Timestamp</span>
              <span className="col-span-2">Duration</span>
              <span className="col-span-1"></span>
            </motion.div>

            <AnimatePresence>
              {filteredLogs.map((log, i) => {
                const sConfig = execStatusConfig[log.status];
                const StatusIcon = sConfig.icon;
                const isExpanded = expandedLog === log.id;
                const isFailed = log.status === "failed";

                return (
                  <motion.div key={log.id} variants={itemVariants}>
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25 }}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      className={`group grid cursor-pointer grid-cols-12 items-center gap-3 rounded-lg border border-transparent px-4 py-2.5 font-mono transition-all duration-150 hover:border-white/[0.06] hover:bg-white/[0.02] ${
                        isFailed ? "bg-red-500/[0.02]" : ""
                      }`}
                    >
                      {/* Status */}
                      <div className="col-span-1">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${sConfig.bg}`}>
                          <StatusIcon size={12} className={sConfig.color} />
                        </div>
                      </div>
                      {/* Flow name */}
                      <div className="col-span-3">
                        <p className={`truncate text-[12px] font-medium ${isFailed ? "text-red-400" : "text-[#00E676]"}`}>
                          {log.flowTitle}
                        </p>
                      </div>
                      {/* Source */}
                      <div className="col-span-2">
                        <span className="text-[11px] text-zinc-500">{log.triggerSource}</span>
                      </div>
                      {/* Timestamp */}
                      <div className="col-span-3">
                        <p className="text-[11px] text-zinc-600">{log.timestamp}</p>
                      </div>
                      {/* Duration */}
                      <div className="col-span-2">
                        <span className="text-[10px] text-zinc-600">{log.duration}</span>
                      </div>
                      {/* Error indicator */}
                      <div className="col-span-1 flex justify-end">
                        {log.errorMessage && (
                          <motion.div
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <AlertTriangle size={12} className="text-red-500" />
                          </motion.div>
                        )}
                      </div>
                    </motion.div>

                    {/* Expanded trace — spring slide-down */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="mx-4 mb-2 overflow-hidden"
                        >
                          <div className={`rounded-lg border px-4 py-3 font-mono ${
                            isFailed
                              ? "border-red-500/15 bg-red-500/5"
                              : "border-[#00E676]/15 bg-[rgba(0,230,118,0.03)]"
                          }`}>
                            <p className={`text-[10px] font-medium uppercase tracking-wider ${
                              isFailed ? "text-red-400" : "text-[#00E676]"
                            }`}>
                              {isFailed ? "Error Trace" : "Execution Details"}
                            </p>
                            {log.errorMessage ? (
                              <p className="mt-1 text-[11px] text-red-300">{log.errorMessage}</p>
                            ) : (
                              <p className="mt-1 text-[11px] text-zinc-500">
                                Completed successfully. Source: {log.triggerSource} | Duration: {log.duration}
                              </p>
                            )}
                            <div className="mt-2 rounded bg-black/30 px-2 py-1.5">
                              <p className="text-[9px] text-zinc-700">
                                {`{ "flow": "${log.flowTitle}", "trigger": "${log.triggerSource}", "status": "${log.status}", "duration": "${log.duration}" }`}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Terminal size={24} strokeWidth={0.8} className="mb-2 text-zinc-800" />
                <p className="text-[12px] text-zinc-600">No activity logs found.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
