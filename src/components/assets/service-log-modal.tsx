"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Wrench, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAssetsStore } from "@/lib/assets-store";
import type { Asset } from "@/lib/assets-data";

interface ServiceLogModalProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceLogModal({ asset, isOpen, onClose }: ServiceLogModalProps) {
  const { logServiceServer } = useAssetsStore();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!notes.trim()) return;
    setSubmitting(true);
    await logServiceServer(asset.id, notes.trim());
    setSubmitting(false);
    setNotes("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0C0C0C] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-amber-400" />
              <h2 className="text-[14px] font-medium text-zinc-200">
                Log Service — {asset.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            <label className="mb-2 block text-[11px] font-medium text-zinc-500">Service Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the service performed (e.g., Oil change, brake inspection)…"
              autoFocus
              rows={4}
              className="w-full resize-none rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none focus:border-[rgba(255,255,255,0.2)]"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!notes.trim() || submitting}
              className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Log Service
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
