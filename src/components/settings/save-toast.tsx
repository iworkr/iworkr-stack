"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settings-store";

export function useSaveToast() {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showSaved = useCallback(() => {
    setVisible(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 2000);
  }, []);

  return { visible, showSaved };
}

export function SaveToast({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#141414] px-3.5 py-2 shadow-xl"
        >
          <Check size={13} className="text-emerald-400" />
          <span className="text-[12px] text-zinc-300">Saved</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Auto-save toast that watches the settings store for save/error states
 */
export function SettingsSaveIndicator() {
  const saving = useSettingsStore((s) => s.saving);
  const lastSaved = useSettingsStore((s) => s.lastSaved);
  const error = useSettingsStore((s) => s.error);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSaved && !saving) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved, saving]);

  return (
    <AnimatePresence mode="wait">
      {saving && (
        <motion.div
          key="saving"
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#141414] px-3.5 py-2 shadow-xl"
        >
          <Loader2 size={13} className="animate-spin text-zinc-400" />
          <span className="text-[12px] text-zinc-400">Saving…</span>
        </motion.div>
      )}
      {!saving && showSaved && !error && (
        <motion.div
          key="saved"
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-[rgba(0,230,118,0.2)] bg-[#141414] px-3.5 py-2 shadow-xl"
        >
          <Check size={13} className="text-[#00E676]" />
          <span className="text-[12px] text-zinc-300">Saved</span>
        </motion.div>
      )}
      {error && !saving && (
        <motion.div
          key="error"
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-red-500/20 bg-[#141414] px-3.5 py-2 shadow-xl"
        >
          <AlertCircle size={13} className="text-red-400" />
          <span className="text-[12px] text-red-300">Failed to save</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
