"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, Sparkles, PartyPopper } from "lucide-react";
import { useBillingStore } from "@/lib/billing-store";
import { useAuthStore } from "@/lib/auth-store";

/* ── Confetti particles ────────────────────────────────── */

function ConfettiParticle({ delay, left }: { delay: number; left: number }) {
  const color = useMemo(() => {
    const colors = ["#00E676", "#FFFFFF", "#00C853", "#A5D6A7", "#69F0AE"];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  const size = useMemo(() => 4 + Math.random() * 6, []);
  const rotation = useMemo(() => Math.random() * 360, []);

  return (
    <motion.div
      initial={{ y: -20, x: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{
        y: [0, 300 + Math.random() * 200],
        x: [0, (Math.random() - 0.5) * 200],
        opacity: [1, 1, 0],
        rotate: [0, rotation + 360],
        scale: [1, 0.5],
      }}
      transition={{
        duration: 2 + Math.random(),
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={{
        position: "absolute",
        left: `${left}%`,
        top: 0,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      }}
    />
  );
}

/* ── Main celebration overlay ──────────────────────────── */

export function UpgradeCelebration() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const { loadBilling } = useBillingStore();
  const { currentOrg } = useAuthStore();

  useEffect(() => {
    if (searchParams.get("upgrade") === "success") {
      setShow(true);
      // Refresh billing data
      if (currentOrg?.id) {
        loadBilling(currentOrg.id);
      }
      // Clean up URL
      const timer = setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("upgrade");
        router.replace(url.pathname + url.search, { scroll: false });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams, currentOrg?.id, loadBilling, router]);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        left: Math.random() * 100,
      })),
    []
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
        >
          {/* Confetti layer */}
          <div className="absolute inset-x-0 top-0 h-full">
            {particles.map((p) => (
              <ConfettiParticle key={p.id} delay={p.delay} left={p.left} />
            ))}
          </div>

          {/* Center toast */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -30 }}
            transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.3 }}
            className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-[#00E676]/20 bg-black/90 px-5 py-3 shadow-[0_0_40px_-10px_rgba(0,230,118,0.3)] backdrop-blur-lg">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.5 }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00E676] shadow-[0_0_20px_-3px_rgba(0,230,118,0.5)]"
              >
                <Check size={16} className="text-black" />
              </motion.div>
              <div>
                <p className="text-[13px] font-medium text-white">
                  Upgrade successful!
                </p>
                <p className="text-[11px] text-zinc-500">
                  All premium features are now unlocked
                </p>
              </div>
              <PartyPopper size={18} className="ml-2 text-[#00E676]" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
