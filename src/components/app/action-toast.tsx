"use client";

import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";

/* ── Toast store ──────────────────────────────────────── */

interface Toast {
  id: string;
  message: string;
  undoAction?: () => void;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, undoAction?: () => void) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, undoAction) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, undoAction }] }));
    // Auto-remove after 5s
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* ── Toast renderer ───────────────────────────────────── */

export function ActionToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-zinc-900 px-4 py-2.5 shadow-xl"
          >
            <span className="text-[13px] text-zinc-200">{toast.message}</span>
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction?.();
                  removeToast(toast.id);
                }}
                className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-200"
              >
                Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
