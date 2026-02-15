"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { Search, FileText, CalendarDays, Users, Receipt, X, SkipForward } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { CheckmarkDraw } from "./spinner";

const menuItems = [
  { icon: FileText, label: "Create Job", shortcut: "C", highlight: true },
  { icon: CalendarDays, label: "Open Scheduler", shortcut: "S", highlight: false },
  { icon: Users, label: "View Clients", shortcut: "L", highlight: false },
  { icon: Receipt, label: "New Invoice", shortcut: "I", highlight: false },
];

export function StepTraining() {
  const { advanceStep, setCommandMenuCompleted } = useOnboardingStore();
  const [phase, setPhase] = useState<"prompt" | "menu" | "typing" | "success">(
    "prompt"
  );
  const [searchText, setSearchText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Listen for Cmd+K
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (phase === "prompt") {
          openMenu();
        }
      }
      if (phase === "menu" || phase === "typing") {
        if (e.key === "Escape") {
          setPhase("prompt");
          setSearchText("");
        }
        if (e.key === "Enter") {
          e.preventDefault();
          handleSuccess();
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, menuItems.length - 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
      }
    },
    [phase]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Simulate typing
  useEffect(() => {
    if (phase !== "typing") return;
    const text = "Create Job";
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setSearchText(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 60);
    return () => clearInterval(interval);
  }, [phase]);

  function openMenu() {
    setPhase("menu");
    setTimeout(() => setPhase("typing"), 600);
  }

  function handleSuccess() {
    setPhase("success");
    setCommandMenuCompleted();
    setTimeout(() => advanceStep(), 1200);
  }

  function handleSkip() {
    setCommandMenuCompleted();
    advanceStep();
  }

  return (
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {phase === "prompt" && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Spotlight effect */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0%,transparent_50%)]" />

            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]"
            >
              <Search size={28} className="text-zinc-400" />
            </motion.div>

            <h2 className="mb-3 text-2xl font-medium tracking-tight text-zinc-100 md:text-3xl">
              Everything is one keystroke away.
            </h2>
            <p className="mb-8 max-w-sm text-sm text-zinc-500">
              The command menu gives you instant access to every action in
              iWorkr. Try it now.
            </p>

            {/* Keyboard shortcut hint — tap to try on mobile */}
            <motion.button
              onClick={openMenu}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-3 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.05)]"
            >
              <span className="text-sm text-zinc-400">Press</span>
              <kbd className="rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 font-mono text-sm text-zinc-200 shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                ⌘
              </kbd>
              <span className="text-sm text-zinc-600">+</span>
              <kbd className="rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 font-mono text-sm text-zinc-200 shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                K
              </kbd>
              <span className="ml-1 text-[11px] text-zinc-600 md:hidden">or tap here</span>
            </motion.button>

            {/* Skip link */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              onClick={handleSkip}
              className="mt-6 flex items-center gap-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-400"
            >
              <SkipForward size={12} />
              Skip this step
            </motion.button>
          </motion.div>
        )}

        {(phase === "menu" || phase === "typing") && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-md overflow-hidden rounded-xl border border-[rgba(255,255,255,0.12)] bg-zinc-900/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Search bar */}
            <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
              <Search size={16} className="shrink-0 text-zinc-500" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                autoFocus
              />
              <kbd className="rounded border border-[rgba(255,255,255,0.06)] px-1.5 py-0.5 text-[10px] text-zinc-600">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="p-1.5">
              <p className="px-2.5 py-1.5 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">
                Actions
              </p>
              {menuItems
                .filter((item) =>
                  item.label.toLowerCase().includes(searchText.toLowerCase())
                )
                .map((item, i) => {
                  const Icon = item.icon;
                  const isActive = i === selectedIndex;
                  return (
                    <button
                      key={item.label}
                      onClick={
                        item.highlight ? () => handleSuccess() : undefined
                      }
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? "bg-[rgba(255,255,255,0.06)] text-zinc-100"
                          : "text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1 text-sm">{item.label}</span>
                      <kbd className="rounded border border-[rgba(255,255,255,0.06)] px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                        {item.shortcut}
                      </kbd>
                    </button>
                  );
                })}
            </div>

            {/* Hint — tap or press Enter */}
            {phase === "typing" && searchText === "Create Job" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-t border-[rgba(255,255,255,0.06)] px-4 py-2.5"
              >
                <span className="text-[11px] text-zinc-500">
                  <span className="hidden md:inline">
                    Press{" "}
                    <kbd className="rounded border border-[rgba(255,255,255,0.08)] px-1 py-0.5 font-mono text-[10px] text-zinc-400">
                      ↵
                    </kbd>{" "}
                    to select
                  </span>
                  <span className="md:hidden">
                    Tap &quot;Create Job&quot; above to continue
                  </span>
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {phase === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Pulse ring */}
            <div className="relative mb-6">
              <motion.div
                animate={{
                  scale: [1, 2],
                  opacity: [0.3, 0],
                }}
                transition={{ duration: 1, repeat: 2 }}
                className="absolute inset-0 rounded-full border border-white/20"
              />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                <span className="text-emerald-400">
                  <CheckmarkDraw size={32} />
                </span>
              </div>
            </div>
            <h3 className="mb-2 text-xl font-medium text-zinc-100">
              You&apos;re a natural.
            </h3>
            <p className="text-sm text-zinc-500">
              The command menu is always one keystroke away.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
