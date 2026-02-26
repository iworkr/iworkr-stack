"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Clock, Mail, MessageSquare, GitBranch,
  Play, Pause, Send, Webhook, Bell, Check, Star, Receipt,
  UserCheck, FileText, Package, FileCheck, CreditCard,
  Cpu, Plus, Trash2, ChevronDown, Upload, Terminal,
  X, AlertTriangle,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import { useAutomationsStore } from "@/lib/automations-store";
import {
  type BlockType,
  type ConditionGroup,
  type ConditionRule,
  type TraceStep,
  triggerEvents,
  conditionOperators,
  contextVariables,
  conditionGroupsToJsonLogic,
  jsonLogicToConditionGroups,
} from "@/lib/automations-data";
import { useToastStore } from "@/components/app/action-toast";
import {
  updateAutomationFlow,
  publishAutomationFlow,
  dryRunAutomationFlow,
  updateFlowConditions,
} from "@/app/actions/automations";

/* ── Block config — PRD: Dark nodes (bg-zinc-950) ──────── */

const blockConfig: Record<BlockType, { icon: typeof Zap; color: string; bg: string; border: string }> = {
  trigger: { icon: Zap, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.06)]", border: "border-[#00E676]/30" },
  delay: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20" },
  action: { icon: Send, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.04)]", border: "border-[#00E676]/20" },
  condition: { icon: GitBranch, color: "text-zinc-400", bg: "bg-zinc-500/5", border: "border-zinc-500/20" },
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail, sms: MessageSquare, webhook: Webhook, internal: Bell,
};

const flowIconMap: Record<string, typeof Star> = {
  Star, Receipt, Clock, UserCheck, FileText, Package, Mail, FileCheck, CreditCard, MessageSquare,
};

/* ── Animated Connector ──────────────────────────────────── */

function AnimatedConnector({ active, testing }: { active: boolean; testing: boolean }) {
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ height: 44, width: 2 }}>
        <div className="absolute inset-0 bg-white/[0.06]" />
        {testing && (
          <motion.div className="absolute inset-x-0 w-full overflow-hidden" style={{ height: 44 }}>
            <motion.div
              animate={{ y: [-44, 44] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
              className="h-6 w-full bg-gradient-to-b from-transparent via-[#00E676] to-transparent opacity-60"
            />
          </motion.div>
        )}
        {active && !testing && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#00E676]/40 to-[#00E676]/10" />
        )}
      </div>
    </div>
  );
}

/* ── Condition Builder ───────────────────────────────────── */

function ConditionBuilder({
  groups,
  onChange,
  entityType,
}: {
  groups: ConditionGroup[];
  onChange: (groups: ConditionGroup[]) => void;
  entityType: string;
}) {
  const vars = contextVariables[entityType] || contextVariables.job;

  const addGroup = () => {
    onChange([
      ...groups,
      {
        id: `group-${Date.now()}`,
        logic: "and",
        rules: [{ id: `rule-${Date.now()}`, field: vars[0]?.value || "", operator: "==", value: "" }],
      },
    ]);
  };

  const addRule = (groupId: string) => {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, rules: [...g.rules, { id: `rule-${Date.now()}`, field: vars[0]?.value || "", operator: "==" as const, value: "" }] }
          : g
      )
    );
  };

  const updateRule = (groupId: string, ruleId: string, patch: Partial<ConditionRule>) => {
    onChange(
      groups.map((g) =>
        g.id === groupId
          ? { ...g, rules: g.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) }
          : g
      )
    );
  };

  const removeRule = (groupId: string, ruleId: string) => {
    onChange(
      groups
        .map((g) =>
          g.id === groupId ? { ...g, rules: g.rules.filter((r) => r.id !== ruleId) } : g
        )
        .filter((g) => g.rules.length > 0)
    );
  };

  const toggleLogic = (groupId: string) => {
    onChange(groups.map((g) => (g.id === groupId ? { ...g, logic: g.logic === "and" ? "or" : "and" } : g)));
  };

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.id} className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => toggleLogic(group.id)}
              className="rounded-lg border border-white/10 bg-zinc-800 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-zinc-400 transition-colors hover:text-white"
            >
              {group.logic}
            </button>
            <span className="text-[10px] text-zinc-600">— all rules in this group must match</span>
          </div>

          {group.rules.map((rule, ri) => (
            <div key={rule.id} className="mb-2 flex items-center gap-2">
              {ri > 0 && (
                <span className="w-8 text-center font-mono text-[9px] uppercase text-zinc-600">
                  {group.logic}
                </span>
              )}
              {ri === 0 && <span className="w-8 text-center font-mono text-[9px] text-zinc-700">IF</span>}

              <select
                value={rule.field}
                onChange={(e) => updateRule(group.id, rule.id, { field: e.target.value })}
                className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-white/20"
              >
                {vars.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>

              <select
                value={rule.operator}
                onChange={(e) => updateRule(group.id, rule.id, { operator: e.target.value as ConditionRule["operator"] })}
                className="w-28 rounded-lg border border-white/[0.06] bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-white/20"
              >
                {conditionOperators.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {rule.operator !== "exists" && rule.operator !== "not_exists" && (
                <input
                  value={rule.value}
                  onChange={(e) => updateRule(group.id, rule.id, { value: e.target.value })}
                  placeholder="value"
                  className="w-24 rounded-lg border border-white/[0.06] bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300 outline-none focus:border-white/20"
                />
              )}

              <button
                onClick={() => removeRule(group.id, rule.id)}
                className="rounded-lg p-1 text-zinc-700 hover:bg-zinc-800 hover:text-zinc-400"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          <button
            onClick={() => addRule(group.id)}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            <Plus size={10} /> Add {group.logic.toUpperCase()} rule
          </button>
        </div>
      ))}

      <button
        onClick={addGroup}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.08] px-3 py-2 text-[11px] text-zinc-600 transition-colors hover:border-white/20 hover:text-zinc-400"
      >
        <Plus size={12} /> Add Condition Group
      </button>
    </div>
  );
}

/* ── Trace Viewer (Dry Run Output) ───────────────────────── */

function TraceViewer({ trace, onClose }: { trace: TraceStep[]; onClose: () => void }) {
  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-white/[0.06] bg-zinc-950"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#00E676]" />
          <span className="font-mono text-[12px] font-semibold text-white">Execution Trace</span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {trace.map((step, i) => {
            const isPass = step.status === "passed" || step.status === "simulated";
            const isFail = step.status === "failed" || step.status === "error";

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-lg border p-3 ${
                  isFail
                    ? "border-rose-500/20 bg-rose-500/5"
                    : step.status === "simulated"
                    ? "border-amber-500/20 bg-amber-500/5"
                    : "border-white/[0.06] bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${isPass ? "bg-[#00E676]" : isFail ? "bg-rose-500" : "bg-zinc-600"}`} />
                  <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">{step.step}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    isPass ? "bg-[rgba(0,230,118,0.1)] text-[#00E676]"
                    : isFail ? "bg-rose-500/10 text-rose-400"
                    : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {step.status}
                  </span>
                  {step.duration_ms !== undefined && (
                    <span className="font-mono text-[9px] text-zinc-700">{step.duration_ms}ms</span>
                  )}
                </div>
                {step.description && (
                  <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-zinc-400">{step.description}</p>
                )}
                {step.evaluation && (
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">{step.evaluation}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Flow Editor Page ───────────────────────────────── */

export default function FlowEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { flows, toggleFlowStatusServer } = useAutomationsStore();
  const { addToast } = useToastStore();

  const [testRunning, setTestRunning] = useState(false);
  const [testStep, setTestStep] = useState(-1);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [traceData, setTraceData] = useState<TraceStep[] | null>(null);

  // Condition builder state
  const flow = useMemo(() => flows.find((f) => f.id === params.id), [flows, params.id]);
  const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>(() =>
    jsonLogicToConditionGroups(flow?.conditions || null)
  );
  const [conditionsDirty, setConditionsDirty] = useState(false);

  const entityType = useMemo(() => {
    if (!flow) return "job";
    const triggerBlock = flow.blocks.find((b) => b.type === "trigger");
    return triggerBlock?.config?.entity || "job";
  }, [flow]);

  const handleConditionsChange = useCallback((groups: ConditionGroup[]) => {
    setConditionGroups(groups);
    setConditionsDirty(true);
  }, []);

  const saveConditions = useCallback(async () => {
    if (!flow) return;
    const logic = conditionGroupsToJsonLogic(conditionGroups);
    const { error } = await updateFlowConditions(flow.id, logic);
    if (error) {
      addToast(`Failed to save conditions: ${error}`);
    } else {
      addToast("Conditions saved");
      setConditionsDirty(false);
    }
  }, [flow, conditionGroups, addToast]);

  if (!flow) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="text-center">
          <Zap size={32} strokeWidth={0.8} className="mx-auto mb-3 text-zinc-800" />
          <p className="text-[13px] text-zinc-500">Flow not found.</p>
          <button onClick={() => router.push("/dashboard/automations")} className="mt-3 text-[11px] text-zinc-500 underline hover:text-zinc-300">
            Back to Logic Core
          </button>
        </div>
      </div>
    );
  }

  const isActive = flow.status === "active";
  const FlowIcon = flowIconMap[flow.icon] || Zap;

  /* ── Dry Run Handler ──────────────────────────────── */
  const handleDryRun = async () => {
    setTestRunning(true);
    setTestSuccess(false);
    setTestStep(0);
    setTraceData(null);

    try {
      // Save any pending conditions first
      if (conditionsDirty) await saveConditions();

      const { data, error } = await dryRunAutomationFlow(flow.id);
      if (error) {
        addToast(`Dry run failed: ${error}`);
        setTestRunning(false);
        setTestStep(-1);
        return;
      }

      const trace = (data?.trace || []) as TraceStep[];

      // Animate through steps
      for (let i = 0; i < Math.min(trace.length, flow.blocks.length); i++) {
        setTestStep(i);
        await new Promise((r) => setTimeout(r, 400));
      }

      setTraceData(trace);

      const hasFail = trace.some((t) => t.status === "failed" || t.status === "error");
      if (hasFail) {
        addToast("Dry run completed — some conditions failed");
      } else {
        setTestSuccess(true);
        addToast(`Dry run completed — ${trace.filter((t) => t.status === "simulated").length} action(s) simulated`);
        setTimeout(() => setTestSuccess(false), 2000);
      }
    } catch {
      addToast("Execution error — check server logs");
    } finally {
      setTestRunning(false);
      setTestStep(-1);
    }
  };

  /* ── Publish Handler ──────────────────────────────── */
  const handlePublish = async () => {
    setPublishing(true);
    // Save conditions first
    if (conditionsDirty) await saveConditions();

    const { data, error } = await publishAutomationFlow(flow.id);
    if (error) {
      addToast(`Publish failed: ${error}`);
    } else {
      addToast(`Published v${data?.version || flow.version + 1} — automation is now live`);
    }
    setPublishing(false);
  };

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between border-b border-white/[0.06] px-6 py-3"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/automations")}
            className="flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={14} /> Logic Core
          </button>
          <span className="text-zinc-700">/</span>
          <div className="flex items-center gap-2">
            <FlowIcon size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">{flow.title}</span>
            <span className="font-mono text-[10px] text-zinc-700">v{flow.version}</span>
            {!flow.isPublished && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-400">Draft</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dry Run Test */}
          <button
            onClick={handleDryRun}
            disabled={testRunning}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition-all ${
              testRunning
                ? "cursor-not-allowed border-[#00E676]/20 bg-[rgba(0,230,118,0.05)] text-[#00E676]"
                : "border-white/[0.1] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            }`}
          >
            {testRunning ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Cpu size={11} />
                </motion.div>
                Compiling...
              </>
            ) : (
              <><Play size={11} /> Test Automation</>
            )}
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#00E676] px-4 text-[11px] font-semibold text-black transition-all hover:bg-[#00C864] disabled:opacity-50"
          >
            {publishing ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Upload size={11} /></motion.div> Publishing...</>
            ) : (
              <><Upload size={11} /> Publish</>
            )}
          </button>

          {/* Status toggle */}
          <button
            onClick={async () => {
              if (toggleLoading) return;
              setToggleLoading(true);
              const was = isActive;
              const { error } = await toggleFlowStatusServer(flow.id);
              if (error) addToast(`Failed: ${error}`);
              else addToast(was ? `${flow.title} paused` : `${flow.title} activated`);
              setToggleLoading(false);
            }}
            disabled={toggleLoading}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-4 text-[11px] font-medium transition-all ${
              isActive
                ? "bg-[rgba(0,230,118,0.1)] text-[#00E676] hover:bg-[rgba(0,230,118,0.15)]"
                : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
            } ${toggleLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {toggleLoading ? "Saving..." : isActive ? <><Pause size={11} /> Active</> : <><Play size={11} /> Paused</>}
          </button>
        </div>
      </motion.div>

      {/* ── Canvas ──────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        {/* Dim overlay when testing */}
        <AnimatePresence>
          {testRunning && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-10 bg-black/20" />}
        </AnimatePresence>

        {/* Success confetti */}
        <AnimatePresence>
          {testSuccess && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00E676] shadow-[0_0_24px_-4px_rgba(0,230,118,0.2)]"
              >
                <Check size={32} className="text-black" strokeWidth={3} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Logic Stream — Vertical Node Builder */}
        <div className="relative mx-auto max-w-2xl px-6 py-12">
          {flow.blocks.map((block, i) => {
            const config = blockConfig[block.type];
            const Icon = config.icon;
            const isTestActive = testRunning && testStep >= i;
            const isTestCurrent = testRunning && testStep === i;
            const channelKey = block.config.channel;
            const ChannelIcon = channelKey ? (channelIcons[channelKey] || Send) : null;

            return (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {i > 0 && <AnimatedConnector active={isTestActive} testing={isTestCurrent || (testRunning && testStep > i)} />}

                <div className="relative z-20">
                  {/* Trigger Node */}
                  {block.type === "trigger" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { boxShadow: ["0 0 0px rgba(0,230,118,0)", "0 0 30px rgba(0,230,118,0.4)", "0 0 0px rgba(0,230,118,0)"] } : {}}
                        transition={isTestCurrent ? { duration: 1, repeat: Infinity } : {}}
                        className={`relative w-full max-w-lg rounded-xl border ${config.border} bg-zinc-950 p-5 backdrop-blur-sm ${isTestActive ? "shadow-[0_0_16px_-4px_rgba(0,230,118,0.12)]" : ""}`}
                      >
                        <div className="absolute -left-px -top-px h-3 w-3 rounded-tl-xl border-l border-t border-[#00E676]/60" />
                        <div className="absolute -right-px -top-px h-3 w-3 rounded-tr-xl border-r border-t border-[#00E676]/60" />
                        <div className="absolute -bottom-px -left-px h-3 w-3 rounded-bl-xl border-b border-l border-[#00E676]/60" />
                        <div className="absolute -bottom-px -right-px h-3 w-3 rounded-br-xl border-b border-r border-[#00E676]/60" />

                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bg}`}>
                            <Icon size={16} className={config.color} />
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-[#00E676]">When this happens...</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>

                        {/* Output Context Preview */}
                        <div className="mt-3 rounded-lg bg-black/40 px-3 py-2">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">Available Data</p>
                          <div className="flex flex-wrap gap-1">
                            {(contextVariables[entityType] || []).slice(0, 6).map((v) => (
                              <span key={v.value} className="rounded bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                                {v.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Delay — Pill */}
                  {block.type === "delay" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { scale: [1, 1.05, 1] } : {}}
                        transition={isTestCurrent ? { duration: 0.5, repeat: Infinity } : {}}
                        className={`flex items-center gap-2 rounded-full border ${config.border} bg-zinc-950 px-5 py-2.5 backdrop-blur-sm`}
                      >
                        <motion.div animate={isTestCurrent ? { rotate: 360 } : {}} transition={isTestCurrent ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}>
                          <Icon size={14} className={config.color} />
                        </motion.div>
                        <span className="text-[12px] font-medium text-amber-300">{block.label}</span>
                      </motion.div>
                    </div>
                  )}

                  {/* Action — Rectangle */}
                  {block.type === "action" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { boxShadow: ["0 0 0px rgba(0,230,118,0)", "0 0 25px rgba(0,230,118,0.3)", "0 0 0px rgba(0,230,118,0)"] } : {}}
                        transition={isTestCurrent ? { duration: 1, repeat: Infinity } : {}}
                        className={`w-full max-w-lg rounded-xl border ${config.border} bg-zinc-950 p-4 backdrop-blur-sm ${isTestActive ? "shadow-[0_0_12px_-4px_rgba(0,230,118,0.1)]" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(0,230,118,0.08)]">
                            {ChannelIcon ? <ChannelIcon size={14} className="text-[#00E676]" /> : <Icon size={14} className={config.color} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-[#00E676]">Do this...</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                        {block.config.template && (
                          <div className="mt-3 rounded-lg bg-black/40 px-3 py-2">
                            <p className="font-mono text-[10px] leading-relaxed text-zinc-500">
                              {block.config.template.replace(/\{([^}]+)\}/g, (_, v) => `{{${v}}}`).slice(0, 140)}
                              {block.config.template.length > 140 && "..."}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}

                  {/* Condition — Inline (legacy block) */}
                  {block.type === "condition" && (
                    <div className="flex justify-center">
                      <motion.div className={`w-full max-w-lg rounded-xl border ${config.border} bg-zinc-950 p-4 backdrop-blur-sm`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/60">
                            <GitBranch size={14} className="text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Only continue if...</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <div className="flex-1 rounded-lg border border-[#00E676]/15 bg-[rgba(0,230,118,0.03)] px-2.5 py-1.5 text-center">
                            <p className="text-[9px] font-medium uppercase text-[#00E676]">Yes → Continue</p>
                          </div>
                          <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/30 px-2.5 py-1.5 text-center">
                            <p className="text-[9px] font-medium uppercase text-zinc-500">No → Stop</p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Test checkmark */}
                  {testRunning && isTestActive && !isTestCurrent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#00E676]"
                    >
                      <Check size={10} className="text-black" strokeWidth={3} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* ── Global Conditions (JSON Logic Builder) ────── */}
          <AnimatedConnector active={false} testing={false} />
          <div className="flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: flow.blocks.length * 0.1, duration: 0.4 }}
              className="w-full max-w-lg rounded-xl border border-zinc-500/20 bg-zinc-950 p-4 backdrop-blur-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/60">
                    <GitBranch size={14} className="text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Global Conditions (JSON Logic)</p>
                    <p className="text-[11px] text-zinc-400">Evaluated before any actions execute</p>
                  </div>
                </div>
                {conditionsDirty && (
                  <button
                    onClick={saveConditions}
                    className="rounded-lg bg-white/10 px-3 py-1 text-[10px] font-medium text-white hover:bg-white/20"
                  >
                    Save
                  </button>
                )}
              </div>

              <ConditionBuilder
                groups={conditionGroups}
                onChange={handleConditionsChange}
                entityType={entityType}
              />

              {conditionGroups.length > 0 && (
                <div className="mt-3 rounded-lg bg-black/40 px-3 py-2">
                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600">Generated AST</p>
                  <pre className="font-mono text-[9px] leading-relaxed text-zinc-600">
                    {JSON.stringify(conditionGroupsToJsonLogic(conditionGroups), null, 2)}
                  </pre>
                </div>
              )}
            </motion.div>
          </div>

          {/* End node */}
          <div className="flex justify-center pt-8">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-white/[0.06]" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-zinc-950">
                <Check size={12} className="text-zinc-600" />
              </div>
              <div className="h-px w-8 bg-white/[0.06]" />
            </div>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] text-zinc-700">END</p>
        </div>

        {/* ── Trace Viewer Panel ──────────────────────────── */}
        <AnimatePresence>
          {traceData && <TraceViewer trace={traceData} onClose={() => setTraceData(null)} />}
        </AnimatePresence>
      </div>
    </div>
  );
}
