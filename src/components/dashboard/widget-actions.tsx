"use client";

import { motion } from "framer-motion";
import { Plus, FileText, UserPlus, Megaphone, Zap } from "lucide-react";
import { useShellStore } from "@/lib/shell-store";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

const actions = [
  {
    id: "new-job",
    icon: Plus,
    label: "New Job",
    description: "Create a new job order",
    color: "group-hover/action:text-[#00E676]",
    bg: "group-hover/action:bg-[rgba(0,230,118,0.08)]",
    border: "group-hover/action:border-[rgba(0,230,118,0.2)]",
    action: "createJob",
  },
  {
    id: "new-invoice",
    icon: FileText,
    label: "New Invoice",
    description: "Generate a new invoice",
    color: "group-hover/action:text-[#00E676]",
    bg: "group-hover/action:bg-[rgba(0,230,118,0.08)]",
    border: "group-hover/action:border-[rgba(0,230,118,0.2)]",
    action: "createInvoice",
  },
  {
    id: "add-client",
    icon: UserPlus,
    label: "Add Client",
    description: "Register a new client",
    color: "group-hover/action:text-emerald-400",
    bg: "group-hover/action:bg-emerald-500/10",
    border: "group-hover/action:border-emerald-500/20",
    action: "createClient",
  },
  {
    id: "broadcast",
    icon: Megaphone,
    label: "Broadcast",
    description: "Send a team broadcast",
    color: "group-hover/action:text-amber-400",
    bg: "group-hover/action:bg-amber-500/10",
    border: "group-hover/action:border-amber-500/20",
    action: "broadcast",
  },
] as const;

export function WidgetActions({ size = "medium" }: { size?: WidgetSize }) {
  const { setCreateClientModalOpen, setCreateInvoiceModalOpen } = useShellStore();

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "createClient":
        setCreateClientModalOpen(true);
        break;
      case "createInvoice":
        setCreateInvoiceModalOpen(true);
        break;
    }
  };

  /* ── SMALL: Compact icon row ────────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0.2}>
        <div className="flex h-full items-center justify-center gap-2 p-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => handleAction(a.action)}
                className="group/action flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/[0.03] transition-all hover:border-[rgba(255,255,255,0.15)] hover:scale-110"
                title={a.label}
              >
                <Icon size={14} strokeWidth={1.5} className={`text-zinc-600 ${a.color}`} />
              </button>
            );
          })}
        </div>
      </WidgetShell>
    );
  }

  /* ── LARGE: Grid with descriptions ──────────────────── */
  if (size === "large") {
    return (
      <WidgetShell
        delay={0.2}
        header={
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-zinc-500" />
            <span className="text-[13px] font-medium text-zinc-300">Quick Actions</span>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 p-3">
          {actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => handleAction(a.action)}
                className={`group/action flex flex-col items-center justify-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/[0.03] px-3 py-4 transition-all duration-200 ${a.bg} ${a.border} hover:scale-[1.02]`}
              >
                <Icon size={22} strokeWidth={1.5} className={`text-zinc-600 transition-all duration-200 ${a.color} group-hover/action:scale-110`} />
                <span className="text-[10px] font-medium text-zinc-600 transition-colors group-hover/action:text-zinc-300">
                  {a.label}
                </span>
                <span className="text-[8px] text-zinc-700 transition-colors group-hover/action:text-zinc-500">
                  {a.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM: 2x2 grid (default) ─────────────────────── */
  return (
    <WidgetShell
      delay={0.2}
      header={
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Quick Actions</span>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 p-3">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleAction(a.action)}
              className={`group/action flex flex-col items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/[0.03] px-3 py-4 transition-all duration-200 ${a.bg} ${a.border} hover:scale-[1.02]`}
            >
              <Icon size={22} strokeWidth={1.5} className={`text-zinc-600 transition-all duration-200 ${a.color} group-hover/action:scale-110`} />
              <span className="text-[10px] font-medium text-zinc-600 transition-colors group-hover/action:text-zinc-300">
                {a.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </WidgetShell>
  );
}
