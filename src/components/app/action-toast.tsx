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
    }, 4000);
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
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2">
      <AnimatePresence>
        {toasts.map((toast, i) => {
          const config = typeConfig[toast.type];
          const Icon = config.icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95, x: 20 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={`flex items-center gap-2.5 rounded-xl border ${config.borderColor} bg-[#0A0A0A]/95 px-3.5 py-2.5 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.5)] backdrop-blur-xl`}
            >
              <Icon size={13} className={config.color} />
              <span className="text-[12px] text-zinc-200">{toast.message}</span>
              {toast.undoAction && (
                <button
                  onClick={() => {
                    toast.undoAction?.();
                    removeToast(toast.id);
                  }}
                  className="ml-1 rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-zinc-400 transition-all hover:bg-white/[0.08] hover:text-zinc-200"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-0.5 rounded-md p-0.5 text-zinc-700 transition-colors hover:text-zinc-400"
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
