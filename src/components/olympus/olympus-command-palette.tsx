/**
 * @component OlympusCommandPalette
 * @status COMPLETE
 * @description Super-admin command palette for cross-tenant search and impersonation
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { create } from "zustand";
import {
  Search,
  Building2,
  Users,
  CreditCard,
  Database,
  Activity,
  Radar,
  ShieldAlert,
  Ghost,
  Download,
  Mail,
  Smartphone,
  MessageSquare,
  Hash,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ── Optional global open state (use with `useOlympusCommandPaletteModK`) ── */

export const useOlympusCommandPaletteStore = create<{
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));

/** Cmd+K / Ctrl+K — pass your toggle, e.g. `() => setOpen((o) => !o)` or `useOlympusCommandPaletteStore.getState().toggle`. */
export function useOlympusCommandPaletteModK(onToggle: () => void) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onToggle();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onToggle]);
}

/* ── Commands ─────────────────────────────────────────── */

type OlympusCommand = {
  id: string;
  label: string;
  group: "Navigation" | "Actions";
  icon: LucideIcon;
  href: string;
};

const commands: OlympusCommand[] = [
  { id: "nav-workspaces", label: "Workspaces", group: "Navigation", icon: Building2, href: "/olympus/workspaces" },
  { id: "nav-users", label: "Users", group: "Navigation", icon: Users, href: "/olympus/users" },
  { id: "nav-billing", label: "Billing", group: "Navigation", icon: CreditCard, href: "/olympus/billing" },
  { id: "nav-communications", label: "Communications", group: "Navigation", icon: MessageSquare, href: "/olympus/communications" },
  { id: "nav-database", label: "Database", group: "Navigation", icon: Database, href: "/olympus/database" },
  { id: "nav-health", label: "Health", group: "Navigation", icon: Activity, href: "/olympus/health" },
  { id: "nav-telemetry", label: "Telemetry", group: "Navigation", icon: Radar, href: "/olympus/telemetry" },
  { id: "nav-mobile-analytics", label: "Mobile Analytics", group: "Navigation", icon: Smartphone, href: "/olympus/mobile-analytics" },
  { id: "nav-system", label: "System", group: "Navigation", icon: ShieldAlert, href: "/olympus/system" },

  { id: "action-search-user-email", label: "Search User by Email", group: "Actions", icon: Mail, href: "/olympus/users" },
  { id: "action-search-workspace", label: "Search Workspace", group: "Actions", icon: Search, href: "/olympus/workspaces" },
  { id: "action-impersonate", label: "Impersonate User", group: "Actions", icon: Ghost, href: "/olympus/users" },
  { id: "action-discount", label: "Apply Discount", group: "Actions", icon: CreditCard, href: "/olympus/billing" },
  { id: "action-export-telemetry", label: "Export Telemetry", group: "Actions", icon: Download, href: "/olympus/telemetry" },
];

const GROUP_ORDER = ["Navigation", "Actions"] as const;

/* ── Inner: mounts only while open — fresh search/selection each open ── */

function OlympusCommandPaletteContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.group.toLowerCase().includes(search.toLowerCase())
  );

  const groups = GROUP_ORDER.filter((g) => filtered.some((c) => c.group === g));

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  const executeCommand = useCallback(
    (cmd: OlympusCommand) => {
      onClose();
      router.push(cmd.href);
    },
    [router, onClose]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    }
  }

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Olympus command palette"
      initial={{ opacity: 0, scale: 0.98, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-[18%] left-1/2 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-[#222] bg-[#0A0A0A] font-sans shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 border-b border-[#222] px-3 py-2.5">
        <Search size={14} className="shrink-0 text-zinc-500" strokeWidth={1.5} />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search Olympus..."
          className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500"
        />
        <kbd className="rounded border border-[#222] bg-[#111] px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
          ESC
        </kbd>
      </div>

      <div ref={listRef} className="max-h-[min(52vh,360px)] overflow-y-auto p-1.5">
        {groups.map((group) => (
          <div key={group}>
            <p className="px-2 py-1.5 text-[9px] font-semibold tracking-widest text-zinc-500 uppercase">
              {group}
            </p>
            {filtered
              .filter((c) => c.group === group)
              .map((cmd) => {
                const globalIdx = filtered.indexOf(cmd);
                const Icon = cmd.icon;
                const isActive = globalIdx === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-active={isActive}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-100 ${
                      isActive
                        ? "bg-white/[0.06] text-zinc-100"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                    }`}
                  >
                    <Icon size={14} className="shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 text-[13px] leading-tight">{cmd.label}</span>
                    {isActive && <ArrowRight size={12} className="shrink-0 text-zinc-500" strokeWidth={1.5} />}
                  </button>
                );
              })}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-8">
            <Hash size={16} className="mb-2 text-zinc-600" strokeWidth={1.5} />
            <p className="text-[13px] text-zinc-500">No results for &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#222] px-3 py-1.5">
        <span className="flex items-center gap-1 text-[9px] text-zinc-500">
          <kbd className="rounded border border-[#222] bg-[#111] px-1 py-0.5 font-mono">↑↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1 text-[9px] text-zinc-500">
          <kbd className="rounded border border-[#222] bg-[#111] px-1 py-0.5 font-mono">↵</kbd>
          select
        </span>
        <span className="flex items-center gap-1 text-[9px] text-zinc-500">
          <kbd className="rounded border border-[#222] bg-[#111] px-1 py-0.5 font-mono">esc</kbd>
          close
        </span>
        <span className="ml-auto flex items-center gap-0.5 text-[9px] text-zinc-500">
          <kbd className="rounded border border-[#222] bg-[#111] px-1 py-0.5 font-mono">⌘</kbd>
          <kbd className="rounded border border-[#222] bg-[#111] px-1 py-0.5 font-mono">K</kbd>
        </span>
      </div>
    </motion.div>
  );
}

/* ── Public shell ─────────────────────────────────────────── */

export function OlympusCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="olympus-command-palette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <OlympusCommandPaletteContent onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
