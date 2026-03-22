/**
 * @component WidgetQuickLinks
 * @status COMPLETE
 * @description Dashboard widget displaying a configurable grid of quick-nav links to key app sections
 * @lastAudit 2026-03-22
 */
"use client";

import { Link as LinkIcon, Briefcase, Calendar, Banknote, Users, Inbox, Warehouse, FileText, Workflow, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { WidgetShell } from "./widget-shell";
import type { WidgetSize } from "@/lib/dashboard-store";

const iconMap: Record<string, typeof LinkIcon> = {
  Briefcase, Calendar, Banknote, Users, Inbox, Warehouse, FileText, Workflow, Plug, Link: LinkIcon,
};

export function WidgetQuickLinks({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const quickLinks = useDashboardStore((s) => s.quickLinks);
  const { t } = useIndustryLexicon();

  /* ── SMALL: Icon grid only ──────────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0}>
        <div className="flex h-full items-center justify-center gap-2 p-2">
          {quickLinks.map((link, i) => {
            const Icon = iconMap[link.icon || "Link"] || LinkIcon;
            return (
              <button
                key={`${link.href}-${i}`}
                onClick={() => router.push(link.href)}
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                title={t(link.label)}
              >
                <Icon size={14} strokeWidth={1.5} className="text-zinc-500 hover:text-zinc-300" />
              </button>
            );
          })}
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE: List with labels ───────────────── */
  return (
    <WidgetShell
      delay={0}
      header={
        <div className="flex items-center gap-2">
          <LinkIcon size={14} className="text-zinc-500" />
          <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Quick Links</span>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-1 p-2">
        {quickLinks.map((link, i) => {
          const Icon = iconMap[link.icon || "Link"] || LinkIcon;
          return (
            <button
              key={`${link.href}-${i}`}
              onClick={() => router.push(link.href)}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[12px] text-zinc-500 transition-colors duration-150 hover:bg-white/[0.03] hover:text-zinc-200"
            >
              <Icon size={14} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
              {t(link.label)}
            </button>
          );
        })}
      </div>
    </WidgetShell>
  );
}
