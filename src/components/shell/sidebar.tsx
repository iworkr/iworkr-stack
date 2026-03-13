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
  HelpCircle,
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
  Zap,
  Package,
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
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
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

/* ── Types ─────────────────────────────────────────────── */

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  shortcut?: string;
  badge?: "PRO";
  hasSubmenu?: boolean;
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

/* ── Navigation Data ──────────────────────────────────── */

const tradesNavItems: NavItem[] = [
  { id: "nav_dashboard", label: "Overview", icon: LayoutDashboard, href: "/dashboard", shortcut: "G D" },
  { id: "nav_jobs", label: "Jobs", icon: Briefcase, href: "/dashboard/jobs", shortcut: "G J" },
  { id: "nav_schedule", label: "Schedule", icon: Calendar, href: "/dashboard/schedule", shortcut: "G S" },
  { id: "nav_dispatch", label: "Dispatch", icon: Map, href: "/dashboard/dispatch", shortcut: "G P" },
  { id: "nav_clients", label: "Clients", icon: Users, href: "/dashboard/clients", shortcut: "G C" },
  { id: "nav_timesheets", label: "Timesheets", icon: Timer, href: "/dashboard/timesheets", shortcut: "G Y" },
  { id: "nav_invoices", label: "Finance", icon: Banknote, href: "/dashboard/finance", shortcut: "G F" },
  { id: "nav_inbox", label: "Messages", icon: Inbox, href: "/dashboard/inbox", shortcut: "G I" },
  { id: "nav_crm", label: "Sales Pipeline", icon: Workflow, href: "/dashboard/crm", shortcut: "G R" },
  { id: "nav_assets", label: "Assets", icon: Warehouse, href: "/dashboard/assets", shortcut: "G A" },
  { id: "nav_forms", label: "Forms", icon: FileText, href: "/dashboard/forms" },
  { id: "nav_team", label: "Team", icon: UsersRound, href: "/dashboard/team", shortcut: "G T" },
  { id: "nav_automations", label: "Automations", icon: Workflow, href: "/dashboard/automations", shortcut: "G W" },
  { id: "nav_integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations" },
  { id: "nav_ai_agent", label: "AI Agent", icon: Bot, href: "/dashboard/ai-agent" },
];

function useCareNavSections(): NavSection[] {
  const { t, isCare } = useIndustryLexicon();

  if (!isCare) {
    return [{
      label: null,
      items: tradesNavItems.map((item) => ({ ...item, label: t(item.label) })),
    }];
  }

  return [
    {
      label: null,
      items: [
        { id: "nav_dashboard", label: "Overview", icon: LayoutGrid, href: "/dashboard/care", shortcut: "G D" },
        { id: "nav_clients", label: "Participants", icon: Heart, href: "/dashboard/care/participants", shortcut: "G C" },
        { id: "nav_schedule", label: "Roster", icon: Calendar, href: "/dashboard/schedule", shortcut: "G S" },
        { id: "nav_master_roster", label: "Master Roster", icon: CalendarClock, href: "/dashboard/roster/master" },
        { id: "nav_jobs", label: "Shifts", icon: Briefcase, href: "/dashboard/jobs", shortcut: "G J" },
        { id: "nav_care_comms", label: "Care Comms", icon: MessageSquare, href: "/dashboard/care/comms", shortcut: "G I" },
      ],
    },
    {
      label: null,
      items: [
        { id: "nav_shift_notes", label: "Shift Notes", icon: ClipboardList, href: "/dashboard/care/progress-notes" },
        { id: "nav_care_plans", label: "Care Plans", icon: BookOpen, href: "/dashboard/care/plans" },
        { id: "nav_medications", label: "Medications", icon: Pill, href: "/dashboard/care/medications" },
        { id: "nav_observations", label: "Observations", icon: Stethoscope, href: "/dashboard/care/observations" },
        { id: "nav_incidents", label: "Incidents", icon: AlertOctagon, href: "/dashboard/care/incidents" },
        { id: "nav_behaviour", label: "Behaviour & Safety", icon: ShieldAlert, href: "/dashboard/care/behaviour" },
        { id: "nav_care_command", label: "Clinical Timeline", icon: Activity, href: "/dashboard/care/clinical-timeline" },
      ],
    },
    {
      label: null,
      items: [
        { id: "nav_funding", label: "Funding & Claims", icon: DollarSign, href: "/dashboard/care/funding-engine" },
        { id: "nav_timesheets", label: "Timesheets", icon: Timer, href: "/dashboard/timesheets", shortcut: "G Y" },
        { id: "nav_invoices", label: "Finance", icon: Banknote, href: "/dashboard/finance", shortcut: "G F" },
        { id: "nav_compliance", label: "Compliance", icon: ShieldCheck, href: "/dashboard/care/compliance-hub" },
        { id: "nav_quality", label: "Quality & CI", icon: Lightbulb, href: "/dashboard/care/quality" },
        { id: "nav_team", label: "Support Team", icon: UserCircle, href: "/dashboard/team", shortcut: "G T" },
      ],
    },
    {
      label: null,
      items: [
        { id: "nav_forms", label: "Forms", icon: FileText, href: "/dashboard/forms" },
        { id: "nav_automations", label: "Automations", icon: Zap, href: "/dashboard/automations", badge: "PRO" },
        { id: "nav_integrations", label: "Integrations", icon: Plug, href: "/dashboard/integrations", badge: "PRO" },
        { id: "nav_ai_agent", label: "AI Agent", icon: Bot, href: "/dashboard/ai-agent" },
      ],
    },
  ];
}

function useTranslatedNavItems() {
  const sections = useCareNavSections();
  return sections.flatMap((s) => s.items);
}

/* ── Nav Link ─────────────────────────────────────────── */

function NavLink({
  item,
  active,
  collapsed,
  badge,
  proBadge,
}: {
  item: NavItem;
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
      data-testid={item.id}
      data-nav-label={item.label}
      className={`group relative flex items-center gap-2.5 rounded-md px-2 py-[6px] transition-all duration-100 ${
        collapsed ? "justify-center" : ""
      } ${
        active
          ? "bg-white/[0.06] text-[var(--text-primary)]"
          : "text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon
        size={16}
        strokeWidth={1.5}
        className={`shrink-0 ${active ? "text-[var(--text-primary)]" : ""}`}
      />

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.12 }}
            className="flex flex-1 items-center justify-between overflow-hidden text-[13px]"
          >
            <span className={active ? "font-medium" : "font-normal"}>{item.label}</span>
            <span className="flex items-center gap-1.5">
              {proBadge && <ProBadge size="xs" />}
              {badge !== undefined && badge > 0 && (
                <span className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--brand)]/15 px-1 font-mono text-[9px] font-medium text-[var(--brand)]">
                  {badge}
                </span>
              )}
              {item.hasSubmenu && (
                <ChevronRight size={12} className="text-zinc-600" />
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

/* ── System Tray Link ─────────────────────────────────── */

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
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="flex flex-1 items-center justify-between"
          >
            <span>{label}</span>
            {(label === "Settings" || label === "Help") && (
              <ChevronRight size={12} className="text-zinc-600" />
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </>
  );

  if (onClick) {
    return <button title={collapsed ? label : undefined} className={cls} onClick={onClick}>{content}</button>;
  }
  if (href) {
    return <Link title={collapsed ? label : undefined} href={href} className={cls}>{content}</Link>;
  }
  return null;
}

/* ── Main Sidebar ─────────────────────────────────────── */

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

  useEffect(() => {
    if (orgId) loadBilling(orgId);
  }, [orgId, loadBilling]);

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

  const membership = useAuthStore((s) => s.currentMembership);
  const userRole = (membership?.role ?? "technician") as RoleId;
  const roleDef = roleDefinitions.find((r) => r.id === userRole);
  const navModuleMap: Record<string, PermissionModule> = {
    nav_invoices: "finance",
    nav_funding: "finance",
    nav_team: "team",
    nav_automations: "integrations",
    nav_integrations: "integrations",
    nav_ai_agent: "integrations",
  };

  const { t: sidebarT } = useIndustryLexicon();
  const navSections = useCareNavSections();
  const translatedNavItems = useTranslatedNavItems();
  const visibleNavItems = translatedNavItems.filter((item) => {
    const module = navModuleMap[item.id];
    if (!module) return true;
    return roleDef?.permissions[module]?.includes("view") ?? false;
  });
  const visibleIds = new Set(visibleNavItems.map((i) => i.id));
  const filteredSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((i) => visibleIds.has(i.id)),
  })).filter((s) => s.items.length > 0);

  const unreadCount = useInboxStore((s) => s.items.filter(i => !i.read && !i.archived).length);

  const isActive = useCallback((href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/care") return pathname === "/dashboard/care";
    return pathname.startsWith(href);
  }, [pathname]);

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

        {/* ── Workspace Switcher (top) ── */}
        <WorkspaceSwitcher
          companyName={companyName}
          logoUrl={brandingLogo}
          collapsed={sidebarCollapsed}
        />

        {/* ── Search Bar ── */}
        {!sidebarCollapsed ? (
          <div className="px-3 pb-1">
            <button
              onClick={() => useShellStore.getState().setCommandMenuOpen(true)}
              className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-[5px] text-[13px] text-zinc-600 transition-colors hover:border-white/[0.1] hover:bg-white/[0.04]"
            >
              <Search size={14} strokeWidth={1.5} className="shrink-0" />
              <span className="flex-1 text-left">Find...</span>
              <kbd className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-[1px] font-mono text-[10px] text-zinc-600">
                ⌘K
              </kbd>
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

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-none px-2">
          {filteredSections.map((section, sIdx) => (
            <div key={sIdx}>
              {/* Separator between sections — thin line, no labels */}
              {sIdx > 0 && (
                <div className="mx-1 my-1.5 h-px bg-white/[0.06]" />
              )}
              <div className="space-y-[1px]">
                {section.items.map((item) => (
                  <NavLink
                    key={item.id}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={sidebarCollapsed}
                    badge={item.id === "nav_inbox" ? unreadCount : undefined}
                    proBadge={(isFree && item.badge === "PRO") || false}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── System Tray ── */}
        <div className="border-t border-white/[0.06] px-2 py-1.5">
          <div className="space-y-[1px]">
            <SystemLink
              label="Get App"
              icon={Smartphone}
              collapsed={sidebarCollapsed}
              href="/dashboard/get-app"
              active={pathname.startsWith("/dashboard/get-app")}
            />
            {roleDef?.scopes.canManageTeam && (
              <SystemLink
                label="Invite Team"
                icon={UserPlus}
                collapsed={sidebarCollapsed}
                onClick={() => setInviteModalOpen(true)}
              />
            )}
            <SystemLink
              label="Settings"
              icon={Settings}
              collapsed={sidebarCollapsed}
              href="/settings"
              active={pathname.startsWith("/settings")}
            />
          </div>
        </div>

        {/* ── Footer — Profile ── */}
        <ProfileFooter
          collapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
        />
      </motion.aside>
    </>
  );
}

/* ── Workspace Switcher (Top) ─────────────────────────── */

function WorkspaceSwitcher({
  companyName,
  logoUrl,
  collapsed,
}: {
  companyName: string;
  logoUrl: string | undefined | null;
  collapsed: boolean;
}) {
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
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex h-7 w-7 items-center justify-center rounded-md overflow-hidden transition-colors hover:bg-white/[0.04]"
          title={companyName}
        >
          <img
            src={logoUrl || "/logos/logo-dark-streamline.png"}
            alt="Logo"
            className={`h-5 w-5 object-contain ${logoUrl ? "" : "brightness-150"}`}
          />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 pt-3 pb-1">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-white/[0.04]"
      >
        <img
          src={logoUrl || "/logos/logo-dark-streamline.png"}
          alt="Logo"
          className={`h-5 w-5 shrink-0 rounded object-contain ${logoUrl ? "" : "brightness-150"}`}
        />
        <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
          {companyName || <Shimmer className="h-3 w-24" />}
        </span>
        <ChevronsUpDown size={12} className="ml-auto shrink-0 text-zinc-600" />
      </button>

      {/* Dropdown — opens downward */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-3 right-3 z-50 mt-1 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            {/* Active workspace */}
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
              <img
                src={logoUrl || "/logos/logo-dark-streamline.png"}
                alt=""
                className={`h-7 w-7 shrink-0 rounded object-contain ${logoUrl ? "" : "brightness-150"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-zinc-200">{companyName}</p>
              </div>
            </div>

            <div className="py-1">
              {[
                { label: "Workspace Settings", icon: Settings, href: "/settings/workspace" },
                { label: "Branding", icon: Settings, href: "/settings/branding" },
                { label: "Members", icon: Users, href: "/dashboard/team" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => { setOpen(false); router.push(item.href); }}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  <item.icon size={14} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Profile Footer (Bottom) ─────────────────────────── */

function ProfileFooter({
  collapsed,
  toggleSidebar,
}: {
  collapsed: boolean;
  toggleSidebar: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut } = useAuthStore();
  const profile = useAuthStore((s) => s.profile);
  const displayName = profile?.full_name || "";
  const displayEmail = profile?.email || "";
  const avatarUrl = profile?.avatar_url;
  const initials = displayName
    ? displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : displayEmail?.[0]?.toUpperCase() || "?";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const avatar = (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400 ring-1 ring-white/[0.08]">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </div>
  );

  if (collapsed) {
    return (
      <div className="border-t border-white/[0.06] px-3 py-2 flex flex-col items-center gap-1.5">
        <button onClick={() => setOpen((p) => !p)} title={displayName || displayEmail}>
          {avatar}
        </button>
        <button
          onClick={toggleSidebar}
          title="Expand sidebar (⌘[)"
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
        >
          <PanelLeftOpen size={14} strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative border-t border-white/[0.06] px-2 py-1.5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04]"
        >
          {avatar}
          <span className="truncate text-[12px] text-zinc-400">{displayName || displayEmail}</span>
        </button>
        <button
          onClick={toggleSidebar}
          title="Collapse sidebar (⌘[)"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
        >
          <PanelLeftClose size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Dropdown — opens upward */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full left-2 right-2 z-50 mb-1.5 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_-16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            {/* User info */}
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
                <button
                  key={item.label}
                  onClick={() => { setOpen(false); router.push(item.href); }}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  <item.icon size={14} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              ))}
              <div className="my-1 h-px bg-white/[0.06]" />
              <button
                onClick={async () => { setOpen(false); await signOut(); router.push("/"); }}
                className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut size={14} strokeWidth={1.5} />
                <span>Log out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
