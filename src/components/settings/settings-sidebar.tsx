"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  User,
  SlidersHorizontal,
  Bell,
  Shield,
  Link2,
  Building2,
  Users,
  CreditCard,
  Plug,
  FileText,
  GitBranch,
  Tag,
  BarChart3,
  Import,
  Plus,
  MapPin,
  Code2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { Shimmer } from "@/components/ui/shimmer";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof User;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "",
    items: [
      { id: "preferences", label: "Preferences", href: "/settings/preferences", icon: SlidersHorizontal },
      { id: "profile", label: "Profile", href: "/settings/profile", icon: User },
      { id: "notifications", label: "Notifications", href: "/settings/notifications", icon: Bell },
      { id: "security", label: "Security & access", href: "/settings/security", icon: Shield },
      { id: "connected", label: "Connected accounts", href: "/settings/connected", icon: Link2 },
    ],
  },
  {
    title: "Jobs",
    items: [
      { id: "labels", label: "Labels", href: "/settings/labels", icon: Tag },
      { id: "templates", label: "Templates", href: "/settings/templates", icon: FileText },
      { id: "statuses", label: "Statuses", href: "/settings/statuses", icon: BarChart3 },
      { id: "workflow", label: "Workflow", href: "/settings/workflow", icon: GitBranch },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "workspace", label: "Workspace", href: "/settings/workspace", icon: Building2 },
      { id: "members", label: "Members", href: "/settings/members", icon: Users },
      { id: "billing", label: "Billing", href: "/settings/billing", icon: CreditCard },
      { id: "integrations", label: "Integrations", href: "/settings/integrations", icon: Plug },
      { id: "branches", label: "Branches", href: "/settings/branches", icon: MapPin },
      { id: "developers", label: "Developer API", href: "/settings/developers", icon: Code2 },
      { id: "import", label: "Import / Export", href: "/settings/import", icon: Import },
    ],
  },
  {
    title: "Your teams",
    items: [],
  },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  const { currentOrg } = useAuthStore();
  const teamName = currentOrg?.name || "";

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[rgba(255,255,255,0.08)] bg-[#050505]">
      {/* Back to app */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          Back to app
        </Link>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 px-3 pb-4">
        {sections.map((section, sectionIdx) => (
          <div key={section.title || sectionIdx} className={sectionIdx > 0 ? "mt-5" : "mt-1"}>
            {section.title && (
              <div className="mb-1 px-2">
                <span className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                  {section.title}
                </span>
              </div>
            )}

            <div className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`group relative flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] transition-colors duration-100 ${
                      active
                        ? "bg-[rgba(255,255,255,0.06)] text-[#EDEDED]"
                        : "text-zinc-500 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.5} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Teams */}
        <div className="mt-5">
          <div className="mb-1 px-2">
            <span className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
              Your teams
            </span>
          </div>
          <div className="space-y-px">
            <Link
              href="/settings/workspace"
              className="flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span>{teamName || <Shimmer className="h-3 w-24" />}</span>
            </Link>
            <button className="flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400">
              <Plus size={13} strokeWidth={1.5} />
              Create a team
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom help */}
      <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
        <button className="text-[12px] text-zinc-600 transition-colors hover:text-zinc-400">
          ?
        </button>
      </div>
    </aside>
  );
}
