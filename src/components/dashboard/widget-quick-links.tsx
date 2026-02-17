"use client";

import { Link as LinkIcon, Briefcase, Calendar, Banknote, Users, Inbox, Warehouse, FileText, Workflow, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/lib/dashboard-store";
import { WidgetShell } from "./widget-shell";

const iconMap: Record<string, typeof LinkIcon> = {
  Briefcase, Calendar, Banknote, Users, Inbox, Warehouse, FileText, Workflow, Plug, Link: LinkIcon,
};

export function WidgetQuickLinks() {
  const router = useRouter();
  const quickLinks = useDashboardStore((s) => s.quickLinks);

  return (
    <WidgetShell
      delay={0}
      header={
        <div className="flex items-center gap-2">
          <LinkIcon size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Quick Links</span>
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
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
            >
              <Icon size={14} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
              {link.label}
            </button>
          );
        })}
      </div>
    </WidgetShell>
  );
}
