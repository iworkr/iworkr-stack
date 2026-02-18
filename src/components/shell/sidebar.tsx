"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Briefcase,
  Calendar,
  Users,
  Banknote,
  LayoutDashboard,
  Settings,
  HelpCircle,
  UserPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Command,
  Warehouse,
  Plug,
  FileText,
  UsersRound,
  Workflow,
  Sun,
  Moon,
  Bot,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useAuthStore } from "@/lib/auth-store";
import { useTeamStore } from "@/lib/team-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getTeamStatus, type TeamMemberStatus } from "@/app/actions/dashboard";
import { useInboxStore } from "@/lib/inbox-store";
import { useState } from "react";
import { Shimmer, ShimmerTeamRow } from "@/components/ui/shimmer";
import { useTheme } from "@/components/providers/theme-provider";
import { useBillingStore } from "@/lib/billing-store";
import { ProBadge } from "@/components/monetization/pro-badge";

/* ── Data ─────────────────────────────────────────────── */

const navItems = [
  { id: "nav_dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", shortcut: "G D" },
  { id: "nav_inbox", label: "Messages", icon: Inbox, href: "/dashboard/inbox", shortcut: "G I" },
  { id: "nav_jobs", label: "My Jobs", icon: Briefcase, href: "/dashboard/jobs", shortcut: "G J" },
  { id: "nav_schedule", label: "Schedule", icon: Calendar, href: "/dashboard/schedule", shortcut: "G S" },
  { id: "nav_clients", label: "Clients", icon: Users, href: "/dashboard/clients", shortcut: "G C" },
  { id: "nav_invoices", label: "Finance", icon: Banknote, href: "/dashboard/finance", shortcut: "G F" },
  { id: "nav_assets", label: "Assets", icon: Warehouse, href: "/dashboard/assets", shortcut: "G A" },
  { id: "nav_forms", label: "Forms", icon: FileText, href: "/dashboard/forms" },
  { id: "nav_team", label: "Team", icon: UsersRound, href: "/dashboard/team", shortcut: "G T" },
  { id: "nav_automations", label: "Automations", icon: Workflow, href: "/dashboard/automations", shortcut: "G W" },
  { id: "nav_integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations" },
  { id: "nav_ai_agent", label: "AI Agent", icon: Bot, href: "/dashboard/ai-agent" },
];

type SidebarTeamMember = { name: string; initials: string; status: "online" | "away"; role: string };

const systemItems = [
  { label: "Get App", icon: Smartphone, href: "/dashboard/get-app", action: null },
  { label: "Settings", icon: Settings, href: "/settings", action: null },
  { label: "Help", icon: HelpCircle, href: "/dashboard/help", action: null },
  { label: "Invite Team", icon: UserPlus, href: null, action: "invite" },
];

/* ── Nav Item ─────────────────────────────────────────── */

function NavLink({
  item,
  active,
  collapsed,
  badge,
  proBadge,
}: {
  item: (typeof navItems)[0];
  active: boolean;
  collapsed: boolean;
  badge?: number;
  proBadge?: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-2.5 rounded-lg px-2 py-[7px] transition-all duration-150 ${
        collapsed ? "justify-center" : ""
      } ${active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      {/* Floating Glass Pill — slides between active items */}
      {active && (
        <motion.div
          layoutId="sidebar-glass-pill"
          className="absolute inset-0 rounded-lg bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
        />
      )}

      {/* Hover glow */}
      {!active && (
        <div className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 bg-white/[0.02]" />
      )}

      {/* Active emerald bar */}
      {active && (
        <motion.div
          layoutId="sidebar-active-bar"
          className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-emerald-500"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <Icon
        size={16}
        strokeWidth={active ? 2 : 1.5}
        className="relative z-10 shrink-0 transition-all duration-150"
      />

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 flex flex-1 items-center justify-between overflow-hidden text-[13px]"
          >
            <span className={active ? "font-medium" : ""}>{item.label}</span>
            <span className="flex items-center gap-1.5">
              {proBadge && <ProBadge size="xs" />}
              {badge !== undefined && badge > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500/15 px-1 font-mono text-[9px] font-medium text-rose-400">
                  {badge}
                </span>
              )}
              {item.shortcut && !proBadge && (
                <kbd className="hidden rounded border border-white/[0.05] bg-white/[0.02] px-1 py-0.5 font-mono text-[9px] text-zinc-700 group-hover:inline-block">
                  {item.shortcut}
                </kbd>
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

/* ── Main Sidebar ─────────────────────────────────────── */

interface SidebarProps {
  onCreateClick?: () => void;
}

export function Sidebar({ onCreateClick }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useShellStore();
  const { setInviteModalOpen } = useTeamStore();
  const { theme, toggle: toggleTheme } = useTheme();
  const onboardingName = useOnboardingStore((s) => s.companyName);
  const { currentOrg } = useAuthStore();
  const { orgId } = useOrg();
  const companyName = currentOrg?.name || onboardingName || "";
  const { subscription, loadBilling } = useBillingStore();
  const planKey = subscription?.plan_key?.replace(/_monthly$/, "").replace(/_annual$/, "").replace(/_yearly$/, "") || "free";
  const isFree = planKey === "free";

  useEffect(() => {
    if (orgId) loadBilling(orgId);
  }, [orgId, loadBilling]);

  const gatedNavIds = new Set(["nav_automations", "nav_integrations"]);

  const unreadCount = useInboxStore((s) => s.items.filter(i => !i.read && !i.archived).length);

  const [teamMembers, setTeamMembers] = useState<SidebarTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    getTeamStatus(orgId).then(({ data }) => {
      if (data && data.length > 0) {
        setTeamMembers(data.map((m: TeamMemberStatus) => ({
          name: m.name || "Team Member",
          initials: m.initials || m.name?.substring(0, 2).toUpperCase() || "??",
          status: (m.status === "on_job" || m.status === "en_route" ? "online" : "away") as "online" | "away",
          role: m.status === "on_job" ? "On Job" : m.status === "en_route" ? "En Route" : "Idle",
        })));
      }
      setTeamLoading(false);
    }).catch(() => setTeamLoading(false));
  }, [orgId]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        layout
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r transition-transform duration-300 md:z-30 md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          width: sidebarCollapsed ? 64 : 240,
          background: "#090909",
          borderColor: "rgba(255,255,255,0.06)",
          paddingTop: typeof window !== "undefined" && (window as any).iworkr ? 6 : 0,
        }}
      >
        {/* macOS traffic light spacer */}
        {typeof window !== "undefined" && (window as any).iworkr && navigator.platform?.includes("Mac") && (
          <div className="h-[30px] w-full shrink-0" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />
        )}

        {/* ── Workspace Switcher ── */}
        <div className="flex h-12 items-center border-b border-white/[0.06] px-3">
          <button
            onClick={() => useShellStore.getState().setCommandMenuOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-white/[0.04]"
          >
            <img
              src="/logos/logo-dark-streamline.png"
              alt="iWorkr"
              className="h-[22px] w-[22px] shrink-0 object-contain brightness-150"
            />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-1 items-center justify-between overflow-hidden"
                >
                  <span className="truncate text-[13px] font-medium text-zinc-200">
                    {companyName || <Shimmer className="h-3 w-24" />}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <kbd className="rounded border border-white/[0.05] bg-white/[0.02] px-1 py-0.5 font-mono text-[9px] text-zinc-600">⌘</kbd>
                    <kbd className="rounded border border-white/[0.05] bg-white/[0.02] px-1 py-0.5 font-mono text-[9px] text-zinc-600">K</kbd>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* ── New Item — Emerald Solid ── */}
        <div className="px-2 pt-2.5 pb-0.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onCreateClick}
            className={`group/create flex items-center gap-2 rounded-lg bg-emerald-600 font-medium text-white transition-all duration-300 hover:bg-emerald-500 hover:shadow-[0_0_24px_-6px_rgba(16,185,129,0.35)] ${
              sidebarCollapsed
                ? "w-10 justify-center p-2"
                : "w-full px-2.5 py-[7px]"
            }`}
          >
            <Pencil size={13} className="shrink-0" />
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-1 items-center justify-between text-[13px]"
                >
                  New Item
                  <kbd className="rounded border border-white/[0.15] bg-white/[0.1] px-1.5 py-0.5 font-mono text-[9px] text-emerald-200/60">
                    C
                  </kbd>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-none px-2 pt-2">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-1 px-2"
              >
                <span className="text-[9px] font-bold tracking-widest text-zinc-700 uppercase">
                  Workspace
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-px">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={isActive(item.href)}
                collapsed={sidebarCollapsed}
                badge={item.id === "nav_inbox" ? unreadCount : undefined}
                proBadge={isFree && gatedNavIds.has(item.id)}
              />
            ))}
          </div>

          {/* ── Team Section ── */}
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 overflow-hidden"
              >
                <div className="mb-1 px-2">
                  <span className="text-[9px] font-bold tracking-widest text-zinc-700 uppercase">
                    Your Team
                  </span>
                </div>
                <div className="space-y-px">
                  {teamLoading && teamMembers.length === 0 ? (
                    <>
                      <ShimmerTeamRow />
                      <ShimmerTeamRow />
                      <ShimmerTeamRow />
                    </>
                  ) : teamMembers.length === 0 ? (
                    <p className="px-2 py-2 text-[11px] text-zinc-700">No team members online</p>
                  ) : (
                    teamMembers.map((member) => (
                      <button
                        key={member.name}
                        onClick={() => router.push("/dashboard/team")}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-[5px] text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-500">
                          {member.initials}
                          <div
                            className={`absolute -right-px -bottom-px h-[7px] w-[7px] rounded-full border-[1.5px] border-[#090909] ${
                              member.status === "online"
                                ? "bg-emerald-500"
                                : "bg-zinc-600"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] text-zinc-400">
                            {member.name}
                          </div>
                        </div>
                        <span className="font-mono text-[9px] text-zinc-600">
                          {member.role}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* ── System Tray ── */}
        <div className="border-t border-white/[0.06] px-2 py-1.5">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-px"
              >
                {systemItems.map((item) => {
                  const Icon = item.icon;
                  if (item.action === "invite") {
                    return (
                      <button
                        key={item.label}
                        onClick={() => setInviteModalOpen(true)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400"
                      >
                        <Icon size={14} strokeWidth={1.5} />
                        <span>{item.label}</span>
                      </button>
                    );
                  }
                  if (item.href?.startsWith("mailto:") || item.href?.startsWith("http")) {
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-2 rounded-lg px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400"
                      >
                        <Icon size={14} strokeWidth={1.5} />
                        <span>{item.label}</span>
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={item.label}
                      href={item.href || "#"}
                      className="flex items-center gap-2 rounded-lg px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400"
                    >
                      <Icon size={14} strokeWidth={1.5} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
            className={`flex items-center gap-2 rounded-lg px-2 py-[5px] text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400 ${
              sidebarCollapsed ? "w-full justify-center" : "w-full"
            }`}
          >
            {theme === "dark" ? (
              <Sun size={14} strokeWidth={1.5} />
            ) : (
              <Moon size={14} strokeWidth={1.5} />
            )}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[13px]"
                >
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Collapse */}
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar (⌘[)" : undefined}
            className={`mt-0.5 flex items-center gap-2 rounded-lg px-2 py-[5px] text-zinc-600 transition-colors hover:bg-white/[0.03] hover:text-zinc-400 ${
              sidebarCollapsed ? "w-full justify-center" : "w-full"
            }`}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={14} strokeWidth={1.5} />
            ) : (
              <>
                <PanelLeftClose size={14} strokeWidth={1.5} />
                <span className="text-[13px]">Collapse</span>
                <kbd className="ml-auto rounded border border-white/[0.05] bg-white/[0.02] px-1 py-0.5 font-mono text-[9px] text-zinc-700">
                  ⌘[
                </kbd>
              </>
            )}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
