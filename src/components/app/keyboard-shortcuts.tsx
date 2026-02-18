"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

const shortcuts = [
  { section: "Navigation", items: [
    { keys: ["G", "D"], desc: "Go to Dashboard" },
    { keys: ["G", "J"], desc: "Go to Jobs" },
    { keys: ["G", "S"], desc: "Go to Schedule" },
    { keys: ["G", "I"], desc: "Go to Messages" },
    { keys: ["G", "C"], desc: "Go to Clients" },
    { keys: ["G", "F"], desc: "Go to Finance" },
    { keys: ["G", "A"], desc: "Go to Assets" },
    { keys: ["G", "T"], desc: "Go to Team" },
    { keys: ["G", "W"], desc: "Go to Automations" },
  ]},
  { section: "Actions", items: [
    { keys: ["C"], desc: "Create new job" },
    { keys: ["⌘", "⇧", "C"], desc: "Add new client" },
    { keys: ["⌘", "K"], desc: "Command palette" },
    { keys: ["⌘", "["], desc: "Toggle sidebar" },
    { keys: ["⌘", ","], desc: "Open settings" },
  ]},
  { section: "Lists", items: [
    { keys: ["↑", "↓"], desc: "Navigate items" },
    { keys: ["↵"], desc: "Open detail" },
    { keys: ["Space"], desc: "Select item" },
  ]},
  { section: "Messages", items: [
    { keys: ["E"], desc: "Archive / Done" },
    { keys: ["H"], desc: "Snooze" },
  ]},
  { section: "General", items: [
    { keys: ["?"], desc: "Show shortcuts" },
    { keys: ["Esc"], desc: "Close modal / panel" },
  ]},
];

export function KeyboardShortcuts({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[10%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] shadow-[0_40px_100px_-12px_rgba(0,0,0,0.9)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.04]">
                  <Keyboard size={12} className="text-zinc-500" />
                </div>
                <h2 className="text-[13px] font-medium text-zinc-200">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
              >
                <X size={13} />
              </button>
            </div>

            {/* Shortcuts Grid */}
            <div className="max-h-[60vh] overflow-y-auto scrollbar-none p-5">
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                {shortcuts.map((group) => (
                  <div key={group.section}>
                    <h3 className="mb-2 text-[9px] font-bold tracking-widest text-zinc-700 uppercase">
                      {group.section}
                    </h3>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <div key={item.desc} className="flex items-center justify-between gap-3">
                          <span className="text-[12px] text-zinc-400">{item.desc}</span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {item.keys.map((k, i) => (
                              <kbd
                                key={i}
                                className="inline-flex min-w-[20px] items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-zinc-500"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.05] px-5 py-2.5">
              <p className="text-[10px] text-zinc-700">
                Press <kbd className="rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono text-[9px]">?</kbd> anywhere to toggle this panel
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
