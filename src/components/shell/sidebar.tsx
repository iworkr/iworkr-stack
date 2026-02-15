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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

/* ── Data ─────────────────────────────────────────────── */

const navItems = [
  { id: "nav_dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", shortcut: "D" },
  { id: "nav_inbox", label: "Inbox", icon: Inbox, href: "/dashboard/inbox", shortcut: "I", badge: 3 },
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

const teamMembers = [
  { name: "Mike Thompson", initials: "MT", status: "online" as const, role: "On Job" },
  { name: "Sarah Chen", initials: "SC", status: "online" as const, role: "En Route" },
  { name: "James O'Brien", initials: "JO", status: "away" as const, role: "Break" },
];

const systemItems = [
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "Help", icon: HelpCircle, href: "#" },
  { label: "Invite Team", icon: UserPlus, href: "#" },
];

/* ── Spotlight Nav Item ───────────────────────────────── */

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: (typeof navItems)[0];
  active: boolean;
  collapsed: boolean;
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
          ? "bg-[rgba(255,255,255,0.03)] text-zinc-100"
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
          className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-white"
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
              {item.badge && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500/15 px-1 text-[9px] font-medium text-red-400">
                  {item.badge}
                </span>
              )}
              <kbd className="hidden rounded border border-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[9px] text-zinc-600 group-hover:inline-block">
                {item.shortcut}
              </kbd>
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
  const { sidebarCollapsed, toggleSidebar } = useShellStore();
  const companyName =
    useOnboardingStore((s) => s.companyName) || "Apex Plumbing";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed top-0 left-0 z-30 flex h-screen flex-col border-r border-[rgba(255,255,255,0.08)] bg-[#080808]"
      style={{ width: sidebarCollapsed ? 64 : 240 }}
    >
      {/* ── Workspace Switcher ── */}
      <div className="flex h-12 items-center border-b border-[rgba(255,255,255,0.08)] px-3">
        <button className="flex w-full items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-[rgba(255,255,255,0.04)]">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-white">
            <span className="text-[8px] font-bold leading-none text-black">
              iW
            </span>
          </div>
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
                  {companyName}
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
          className={`flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.1)] bg-transparent transition-all duration-200 hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.03)] hover:shadow-[0_0_12px_rgba(255,255,255,0.03)] ${
            sidebarCollapsed
              ? "w-10 justify-center p-2"
              : "w-full px-2.5 py-[6px]"
          }`}
        >
          <Pencil size={13} className="shrink-0 text-zinc-400" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-1 items-center justify-between text-[13px] text-zinc-400"
              >
                New Item
                <kbd className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
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
                {teamMembers.map((member) => (
                  <button
                    key={member.name}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-500">
                      {member.initials}
                      <div
                        className={`absolute -right-px -bottom-px h-[7px] w-[7px] rounded-full border-[1.5px] border-[#080808] ${
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
                    <span className="text-[10px] text-zinc-600">
                      {member.role}
                    </span>
                  </button>
                ))}
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
                return (
                  <Link
                    key={item.label}
                    href={item.href}
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
  );
}
