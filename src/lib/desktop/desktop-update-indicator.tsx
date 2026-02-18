"use client";

import { useEffect, useState } from "react";
import { useDesktop } from "./use-desktop";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownCircle, X } from "lucide-react";

export function DesktopUpdateIndicator() {
  const { isDesktop, api } = useDesktop();
  const [updateReady, setUpdateReady] = useState<{
    version: string;
    releaseDate: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isDesktop || !api) return;

    const unsub = api.update.onDownloaded((info) => {
      setUpdateReady(info);
      setDismissed(false);
    });

    return unsub;
  }, [isDesktop, api]);

  if (!isDesktop || !updateReady || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5"
      >
        <ArrowDownCircle size={13} className="text-emerald-400" />
        <span className="text-[11px] font-medium text-emerald-300">
          v{updateReady.version} ready
        </span>
        <button
          onClick={() => api?.update.install()}
          className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30"
        >
          Restart
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 text-zinc-600 hover:text-zinc-400"
        >
          <X size={10} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
