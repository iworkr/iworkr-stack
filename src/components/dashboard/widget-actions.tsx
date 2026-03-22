/**
 * @component WidgetActions
 * @status COMPLETE
 * @description Dashboard quick-actions widget with buttons for creating jobs, quotes, invites, and broadcasts
 * @lastAudit 2026-03-22
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, FileText, UserPlus, Megaphone, Zap } from "lucide-react";
import { useShellStore } from "@/lib/shell-store";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { WidgetShell } from "./widget-shell";
import { BroadcastModal } from "@/components/messenger/broadcast-modal";
import type { WidgetSize } from "@/lib/dashboard-store";

const actionsConfig = [
  {
    id: "new-job",
    icon: Briefcase,
    labelKey: "New Job",
    descriptionKey: "Create a new job order",
    action: "createJob",
    ghost: "var(--ghost-emerald)",
    ghostText: "var(--ghost-emerald-text)",
  },
  {
    id: "new-invoice",
    icon: FileText,
    labelKey: "New Invoice",
    descriptionKey: "Generate a new invoice",
    action: "createInvoice",
    ghost: "var(--ghost-blue)",
    ghostText: "var(--ghost-blue-text)",
  },
  {
    id: "add-client",
    icon: UserPlus,
    labelKey: "Add Client",
    descriptionKey: "Register a new client",
    action: "createClient",
    ghost: "var(--ghost-violet)",
    ghostText: "var(--ghost-violet-text)",
  },
  {
    id: "broadcast",
    icon: Megaphone,
    labelKey: "Broadcast",
    descriptionKey: "Send a team broadcast",
    action: "broadcast",
    ghost: "var(--ghost-amber)",
    ghostText: "var(--ghost-amber-text)",
  },
] as const;

export function WidgetActions({ size = "medium" }: { size?: WidgetSize }) {
  const { setCreateClientModalOpen, setCreateInvoiceModalOpen, setCreateJobModalOpen } = useShellStore();
  const { orgId, userId } = useOrg();
  const { t } = useIndustryLexicon();
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const actions = actionsConfig.map((a) => ({
    ...a,
    label: t(a.labelKey),
    description: t(a.descriptionKey),
    ghost: a.ghost,
    ghostText: a.ghostText,
  }));

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
        setBroadcastOpen(true);
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
                className="group/action flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200"
                style={{ borderColor: "var(--border-base)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.ghostText; e.currentTarget.style.background = a.ghost; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-base)"; e.currentTarget.style.background = "transparent"; }}
                title={a.label}
              >
                <Icon size={15} strokeWidth={1.5} className="text-[var(--text-dim)] transition-colors duration-200 group-hover/action:text-[var(--text-body)]" />
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
          <Zap size={14} strokeWidth={1.5} className="text-[var(--text-dim)]" />
          <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-muted)]">Quick Actions</span>
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
              className="group/action flex flex-col items-center justify-center gap-2.5 rounded-xl border px-3 py-5 transition-all duration-200"
              style={{ borderColor: "var(--border-base)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.ghostText; e.currentTarget.style.background = a.ghost; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-base)"; e.currentTarget.style.background = "transparent"; }}
            >
              <div
                className="flex items-center justify-center rounded-lg border transition-all duration-200"
                style={{
                  width: size === "large" ? 40 : 36,
                  height: size === "large" ? 40 : 36,
                  borderColor: "var(--border-base)",
                  background: "var(--subtle-bg)",
                }}
              >
                <Icon
                  size={size === "large" ? 20 : 17}
                  strokeWidth={1.5}
                  className="text-[var(--text-dim)] transition-colors duration-200 group-hover/action:text-[var(--text-body)]"
                />
              </div>
              <span className="font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--text-dim)] transition-colors duration-200 group-hover/action:text-[var(--text-body)]">
                {a.label}
              </span>
              {size === "large" && (
                <span className="text-[8px] text-[var(--text-dim)] transition-colors duration-200 group-hover/action:text-[var(--text-muted)]">
                  {a.description}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {orgId && userId && (
        <BroadcastModal
          open={broadcastOpen}
          onClose={() => setBroadcastOpen(false)}
          orgId={orgId}
          userId={userId}
        />
      )}
    </WidgetShell>
  );
}
