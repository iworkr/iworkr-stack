"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Zap,
  Clock,
  Mail,
  MessageSquare,
  GitBranch,
  Play,
  Pause,
  Settings,
  ChevronDown,
  Send,
  Webhook,
  Bell,
  Check,
  Star,
  Receipt,
  UserCheck,
  FileText,
  Package,
  FileCheck,
  CreditCard,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAutomationsStore } from "@/lib/automations-store";
import { type BlockType } from "@/lib/automations-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Block config ─────────────────────────────────────── */

const blockConfig: Record<BlockType, { icon: typeof Zap; color: string; bg: string; border: string; shape: string }> = {
  trigger: { icon: Zap, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", shape: "diamond" },
  delay: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", shape: "pill" },
  action: { icon: Send, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", shape: "rectangle" },
  condition: { icon: GitBranch, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30", shape: "split" },
};

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  webhook: Webhook,
  internal: Bell,
};

const flowIconMap: Record<string, typeof Star> = {
  Star, Receipt, Clock, UserCheck, FileText, Package, Mail, FileCheck, CreditCard, MessageSquare,
};

export default function FlowEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { flows, toggleFlowStatusServer, testFlowServer } = useAutomationsStore();
  const { addToast } = useToastStore();
  const [testRunning, setTestRunning] = useState(false);
  const [testStep, setTestStep] = useState(-1);
  const [toggleLoading, setToggleLoading] = useState(false);

  const flow = useMemo(
    () => flows.find((f) => f.id === params.id),
    [flows, params.id]
  );

  if (!flow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Zap size={32} strokeWidth={0.8} className="mx-auto mb-3 text-zinc-800" />
          <p className="text-[13px] text-zinc-500">Flow not found.</p>
          <button
            onClick={() => router.push("/dashboard/automations")}
            className="mt-3 text-[11px] text-zinc-500 underline hover:text-zinc-300"
          >
            Back to Automations
          </button>
        </div>
      </div>
    );
  }

  const isActive = flow.status === "active";
  const FlowIcon = flowIconMap[flow.icon] || Zap;

  const handleTest = async () => {
    setTestRunning(true);
    setTestStep(0);
    try {
      const { data, error } = await testFlowServer(flow.id);
      if (error) {
        addToast(`Test failed: ${error}`);
      } else {
        for (let i = 0; i < flow.blocks.length; i++) {
          setTestStep(i);
          await new Promise((r) => setTimeout(r, 300));
        }
        addToast(
          data?.executed
            ? `Test completed — ${data.executed} action${data.executed > 1 ? "s" : ""} executed`
            : "Test completed successfully — all blocks passed"
        );
      }
    } catch {
      addToast("Execution error — check server logs");
    } finally {
      setTestRunning(false);
      setTestStep(-1);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/automations")}
            className="flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={14} />
            Automations
          </button>
          <span className="text-zinc-700">/</span>
          <div className="flex items-center gap-2">
            <FlowIcon size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">{flow.title}</span>
            <span className="text-[10px] font-mono text-zinc-700">v{flow.version}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Test button */}
          <button
            onClick={handleTest}
            disabled={testRunning}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition-all ${
              testRunning
                ? "cursor-not-allowed border-zinc-700 bg-zinc-900 text-zinc-600"
                : "border-[rgba(255,255,255,0.1)] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            }`}
          >
            <Play size={11} /> {testRunning ? "Running..." : "Test Flow"}
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
            className={`flex h-8 items-center gap-1.5 rounded-lg px-4 text-[11px] font-semibold transition-all ${
              isActive
                ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/20"
            } ${toggleLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {toggleLoading ? "Saving..." : isActive ? <><Pause size={11} /> Active</> : <><Play size={11} /> Paused</>}
          </button>
        </div>
      </div>

      {/* ── Canvas ────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto" style={{ background: "#050505" }}>
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Dim overlay when testing */}
        {testRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 z-10 bg-black/30"
          />
        )}

        {/* The Logic Stream */}
        <div className="relative mx-auto max-w-lg px-6 py-12">
          {flow.blocks.map((block, i) => {
            const config = blockConfig[block.type];
            const Icon = config.icon;
            const isCondition = block.type === "condition";
            const isTestActive = testRunning && testStep >= i;
            const isTestCurrent = testRunning && testStep === i;
            const channelKey = block.config.channel;
            const ChannelIcon = channelKey ? (channelIcons[channelKey] || Send) : null;

            return (
              <div key={block.id} className="relative">
                {/* Connecting line */}
                {i > 0 && (
                  <div className="flex justify-center">
                    <motion.div
                      className="w-px"
                      style={{ height: 40 }}
                      initial={{ background: "rgba(255,255,255,0.06)" }}
                      animate={{
                        background: isTestActive
                          ? "linear-gradient(180deg, rgba(59,130,246,0.8), rgba(59,130,246,0.3))"
                          : "rgba(255,255,255,0.06)",
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}

                {/* Block Node */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-20"
                >
                  {/* Trigger — Diamond shape */}
                  {block.type === "trigger" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 30px rgba(59,130,246,0.4)", "0 0 0px rgba(59,130,246,0)"] } : {}}
                        transition={isTestCurrent ? { duration: 1, repeat: Infinity } : {}}
                        className={`relative border ${config.border} ${config.bg} rounded-xl p-5 backdrop-blur-sm`}
                        style={{ transform: "rotate(0deg)" }}
                      >
                        {/* Diamond corners accent */}
                        <div className="absolute -top-px -left-px h-3 w-3 border-t border-l border-blue-500/60 rounded-tl-xl" />
                        <div className="absolute -top-px -right-px h-3 w-3 border-t border-r border-blue-500/60 rounded-tr-xl" />
                        <div className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-blue-500/60 rounded-bl-xl" />
                        <div className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-blue-500/60 rounded-br-xl" />

                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bg}`}>
                            <Icon size={16} className={config.color} />
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-blue-500">Trigger</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Delay — Pill shape */}
                  {block.type === "delay" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { scale: [1, 1.05, 1] } : {}}
                        transition={isTestCurrent ? { duration: 0.5, repeat: Infinity } : {}}
                        className={`flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-5 py-2.5 backdrop-blur-sm`}
                      >
                        <motion.div
                          animate={isTestCurrent ? { rotate: 360 } : {}}
                          transition={isTestCurrent ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
                        >
                          <Icon size={14} className={config.color} />
                        </motion.div>
                        <span className="text-[12px] font-medium text-amber-300">{block.label}</span>
                      </motion.div>
                    </div>
                  )}

                  {/* Action — Rectangle card */}
                  {block.type === "action" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { boxShadow: ["0 0 0px rgba(16,185,129,0)", "0 0 25px rgba(16,185,129,0.3)", "0 0 0px rgba(16,185,129,0)"] } : {}}
                        transition={isTestCurrent ? { duration: 1, repeat: Infinity } : {}}
                        className={`w-full max-w-sm rounded-xl border ${config.border} ${config.bg} p-4 backdrop-blur-sm`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15`}>
                            {ChannelIcon ? <ChannelIcon size={14} className="text-emerald-400" /> : <Icon size={14} className={config.color} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-emerald-500">Action</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                        {/* Template preview */}
                        {block.config.template && (
                          <div className="mt-3 rounded-lg bg-[rgba(0,0,0,0.3)] px-3 py-2">
                            <p className="text-[10px] leading-relaxed text-zinc-500">
                              {block.config.template.slice(0, 120)}
                              {block.config.template.length > 120 && "..."}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )}

                  {/* Condition — Split path */}
                  {block.type === "condition" && (
                    <div className="flex justify-center">
                      <motion.div
                        className={`rounded-xl border ${config.border} ${config.bg} p-4 backdrop-blur-sm`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
                            <GitBranch size={14} className="text-violet-400" />
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-violet-500">Condition</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                        {/* Path labels */}
                        <div className="mt-3 flex gap-2">
                          <div className="flex-1 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-1.5 text-center">
                            <p className="text-[9px] font-medium uppercase text-emerald-500">Yes → Path A</p>
                          </div>
                          <div className="flex-1 rounded-lg border border-zinc-500/15 bg-zinc-500/5 px-2.5 py-1.5 text-center">
                            <p className="text-[9px] font-medium uppercase text-zinc-500">No → Path B</p>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Test completion checkmark */}
                  {testRunning && isTestActive && !isTestCurrent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                    >
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </motion.div>
              </div>
            );
          })}

          {/* End node */}
          <div className="flex justify-center pt-6">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-[rgba(255,255,255,0.06)]" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)]">
                <Check size={12} className="text-zinc-600" />
              </div>
              <div className="h-px w-8 bg-[rgba(255,255,255,0.06)]" />
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-700">End of flow</p>
        </div>
      </div>
    </div>
  );
}
