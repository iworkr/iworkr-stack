/**
 * @component Sidebar
 * @status PARTIAL
 * @description Main navigation sidebar with collapsible sections, badge counts, and workspace context
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Briefcase,
  Calendar,
  Users,
  Banknote,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  UserPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Warehouse,
  Plug,
  FileText,
  UsersRound,
  UserCircle,
  Workflow,
  Bot,
  Smartphone,
  Map,
  Activity,
  DollarSign,
  ShieldCheck,
  Shield,
  Zap,
  ChevronRight,
  Search,
  LogOut,
  ChevronsUpDown,
  Heart,
  CalendarClock,
  Pill,
  Stethoscope,
  AlertOctagon,
  ClipboardList,
  ShieldAlert,
  BookOpen,
  Lightbulb,
  Timer,
  MessageSquare,
  Building2,
  Truck,
  Grid3X3,
  Eye,
  Send,
  RefreshCw,
  Phone,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useAuthStore } from "@/lib/auth-store";
import { useTeamStore } from "@/lib/team-store";
import { useOrg } from "@/lib/hooks/use-org";
import { useInboxStore } from "@/lib/inbox-store";
import { Shimmer } from "@/components/ui/shimmer";
import { useBillingStore } from "@/lib/billing-store";
import { createClient } from "@/lib/supabase/client";
import { ProBadge } from "@/components/monetization/pro-badge";
import { roleDefinitions, type RoleId, type PermissionModule } from "@/lib/team-data";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { useBrandingStore } from "@/lib/stores/branding-store";
import { WorkspaceSwitcher as WorkspaceSwitcherNew } from "@/components/shell/workspace-switcher";
import { LetterAvatar } from "@/components/ui/letter-avatar";

// ═══════════════════════════════════════════════════════════════════════════════
// Project Yggdrasil — Nested Accordion Sidebar (Information Architecture v2)
// ═══════════════════════════════════════════════════════════════════════════════

/* ── Types ─────────────────────────────────────────────── */

interface NavChild {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  shortcut?: string;
  badge?: "PRO";
  /** Permission module required to see this item */
  module?: PermissionModule;
}

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  /** If set, this is a top-level link (no children) */
  href?: string;
  shortcut?: string;
  children?: NavChild[];
  /** Permission module required to see entire group */
  module?: PermissionModule;
  /** Minimum clearance to see group (1-5). If not set, visible to all. */
  minClearance?: number;
}

/* ── Care IA (Yggdrasil Pillars) ────────────────────────── */

const CARE_NAV: NavGroup[] = [
  // ── Overview (top-level link) ──
  {
    id: "grp_overview",
    label: "Overview",
    icon: LayoutGrid,
    href: "/dashboard/care",
    shortcut: "G D",
  },

  // ── Pillar 1: Participants ──
  {
    id: "grp_participants",
    label: "Participants",
    icon: Heart,
    children: [
      { id: "nav_participants_dir", label: "Directory", icon: Users, href: "/dashboard/care/participants", shortcut: "G C" },
      { id: "nav_care_plans", label: "Care Plans", icon: BookOpen, href: "/dashboard/care/plans" },
      { id: "nav_plan_reviews", label: "Funding & Plan Reviews", icon: FileText, href: "/dashboard/care/plan-reviews/build" },
    ],
  },

  // ── Pillar 2: Rostering & Ops ──
  {
    id: "grp_rostering",
    label: "Rostering & Ops",
    icon: Calendar,
    children: [
      { id: "nav_master_roster", label: "Master Roster", icon: CalendarClock, href: "/dashboard/schedule", shortcut: "G S" },
      { id: "nav_roster_dispatch", label: "Roster Dispatch", icon: CalendarClock, href: "/dashboard/roster/dispatch" },
      { id: "nav_daily_ops", label: "Daily Ops", icon: Activity, href: "/dashboard/care/daily-ops" },
      { id: "nav_houses", label: "Houses / SIL", icon: Building2, href: "/dashboard/houses" },
      { id: "nav_fleet", label: "Fleet Management", icon: Truck, href: "/dashboard/fleet/overview" },
    ],
  },

  // ── Pillar 3: Clinical & Safety ──
  {
    id: "grp_clinical",
    label: "Clinical & Safety",
    icon: ShieldCheck,
    children: [
      { id: "nav_shift_notes", label: "Shift Notes & Comms", icon: ClipboardList, href: "/dashboard/care/notes" },
      { id: "nav_medications", label: "eMAR / Medications", icon: Pill, href: "/dashboard/care/medications" },
      { id: "nav_incidents", label: "Incidents & Observations", icon: AlertOctagon, href: "/dashboard/care/incidents" },
      { id: "nav_goal_matrix", label: "Goal Matrix", icon: Activity, href: "/dashboard/clinical/goals" },
    ],
  },

  // ── Pillar 4: Financials & PRODA ──
  {
    id: "grp_financials",
    label: "Financials & PRODA",
    icon: DollarSign,
    module: "finance",
    children: [
      { id: "nav_proda", label: "PRODA Claims", icon: Send, href: "/dashboard/care/proda-claims", module: "finance" },
      { id: "nav_sil_fin", label: "SIL Quoting & Variance", icon: Grid3X3, href: "/dashboard/care/sil-quoting", module: "finance" },
      { id: "nav_petty_cash", label: "Petty Cash", icon: Banknote, href: "/dashboard/finance/petty-cash", module: "finance" },
      { id: "nav_coordination", label: "Coordination Ledger", icon: Timer, href: "/dashboard/coordination/ledger", module: "finance" },
      { id: "nav_iworkr_connect", label: "iWorkr Connect", icon: Zap, href: "/dashboard/finance/iworkr-connect", module: "finance" },
      { id: "nav_invoicing", label: "Participant Invoicing", icon: FileText, href: "/dashboard/finance/invoicing", module: "finance" },
    ],
  },

  // ── Pillar 5: Workforce ──
  {
    id: "grp_workforce",
    label: "Workforce",
    icon: UsersRound,
    children: [
      { id: "nav_team", label: "Team Directory", icon: UserCircle, href: "/dashboard/workforce/team", shortcut: "G T", module: "team" },
      { id: "nav_timesheets", label: "Timesheets", icon: Timer, href: "/dashboard/timesheets" },
      { id: "nav_payroll_export", label: "Payroll Export", icon: DollarSign, href: "/dashboard/workforce/payroll-export" },
      { id: "nav_leave", label: "Leave Engine", icon: CalendarClock, href: "/dashboard/team/leave", module: "team" },
    ],
  },

  // ── Pillar 6: Governance ──
  {
    id: "grp_governance",
    label: "Governance",
    icon: Shield,
    minClearance: 3,
    children: [
      { id: "nav_compliance", label: "Policies & Readiness", icon: ShieldCheck, href: "/dashboard/compliance/readiness" },
      { id: "nav_quality", label: "Quality & CI", icon: Lightbulb, href: "/dashboard/care/quality" },
      { id: "nav_auditor", label: "Auditor Portals", icon: ShieldAlert, href: "/dashboard/compliance/audits" },
    ],
  },

  // ── Pillar 7: Workspace Settings ──
  {
    id: "grp_workspace",
    label: "Workspace",
    icon: Settings,
    minClearance: 2,
    children: [
      { id: "nav_forms", label: "Forms", icon: FileText, href: "/dashboard/forms" },
      { id: "nav_automations", label: "Automations", icon: Zap, href: "/dashboard/automations", badge: "PRO", module: "integrations" },
      { id: "nav_integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations", badge: "PRO", module: "integrations" },
      { id: "nav_accounting_sync", label: "Accounting Sync", icon: RefreshCw, href: "/dashboard/settings/integrations", module: "integrations" },
      { id: "nav_ai_agent", label: "AI Agent", icon: Bot, href: "/dashboard/ai-agent", module: "integrations" },
    ],
  },
];

/* ── Trades IA ──────────────────────────────────────────── */

const TRADES_NAV: NavGroup[] = [
  { id: "grp_overview", label: "Overview", icon: LayoutDashboard, href: "/dashboard", shortcut: "G D" },
  {
    id: "grp_work",
    label: "Work",
    icon: Briefcase,
    children: [
      { id: "nav_jobs", label: "Jobs", icon: Briefcase, href: "/dashboard/jobs", shortcut: "G J" },
      { id: "nav_schedule", label: "Schedule", icon: Calendar, href: "/dashboard/schedule", shortcut: "G S" },
      { id: "nav_dispatch", label: "Dispatch", icon: Map, href: "/dashboard/dispatch" },
    ],
  },
  {
    id: "grp_clients",
    label: "Clients & Sales",
    icon: Users,
    children: [
      { id: "nav_clients", label: "Clients", icon: Users, href: "/dashboard/clients", shortcut: "G C" },
      { id: "nav_crm", label: "Sales Pipeline", icon: Workflow, href: "/dashboard/crm" },
      { id: "nav_portal", label: "Family Portal", icon: Heart, href: "/dashboard/portal" },
    ],
  },
  {
    id: "grp_finance",
    label: "Finance",
    icon: Banknote,
    module: "finance",
    children: [
      { id: "nav_invoices", label: "Invoices", icon: Banknote, href: "/dashboard/finance", shortcut: "G F", module: "finance" },
      { id: "nav_timesheets", label: "Timesheets", icon: Timer, href: "/dashboard/timesheets" },
      { id: "nav_travel_ledger", label: "Travel Ledger", icon: Map, href: "/dashboard/finance/travel-ledger" },
      { id: "nav_sync_errors", label: "Sync Errors", icon: AlertOctagon, href: "/dashboard/finance/sync-errors" },
    ],
  },
  { id: "nav_inbox", label: "Messages", icon: Inbox, href: "/dashboard/inbox", shortcut: "G I" },
  { id: "nav_comms", label: "Communications", icon: Phone, href: "/dashboard/communications", shortcut: "G C" },
  {
    id: "grp_ops",
    label: "Operations",
    icon: Warehouse,
    children: [
      { id: "nav_assets", label: "Assets", icon: Warehouse, href: "/dashboard/assets", shortcut: "G A" },
      { id: "nav_team", label: "Team", icon: UsersRound, href: "/dashboard/team", shortcut: "G T", module: "team" },
      { id: "nav_leave", label: "Leave Engine", icon: CalendarClock, href: "/dashboard/team/leave", module: "team" },
    ],
  },
  {
    id: "grp_settings",
    label: "Workspace",
    icon: Settings,
    minClearance: 2,
    children: [
      { id: "nav_forms", label: "Forms", icon: FileText, href: "/dashboard/forms" },
      { id: "nav_automations", label: "Automations", icon: Zap, href: "/dashboard/automations", badge: "PRO", module: "integrations" },
      { id: "nav_integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations", badge: "PRO", module: "integrations" },
      { id: "nav_ai_agent", label: "AI Agent", icon: Bot, href: "/dashboard/ai-agent", module: "integrations" },
    ],
  },
];

/* ── Clearance map (mirrors role-gate.tsx) ──────────────── */

const CLEARANCE: Record<string, number> = {
  owner: 5, admin: 5, manager: 3, office_admin: 3,
  senior_tech: 2, technician: 1, apprentice: 1, subcontractor: 1,
};

/* ── RBAC filter ─────────────────────────────────────────── */

function useFilteredNav(groups: NavGroup[]) {
  const membership = useAuthStore((s) => s.currentMembership);
  const userRole = (membership?.role ?? "technician") as RoleId;
  const roleDef = roleDefinitions.find((r) => r.id === userRole);
  const clearance = CLEARANCE[userRole] ?? 1;
  const { subscription, planTier } = useBillingStore();
  const planKey = subscription?.plan_key?.replace(/_monthly$/, "").replace(/_annual$/, "").replace(/_yearly$/, "") || planTier || "free";
  const isFree = planKey === "free";

  return useMemo(() => {
    const canView = (mod?: PermissionModule) => {
      if (!mod) return true;
      return roleDef?.permissions[mod]?.includes("view") ?? false;
    };

    return groups
      .filter((g) => {
        if (g.minClearance && clearance < g.minClearance) return false;
        if (g.module && !canView(g.module)) return false;
        return true;
      })
      .map((g) => {
        if (!g.children) return g;
        const filtered = g.children.filter((c) => canView(c.module));
        if (filtered.length === 0) return null;
        return { ...g, children: filtered };
      })
      .filter(Boolean) as NavGroup[];
  }, [groups, roleDef, clearance]);
}

/* ── Accordion state: auto-expand based on route ─────────── */

function useAccordionState(groups: NavGroup[], pathname: string) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  // Auto-expand the group that contains the active route
  useEffect(() => {
    for (const g of groups) {
      if (!g.children) continue;
      const isChildActive = g.children.some((c) =>
        pathname === c.href || pathname.startsWith(c.href + "/")
      );
      if (isChildActive) {
        setOpenGroups((prev) => {
          const next = new Set(prev);
          next.add(g.id);
          return next;
        });
      }
    }
  }, [pathname, groups]);

  const toggle = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return { openGroups, toggle };
}

/* ── Bubble-up badge counts ──────────────────────────────── */

function useBadgeCounts(): Record<string, number> {
  const unread = useInboxStore((s) => s.items.filter((i) => !i.read && !i.archived).length);
  // Map child nav IDs to their badge counts
  // In the future, this can pull from multiple stores (incidents, notes, etc.)
  return useMemo(
    () => ({
      nav_inbox: unread,         // Trades: Messages
      nav_incidents: 0,          // Placeholder — wire to real incident store
      nav_shift_notes: 0,        // Placeholder
    } as Record<string, number>),
    [unread],
  );
}

/* ── Collapsible Group ──────────────────────────────────── */

function CollapsibleGroup({
  group,
  isOpen,
  onToggle,
  pathname,
  collapsed,
  badgeCounts,
  isFree,
}: {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  collapsed: boolean;
  badgeCounts: Record<string, number>;
  isFree: boolean;
}) {
  const Icon = group.icon;
  const children = group.children!;

  // Bubble-up: sum all children's badges
  const groupBadge = children.reduce(
    (sum, c) => sum + (badgeCounts[c.id] || 0),
    0,
  );

  const hasActiveChild = children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/"),
  );

  if (collapsed) {
    // In collapsed mode, show the first child's route on click
    return (
      <Link
        href={children[0]?.href || "#"}
        title={group.label}
        className={`flex items-center justify-center rounded-md px-2 py-[6px] transition-all duration-100 ${
          hasActiveChild
            ? "bg-white/[0.06] text-[var(--text-primary)]"
            : "text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
        }`}
      >
        <div className="relative">
          <Icon size={16} strokeWidth={1.5} />
          {groupBadge > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </div>
      </Link>
    );
  }

  return (
    <div>
      {/* Parent trigger */}
      <button
        onClick={onToggle}
        className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-[6px] text-[13px] transition-all duration-100 ${
          hasActiveChild || isOpen
            ? "text-[var(--text-primary)]"
            : "text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
        }`}
      >
        <Icon size={16} strokeWidth={1.5} className="shrink-0" />
        <span className="flex-1 text-left font-normal">{group.label}</span>

        {/* Bubble-up badge (pulsing dot when collapsed) */}
        {groupBadge > 0 && !isOpen && (
          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
        )}

        {/* Chevron */}
        <ChevronRight
          size={12}
          className={`shrink-0 text-zinc-600 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Accordion content — CSS Grid 0fr→1fr for smooth animation */}
      <div
        className="transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          display: "grid",
          gridTemplateRows: isOpen ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div className="pl-[18px] pr-1 pt-0.5 pb-0.5">
            {children.map((child) => {
              const CIcon = child.icon;
              const active =
                pathname === child.href ||
                pathname.startsWith(child.href + "/");
              const count = badgeCounts[child.id] || 0;

              return (
                <Link
                  key={child.id}
                  href={child.href}
                  data-testid={child.id}
                  className={`group relative flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[12.5px] transition-all duration-100 ${
                    active
                      ? "bg-white/[0.05] text-white font-medium"
                      : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                  }`}
                >
                  <CIcon size={14} strokeWidth={1.5} className="shrink-0" />
                  <span className="flex-1 truncate">{child.label}</span>
                  {isFree && child.badge === "PRO" && <ProBadge size="xs" />}
                  {count > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500/15 px-1 font-mono text-[9px] font-medium text-rose-400">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Top-level nav link (no children) ────────────────────── */

function TopLevelLink({
  group,
  active,
  collapsed,
  badgeCount,
}: {
  group: NavGroup;
  active: boolean;
  collapsed: boolean;
  badgeCount?: number;
}) {
  const Icon = group.icon;

  return (
    <Link
      href={group.href!}
      title={collapsed ? group.label : undefined}
      data-testid={group.id}
      className={`group relative flex items-center gap-2.5 rounded-md px-2 py-[6px] transition-all duration-100 ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-white/[0.06] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
      }`}
    >
      <div className="relative">
        <Icon size={16} strokeWidth={1.5} className={`shrink-0 ${active ? "text-[var(--text-primary)]" : ""}`} />
        {collapsed && badgeCount !== undefined && badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
        )}
      </div>

      {!collapsed && (
        <span className="flex flex-1 items-center justify-between text-[13px]">
          <span className={active ? "font-medium" : "font-normal"}>{group.label}</span>
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)]/15 px-1 font-mono text-[9px] font-medium text-[var(--brand)]">
              {badgeCount}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

/* ── System Tray Link ────────────────────────────────────── */

function SystemLink({
  label,
  icon: Icon,
  collapsed,
  onClick,
  href,
  active,
}: {
  label: string;
  icon: React.ElementType;
  collapsed: boolean;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const cls = `flex w-full items-center gap-2.5 rounded-md px-2 py-[6px] text-[13px] transition-all duration-100 ${
    collapsed ? "justify-center" : ""
  } ${
    active
      ? "bg-white/[0.06] text-[var(--text-primary)]"
      : "text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
  }`;

  const content = (
    <>
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </>
  );

  if (onClick) return <button title={collapsed ? label : undefined} className={cls} onClick={onClick}>{content}</button>;
  if (href) return <Link title={collapsed ? label : undefined} href={href} className={cls}>{content}</Link>;
  return null;
}

/* ── Main Sidebar ─────────────────────────────────────────── */

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useShellStore();
  const { setInviteModalOpen } = useTeamStore();
  const onboardingName = useOnboardingStore((s) => s.companyName);
  const { currentOrg } = useAuthStore();
  const { orgId } = useOrg();
  const companyName = currentOrg?.name || onboardingName || "";
  const brandingLogo = useBrandingStore((s) => s.branding?.logo_light_url);
  const { subscription, planTier, loadBilling } = useBillingStore();
  const planKey = subscription?.plan_key?.replace(/_monthly$/, "").replace(/_annual$/, "").replace(/_yearly$/, "") || planTier || "free";
  const isFree = planKey === "free";
  const membership = useAuthStore((s) => s.currentMembership);
  const userRole = (membership?.role ?? "technician") as RoleId;
  const roleDef = roleDefinitions.find((r) => r.id === userRole);

  useEffect(() => { if (orgId) loadBilling(orgId); }, [orgId, loadBilling]);

  // Realtime billing sync
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`billing-sync-${orgId}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "subscriptions", filter: `organization_id=eq.${orgId}` }, () => loadBilling(orgId))
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "organizations", filter: `id=eq.${orgId}` }, () => loadBilling(orgId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, loadBilling]);

  // Select nav tree based on industry
  const { isCare } = useIndustryLexicon();
  const rawNav = isCare ? CARE_NAV : TRADES_NAV;
  const filteredNav = useFilteredNav(rawNav);
  const { openGroups, toggle } = useAccordionState(filteredNav, pathname);
  const badgeCounts = useBadgeCounts();

  const isActive = useCallback(
    (href: string) => {
      if (href === "/dashboard") return pathname === "/dashboard";
      if (href === "/dashboard/care") return pathname === "/dashboard/care";
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname],
  );

  useEffect(() => { setMobileSidebarOpen(false); }, [pathname, setMobileSidebarOpen]);

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
        className={`fixed top-0 left-0 z-50 flex h-screen flex-col border-r transition-transform duration-200 md:z-30 md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          width: sidebarCollapsed ? 64 : 220,
          background: "var(--surface-0)",
          borderColor: "var(--border-base)",
          paddingTop: typeof window !== "undefined" && (window as any).iworkr ? 6 : 0,
        }}
      >
        {/* macOS traffic light spacer */}
        {typeof window !== "undefined" && (window as any).iworkr && navigator.platform?.includes("Mac") && (
          <div className="h-[30px] w-full shrink-0" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} />
        )}

        {/* ── iWorkr Logo ── */}
        {sidebarCollapsed ? (
          <div className="flex items-center justify-center px-3 pt-3.5 pb-0.5">
            <img
              src="/logos/logo-dark-streamline.png"
              alt="iWorkr"
              style={{ width: 30, height: 30 }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex items-center px-[18px] pt-3.5 pb-0.5">
            <img
              src="/logos/logo-dark-full.png"
              alt="iWorkr"
              style={{ height: 30, width: "auto" }}
              draggable={false}
            />
          </div>
        )}

        {/* ── Workspace Switcher ── */}
        <WorkspaceSwitcherNew collapsed={sidebarCollapsed} />

        {/* ── Search Bar (Cmd+K) ── */}
        {!sidebarCollapsed ? (
          <div className="px-3 pb-1">
            <button
              onClick={() => useShellStore.getState().setCommandMenuOpen(true)}
              className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-[5px] text-[13px] text-zinc-600 transition-colors hover:border-white/[0.1] hover:bg-white/[0.04]"
            >
              <Search size={14} strokeWidth={1.5} className="shrink-0" />
              <span className="flex-1 text-left">Find...</span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-[1px] font-mono text-[10px] text-zinc-600">⌘K</kbd>
            </button>
          </div>
        ) : (
          <div className="px-3 pb-1">
            <button
              onClick={() => useShellStore.getState().setCommandMenuOpen(true)}
              title="Search (⌘K)"
              className="flex w-full items-center justify-center rounded-md py-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
            >
              <Search size={16} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* ── Navigation Tree ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-none px-2">
          <div className="space-y-[1px] py-0.5">
            {filteredNav.map((group) => {
              // Top-level link (no children)
              if (group.href && !group.children) {
                return (
                  <TopLevelLink
                    key={group.id}
                    group={group}
                    active={isActive(group.href)}
                    collapsed={sidebarCollapsed}
                    badgeCount={badgeCounts[group.id]}
                  />
                );
              }

              // Collapsible group
              if (group.children) {
                return (
                  <CollapsibleGroup
                    key={group.id}
                    group={group}
                    isOpen={openGroups.has(group.id)}
                    onToggle={() => toggle(group.id)}
                    pathname={pathname}
                    collapsed={sidebarCollapsed}
                    badgeCounts={badgeCounts}
                    isFree={isFree}
                  />
                );
              }

              return null;
            })}
          </div>
        </nav>

        {/* ── System Tray ── */}
        <div className="border-t border-white/[0.06] px-2 py-1.5">
          <div className="space-y-[1px]">
            <SystemLink label="Get App" icon={Smartphone} collapsed={sidebarCollapsed} href="/dashboard/get-app" active={pathname.startsWith("/dashboard/get-app")} />
            {roleDef?.scopes.canManageTeam && (
              <SystemLink label="Invite Team" icon={UserPlus} collapsed={sidebarCollapsed} onClick={() => setInviteModalOpen(true)} />
            )}
            <SystemLink label="Settings" icon={Settings} collapsed={sidebarCollapsed} href="/settings" active={pathname.startsWith("/settings")} />
          </div>
        </div>

        {/* ── Footer — Profile ── */}
        <ProfileFooter collapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />
      </motion.aside>
    </>
  );
}

/* ── Workspace Switcher (Top) ────────────────────────────── */

function WorkspaceSwitcher({ companyName, logoUrl, collapsed }: { companyName: string; logoUrl: string | undefined | null; collapsed: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (collapsed) {
    return (
      <div className="px-3 pt-3 pb-1 flex justify-center">
        <button onClick={() => setOpen((p) => !p)} className="flex h-7 w-7 items-center justify-center rounded-md overflow-hidden transition-colors hover:bg-white/[0.04]" title={companyName}>
          <img src={logoUrl || "/logos/logo-dark-streamline.png"} alt="Logo" className={`h-5 w-5 object-contain ${logoUrl ? "" : "brightness-150"}`} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 pt-3 pb-1">
      <button onClick={() => setOpen((p) => !p)} className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-white/[0.04]">
        <img src={logoUrl || "/logos/logo-dark-streamline.png"} alt="Logo" className={`h-5 w-5 shrink-0 rounded object-contain ${logoUrl ? "" : "brightness-150"}`} />
        <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{companyName || <Shimmer className="h-3 w-24" />}</span>
        <ChevronsUpDown size={12} className="ml-auto shrink-0 text-zinc-600" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-3 right-3 z-50 mt-1 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
              <img src={logoUrl || "/logos/logo-dark-streamline.png"} alt="" className={`h-7 w-7 shrink-0 rounded object-contain ${logoUrl ? "" : "brightness-150"}`} />
              <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium text-zinc-200">{companyName}</p></div>
            </div>
            <div className="py-1">
              {[
                { label: "Workspace Settings", icon: Settings, href: "/settings/workspace" },
                { label: "Branding", icon: Settings, href: "/settings/branding" },
                { label: "Communications", icon: Settings, href: "/dashboard/settings/communications" },
                { label: "Members", icon: Users, href: "/dashboard/team" },
              ].map((item) => (
                <button key={item.label} onClick={() => { setOpen(false); router.push(item.href); }} className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200">
                  <item.icon size={14} strokeWidth={1.5} /><span>{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Profile Footer (Bottom) ─────────────────────────────── */

function ProfileFooter({ collapsed, toggleSidebar }: { collapsed: boolean; toggleSidebar: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut } = useAuthStore();
  const profile = useAuthStore((s) => s.profile);
  const displayName = profile?.full_name || "";
  const displayEmail = profile?.email || "";
  const avatarUrl = profile?.avatar_url;
  const avatarName = displayName || displayEmail || "?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const avatar = <LetterAvatar name={avatarName} src={avatarUrl} size={24} ring />;

  if (collapsed) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2 flex flex-col items-center gap-1.5">
        <button onClick={() => setOpen((p) => !p)} title={displayName || displayEmail}>{avatar}</button>
        <button onClick={toggleSidebar} title="Expand sidebar (⌘[)" className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400">
          <PanelLeftOpen size={14} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative border-t border-white/[0.06] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((p) => !p)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04]">
          {avatar}
          <span className="truncate text-[12px] text-zinc-400">{displayName || displayEmail}</span>
        </button>
        <button onClick={toggleSidebar} title="Collapse sidebar (⌘[)" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400">
          <PanelLeftClose size={14} strokeWidth={1.5} />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-2 right-2 z-50 mb-1.5 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_-16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
              {avatar}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-zinc-200">{displayName}</p>
                <p className="truncate text-[10px] text-zinc-600">{displayEmail}</p>
              </div>
            </div>
            <div className="py-1">
              {[
                { label: "Profile", icon: UserCircle, href: "/settings/profile" },
                { label: "Preferences", icon: Settings, href: "/settings/preferences" },
              ].map((item) => (
                <button key={item.label} onClick={() => { setOpen(false); router.push(item.href); }} className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200">
                  <item.icon size={14} strokeWidth={1.5} /><span>{item.label}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-white/[0.06]" />
              <button onClick={async () => { setOpen(false); await signOut(); router.push("/"); }} className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-red-400 transition-colors hover:bg-red-500/10">
                <LogOut size={14} strokeWidth={1.5} /><span>Log out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
