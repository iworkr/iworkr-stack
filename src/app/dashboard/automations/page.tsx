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
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  useAutomationsStore,
  type AutomationsTab,
} from "@/lib/automations-store";
import { type FlowCategory, getCategoryLabel } from "@/lib/automations-data";
import { FlowCard } from "@/components/automations/flow-card";
import { useToastStore } from "@/components/app/action-toast";

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: AutomationsTab; label: string; icon: typeof Zap }[] = [
  { id: "flows", label: "Flows", icon: Zap },
  { id: "activity", label: "Activity Log", icon: Terminal },
];

/* ── Status Config ────────────────────────────────────── */

const execStatusConfig = {
  success: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  skipped: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-500/10" },
};

export default function AutomationsPage() {
  const router = useRouter();
  const {
    flows,
    logs,
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
    // active first, then paused, then draft
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
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-4 pb-0 pt-4 md:px-6 md:pt-5">
        {/* Title row */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">Automations</h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">
              Build logic flows that run your business on autopilot.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-4 pr-3">
              <div className="flex items-center gap-1.5">
                <Zap size={12} className="text-emerald-500" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{activeCount}</span> Active Flows
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-blue-500" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{totalRuns.toLocaleString()}</span> runs today
                </span>
              </div>
            </div>

            {/* Master Pause Toggle */}
            <button
              onClick={handleMasterPause}
              disabled={masterPauseLoading}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition-all ${
                masterPaused
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
              } ${masterPauseLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {masterPaused ? <Play size={12} /> : <Pause size={12} />}
              {masterPauseLoading ? "Saving..." : masterPaused ? "Resume All" : "Pause All"}
            </button>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flows..."
                className="h-8 w-48 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-[rgba(255,255,255,0.2)]"
              />
            </div>

            {/* New Flow */}
            <button
              onClick={handleNewFlow}
              disabled={creatingFlow}
              className={`flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 text-[12px] font-semibold text-white shadow-[0_0_20px_-4px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_0_30px_-4px_rgba(59,130,246,0.4)] ${creatingFlow ? "opacity-60 cursor-not-allowed" : ""}`}
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
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] px-1 text-[9px] font-medium text-zinc-500">
                    {logs.length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="automations-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === "flows" ? (
          /* ── Flow Grid ──────────────────────────────── */
          Object.keys(grouped).length > 0 ? (
            Object.entries(grouped).map(([category, items], groupIdx) => (
              <div key={category} className="mb-8">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: groupIdx * 0.05 }}
                  className="mb-3 flex items-center gap-2"
                >
                  <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    {getCategoryLabel(category as FlowCategory)}
                  </h2>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.04)]" />
                  <span className="text-[10px] text-zinc-700">{items.length}</span>
                </motion.div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((flow, i) => (
                    <FlowCard key={flow.id} flow={flow} index={groupIdx * 4 + i} />
                  ))}
                </div>
              </div>
            ))
          ) : flows.length === 0 && !searchQuery ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 ring-1 ring-white/5">
                <Zap size={28} strokeWidth={1} className="text-blue-400" />
              </div>
              <h3 className="text-[14px] font-medium text-zinc-300">No Automations Yet</h3>
              <p className="mt-1 max-w-[280px] text-[11px] leading-relaxed text-zinc-600">
                Create your first automation to put your business on autopilot. Start from a template or build from scratch.
              </p>
              <button
                onClick={handleNewFlow}
                disabled={creatingFlow}
                className="mt-5 flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2 text-[12px] font-semibold text-white shadow-[0_0_20px_-4px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_0_30px_-4px_rgba(59,130,246,0.4)]"
              >
                <Plus size={13} strokeWidth={2} />
                {creatingFlow ? "Creating..." : "Create First Flow"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Zap size={28} strokeWidth={0.8} className="mb-3 text-zinc-800" />
              <p className="text-[13px] text-zinc-500">No flows found.</p>
              <p className="mt-1 text-[11px] text-zinc-700">Try adjusting your search.</p>
            </div>
          )
        ) : (
          /* ── Activity Log (Terminal) ─────────────────── */
          <div>
            {/* Header row */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-700">
              <span className="col-span-1">Status</span>
              <span className="col-span-3">Flow</span>
              <span className="col-span-2">Trigger Source</span>
              <span className="col-span-3">Timestamp</span>
              <span className="col-span-2">Duration</span>
              <span className="col-span-1"></span>
            </div>

            <AnimatePresence>
              {filteredLogs.map((log, i) => {
                const sConfig = execStatusConfig[log.status];
                const StatusIcon = sConfig.icon;
                const isExpanded = expandedLog === log.id;

                return (
                  <motion.div key={log.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02, duration: 0.25 }}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      className={`group grid cursor-pointer grid-cols-12 items-center gap-3 rounded-lg border border-transparent px-4 py-3 transition-all duration-150 hover:border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.02)] ${
                        log.status === "failed" ? "bg-red-500/[0.02]" : ""
                      }`}
                    >
                      <div className="col-span-1">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${sConfig.bg}`}>
                          <StatusIcon size={12} className={sConfig.color} />
                        </div>
                      </div>
                      <div className="col-span-3">
                        <p className="truncate text-[12px] font-medium text-zinc-300">{log.flowTitle}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-mono text-[11px] text-zinc-500">{log.triggerSource}</span>
                      </div>
                      <div className="col-span-3">
                        <p className="text-[11px] text-zinc-500">{log.timestamp}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-mono text-[10px] text-zinc-600">{log.duration}</span>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {log.errorMessage && (
                          <AlertTriangle size={12} className="text-red-500" />
                        )}
                      </div>
                    </motion.div>

                    {/* Expanded error trace */}
                    <AnimatePresence>
                      {isExpanded && log.errorMessage && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mx-4 mb-2 overflow-hidden"
                        >
                          <div className="rounded-lg border border-red-500/15 bg-red-500/5 px-4 py-3">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-red-400">Error</p>
                            <p className="mt-1 font-mono text-[11px] text-red-300">{log.errorMessage}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
