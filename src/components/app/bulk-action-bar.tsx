"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Trash2, ArrowRight, UserPlus, X } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onChangeStatus: () => void;
  onAssign: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  count,
  onChangeStatus,
  onAssign,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-6 z-50 flex justify-center"
        >
          <div className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-zinc-900/95 px-2 py-1.5 shadow-xl backdrop-blur-sm">
            <span className="px-2 text-[13px] font-medium text-zinc-200">
              {count} selected
            </span>
            <div className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.1)]" />
            <button
              onClick={onChangeStatus}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <ArrowRight size={12} />
              Status
            </button>
            <button
              onClick={onAssign}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <UserPlus size={12} />
              Assign
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <div className="mx-1 h-4 w-px bg-[rgba(255,255,255,0.1)]" />
            <button
              onClick={onClear}
              className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
