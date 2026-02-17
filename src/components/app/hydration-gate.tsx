"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";

/**
 * HydrationGate blocks rendering of children until Zustand persist stores
 * have rehydrated from localStorage.  For returning users this is <50ms.
 * For cold starts (no cache) we cap the wait at 1.5s then render anyway.
 *
 * While waiting, a premium branded splash screen is shown. Once ready the
 * content fades in smoothly.
 */

function useStoresHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Zustand persist exposes onFinishHydration / hasHydrated
    // The auth store is the critical one — once it's rehydrated, cached orgId
    // is available and all downstream data stores can render from their cache.
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // In case hydration already finished before this effect ran
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
    }

    return unsub;
  }, []);

  return hydrated;
}

export function HydrationGate({ children }: { children: ReactNode }) {
  const hydrated = useStoresHydrated();
  const [forceShow, setForceShow] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Safety valve: never block for more than 1.5s
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const ready = hydrated || forceShow;

  // Once ready, hold splash for a tiny moment so the fade looks intentional
  useEffect(() => {
    if (!ready) return;
    // Minimum 200ms splash so it doesn't just flash
    const t = setTimeout(() => setSplashDone(true), 150);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <>
      <AnimatePresence>
        {!splashDone && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
          >
            {/* Subtle radial glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,230,118,0.06)_0%,transparent_70%)]" />

            {/* Logo + pulse */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex flex-col items-center"
            >
              <img
                src="/logos/logo-dark-streamline.png"
                alt="iWorkr"
                className="h-10 w-10 object-contain"
              />
              {/* Animated ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  border: "1.5px solid rgba(0,230,118,0.3)",
                  margin: "-8px",
                  borderRadius: "50%",
                }}
                animate={{
                  scale: [1, 1.6, 1.6],
                  opacity: [0.6, 0, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render children as soon as ready (they're behind the splash overlay) */}
      {ready && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="h-full"
        >
          {children}
        </motion.div>
      )}
    </>
  );
}
