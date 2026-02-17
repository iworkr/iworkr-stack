"use client";

import { Users } from "lucide-react";
import { useTeamStore } from "@/lib/team-store";
import { WidgetShell } from "./widget-shell";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";

export function WidgetTeamStatus({ compact }: { compact?: boolean }) {
  const members = useTeamStore((s) => s.members);
  const loaded = useTeamStore((s) => s.loaded);

  const onlineMembers = members.filter(
    (m) => m.onlineStatus === "online" || m.onlineStatus === "idle"
  );
  const display = compact ? onlineMembers.slice(0, 3) : onlineMembers.slice(0, 8);

  if (!loaded && members.length === 0) {
    return (
      <WidgetShell delay={0}>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <ShimmerCircle className="h-6 w-6" />
              <Shimmer className="h-3 w-20" />
            </div>
          ))}
        </div>
      </WidgetShell>
    );
  }

  if (compact) {
    return (
      <WidgetShell delay={0}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-zinc-500" />
            <span className="text-[13px] font-medium text-zinc-300">Team</span>
          </div>
          <span className="text-[20px] font-medium text-zinc-100">{onlineMembers.length}</span>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      delay={0}
      header={
        <div className="flex items-center gap-2">
          <Users size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Team Status</span>
          <span className="text-[11px] text-zinc-600">{onlineMembers.length} online</span>
        </div>
      }
    >
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {display.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-zinc-600">
            No team members online
          </div>
        ) : (
          display.map((m) => {
            const initials = m.name
              ? m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
              : "??";
            return (
              <div key={m.id} className="flex items-center gap-2.5 px-4 py-2">
                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-500">
                  {initials}
                  <div
                    className={`absolute -right-px -bottom-px h-[7px] w-[7px] rounded-full border-[1.5px] border-[#0C0C0C] ${
                      m.onlineStatus === "online" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>
                <span className="truncate text-[12px] text-zinc-400">{m.name}</span>
                <span className="ml-auto text-[10px] text-zinc-600">
                  {m.onlineStatus === "online" ? "Active" : "Idle"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </WidgetShell>
  );
}
