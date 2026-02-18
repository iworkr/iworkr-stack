"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  FileText,
  CalendarDays,
  Users,
  Receipt,
  LayoutDashboard,
  Inbox,
  Briefcase,
  Banknote,
  Settings,
  Warehouse,
  UsersRound,
  Bot,
  Plug,
  Workflow,
  Hash,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";

/* ── Commands ─────────────────────────────────────────── */

const commands = [
  { id: "create-job", label: "Create Job", icon: FileText, shortcut: "C", group: "Actions" },
  { id: "create-invoice", label: "New Invoice", icon: Receipt, shortcut: "N", group: "Actions" },
  { id: "create-client", label: "Add Client", icon: Users, shortcut: "⌘⇧C", group: "Actions" },
  { id: "nav-dashboard", label: "Go to Dashboard", icon: LayoutDashboard, shortcut: "G D", group: "Navigation", href: "/dashboard" },
  { id: "nav-inbox", label: "Go to Messages", icon: Inbox, shortcut: "G I", group: "Navigation", href: "/dashboard/inbox" },
  { id: "nav-jobs", label: "Go to Jobs", icon: Briefcase, shortcut: "G J", group: "Navigation", href: "/dashboard/jobs" },
  { id: "nav-schedule", label: "Go to Schedule", icon: CalendarDays, shortcut: "G S", group: "Navigation", href: "/dashboard/schedule" },
  { id: "nav-clients", label: "Go to Clients", icon: Users, shortcut: "G C", group: "Navigation", href: "/dashboard/clients" },
  { id: "nav-finance", label: "Go to Finance", icon: Banknote, shortcut: "G F", group: "Navigation", href: "/dashboard/finance" },
  { id: "nav-assets", label: "Go to Assets", icon: Warehouse, shortcut: "G A", group: "Navigation", href: "/dashboard/assets" },
  { id: "nav-team", label: "Go to Team", icon: UsersRound, shortcut: "G T", group: "Navigation", href: "/dashboard/team" },
  { id: "nav-automations", label: "Go to Automations", icon: Workflow, shortcut: "G W", group: "Navigation", href: "/dashboard/automations" },
  { id: "nav-integrations", label: "Go to Integrations", icon: Plug, group: "Navigation", href: "/dashboard/integrations" },
  { id: "nav-ai-agent", label: "Go to AI Agent", icon: Bot, group: "Navigation", href: "/dashboard/ai-agent" },
  { id: "nav-settings", label: "Go to Settings", icon: Settings, shortcut: "⌘,", group: "Navigation", href: "/settings" },
];

export function CommandMenu() {
  const router = useRouter();
  const { commandMenuOpen, setCommandMenuOpen, setCreateClientModalOpen, setCreateInvoiceModalOpen, setCreateJobModalOpen } = useShellStore();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.group.toLowerCase().includes(search.toLowerCase())
  );

  const groups = [...new Set(filtered.map((c) => c.group))];

  useEffect(() => {
    if (commandMenuOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandMenuOpen]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandMenuOpen(!commandMenuOpen);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [commandMenuOpen, setCommandMenuOpen]);

  const executeCommand = useCallback(
    (cmd: (typeof commands)[0]) => {
      setCommandMenuOpen(false);
      if (cmd.href) {
        router.push(cmd.href);
      } else if (cmd.id === "create-client") {
        setCreateClientModalOpen(true);
      } else if (cmd.id === "create-invoice") {
        setCreateInvoiceModalOpen(true);
      } else if (cmd.id === "create-job") {
        setCreateJobModalOpen(true);
      }
    },
    [router, setCommandMenuOpen, setCreateClientModalOpen, setCreateInvoiceModalOpen, setCreateJobModalOpen]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setCommandMenuOpen(false);
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

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector("[data-active='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {commandMenuOpen && (
        <>
          {/* Backdrop — heavy shadow, no blur (keep context visible) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setCommandMenuOpen(false)}
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[18%] left-1/2 z-50 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-[0_40px_100px_-12px_rgba(0,0,0,0.9)]"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
              <Search size={15} className="shrink-0 text-zinc-600" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <kbd className="rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[360px] overflow-y-auto scrollbar-none p-1.5">
              {groups.map((group) => (
                <div key={group}>
                  <p className="px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-zinc-700 uppercase">
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
                          data-active={isActive}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all duration-100 ${
                            isActive
                              ? "bg-white/[0.05] text-zinc-100"
                              : "text-zinc-400 hover:bg-white/[0.03]"
                          }`}
                        >
                          <Icon size={15} className="shrink-0" strokeWidth={1.5} />
                          <span className="flex-1 text-[13px]">{cmd.label}</span>
                          {isActive && (
                            <ArrowRight size={12} className="text-zinc-600" />
                          )}
                          {cmd.shortcut && (
                            <div className="flex items-center gap-0.5">
                              {cmd.shortcut.split(" ").map((k, i) => (
                                <kbd key={i} className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center py-10">
                  <Hash size={18} className="mb-2 text-zinc-700" />
                  <p className="text-[12px] text-zinc-600">
                    No results for &ldquo;{search}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-white/[0.05] px-4 py-2">
              <span className="flex items-center gap-1 text-[9px] text-zinc-600">
                <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1 text-[9px] text-zinc-600">
                <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1 text-[9px] text-zinc-600">
                <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono">esc</kbd>
                close
              </span>
              <span className="ml-auto flex items-center gap-1 text-[9px] text-zinc-700">
                <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono">⌘</kbd>
                <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono">K</kbd>
                toggle
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
