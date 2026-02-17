"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Zap,
  Clock,
  Mail,
  MessageSquare,
  GitBranch,
  Play,
  Pause,
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
  Cpu,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAutomationsStore } from "@/lib/automations-store";
import { type BlockType } from "@/lib/automations-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Block config — PRD: Dark nodes (bg-zinc-950) ──────── */

const blockConfig: Record<BlockType, { icon: typeof Zap; color: string; bg: string; border: string }> = {
  trigger: { icon: Zap, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.06)]", border: "border-[#00E676]/30" },
  delay: { icon: Clock, color: "text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/20" },
  action: { icon: Send, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.04)]", border: "border-[#00E676]/20" },
  condition: { icon: GitBranch, color: "text-zinc-400", bg: "bg-zinc-500/5", border: "border-zinc-500/20" },
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

/* ── Animated Connector (dashed moving line) ──────────── */

function AnimatedConnector({ active, testing }: { active: boolean; testing: boolean }) {
  return (
    <div className="flex justify-center">
      <div className="relative" style={{ height: 44, width: 2 }}>
        {/* Base line */}
        <div className="absolute inset-0 bg-white/[0.06]" />
        {/* Animated dash overlay when testing */}
        {testing && (
          <motion.div
            className="absolute inset-x-0 w-full overflow-hidden"
            style={{ height: 44 }}
          >
            <motion.div
              animate={{ y: [-44, 44] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
              className="h-6 w-full bg-gradient-to-b from-transparent via-[#00E676] to-transparent opacity-60"
            />
          </motion.div>
        )}
        {/* Green gradient when active */}
        {active && !testing && (
          <div className="absolute inset-0 bg-gradient-to-b from-[#00E676]/40 to-[#00E676]/10" />
        )}
      </div>
    </div>
  );
}

export default function FlowEditorPage() {
  const router = useRouter();
  const params = useParams();
  const { flows, toggleFlowStatusServer, testFlowServer } = useAutomationsStore();
  const { addToast } = useToastStore();
  const [testRunning, setTestRunning] = useState(false);
  const [testStep, setTestStep] = useState(-1);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const flow = useMemo(
    () => flows.find((f) => f.id === params.id),
    [flows, params.id]
  );

  if (!flow) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <div className="text-center">
          <Zap size={32} strokeWidth={0.8} className="mx-auto mb-3 text-zinc-800" />
          <p className="text-[13px] text-zinc-500">Flow not found.</p>
          <button
            onClick={() => router.push("/dashboard/automations")}
            className="mt-3 text-[11px] text-zinc-500 underline hover:text-zinc-300"
          >
            Back to Logic Core
          </button>
        </div>
      </div>
    );
  }

  const isActive = flow.status === "active";
  const FlowIcon = flowIconMap[flow.icon] || Zap;

  const handleTest = async () => {
    setTestRunning(true);
    setTestSuccess(false);
    setTestStep(0);
    try {
      const { data, error } = await testFlowServer(flow.id);
      if (error) {
        addToast(`Test failed: ${error}`);
      } else {
        for (let i = 0; i < flow.blocks.length; i++) {
          setTestStep(i);
          await new Promise((r) => setTimeout(r, 400));
        }
        setTestSuccess(true);
        addToast(
          data?.executed
            ? `Test completed — ${data.executed} action${data.executed > 1 ? "s" : ""} executed`
            : "Test completed successfully — all blocks passed"
        );
        setTimeout(() => setTestSuccess(false), 2000);
      }
    } catch {
      addToast("Execution error — check server logs");
    } finally {
      setTestRunning(false);
      setTestStep(-1);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ────────────────────────────────────── */}
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
            <ArrowLeft size={14} />
            Logic Core
          </button>
          <span className="text-zinc-700">/</span>
          <div className="flex items-center gap-2">
            <FlowIcon size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">{flow.title}</span>
            <span className="font-mono text-[10px] text-zinc-700">v{flow.version}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Test button — PRD: "compiling" feel */}
          <button
            onClick={handleTest}
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
              <><Play size={11} /> Test Flow</>
            )}
          </button>

          {/* Status toggle — PRD: Neon green active */}
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

      {/* ── Canvas — PRD: dot grid background ──────────── */}
      <div className="relative flex-1 overflow-y-auto">
        {/* Dot grid pattern (PRD spec: opacity 0.1) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Dim overlay when testing */}
        <AnimatePresence>
          {testRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-10 bg-black/20"
            />
          )}
        </AnimatePresence>

        {/* Success confetti overlay */}
        <AnimatePresence>
          {testSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00E676] shadow-[0_0_60px_rgba(0,230,118,0.5)]"
              >
                <Check size={32} className="text-black" strokeWidth={3} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Logic Stream */}
        <div className="relative mx-auto max-w-lg px-6 py-12">
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
                {/* Animated connector */}
                {i > 0 && (
                  <AnimatedConnector active={isTestActive} testing={isTestCurrent || (testRunning && testStep > i)} />
                )}

                {/* Block Node — PRD: dark cards (bg-zinc-950) */}
                <div className="relative z-20">
                  {/* Trigger */}
                  {block.type === "trigger" && (
                    <div className="flex justify-center">
                      <motion.div
                        animate={isTestCurrent ? { boxShadow: ["0 0 0px rgba(0,230,118,0)", "0 0 30px rgba(0,230,118,0.4)", "0 0 0px rgba(0,230,118,0)"] } : {}}
                        transition={isTestCurrent ? { duration: 1, repeat: Infinity } : {}}
                        className={`relative rounded-xl border ${config.border} bg-zinc-950 p-5 backdrop-blur-sm ${
                          isTestActive ? "shadow-[0_0_20px_-4px_rgba(0,230,118,0.3)]" : ""
                        }`}
                      >
                        {/* Green corner accents */}
                        <div className="absolute -left-px -top-px h-3 w-3 rounded-tl-xl border-l border-t border-[#00E676]/60" />
                        <div className="absolute -right-px -top-px h-3 w-3 rounded-tr-xl border-r border-t border-[#00E676]/60" />
                        <div className="absolute -bottom-px -left-px h-3 w-3 rounded-bl-xl border-b border-l border-[#00E676]/60" />
                        <div className="absolute -bottom-px -right-px h-3 w-3 rounded-br-xl border-b border-r border-[#00E676]/60" />

                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.bg}`}>
                            <Icon size={16} className={config.color} />
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-[#00E676]">Trigger</p>
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
                        className={`flex items-center gap-2 rounded-full border ${config.border} bg-zinc-950 px-5 py-2.5 backdrop-blur-sm`}
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
                        animate={isTestCurrent ? { boxShadow: ["0 0 0px rgba(0,230,118,0)", "0 0 25px rgba(0,230,118,0.3)", "0 0 0px rgba(0,230,118,0)"] } : {}}
                        transition={isTestCurrent ? { duration: 1, repeat: Infinity } : {}}
                        className={`w-full max-w-sm rounded-xl border ${config.border} bg-zinc-950 p-4 backdrop-blur-sm ${
                          isTestActive ? "shadow-[0_0_15px_-4px_rgba(0,230,118,0.2)]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(0,230,118,0.08)]">
                            {ChannelIcon ? <ChannelIcon size={14} className="text-[#00E676]" /> : <Icon size={14} className={config.color} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-[#00E676]">Action</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                        {block.config.template && (
                          <div className="mt-3 rounded-lg bg-black/40 px-3 py-2">
                            <p className="font-mono text-[10px] leading-relaxed text-zinc-500">
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
                      <motion.div className={`rounded-xl border ${config.border} bg-zinc-950 p-4 backdrop-blur-sm`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/60">
                            <GitBranch size={14} className="text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Condition</p>
                            <p className="text-[12px] text-zinc-200">{block.label}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <div className="flex-1 rounded-lg border border-[#00E676]/15 bg-[rgba(0,230,118,0.03)] px-2.5 py-1.5 text-center">
                            <p className="text-[9px] font-medium uppercase text-[#00E676]">Yes → Path A</p>
                          </div>
                          <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/30 px-2.5 py-1.5 text-center">
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
                      className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-[#00E676] shadow-[0_0_10px_rgba(0,230,118,0.4)]"
                    >
                      <Check size={10} className="text-black" strokeWidth={3} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}

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
      </div>
    </div>
  );
}
