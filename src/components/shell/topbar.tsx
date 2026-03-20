"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Activity,
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
  AtSign,
  Clock,
  Megaphone,
  Briefcase,
  DollarSign,
  CheckCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShellStore } from "@/lib/shell-store";
import { useAuthStore } from "@/lib/auth-store";
import { useInboxStore } from "@/lib/inbox-store";
import { Shimmer } from "@/components/ui/shimmer";
import { DesktopUpdateIndicator } from "@/lib/desktop/desktop-update-indicator";
import { translateLabel, type IndustryType } from "@/lib/industry-lexicon";
import { LetterAvatar } from "@/components/ui/letter-avatar";
import { getBranches, type Branch } from "@/app/actions/branches";
import { useOrg } from "@/lib/hooks/use-org";
import { useActiveBranch, setActiveBranchId as setGlobalBranch } from "@/lib/hooks/use-active-branch";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { markAllRead } from "@/app/actions/notifications";
import { useToastStore } from "@/components/shell/notification-toast";

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
    coordination: "Coordination",
    ledger: "Ledger",
    sil: "SIL",
    quoting: "Quoting",
    variance: "Variance",
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
    governance: "Governance",
    compliance: "Compliance",
    policies: "Policies",
    fleet: "Fleet",
    vehicles: "Vehicles",
    overview: "Overview",
    plan: "Plan",
    reviews: "Reviews",
    build: "Build",
    training: "Training",
    audits: "Audits",
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
  const [activeBranchId, setActiveBranchId] = useActiveBranch();

  const { data: branches = [], isFetched: loaded } = useQuery<Branch[]>({
    queryKey: ["branches", orgId],
    queryFn: async () => {
      const { data } = await getBranches(orgId!);
      return data || [];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Default to HQ branch if none selected
  useEffect(() => {
    if (branches.length > 0 && !activeBranchId) {
      const hq = branches.find((b) => b.is_headquarters);
      setActiveBranchId(hq?.id || branches[0].id);
    }
  }, [branches, activeBranchId, setActiveBranchId]);

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
    setActiveBranchId(id); // writes to localStorage + dispatches event via unified hook
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

/* ── Notification helpers ────────────────────────────────── */

const NOTIFICATION_TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string }> = {
  mention:      { icon: AtSign,     color: "text-blue-500 bg-blue-500/10" },
  nudge:        { icon: Clock,      color: "text-amber-500 bg-amber-500/10" },
  announcement: { icon: Megaphone,  color: "text-rose-500 bg-rose-500/10" },
  job_assigned: { icon: Briefcase,  color: "text-emerald-500 bg-emerald-500/10" },
  invoice_paid: { icon: DollarSign, color: "text-emerald-500 bg-emerald-500/10" },
  system:       { icon: Bell,       color: "text-zinc-400 bg-zinc-400/10" },
};

function getNotifIcon(type: string) {
  return NOTIFICATION_TYPE_CONFIG[type] || NOTIFICATION_TYPE_CONFIG.system;
}

/** Turn a date string or "2m ago" into a short relative label. */
function relativeTime(input: string): string {
  // If it's already a relative string, return it
  if (/^\d+[smhd]\s?ago$/i.test(input)) return input;

  const date = new Date(input);
  if (isNaN(date.getTime())) return input;

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const addRealtimeItem = useInboxStore((s) => s.addRealtimeItem);
  const userId = useAuthStore((s) => s.profile?.id);
  const displayItems = items.filter((i) => !i.archived).slice(0, 5);
  const unreadCount = items.filter((i) => !i.read && !i.archived).length;
  const [markingAll, setMarkingAll] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  // Outside-click handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  // Realtime subscription
  const handleNewNotification = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      addRealtimeItem(payload);
      // Trigger a toast for the new notification
      const n = payload.new;
      addToast({
        id: (n.id as string) || crypto.randomUUID(),
        type: (n.type as string) || "system",
        title: (n.title as string) || "New notification",
        body: (n.body as string) || "",
        action_url: (n.action_url as string) || undefined,
        created_at: (n.created_at as string) || new Date().toISOString(),
      });
    },
    [addRealtimeItem, addToast],
  );

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const supabase = createClient();
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        handleNewNotification,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, handleNewNotification]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      // Optimistic: mark all items as read in local store
      useInboxStore.setState((s) => ({
        items: s.items.map((i) => ({ ...i, read: true })),
      }));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onToggle}
        className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
      >
        <Bell size={14} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-black" />
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
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-zinc-300">Notifications</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-medium text-emerald-500">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-50"
                >
                  <CheckCheck size={10} />
                  Mark all read
                </button>
              )}
            </div>

            {/* Items list */}
            {displayItems.length === 0 ? (
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
              <div className="max-h-[320px] divide-y divide-white/[0.04] overflow-y-auto">
                {displayItems.map((item) => {
                  const isUnread = !item.read;
                  const config = getNotifIcon(item.type);
                  const Icon = config.icon;
                  const [iconText, iconBg] = config.color.split(" ");

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onClose();
                        router.push("/dashboard/inbox");
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${
                        isUnread ? "bg-white/[0.03]" : ""
                      }`}
                    >
                      {/* Icon */}
                      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
                        <Icon size={13} className={iconText} />
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 truncate text-[11px] font-medium text-zinc-300">
                            {isUnread && (
                              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            )}
                            {item.sender}
                          </span>
                          <span className="shrink-0 text-[9px] text-zinc-600">
                            {relativeTime(item.time)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-zinc-500">{item.body}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer — View all */}
            <div className="border-t border-white/[0.06] p-2">
              <Link
                href="/dashboard/inbox"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-center text-[11px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              >
                View all
                <ChevronRight size={10} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Sync Radar Popover ─────────────────────────────────────── */

type SyncRadarLog = {
  id: string;
  integration_name: string;
  entity_type: string;
  status: string;
  error_message: string | null;
  created_at: string | null;
};

function SyncRadarPopover({
  open,
  orgId,
  onToggle,
  onClose,
}: {
  open: boolean;
  orgId: string | null;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<SyncRadarLog[]>([]);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  useEffect(() => {
    if (!orgId) return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/integrations/sync-radar?orgId=${orgId}&limit=12`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setActiveCount(Number(data.activeCount || 0));
      } catch {
        // Ignore transient polling failures.
      }
    };

    load();
    timer = setInterval(load, 12000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [orgId]);

  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onToggle}
        className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300"
        aria-label="Open sync radar"
      >
        <Activity size={14} strokeWidth={1.7} className={activeCount > 0 ? "text-[var(--brand)]" : ""} />
        {activeCount > 0 && (
          <>
            <span className="absolute inset-0 animate-ping rounded-md border border-[var(--brand)]/50" />
            <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--brand)] ring-1 ring-black" />
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-1.5 w-[22rem] overflow-hidden rounded-lg border border-white/[0.08] bg-[#161616] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <span className="text-[12px] font-medium text-zinc-300">Sync Radar</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  activeCount > 0 ? "bg-[var(--brand)]/12 text-[var(--brand)]" : "bg-white/[0.06] text-zinc-500"
                }`}
              >
                {activeCount > 0 ? `${activeCount} active` : "Idle"}
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <Activity size={16} className="mb-2 text-zinc-700" />
                <p className="text-[12px] text-zinc-500">No recent sync activity</p>
                <p className="mt-0.5 text-[10px] text-zinc-700">Events appear here as providers sync.</p>
              </div>
            ) : (
              <div className="max-h-[300px] divide-y divide-white/[0.04] overflow-y-auto">
                {logs.map((log) => {
                  const statusClass =
                    log.status === "success"
                      ? "text-emerald-400"
                      : log.status === "pending"
                        ? "text-amber-400"
                        : "text-red-400";
                  return (
                    <div key={log.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusClass.replace("text-", "bg-")}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-zinc-300">
                            {log.integration_name} · {log.entity_type}
                          </span>
                          <span className={`shrink-0 text-[9px] font-medium uppercase ${statusClass}`}>
                            {log.status}
                          </span>
                        </div>
                        <p className="truncate text-[10px] text-zinc-600">
                          {log.error_message || "Sync completed"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
      <button onClick={onToggle} className="transition-all duration-150 hover:ring-2 hover:ring-white/[0.2] rounded-full">
        {displayName ? (
          <LetterAvatar name={displayName} src={avatarUrl} size={24} ring />
        ) : (
          <Shimmer className="h-6 w-6 rounded-full" />
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
              {displayName && <LetterAvatar name={displayName} src={avatarUrl} size={28} ring />}
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
  const { orgId } = useOrg();
  const industryType = ((currentOrg as Record<string, unknown> | null)?.industry_type === "care" ? "care" : "trades") as IndustryType;
  const breadcrumbs = getBreadcrumbs(pathname, "", industryType);

  const [branchOpen, setBranchOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
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
      {typeof window !== "undefined" && "iworkr" in window && (
        <DesktopUpdateIndicator />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-1">
        <SyncRadarPopover
          open={radarOpen}
          orgId={orgId}
          onToggle={() => {
            setBranchOpen(false);
            setNotifOpen(false);
            setProfileOpen(false);
            setRadarOpen((p) => !p);
          }}
          onClose={() => setRadarOpen(false)}
        />

        {/* Notification Bell */}
        <NotificationsPopover
          open={notifOpen}
          onToggle={() => {
            setBranchOpen(false);
            setRadarOpen(false);
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
            setRadarOpen(false);
            setNotifOpen(false);
            setProfileOpen((p) => !p);
          }}
          onClose={() => setProfileOpen(false)}
        />
      </div>
    </header>
  );
}
