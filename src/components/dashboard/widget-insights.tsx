"use client";

import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, Lightbulb, CheckCircle2, Info, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getAIInsights, type AIInsight } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";

const typeConfig = {
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
  alert: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

const fallbackInsight: AIInsight = {
  type: "warning",
  title: "3 jobs unassigned for tomorrow morning",
  body: "Friday has 3 open jobs with no technician assigned. James is available 7 AM — 1 PM. Consider batch-assigning to reduce gap time.",
  action: "Fix Schedule",
  action_route: "/dashboard/schedule",
  priority: 1,
};

export function WidgetInsights() {
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

  // Show the highest priority insight
  const insight = insights.length > 0 ? insights[0] : fallbackInsight;
  const config = typeConfig[insight.type] || typeConfig.warning;
  const Icon = config.icon;

  return (
    <WidgetShell delay={0.25}>
      <div className="relative overflow-hidden p-5">
        {/* Aurora animated background */}
        <div className="pointer-events-none absolute inset-[-50%] z-0 opacity-[0.12]">
          <motion.div
            className="h-full w-full"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, rgba(99,102,241,0.5) 0deg, rgba(168,85,247,0.4) 60deg, rgba(56,189,248,0.3) 120deg, rgba(16,185,129,0.3) 180deg, rgba(99,102,241,0.5) 240deg, rgba(168,85,247,0.4) 300deg, rgba(56,189,248,0.3) 360deg)",
              filter: "blur(40px)",
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Shimmer stripe */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.04]">
          <motion.div
            className="absolute top-0 h-full w-1/2"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
            }}
            animate={{ left: ["-50%", "150%"] }}
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
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
              <Icon size={14} strokeWidth={1.5} className={config.color} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-medium text-zinc-200">{insight.title}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {insight.body}
              </p>
              {insight.action && insight.action_route && (
                <button
                  onClick={() => router.push(insight.action_route!)}
                  className="mt-3 flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-indigo-400"
                >
                  <Calendar size={11} />
                  {insight.action}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}
