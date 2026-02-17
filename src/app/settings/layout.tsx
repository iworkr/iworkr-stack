"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { SettingsSaveIndicator } from "@/components/settings/save-toast";
import { HydrationGate } from "@/components/app/hydration-gate";
import { useAuthStore } from "@/lib/auth-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, currentOrg } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // Load settings from DB on mount
  useEffect(() => {
    if (currentOrg?.id && user?.id) {
      loadSettings(currentOrg.id, user.id);
    }
  }, [currentOrg?.id, user?.id, loadSettings]);

  // Escape to go back to app
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/dashboard");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  return (
    <HydrationGate>
      <div className="flex h-screen overflow-hidden bg-black text-white">
        {/* Noise grain */}
        <div
          className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.012] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />

        {/* Settings sidebar */}
        <SettingsSidebar />

        {/* Content area - flex-1 and overflow to prevent blackout */}
        <main className="relative z-0 flex-1 overflow-y-auto bg-black">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-[800px] px-12 py-10"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Auto-save indicator */}
        <SettingsSaveIndicator />
      </div>
    </HydrationGate>
  );
}
