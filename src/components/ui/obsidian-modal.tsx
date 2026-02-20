"use client";

import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { type ReactNode, useEffect, useRef } from "react";

/** PRD 55.0 — Glass & Shadow. Centered dialog with backdrop blur and scale-in. */

const BACKDROP_CLASS =
  "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm";
const CONTAINER_CLASS =
  "overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl";

const CENTERED_TRANSITION = { duration: 0.15, ease: "easeOut" as const };

interface ObsidianModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Max width: md (28rem), lg (32rem), xl (36rem), 2xl (42rem), or full */
  maxWidth?: "md" | "lg" | "xl" | "2xl" | "full";
  /** Content padding. Default p-8. Use "none" when modal has its own padding. */
  padding?: "p-6" | "p-8" | "none";
  /** Callback when Escape is pressed (default: onClose) */
  onEscape?: () => void;
  /** Prevent closing on backdrop click */
  preventBackdropClose?: boolean;
}

export function ObsidianModal({
  open,
  onClose,
  children,
  maxWidth = "xl",
  padding = "p-8",
  onEscape = onClose,
  preventBackdropClose = false,
}: ObsidianModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onEscape();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onEscape]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CENTERED_TRANSITION}
            className={BACKDROP_CLASS}
            onClick={preventBackdropClose ? undefined : onClose}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              ref={containerRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={CENTERED_TRANSITION}
              className={`flex max-h-[85vh] w-full flex-col ${CONTAINER_CLASS} ${padding === "none" ? "" : padding}`}
              style={{
                maxWidth:
                  maxWidth === "full"
                    ? "100%"
                    : maxWidth === "md"
                    ? "28rem"
                    : maxWidth === "lg"
                    ? "32rem"
                    : maxWidth === "xl"
                    ? "36rem"
                    : "42rem",
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Modal header: title + optional close. No <hr>. */
export function ObsidianModalHeader({
  title,
  subtitle,
  onClose,
  closeLabel = "Close",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6">
      <div>
        <h2 className="font-display text-[17px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        {subtitle != null && (
          <p className="mt-0.5 text-[12px] text-zinc-500">{subtitle}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
        aria-label={closeLabel}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** Primary CTA — stark white. PRD 55.0 */
export const obsidianButtonPrimary =
  "rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

/** Secondary / Cancel — ghost */
export const obsidianButtonGhost =
  "rounded-xl bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white";

/** Destructive — muted rose */
export const obsidianButtonDanger =
  "rounded-xl border border-rose-500/20 bg-transparent px-4 py-2 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10";
