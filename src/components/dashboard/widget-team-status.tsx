"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useTeamStore } from "@/lib/team-store";
import { WidgetShell } from "./widget-shell";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";
import type { WidgetSize } from "@/lib/dashboard-store";

export function WidgetTeamStatus({ size = "medium" }: { size?: WidgetSize }) {
  const members = useTeamStore((s) => s.members);
  const loaded = useTeamStore((s) => s.loaded);

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
          <Users size={14} strokeWidth={1.5} className="mb-1.5 text-zinc-600" />
          <span className="text-[22px] font-medium tracking-tight text-white">{onlineMembers.length}</span>
          <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">Online</span>
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
          <Users size={14} strokeWidth={1.5} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Team Status</span>
          <span className="text-[11px] text-zinc-600">{onlineMembers.length} online</span>
        </div>
      }
    >
      <div className="divide-y divide-white/[0.03]">
        {display.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="relative mb-3 flex h-10 w-10 items-center justify-center">
              <div className="animate-orbit-reverse">
                <div className="h-1 w-1 rounded-full bg-zinc-700" />
              </div>
              <Users size={18} strokeWidth={1.5} className="text-zinc-700" />
            </div>
            <p className="text-[12px] text-zinc-600">No team members online</p>
          </div>
        ) : (
          display.map((m, i) => {
            const initials = m.name
              ? m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
              : "??";
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-2.5 px-4 py-2 transition-colors duration-150 hover:bg-white/[0.02]"
              >
                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-500">
                  {initials}
                  <div
                    className={`absolute -right-px -bottom-px h-[6px] w-[6px] rounded-full border-[1.5px] border-[#0A0A0A] ${
                      m.onlineStatus === "online" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>
                <span className="truncate text-[12px] text-zinc-400">{m.name}</span>
                <span className="ml-auto text-[10px] text-zinc-600">
                  {m.onlineStatus === "online" ? "Active" : "Idle"}
                </span>
                {size === "large" && m.role && (
                  <span className="text-[9px] text-zinc-700">
                    {String(m.role).replace(/_/g, " ")}
                  </span>
                )}
              </motion.div>
            );
          })
        )}

        {size === "large" && onlineMembers.length > maxDisplay && (
          <div className="px-4 py-2 text-center text-[10px] text-zinc-600">
            +{onlineMembers.length - maxDisplay} more
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
