"use client";

import { motion } from "framer-motion";
import { Briefcase, FileText, UserPlus, Megaphone, Zap } from "lucide-react";
import { useShellStore } from "@/lib/shell-store";
import { useToastStore } from "@/components/app/action-toast";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

const actions = [
  {
    id: "new-job",
    icon: Briefcase,
    label: "New Job",
    description: "Create a new job order",
    action: "createJob",
    accentHover: "hover:border-emerald-500/15",
  },
  {
    id: "new-invoice",
    icon: FileText,
    label: "New Invoice",
    description: "Generate a new invoice",
    action: "createInvoice",
    accentHover: "hover:border-blue-500/15",
  },
  {
    id: "add-client",
    icon: UserPlus,
    label: "Add Client",
    description: "Register a new client",
    action: "createClient",
    accentHover: "hover:border-violet-500/15",
  },
  {
    id: "broadcast",
    icon: Megaphone,
    label: "Broadcast",
    description: "Send a team broadcast",
    action: "broadcast",
    accentHover: "hover:border-amber-500/15",
  },
] as const;

export function WidgetActions({ size = "medium" }: { size?: WidgetSize }) {
  const { setCreateClientModalOpen, setCreateInvoiceModalOpen, setCreateJobModalOpen } = useShellStore();
  const { addToast } = useToastStore();

  const handleAction = (actionId: string) => {
    switch (actionId) {
      case "createJob":
        setCreateJobModalOpen(true);
        break;
      case "createClient":
        setCreateClientModalOpen(true);
        break;
      case "createInvoice":
        setCreateInvoiceModalOpen(true);
        break;
      case "broadcast":
        // INCOMPLETE:TODO — Broadcast feature not implemented; should open a composer modal to send team-wide messages with delivery tracking. Done when BroadcastModal sends real messages via messenger server action.
        addToast("Broadcast coming soon");
        break;
    }
  };

  if (size === "small") {
    return (
      <WidgetShell delay={0.25}>
        <div className="flex h-full items-center justify-center gap-2.5 p-3">
          {actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                onClick={() => handleAction(a.action)}
                className={`group/action flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.04] bg-transparent transition-all duration-200 ${a.accentHover}`}
                title={a.label}
              >
                <Icon size={15} strokeWidth={1.5} className="text-zinc-600 transition-colors duration-200 group-hover/action:text-zinc-200" />
              </motion.button>
            );
          })}
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      delay={0.25}
      header={
        <div className="flex items-center gap-2">
          <Zap size={14} strokeWidth={1.5} className="text-zinc-600" />
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Quick Actions</span>
        </div>
      }
    >
      <div className={`grid gap-2.5 p-4 ${size === "large" ? "grid-cols-2" : "grid-cols-2"}`}>
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleAction(a.action)}
              className={`group/action flex flex-col items-center justify-center gap-2.5 rounded-xl border border-white/[0.03] bg-transparent px-3 py-5 transition-all duration-200 ${a.accentHover}`}
            >
              <div className="relative">
                <Icon
                  size={size === "large" ? 24 : 20}
                  strokeWidth={1.5}
                  className="text-zinc-600 transition-colors duration-200 group-hover/action:text-zinc-200"
                />
              </div>
              <span className="text-[10px] font-medium text-zinc-600 transition-colors duration-200 group-hover/action:text-zinc-300">
                {a.label}
              </span>
              {size === "large" && (
                <span className="text-[8px] text-zinc-800 transition-colors duration-200 group-hover/action:text-zinc-600">
                  {a.description}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </WidgetShell>
  );
}
