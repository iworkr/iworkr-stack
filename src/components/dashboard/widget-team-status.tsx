/**
 * @component WidgetTeamStatus
 * @status COMPLETE
 * @description Dashboard widget showing team member avatars with online/offline status indicators
 * @lastAudit 2026-03-22
 */
"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useTeamStore } from "@/lib/team-store";
import { WidgetShell } from "./widget-shell";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";
import { LetterAvatar } from "@/components/ui/letter-avatar";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import type { WidgetSize } from "@/lib/dashboard-store";

export function WidgetTeamStatus({ size = "medium" }: { size?: WidgetSize }) {
  const members = useTeamStore((s) => s.members);
  const loaded = useTeamStore((s) => s.loaded);
  const { t, isCare } = useIndustryLexicon();

  const onlineMembers = members.filter(
    (m) => m.onlineStatus === "online" || m.onlineStatus === "idle"
  );

  const maxDisplay = size === "small" ? 0 : size === "medium" ? 5 : 12;
  const display = onlineMembers.slice(0, maxDisplay);

  if (!loaded && members.length === 0) {
    return (
      <WidgetShell delay={0}>
        <div className="p-4 space-y-2.5">
          {Array.from({ length: size === "small" ? 1 : 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <ShimmerCircle className="h-6 w-6" />
              <Shimmer className="h-2.5 w-20" />
            </div>
          ))}
        </div>
      </WidgetShell>
    );
  }

  /* ── SMALL: Just online count ───────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0}>
        <div className="flex h-full flex-col items-center justify-center p-3">
          <Users size={14} strokeWidth={1.5} className="mb-1.5 text-[var(--text-dim)]" />
          <span className="font-mono text-[22px] font-medium tabular-nums tracking-tight text-[var(--text-primary)]">{onlineMembers.length}</span>
          <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-dim)]">Online</span>
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE: Member list ────────────────────── */
  return (
    <WidgetShell
      delay={0}
      header={
        <div className="flex items-center gap-2">
          <Users size={14} strokeWidth={1.5} className="text-[var(--text-muted)]" />
          <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">{t("Team")} Status</span>
          <span className="font-mono text-[9px] tabular-nums text-[var(--text-dim)]">{onlineMembers.length} online</span>
        </div>
      }
    >
      <div className="divide-y divide-[var(--border-base)]">
        {display.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-3 flex h-10 w-10 items-center justify-center">
              <div className="animate-orbit-reverse">
                <div className="h-1 w-1 rounded-full" style={{ background: "var(--text-dim)" }} />
              </div>
              <Users size={18} strokeWidth={1.5} className="text-[var(--text-dim)]" />
            </div>
            <p className="text-[12px] text-[var(--text-dim)]">No team members online</p>
            <p className="mt-0.5 font-mono text-[9px] tracking-widest uppercase text-[var(--text-dim)]">Check back later</p>
          </div>
        ) : (
          display.map((m, i) => {
            const isOnline = m.onlineStatus === "online";
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2.5 px-4 py-2 transition-colors duration-150 hover:bg-[var(--subtle-bg)]"
              >
                <div className="relative">
                  <LetterAvatar name={m.name || "?"} size={24} />
                  <div
                    className="absolute -right-px -bottom-px h-[6px] w-[6px] rounded-full"
                    style={{
                      background: isOnline ? "var(--brand)" : "var(--ghost-amber-text)",
                      border: "1.5px solid var(--surface-1)",
                    }}
                  />
                </div>
                <span className="truncate text-[12px] text-[var(--text-body)]">{m.name}</span>
                <span
                  className="ml-auto font-mono text-[9px] font-medium uppercase tracking-widest"
                  style={{ color: isOnline ? "var(--ghost-emerald-text)" : "var(--ghost-amber-text)" }}
                >
                  {isOnline ? "Active" : "Idle"}
                </span>
                {size === "large" && m.role && (
                  <span className="font-mono text-[9px] text-[var(--text-dim)]">
                    {t(String(m.role).replace(/_/g, " "))}
                  </span>
                )}
              </motion.div>
            );
          })
        )}

        {size === "large" && onlineMembers.length > maxDisplay && (
          <div className="px-4 py-2 text-center font-mono text-[9px] tabular-nums text-[var(--text-dim)]">
            +{onlineMembers.length - maxDisplay} more
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
