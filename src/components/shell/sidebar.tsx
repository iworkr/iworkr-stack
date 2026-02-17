"use client";

import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
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
  { id: "nav_dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", shortcut: "D" },
  { id: "nav_inbox", label: "Messages", icon: Inbox, href: "/dashboard/inbox", shortcut: "I" },
  { id: "nav_jobs", label: "My Jobs", icon: Briefcase, href: "/dashboard/jobs", shortcut: "J" },
  { id: "nav_schedule", label: "Schedule", icon: Calendar, href: "/dashboard/schedule", shortcut: "S" },
  { id: "nav_clients", label: "Clients", icon: Users, href: "/dashboard/clients", shortcut: "C" },
  { id: "nav_invoices", label: "Finance", icon: Banknote, href: "/dashboard/finance", shortcut: "F" },
  { id: "nav_assets", label: "Assets", icon: Warehouse, href: "/dashboard/assets", shortcut: "A" },
  { id: "nav_forms", label: "Forms", icon: FileText, href: "/dashboard/forms" },
  { id: "nav_team", label: "Team", icon: UsersRound, href: "/dashboard/team", shortcut: "T" },
  { id: "nav_automations", label: "Automations", icon: Workflow, href: "/dashboard/automations", shortcut: "W" },
  { id: "nav_integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations" },
];

type SidebarTeamMember = { name: string; initials: string; status: "online" | "away"; role: string };

const systemItems = [
  { label: "Settings", icon: Settings, href: "/settings", action: null },
  { label: "Help", icon: HelpCircle, href: "/dashboard/help", action: null },
  { label: "Invite Team", icon: UserPlus, href: null, action: "invite" },
];

/* ── Spotlight Nav Item ───────────────────────────────── */

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
  const ref = useRef<HTMLAnchorElement>(null);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);
  const springX = useSpring(mouseX, { stiffness: 300, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 300, damping: 25 });

  function handleMouseMove(e: ReactMouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }
  function handleMouseLeave() {
    mouseX.set(-1000);
    mouseY.set(-1000);
  }

  return (
    <Link
      ref={ref}
      href={item.href}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex items-center gap-2.5 rounded-md px-2 py-[6px] transition-colors duration-100 ${
        active
          ? "bg-[rgba(0,230,118,0.06)] text-[#00E676]"
          : "text-zinc-500 hover:text-zinc-300"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {/* Spotlight hover gradient */}
      <motion.div
        className="pointer-events-none absolute inset-0 -z-0 rounded-md opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120px circle at ${springX.get()}px ${springY.get()}px, rgba(255,255,255,0.04), transparent 80%)`,
        }}
      />

      {/* Active indicator bar */}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-[#00E676]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <Icon size={16} strokeWidth={1.5} className="relative z-10 shrink-0" />

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="relative z-10 flex flex-1 items-center justify-between overflow-hidden text-[13px]"
          >
            <span>{item.label}</span>
            <span className="flex items-center gap-1.5">
              {proBadge && <ProBadge size="xs" />}
              {badge && badge > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500/15 px-1 text-[9px] font-medium text-red-400">
                  {badge}
                </span>
              )}
              {!proBadge && (
                <kbd className="hidden rounded border border-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[9px] text-zinc-600 group-hover:inline-block">
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

  // Load billing on org change
  useEffect(() => {
    if (orgId) loadBilling(orgId);
  }, [orgId, loadBilling]);

  // Nav items that require a paid plan — show PRO badge when on free tier
  const gatedNavIds = new Set(["nav_automations", "nav_integrations"]);

  // Live unread count for inbox badge
  const unreadCount = useInboxStore((s) => s.items.filter(i => !i.read && !i.archived).length);

  // Live team status — starts empty (shimmer shown until real data loads)
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

  // Auto-close mobile sidebar on navigation
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
          background: "var(--surface-1)",
          borderColor: "var(--border-base)",
        }}
      >
      {/* ── Workspace Switcher ── */}
      <div className="flex h-12 items-center border-b border-[rgba(255,255,255,0.08)] px-3">
        <button className="flex w-full items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[rgba(255,255,255,0.04)]">
          <img
            src="/logos/logo-dark-streamline.png"
            alt="iWorkr"
            className="h-[22px] w-[22px] shrink-0 object-contain"
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
                <Command size={11} className="shrink-0 text-zinc-600" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── New Item Button ── */}
      <div className="px-2 pt-2.5 pb-0.5">
        <button
          onClick={onCreateClick}
          className={`flex items-center gap-2 rounded-lg bg-gradient-to-b from-[#00E676] to-[#00C853] text-black font-semibold transition-all duration-200 hover:shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)] ${
            sidebarCollapsed
              ? "w-10 justify-center p-2"
              : "w-full px-2.5 py-[6px]"
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
                <kbd className="rounded bg-black/15 px-1.5 py-0.5 font-mono text-[9px]">
                  C
                </kbd>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 pt-2">
        {/* Primary group label */}
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-1 px-2"
            >
              <span className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
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
                <span className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
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
                      className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                    >
                      <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-500">
                        {member.initials}
                        <div
                          className={`absolute -right-px -bottom-px h-[7px] w-[7px] rounded-full border-[1.5px] ${
                            member.status === "online"
                              ? "bg-[#00E676]"
                              : "bg-zinc-600"
                          }`}
                          style={{ borderColor: "var(--surface-1)" }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-zinc-400">
                          {member.name}
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600">
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
      <div className="border-t border-[rgba(255,255,255,0.08)] px-2 py-1.5">
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
                      className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400"
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
                      className="flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400"
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
                    className="flex items-center gap-2 rounded-md px-2 py-[5px] text-[13px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400"
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
          className={`flex items-center gap-2 rounded-md px-2 py-[5px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400 ${
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
          className={`mt-0.5 flex items-center gap-2 rounded-md px-2 py-[5px] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-400 ${
            sidebarCollapsed ? "w-full justify-center" : "w-full"
          }`}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={14} strokeWidth={1.5} />
          ) : (
            <>
              <PanelLeftClose size={14} strokeWidth={1.5} />
              <span className="text-[13px]">Collapse</span>
              <kbd className="ml-auto rounded border border-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[9px] text-zinc-600">
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
