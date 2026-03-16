"use client";

import { create } from "zustand";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useCallback } from "react";
import {
  Bell,
  X,
  AtSign,
  Clock,
  Megaphone,
  Briefcase,
  DollarSign,
} from "lucide-react";
import { markRead } from "@/app/actions/notifications";

/* ── Toast notification type ──────────────────────────── */

export interface ToastNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  action_url?: string;
  created_at: string;
}

/* ── Toast store ──────────────────────────────────────── */

interface ToastState {
  toasts: ToastNotification[];
  addToast: (notification: ToastNotification) => void;
  dismissToast: (id: string) => void;
}

const MAX_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (notification) =>
    set((state) => {
      // Dedupe by id
      if (state.toasts.some((t) => t.id === notification.id)) return state;
      // Keep max 3, drop oldest if overflow
      const updated = [notification, ...state.toasts].slice(0, MAX_TOASTS);
      return { toasts: updated };
    }),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

/* ── Toast icon resolver ──────────────────────────────── */

const TOAST_ICON_MAP: Record<string, { icon: typeof Bell; color: string }> = {
  mention:      { icon: AtSign,     color: "text-blue-500" },
  nudge:        { icon: Clock,      color: "text-amber-500" },
  announcement: { icon: Megaphone,  color: "text-rose-500" },
  job_assigned: { icon: Briefcase,  color: "text-emerald-500" },
  invoice_paid: { icon: DollarSign, color: "text-emerald-500" },
  system:       { icon: Bell,       color: "text-zinc-400" },
};

function getToastIcon(type: string) {
  return TOAST_ICON_MAP[type] || TOAST_ICON_MAP.system;
}

/* ── Auto-dismiss timer bar ──────────────────────────── */

const DISMISS_MS = 5000;

function ToastProgressBar({ id }: { id: string }) {
  const dismiss = useToastStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <div className="absolute bottom-0 left-0 h-[2px] w-full overflow-hidden rounded-b-lg">
      <motion.div
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: DISMISS_MS / 1000, ease: "linear" }}
        className="h-full bg-emerald-500/40"
      />
    </div>
  );
}

/* ── Single toast card ────────────────────────────────── */

function ToastCard({
  toast,
  index,
}: {
  toast: ToastNotification;
  index: number;
}) {
  const router = useRouter();
  const dismiss = useToastStore((s) => s.dismissToast);
  const cardRef = useRef<HTMLDivElement>(null);
  const config = getToastIcon(toast.type);
  const Icon = config.icon;

  const handleClick = useCallback(() => {
    dismiss(toast.id);
    // Mark as read in background
    markRead(toast.id).catch(() => {});
    router.push(toast.action_url || "/dashboard/inbox");
  }, [dismiss, toast.id, toast.action_url, router]);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dismiss(toast.id);
    },
    [dismiss, toast.id],
  );

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{ zIndex: 50 - index }}
      onClick={handleClick}
      className="group relative w-80 cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-zinc-900 p-4 shadow-2xl transition-colors hover:border-white/[0.14]"
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded text-zinc-600 opacity-0 transition-all hover:bg-white/[0.06] hover:text-zinc-300 group-hover:opacity-100"
      >
        <X size={12} />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
          <Icon size={13} className={config.color} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 pr-4">
          <p className="text-[12px] font-medium text-zinc-200 leading-snug">
            {toast.title}
          </p>
          {toast.body && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 leading-relaxed">
              {toast.body}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <ToastProgressBar id={toast.id} />
    </motion.div>
  );
}

/* ── Toast container (rendered once at app level) ──── */

export function NotificationToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast, i) => (
          <ToastCard key={toast.id} toast={toast} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
