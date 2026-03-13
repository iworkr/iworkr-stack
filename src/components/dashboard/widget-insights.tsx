"use client";

import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, CheckCircle2, Info, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { getAIInsights, type AIInsight } from "@/app/actions/dashboard";
import { WidgetShell } from "./widget-shell";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import type { WidgetSize } from "@/lib/dashboard-store";

function getTypeConfig() {
  return {
    warning: { icon: AlertTriangle, color: "var(--ghost-amber-text)", bg: "var(--ghost-amber)", dot: "var(--ghost-amber-text)" },
    alert: { icon: AlertTriangle, color: "var(--ghost-rose-text)", bg: "var(--ghost-rose)", dot: "var(--ghost-rose-text)" },
    info: {
      icon: Info,
      color: "var(--ghost-emerald-text)",
      bg: "var(--ghost-emerald)",
      dot: "var(--brand)",
    },
    success: {
      icon: CheckCircle2,
      color: "var(--ghost-emerald-text)",
      bg: "var(--ghost-emerald)",
      dot: "var(--brand)",
    },
  };
}

function getEmptyInsight(t: (key: string) => string): AIInsight {
  return {
    type: "success",
    title: t("Schedule looks optimized"),
    body: t("All jobs are assigned and invoices are up to date. Your operations are running smoothly."),
    priority: 0,
    action: "",
    action_route: "",
  };
}

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
  const { t } = useIndustryLexicon();
  const cachedInsights = useDashboardStore((s) => s.widgetInsights);
  const setWidgetCache = useDashboardStore((s) => s.setWidgetCache);
  const isWidgetFresh = useDashboardStore((s) => s.isWidgetFresh);
  const [insights, setInsights] = useState<AIInsight[]>(
    (cachedInsights.data as AIInsight[] | null) ?? []
  );
  const [loaded, setLoaded] = useState(
    cachedInsights.data !== null && (cachedInsights.data as AIInsight[]).length > 0
  );

  useEffect(() => {
    if (!orgId) return;
    // Use cached data immediately, skip fetch if fresh
    if (isWidgetFresh('widgetInsights') && cachedInsights.data) {
      setInsights(cachedInsights.data as AIInsight[]);
      setLoaded(true);
      return;
    }
    getAIInsights(orgId).then(({ data }) => {
      if (data && data.length > 0) {
        setInsights(data);
        setWidgetCache('widgetInsights', data);
      }
      setLoaded(true);
    });
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeConfig = getTypeConfig();
  const emptyInsight = getEmptyInsight(t);
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
            <Sparkles size={14} className="text-[var(--text-muted)]" />
          </div>
          <div className="mb-1 flex h-5 w-5 items-center justify-center rounded" style={{ background: config.bg }}>
            <Icon size={10} style={{ color: config.color }} />
          </div>
          <span className="line-clamp-2 font-mono text-[9px] leading-tight text-[var(--text-muted)]">
            {insight.title}
          </span>
        </div>
      </WidgetShell>
    );
  }

  /* ── LARGE: Multiple insights list ──────────────────── */
  if (size === "large") {
    const displayInsights = insights.length > 0 ? insights.slice(0, 4) : [getEmptyInsight(t)];

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
              <Sparkles size={14} className="text-[var(--text-muted)]" />
              <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">AI Insights</span>
              <span className="font-mono text-[9px] tabular-nums text-[var(--text-dim)]">{insights.length} active</span>
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
                    className="flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors duration-200 hover:border-[var(--border-active)]"
                    style={{ borderColor: "var(--border-base)", background: "var(--subtle-bg)" }}
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: cfg.bg }}>
                      <InsIcon size={12} strokeWidth={1.5} style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[11px] font-medium text-[var(--text-body)]">{ins.title}</h4>
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-[var(--text-dim)]">{ins.body}</p>
                      {ins.action && ins.action_route && (
                        <button
                          onClick={() => router.push(ins.action_route!)}
                          className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
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
            <Sparkles size={14} className="text-[var(--text-muted)]" />
            <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">AI Insight</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: config.bg }}>
              <Icon size={14} strokeWidth={1.5} style={{ color: config.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-medium text-[var(--text-body)]">{insight.title}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{insight.body}</p>
              {insight.action && insight.action_route && (
                <button
                  onClick={() => router.push(insight.action_route!)}
                  className="mt-3 flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[9px] font-medium uppercase tracking-widest transition-all duration-200 hover:border-[var(--border-active)] hover:text-[var(--text-primary)]"
                  style={{ borderColor: "var(--border-base)", background: "var(--subtle-bg)", color: "var(--text-muted)" }}
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
