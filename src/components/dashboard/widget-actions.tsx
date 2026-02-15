"use client";

import { motion } from "framer-motion";
import { Plus, FileText, UserPlus, Megaphone, Zap } from "lucide-react";
import { useShellStore } from "@/lib/shell-store";
import { WidgetShell } from "./widget-shell";

const actions = [
  {
    id: "new-job",
    icon: Plus,
    label: "New Job",
    color: "group-hover/action:text-violet-400",
    bg: "group-hover/action:bg-violet-500/10",
    border: "group-hover/action:border-violet-500/20",
    action: "createJob",
  },
  {
    id: "new-invoice",
    icon: FileText,
    label: "New Invoice",
    color: "group-hover/action:text-blue-400",
    bg: "group-hover/action:bg-blue-500/10",
    border: "group-hover/action:border-blue-500/20",
    action: "createInvoice",
  },
  {
    id: "add-client",
    icon: UserPlus,
    label: "Add Client",
    color: "group-hover/action:text-emerald-400",
    bg: "group-hover/action:bg-emerald-500/10",
    border: "group-hover/action:border-emerald-500/20",
    action: "createClient",
  },
  {
    id: "broadcast",
    icon: Megaphone,
    label: "Broadcast",
    color: "group-hover/action:text-amber-400",
    bg: "group-hover/action:bg-amber-500/10",
    border: "group-hover/action:border-amber-500/20",
    action: "broadcast",
  },
] as const;

export function WidgetActions() {
  const { setCreateClientModalOpen, setCreateInvoiceModalOpen } = useShellStore();

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "createClient":
        setCreateClientModalOpen(true);
        break;
      case "createInvoice":
        setCreateInvoiceModalOpen(true);
        break;
      // createJob and broadcast handled via other mechanisms
    }
  };

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
              transition={{
                delay: 0.25 + i * 0.06,
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => handleAction(a.action)}
              className={`group/action flex flex-col items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-white/[0.03] px-3 py-4 transition-all duration-200 ${a.bg} ${a.border} hover:scale-[1.02]`}
            >
              <Icon
                size={22}
                strokeWidth={1.5}
                className={`text-zinc-600 transition-all duration-200 ${a.color} group-hover/action:scale-110`}
              />
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
