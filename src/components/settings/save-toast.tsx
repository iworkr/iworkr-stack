"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useState, useCallback, useRef } from "react";

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
