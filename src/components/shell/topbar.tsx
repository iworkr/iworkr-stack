"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  ChevronRight,
  Menu,
  Settings,
  Users,
  Download,
  LogOut,
  Check,
  ChevronDown,
  Sun,
  User,
  Shield,
  CreditCard,
  Keyboard,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useAuthStore } from "@/lib/auth-store";
import { useInboxStore } from "@/lib/inbox-store";
import { Shimmer } from "@/components/ui/shimmer";
import { DesktopUpdateIndicator } from "@/lib/desktop/desktop-update-indicator";

function getBreadcrumbs(pathname: string, companyName: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = companyName
    ? [{ label: companyName, href: "/dashboard" }]
    : [];

  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",
    inbox: "Inbox",
    jobs: "My Jobs",
    schedule: "Schedule",
    clients: "Clients",
    finance: "Finance",
    settings: "Settings",
    assets: "Assets",
    forms: "Forms",
    team: "Team",
    automations: "Automations",
    integrations: "Integrations",
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === "dashboard" && i === 0) {
      crumbs.push({ label: "Dashboard", href: "/dashboard" });
    } else if (labelMap[seg]) {
      crumbs.push({
        label: labelMap[seg],
        href: "/" + segments.slice(0, i + 1).join("/"),
      });
    }
  }

  return crumbs;
}

/* ── Workspace Dropdown (Linear-style) ─────────────────── */

function WorkspaceDropdown({
  companyName,
  open,
  onToggle,
  onClose,
}: {
  companyName: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const { signOut: authSignOut } = useAuthStore();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  const menuItems = [
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Members", icon: Users, href: "/dashboard/team" },
    { label: "Download App", icon: Download, href: "/#download" },
    { divider: true },
    { label: "Log out", icon: LogOut, href: "/" },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
      >
        <img
          src="/logos/logo-dark-streamline.png"
          alt="iWorkr"
          className="h-[18px] w-[18px] object-contain"
        />
        <span className="hidden text-[13px] font-medium text-zinc-300 sm:inline">
          {companyName || <Shimmer className="h-3 w-20" />}
        </span>
        <ChevronDown size={11} className="text-zinc-600" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#161616] py-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            {/* Active workspace */}
            <div className="mx-1 mb-1 flex items-center gap-2 rounded-md bg-[rgba(255,255,255,0.04)] px-2.5 py-2">
              <img
                src="/logos/logo-dark-streamline.png"
                alt="iWorkr"
                className="h-4 w-4 object-contain"
              />
              <span className="flex-1 truncate text-[12px] font-medium text-zinc-200">
                {companyName || <Shimmer className="h-3 w-24" />}
              </span>
              <Check size={12} className="text-[#00E676]" />
            </div>

            <div className="my-1 h-px bg-[rgba(255,255,255,0.06)]" />

            {menuItems.map((item, i) => {
              if ("divider" in item) {
                return (
                  <div
                    key={`div-${i}`}
                    className="my-1 h-px bg-[rgba(255,255,255,0.06)]"
                  />
                );
              }
              const Icon = item.icon;
              const isDanger = item.label === "Log out";
              return (
                <button
                  key={item.label}
                  onClick={async () => {
                    onClose();
                    if (isDanger) {
                      await authSignOut();
                      router.push("/");
                    } else {
                      router.push(item.href);
                    }
                  }}
                  className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                    isDanger
                      ? "text-red-400 hover:bg-red-500/10"
                      : "text-zinc-400 hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-200"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Notifications Popover ──────────────────────────────── */

function NotificationsPopover({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { items } = useInboxStore();
  const unreadItems = items.filter((i) => !i.read && !i.archived).slice(0, 4);
  const unreadCount = items.filter((i) => !i.read && !i.archived).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={onToggle}
        className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
      >
        <Bell size={14} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[#00E676] ring-1 ring-black" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5">
              <span className="text-[12px] font-medium text-zinc-300">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[rgba(0,230,118,0.12)] px-1.5 py-0.5 text-[9px] font-medium text-[#00E676]">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadItems.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/5"
                >
                  <Sun size={16} className="text-amber-400/60" />
                </motion.div>
                <p className="text-[12px] text-zinc-500">No new notifications</p>
                <p className="mt-0.5 text-[10px] text-zinc-700">You&apos;re all caught up.</p>
              </div>
            ) : (
              <div className="max-h-[300px] divide-y divide-[rgba(255,255,255,0.04)] overflow-y-auto">
                {unreadItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onClose();
                      router.push("/dashboard/inbox");
                    }}
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00E676]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[11px] font-medium text-zinc-300">
                          {item.sender}
                        </span>
                        <span className="shrink-0 text-[9px] text-zinc-700">{item.time}</span>
                      </div>
                      <p className="truncate text-[10px] text-zinc-600">{item.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-[rgba(255,255,255,0.06)] p-2">
              <button
                onClick={() => {
                  onClose();
                  router.push("/dashboard/inbox");
                }}
                className="w-full rounded-md py-1.5 text-center text-[11px] text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
              >
                View all notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Profile Menu ────────────────────────────────────────── */

function ProfileMenu({
  open,
  onToggle,
  onClose,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const displayName = profile?.full_name || "";
  const displayEmail = profile?.email || "";
  const initials = displayName
    ? displayName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  const items = [
    { label: "Profile", icon: User, href: "/settings/profile" },
    { label: "Preferences", icon: Settings, href: "/settings/preferences" },
    { label: "Security", icon: Shield, href: "/settings/security" },
    { label: "Billing", icon: CreditCard, href: "/settings" },
    { label: "Keyboard Shortcuts", icon: Keyboard, href: "/settings" },
    { divider: true },
    { label: "Log out", icon: LogOut, href: "/" },
  ] as const;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400 ring-1 ring-[rgba(255,255,255,0.08)] transition-all duration-150 hover:ring-[rgba(255,255,255,0.2)]"
      >
        {initials || <Shimmer className="h-3 w-3 rounded-full" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            {/* User info */}
            <div className="border-b border-[rgba(255,255,255,0.06)] px-3 py-2.5">
              <p className="text-[12px] font-medium text-zinc-200">
                {displayName || <Shimmer className="h-3 w-24" />}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {displayEmail || <Shimmer className="h-2 w-32" />}
              </p>
            </div>

            <div className="py-1">
              {items.map((item, i) => {
                if ("divider" in item) {
                  return (
                    <div
                      key={`div-${i}`}
                      className="my-1 h-px bg-[rgba(255,255,255,0.06)]"
                    />
                  );
                }
                const Icon = item.icon;
                const isDanger = item.label === "Log out";
                return (
                  <button
                    key={item.label}
                    onClick={async () => {
                      onClose();
                      if (isDanger) {
                        await signOut();
                        router.push("/");
                      } else {
                        router.push(item.href);
                      }
                    }}
                    className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                      isDanger
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-zinc-400 hover:bg-[rgba(255,255,255,0.05)] hover:text-zinc-200"
                    }`}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Topbar ─────────────────────────────────────────── */

export function Topbar() {
  const pathname = usePathname();
  const { setCommandMenuOpen, setMobileSidebarOpen } = useShellStore();
  const onboardingName = useOnboardingStore((s) => s.companyName);
  const { currentOrg } = useAuthStore();
  const companyName = currentOrg?.name || onboardingName || "";
  const breadcrumbs = getBreadcrumbs(pathname, companyName);

  const [wsOpen, setWsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const closeAll = useCallback(() => {
    setWsOpen(false);
    setNotifOpen(false);
    setProfileOpen(false);
  }, []);

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center border-b border-white/[0.05] bg-[#050505]/80 px-3 backdrop-blur-xl md:px-4">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="mr-2 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300 md:hidden"
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {/* Workspace Dropdown */}
      <WorkspaceDropdown
        companyName={companyName}
        open={wsOpen}
        onToggle={() => {
          setNotifOpen(false);
          setProfileOpen(false);
          setWsOpen((p) => !p);
        }}
        onClose={() => setWsOpen(false)}
      />

      {/* Breadcrumbs */}
      <nav className="ml-1 flex min-w-0 items-center gap-1 text-[13px]">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href + i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} className="text-zinc-700" />}
            <Link
              href={crumb.href}
              className={`transition-colors duration-150 ${
                i === breadcrumbs.length - 1
                  ? "font-medium text-zinc-300"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {crumb.label}
            </Link>
          </span>
        ))}
      </nav>

      {/* Desktop update indicator */}
      {typeof window !== "undefined" && (window as any).iworkr && (
        <DesktopUpdateIndicator />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-1.5">
        {/* Command Search Trigger — minimal, borderless */}
        <button
          onClick={() => setCommandMenuOpen(true)}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-zinc-600 transition-all duration-200 hover:bg-white/[0.03] hover:text-zinc-400"
        >
          <Search size={14} strokeWidth={1.5} />
          <span className="hidden text-zinc-700 sm:inline">Search...</span>
          <kbd className="hidden font-mono text-[9px] text-zinc-700 sm:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Notification Bell */}
        <NotificationsPopover
          open={notifOpen}
          onToggle={() => {
            setWsOpen(false);
            setProfileOpen(false);
            setNotifOpen((p) => !p);
          }}
          onClose={() => setNotifOpen(false)}
        />

        {/* Profile Menu */}
        <ProfileMenu
          open={profileOpen}
          onToggle={() => {
            setWsOpen(false);
            setNotifOpen(false);
            setProfileOpen((p) => !p);
          }}
          onClose={() => setProfileOpen(false)}
        />
      </div>
    </header>
  );
}
