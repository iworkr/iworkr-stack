"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const shortcuts = [
  { section: "Navigation", items: [
    { keys: ["G", "J"], desc: "Go to Jobs" },
    { keys: ["G", "S"], desc: "Go to Schedule" },
    { keys: ["G", "I"], desc: "Go to Inbox" },
    { keys: ["G", "C"], desc: "Go to Clients" },
  ]},
  { section: "Actions", items: [
    { keys: ["C"], desc: "Create new job" },
    { keys: ["⌘", "K"], desc: "Command menu" },
    { keys: ["⌘", "["], desc: "Toggle sidebar" },
  ]},
  { section: "List", items: [
    { keys: ["↑", "↓"], desc: "Navigate items" },
    { keys: ["Enter"], desc: "Open detail" },
    { keys: ["Space"], desc: "Select item" },
  ]},
  { section: "Inbox", items: [
    { keys: ["E"], desc: "Archive / Done" },
    { keys: ["H"], desc: "Snooze" },
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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[10%] left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-xl border border-[#282828] bg-[#141414] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-200">Keyboard Shortcuts</h2>
              <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-5">
              {shortcuts.map((group) => (
                <div key={group.section}>
                  <h3 className="mb-2 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                    {group.section}
                  </h3>
                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div key={item.desc} className="flex items-center justify-between">
                        <span className="text-[13px] text-zinc-400">{item.desc}</span>
                        <div className="flex items-center gap-1">
                          {item.keys.map((k, i) => (
                            <span key={i}>
                              <kbd className="inline-block min-w-[22px] rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-center font-mono text-[10px] text-zinc-400">
                                {k}
                              </kbd>
                              {i < item.keys.length - 1 && (
                                <span className="mx-0.5 text-[10px] text-zinc-700">then</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
