"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useEffect, useRef, useState } from "react";
import { TOOLBOX_ITEMS, filterTools } from "./forge-config";
import type { BlockType } from "@/lib/forms-data";
import { useBillingStore } from "@/lib/billing-store";

const GATED_BLOCKS: Record<string, string> = {
  signature: "pro",
  risk_matrix: "pro",
};

const PLAN_ORDER = ["free", "starter", "pro", "business"];

interface SlashCommandPopoverProps {
  open: boolean;
  query: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function SlashCommandPopover({
  open,
  query,
  onSelect,
  onClose,
  anchorRef,
}: SlashCommandPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(() => filterTools(query), [query]);
  const selected = filtered[highlightIndex];

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && selected) {
        e.preventDefault();
        onSelect(selected.type);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered.length, selected, onSelect, onClose]);

  if (!open) return null;

  const rect = anchorRef.current?.getBoundingClientRect();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 max-h-[280px] min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-zinc-900/90 py-1 shadow-xl backdrop-blur-md"
        style={{
          left: rect ? rect.left : 24,
          top: rect ? rect.bottom + 6 : 120,
        }}
      >
        <div
          ref={listRef}
          className="max-h-[260px] overflow-y-auto py-1"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-zinc-500">
              No tools match “{query}”
            </div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const isHighlight = i === highlightIndex;
              const requiredTier = GATED_BLOCKS[item.type];
              const { plan } = useBillingStore();
              const isLocked = requiredTier && PLAN_ORDER.indexOf(plan.key) < PLAN_ORDER.indexOf(requiredTier);

              return (
                <button
                  key={item.type}
                  type="button"
                  role="option"
                  aria-selected={isHighlight}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => {
                    if (isLocked) {
                      window.location.href = "/settings/billing";
                      return;
                    }
                    onSelect(item.type);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors ${
                    isLocked ? "opacity-50" : ""
                  } ${
                    isHighlight
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <Icon size={14} className="shrink-0 text-zinc-500" />
                  {item.label}
                  {isLocked && (
                    <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wider bg-amber-500/10 text-amber-400">
                      PRO
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
