"use client";

import { useEffect, useState } from "react";
import { useDesktop } from "./use-desktop";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

export function DesktopOfflineBanner() {
  const { isDesktop } = useDesktop();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    setOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
    document.body.classList.toggle("desktop-ghost-mode", offline);
    return () => document.body.classList.remove("desktop-ghost-mode");
  }, [isDesktop, offline]);

  if (!isDesktop || !offline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -32, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9999] flex h-8 items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] text-[11px] font-medium text-amber-400"
      >
        <WifiOff size={12} />
        Connection Lost. Offline Mode Active.
      </motion.div>
    </AnimatePresence>
  );
}
