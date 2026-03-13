"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Menu,
  Settings,
  LogOut,
  Check,
  ChevronDown,
  Sun,
  User,
  Shield,
  CreditCard,
  Keyboard,
  Building2,
  Plus,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useAuthStore } from "@/lib/auth-store";
import { useInboxStore } from "@/lib/inbox-store";
import { Shimmer } from "@/components/ui/shimmer";
import { DesktopUpdateIndicator } from "@/lib/desktop/desktop-update-indicator";
import { translateLabel, type IndustryType } from "@/lib/industry-lexicon";
import { getBranches, type Branch } from "@/app/actions/branches";
import { useOrg } from "@/lib/hooks/use-org";

/* ── Breadcrumbs ─────────────────────────────────────── */

function getBreadcrumbs(pathname: string, branchName: string, industryType: IndustryType = "trades") {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];

  const t = (key: string) => translateLabel(key, industryType);

  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",
    inbox: "Inbox",
    messages: "Messages",
    jobs: t("My Jobs"),
    schedule: t("Schedule"),
    clients: t("Clients"),
    finance: "Finance",
    settings: "Settings",
    assets: "Assets",
    forms: "Forms",
    team: t("Team"),
    automations: "Automations",
    integrations: "Integrations",
    dispatch: t("Dispatch"),
    crm: t("Sales Pipeline"),
    credentials: "Credentials",
    care: "Care",
    medications: "Medications",
    incidents: "Incidents",
    observations: "Observations",
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === "dashboard" && i === 0) {
      // Skip "dashboard" — the branch name already anchors it
    } else if (labelMap[seg]) {
      crumbs.push({
        label: labelMap[seg],
        href: "/" + segments.slice(0, i + 1).join("/"),
      });
    }
  }

  return crumbs;
}

/* ── Branch Selector ─────────────────────────────────── */

function BranchSelector({
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
  const { orgId } = useOrg();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load branches
  useEffect(() => {
    if (!orgId) return;
    getBranches(orgId).then(({ data }) => {
      setBranches(data || []);
      setLoaded(true);
      // Default to HQ or first branch
      if (data && data.length > 0) {
        const stored = localStorage.getItem("iworkr-active-branch");
        const match = data.find((b) => b.id === stored);
        setActiveBranchId(match?.id || data.find((b) => b.is_headquarters)?.id || data[0].id);
      }
    });
  }, [orgId]);

  // Outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const activeName = activeBranch?.name || (branches.length === 0 && loaded ? "No branches" : "");

  function selectBranch(id: string) {
    setActiveBranchId(id);
    localStorage.setItem("iworkr-active-branch", id);
    onClose();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.06]">
          <Building2 size={12} strokeWidth={1.5} className="text-zinc-400" />
        </div>
        <span className="hidden text-[13px] font-medium text-[var(--text-primary)] sm:inline">
          {activeName || <Shimmer className="h-3 w-20" />}
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
            className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
              <span className="text-[11px] font-medium text-zinc-500">Branches</span>
              <button
                onClick={() => {
                  onClose();
                  router.push("/settings/branches");
                }}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-400"
              >
                Manage
              </button>
            </div>

            {/* Branch list */}
            <div className="max-h-[240px] overflow-y-auto py-1">
              {branches.length === 0 && loaded && (
                <div className="flex flex-col items-center py-6">
                  <Building2 size={16} className="mb-1.5 text-zinc-700" />
                  <p className="text-[11px] text-zinc-600">No branches configured</p>
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/settings/branches");
                    }}
                    className="mt-2 text-[11px] text-[var(--brand)] hover:underline"
                  >
                    Add your first branch
                  </button>
                </div>
              )}
              {branches.map((b) => {
                const isActive = b.id === activeBranchId;
                const location = [b.city, b.state].filter(Boolean).join(", ");
                return (
                  <button
                    key={b.id}
                    onClick={() => selectBranch(b.id)}
                    className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors ${
                      isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      b.is_headquarters ? "bg-[var(--brand)]/10" : "bg-white/[0.04]"
                    }`}>
                      <Building2 size={13} className={b.is_headquarters ? "text-[var(--brand)]" : "text-zinc-500"} />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-medium text-zinc-200">{b.name}</span>
                        {b.is_headquarters && (
                          <span className="shrink-0 rounded bg-[var(--brand)]/10 px-1 py-[1px] text-[8px] font-bold text-[var(--brand)]">HQ</span>
                        )}
                      </div>
                      {location && (
                        <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                          <MapPin size={8} />
                          {location}
                        </span>
                      )}
                    </div>
                    {isActive && <Check size={12} className="shrink-0 text-[var(--brand)]" />}
                  </button>
                );
              })}
            </div>

            {/* Add branch */}
            {branches.length > 0 && (
              <>
                <div className="h-px bg-white/[0.06]" />
                <div className="p-1">
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/settings/branches");
                    }}
                    className="mx-0 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                  >
                    <Plus size={12} />
                    Add branch
                  </button>
                </div>
              </>
            )}
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
  const items = useInboxStore((s) => s.items);
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
        whileTap={{ scale: 0.96 }}
        onClick={onToggle}
        className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
      >
        <Bell size={14} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--brand)] ring-1 ring-black" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <span className="text-[12px] font-medium text-zinc-300">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--brand)]/12 px-1.5 py-0.5 text-[9px] font-medium text-[var(--brand)]">
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
              <div className="max-h-[300px] divide-y divide-white/[0.04] overflow-y-auto">
                {unreadItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onClose(); router.push("/dashboard/inbox"); }}
                    className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-[11px] font-medium text-zinc-300">{item.sender}</span>
                        <span className="shrink-0 text-[9px] text-zinc-700">{item.time}</span>
                      </div>
                      <p className="truncate text-[10px] text-zinc-600">{item.body}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-white/[0.06] p-2">
              <button
                onClick={() => { onClose(); router.push("/dashboard/inbox"); }}
                className="w-full rounded-md py-1.5 text-center text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
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
  const avatarUrl = profile?.avatar_url;
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
        className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400 ring-1 ring-white/[0.08] transition-all duration-150 hover:ring-white/[0.2]"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : initials ? (
          initials
        ) : (
          <Shimmer className="h-3 w-3 rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            {/* User info */}
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/[0.08]" referrerPolicy="no-referrer" />
              ) : initials ? (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-400 ring-1 ring-white/[0.08]">
                  {initials}
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-zinc-200">
                  {displayName || <Shimmer className="h-3 w-24" />}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                  {displayEmail || <Shimmer className="h-2 w-32" />}
                </p>
              </div>
            </div>

            <div className="py-1">
              {items.map((item, i) => {
                if ("divider" in item) {
                  return <div key={`div-${i}`} className="my-1 h-px bg-white/[0.06]" />;
                }
                const Icon = item.icon;
                const isDanger = item.label === "Log out";
                return (
                  <button
                    key={item.label}
                    onClick={async () => {
                      onClose();
                      if (isDanger) { await signOut(); router.push("/"); }
                      else { router.push(item.href); }
                    }}
                    className={`mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                      isDanger
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
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
  const { setMobileSidebarOpen } = useShellStore();
  const { currentOrg } = useAuthStore();
  const industryType = ((currentOrg as Record<string, unknown> | null)?.industry_type === "care" ? "care" : "trades") as IndustryType;
  const breadcrumbs = getBreadcrumbs(pathname, "", industryType);

  const [branchOpen, setBranchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="relative z-30 flex h-11 shrink-0 items-center border-b px-3 md:px-4" style={{ borderColor: "var(--border-base)", background: "var(--surface-0)" }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="mr-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 md:hidden"
      >
        <Menu size={16} strokeWidth={1.5} />
      </button>

      {/* Branch Selector */}
      <BranchSelector
        open={branchOpen}
        onToggle={() => {
          setNotifOpen(false);
          setProfileOpen(false);
          setBranchOpen((p) => !p);
        }}
        onClose={() => setBranchOpen(false)}
      />

      {/* Breadcrumbs */}
      <nav className="ml-1 flex min-w-0 items-center gap-1 text-[13px]">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href + i} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-zinc-700" />
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
      <div className="flex items-center gap-1">
        {/* Notification Bell */}
        <NotificationsPopover
          open={notifOpen}
          onToggle={() => {
            setBranchOpen(false);
            setProfileOpen(false);
            setNotifOpen((p) => !p);
          }}
          onClose={() => setNotifOpen(false)}
        />

        {/* Profile Menu */}
        <ProfileMenu
          open={profileOpen}
          onToggle={() => {
            setBranchOpen(false);
            setNotifOpen(false);
            setProfileOpen((p) => !p);
          }}
          onClose={() => setProfileOpen(false)}
        />
      </div>
    </header>
  );
}
