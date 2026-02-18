"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) menuRef.current.style.left = `${x - rect.width}px`;
    if (rect.bottom > vh) menuRef.current.style.top = `${y - rect.height}px`;
  }, [open, x, y]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={onClose}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
          />
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0A0A0A]/95 p-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8)] backdrop-blur-xl"
            style={{ left: x, top: y }}
          >
            {items.map((item) =>
              item.divider ? (
                <div key={item.id} className="my-1 h-px bg-white/[0.05]" />
              ) : (
                <button
                  key={item.id}
                  onClick={() => { onSelect(item.id); onClose(); }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-all duration-100 ${
                    item.danger
                      ? "text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                      : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                  }`}
                >
                  {item.icon && <span className="shrink-0 text-zinc-600">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="font-mono text-[9px] text-zinc-700">{item.shortcut}</kbd>
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
