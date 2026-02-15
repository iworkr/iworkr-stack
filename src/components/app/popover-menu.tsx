"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { Search, Check } from "lucide-react";

/* ── Generic Popover Menu (Linear-style) ─────────────── */

interface PopoverMenuProps<T extends string> {
  open: boolean;
  onClose: () => void;
  items: { value: T; label: string; icon?: ReactNode }[];
  selected: T;
  onSelect: (value: T) => void;
  searchable?: boolean;
  width?: number;
  align?: "left" | "right";
}

export function PopoverMenu<T extends string>({
  open,
  onClose,
  items,
  selected,
  onSelect,
  searchable = true,
  width = 200,
  align = "left",
}: PopoverMenuProps<T>) {
  const [search, setSearch] = useState("");
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((i) =>
    i.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setSearch("");
      setFocusedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setFocusedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && filtered[focusedIdx]) { e.preventDefault(); onSelect(filtered[focusedIdx].value); onClose(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [open, filtered, focusedIdx, onSelect, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-50 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F] p-1 shadow-xl ${
              align === "right" ? "right-0" : "left-0"
            }`}
            style={{ width }}
          >
            {/* Search */}
            {searchable && (
              <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-2 pb-1.5 pt-0.5">
                <Search size={11} className="shrink-0 text-zinc-600" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setFocusedIdx(0); }}
                  placeholder="Search..."
                  className="w-full bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                />
              </div>
            )}

            {/* Items */}
            <div className="max-h-[200px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-2 py-3 text-center text-[11px] text-zinc-600">No results</div>
              )}
              {filtered.map((item, i) => (
                <button
                  key={item.value}
                  onClick={() => { onSelect(item.value); onClose(); }}
                  onMouseEnter={() => setFocusedIdx(i)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 text-left transition-colors ${
                    i === focusedIdx ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60"
                  }`}
                  style={{ height: 28 }}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span className="flex-1 truncate text-[13px]">{item.label}</span>
                  {selected === item.value && (
                    <Check size={11} className="shrink-0 text-zinc-400" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
