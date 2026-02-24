"use client";

import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";
import { CheckCircle, AlertCircle, X } from "lucide-react";

/* ── Toast store ──────────────────────────────────────── */

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  undoAction?: () => void;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, undoAction?: () => void, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, undoAction, type = "success") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, undoAction, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* ── Toast renderer ───────────────────────────────────── */

const typeConfig: Record<ToastType, { icon: typeof CheckCircle; color: string; borderColor: string }> = {
  success: { icon: CheckCircle, color: "text-emerald-400", borderColor: "border-emerald-500/15" },
  error: { icon: AlertCircle, color: "text-rose-400", borderColor: "border-rose-500/15" },
  info: { icon: CheckCircle, color: "text-zinc-400", borderColor: "border-white/[0.06]" },
};

export function ActionToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const config = typeConfig[toast.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center gap-2.5 rounded-full border border-zinc-700 ${config.borderColor} bg-zinc-900 px-4 py-2.5 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.5)]`}
            >
              <Icon size={13} className={config.color} />
              <span className="text-[13px] text-white">{toast.message}</span>
              {toast.undoAction && (
                <button
                  onClick={() => {
                    toast.undoAction?.();
                    removeToast(toast.id);
                  }}
                  className="ml-1 rounded-md px-2 py-0.5 text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-0.5 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
                aria-label="Dismiss"
              >
                <X size={11} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
