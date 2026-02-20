"use client";

import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, CheckCircle2, Info, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getAIInsights, type AIInsight } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

const typeConfig = {
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/8", dot: "bg-amber-500" },
  alert: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/8", dot: "bg-red-500" },
  info: { icon: Info, color: "text-emerald-500", bg: "bg-emerald-500/8", dot: "bg-emerald-500" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/8", dot: "bg-emerald-500" },
};

const emptyInsight: AIInsight = {
  type: "success",
  title: "No active insights",
  body: "Schedule is optimized. We\u2019ll surface recommendations here when action is needed.",
  priority: 0,
  action: "",
  action_route: "",
};

/* ── Loading state with Lottie-style animation ────────── */
function InsightSkeleton({ size }: { size: WidgetSize }) {
  return (
    <WidgetShell delay={0.25}>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative h-3.5 w-3.5">
            <div className="absolute inset-0 animate-orbit">
              <div className="h-1 w-1 rounded-full bg-zinc-500/40" />
            </div>
            <div className="absolute inset-0 animate-orbit-reverse">
              <div className="absolute bottom-0 right-0 h-0.5 w-0.5 rounded-full bg-zinc-600" />
            </div>
          </div>
          <div className="h-2.5 w-14 rounded bg-zinc-800/40 relative overflow-hidden">
            <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
          </div>
        </div>
        {size !== "small" && (
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-zinc-800/30 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-28 rounded bg-zinc-800/40 relative overflow-hidden">
                <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
              <div className="h-2.5 w-full rounded bg-zinc-800/25 relative overflow-hidden">
                <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

export function WidgetInsights({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { orgId } = useOrg();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getAIInsights(orgId).then(({ data }) => {
      if (data && data.length > 0) setInsights(data);
      setLoaded(true);
    });
  }, [orgId]);

  const insight = insights.length > 0 ? insights[0] : emptyInsight;
  const config = typeConfig[insight.type] || typeConfig.warning;
  const Icon = config.icon;

  if (!loaded) return <InsightSkeleton size={size} />;

  /* ── SMALL: Just icon + title ───────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0.25}>
        <div className="flex h-full flex-col items-center justify-center p-3 text-center">
          <div className="relative mb-1.5">
            <Sparkles size={14} className="text-zinc-400" />
          </div>
          <div className={`flex h-5 w-5 items-center justify-center rounded ${config.bg} mb-1`}>
            <Icon size={10} className={config.color} />
          </div>
          <span className="line-clamp-2 text-[9px] leading-tight text-zinc-500">
            {insight.title}
          </span>
        </div>
      </WidgetShell>
    );
  }

  /* ── LARGE: Multiple insights list ──────────────────── */
  if (size === "large") {
    const displayInsights = insights.length > 0 ? insights.slice(0, 4) : [emptyInsight];

    return (
      <WidgetShell delay={0.25}>
        <div className="relative overflow-hidden">
          {/* Ultra-subtle neutral aurora (Obsidian) */}
          <div className="pointer-events-none absolute inset-[-50%] z-0 opacity-[0.04]">
            <motion.div className="h-full w-full"
              style={{ background: "conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0.08) 0deg, transparent 120deg, rgba(255,255,255,0.05) 240deg, transparent 360deg)", filter: "blur(50px)" }}
              animate={{ rotate: [0, 360] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="relative z-10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-zinc-400" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">AI Insights</span>
              <span className="text-[10px] text-zinc-700">{insights.length} active</span>
            </div>

            <div className="space-y-1.5">
              {displayInsights.map((ins, i) => {
                const cfg = typeConfig[ins.type] || typeConfig.warning;
                const InsIcon = cfg.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className="flex items-start gap-2.5 rounded-lg border border-white/[0.03] bg-white/[0.02] p-2.5 transition-colors duration-200 hover:border-white/[0.06]"
                  >
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cfg.bg}`}>
                      <InsIcon size={12} strokeWidth={1.5} className={cfg.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[11px] font-medium text-zinc-300">{ins.title}</h4>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-600">{ins.body}</p>
                      {ins.action && ins.action_route && (
                        <button
                          onClick={() => router.push(ins.action_route!)}
                          className="mt-1.5 flex items-center gap-1 text-[9px] font-medium text-zinc-500 transition-colors hover:text-white"
                        >
                          <Calendar size={9} /> {ins.action}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM: Single insight (default) ───────────────── */
  return (
    <WidgetShell delay={0.25}>
      <div className="relative overflow-hidden p-5">
        {/* Subtle neutral aurora (Obsidian) */}
        <div className="pointer-events-none absolute inset-[-50%] z-0 opacity-[0.05]">
          <motion.div className="h-full w-full"
            style={{ background: "conic-gradient(from 180deg at 50% 50%, rgba(255,255,255,0.08) 0deg, transparent 120deg, rgba(255,255,255,0.05) 240deg, transparent 360deg)", filter: "blur(50px)" }}
            animate={{ rotate: [0, 360] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="relative z-10">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles size={14} className="text-zinc-400" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">AI Insight</span>
          </div>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
              <Icon size={14} strokeWidth={1.5} className={config.color} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-medium text-zinc-200">{insight.title}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{insight.body}</p>
              {insight.action && insight.action_route && (
                <button
                  onClick={() => router.push(insight.action_route!)}
                  className="mt-3 flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-zinc-200"
                >
                  <Calendar size={11} /> {insight.action}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
