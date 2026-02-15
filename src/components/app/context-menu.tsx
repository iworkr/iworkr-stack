"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function ContextMenu({ open, x, y, items, onSelect, onClose }: ContextMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 w-48 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl"
            style={{ left: x, top: y }}
          >
            {items.map((item) =>
              item.divider ? (
                <div key={item.id} className="my-1 h-px bg-[rgba(255,255,255,0.06)]" />
              ) : (
                <button
                  key={item.id}
                  onClick={() => { onSelect(item.id); onClose(); }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                    item.danger
                      ? "text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  {item.icon && <span className="shrink-0 text-zinc-500">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="font-mono text-[10px] text-zinc-600">{item.shortcut}</kbd>
                  )}
                </button>
              )
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
