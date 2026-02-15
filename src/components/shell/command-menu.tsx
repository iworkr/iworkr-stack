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
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";

const commands = [
  { id: "create-job", label: "Create Job", icon: FileText, shortcut: "C", group: "Actions" },
  { id: "create-invoice", label: "New Invoice", icon: Receipt, shortcut: "N", group: "Actions" },
  { id: "create-client", label: "Add Client", icon: Users, shortcut: "⌘⇧C", group: "Actions" },
  { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "D", group: "Navigate", href: "/dashboard" },
  { id: "nav-inbox", label: "Inbox", icon: Inbox, shortcut: "I", group: "Navigate", href: "/dashboard/inbox" },
  { id: "nav-jobs", label: "My Jobs", icon: Briefcase, shortcut: "J", group: "Navigate", href: "/dashboard/jobs" },
  { id: "nav-schedule", label: "Schedule", icon: CalendarDays, shortcut: "S", group: "Navigate", href: "/dashboard/schedule" },
  { id: "nav-clients", label: "Clients", icon: Users, shortcut: "C", group: "Navigate", href: "/dashboard/clients" },
  { id: "nav-finance", label: "Finance", icon: Banknote, shortcut: "F", group: "Navigate", href: "/dashboard/finance" },
  { id: "nav-settings", label: "Settings", icon: Settings, shortcut: "⌘,", group: "Navigate", href: "/settings" },
];

export function CommandMenu() {
  const router = useRouter();
  const { commandMenuOpen, setCommandMenuOpen } = useShellStore();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.group.toLowerCase().includes(search.toLowerCase())
  );

  const groups = [...new Set(filtered.map((c) => c.group))];

  // Reset on open
  useEffect(() => {
    if (commandMenuOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandMenuOpen]);

  // Global Cmd+K
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

  const { setCreateClientModalOpen, setCreateInvoiceModalOpen } = useShellStore();

  const executeCommand = useCallback(
    (cmd: (typeof commands)[0]) => {
      setCommandMenuOpen(false);
      if (cmd.href) {
        router.push(cmd.href);
      } else if (cmd.id === "create-client") {
        setCreateClientModalOpen(true);
      } else if (cmd.id === "create-invoice") {
        setCreateInvoiceModalOpen(true);
      }
    },
    [router, setCommandMenuOpen, setCreateClientModalOpen, setCreateInvoiceModalOpen]
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

  return (
    <AnimatePresence>
      {commandMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setCommandMenuOpen(false)}
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a]/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
              <Search size={16} className="shrink-0 text-zinc-500" />
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
                className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              <button
                onClick={() => setCommandMenuOpen(false)}
                className="rounded-md p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
              >
                <X size={14} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto p-1.5">
              {groups.map((group) => (
                <div key={group}>
                  <p className="px-2.5 py-1.5 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
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
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                            isActive
                              ? "bg-zinc-800/60 text-zinc-100"
                              : "text-zinc-400 hover:bg-zinc-800/40"
                          }`}
                        >
                          <Icon size={15} className="shrink-0" strokeWidth={1.5} />
                          <span className="flex-1 text-sm">{cmd.label}</span>
                          {cmd.shortcut && (
                            <kbd className="rounded border border-zinc-700/50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-zinc-600">
                  No results for &ldquo;{search}&rdquo;
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2">
              <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                <kbd className="rounded border border-zinc-700/50 px-1 py-0.5 font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                <kbd className="rounded border border-zinc-700/50 px-1 py-0.5 font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                <kbd className="rounded border border-zinc-700/50 px-1 py-0.5 font-mono">esc</kbd>
                close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
