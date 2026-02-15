"use client";

import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, Lightbulb, ArrowRight, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { WidgetShell } from "./widget-shell";

const insight = {
  type: "warning" as const,
  icon: AlertTriangle,
  title: "3 jobs unassigned for tomorrow morning",
  body: "Friday has 3 open jobs with no technician assigned. James is available 7 AM — 1 PM. Consider batch-assigning to reduce gap time.",
  action: "Fix Schedule",
  actionRoute: "/dashboard/schedule",
};

export function WidgetInsights() {
  const router = useRouter();

  return (
    <WidgetShell delay={0.25}>
      <div className="relative overflow-hidden p-5">
        {/* Aurora animated background */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
          <motion.div
            className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%]"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, rgba(99,102,241,0.5) 0deg, rgba(168,85,247,0.4) 60deg, rgba(56,189,248,0.3) 120deg, rgba(16,185,129,0.3) 180deg, rgba(99,102,241,0.5) 240deg, rgba(168,85,247,0.4) 300deg, rgba(56,189,248,0.3) 360deg)",
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Shimmer stripe */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]">
          <motion.div
            className="absolute -left-full top-0 h-full w-1/2"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
            }}
            animate={{ left: ["- 50%", "150%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative">
              <Sparkles size={14} className="text-indigo-400" />
              <div className="absolute inset-0 animate-pulse blur-sm">
                <Sparkles size={14} className="text-indigo-400/50" />
              </div>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-400/80">
              AI Insight
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <insight.icon size={14} strokeWidth={1.5} className="text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-medium text-zinc-200">{insight.title}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {insight.body}
              </p>
              <button
                onClick={() => router.push(insight.actionRoute)}
                className="mt-3 flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-indigo-400"
              >
                <Calendar size={11} />
                {insight.action}
              </button>
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
