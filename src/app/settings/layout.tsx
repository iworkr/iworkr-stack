/**
 * @layout SettingsLayout
 * @status COMPLETE
 * @description Settings shell with sidebar navigation, save indicator, and brand provider
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";
import { SettingsSaveIndicator } from "@/components/settings/save-toast";
import { HydrationGate } from "@/components/app/hydration-gate";
import { BrandProvider } from "@/components/providers/brand-provider";
import { useAuthStore } from "@/lib/auth-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { getDashboardPath } from "@/lib/hooks/use-dashboard-path";

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
        router.push(getDashboardPath());
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  return (
    <HydrationGate>
      <BrandProvider>
      <div className="flex h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
        {/* Noise grain — uses standardized stealth-noise token */}
        <div className="stealth-noise fixed inset-0 z-[9999]" />

        {/* Settings sidebar */}
        <SettingsSidebar />

        {/* Content area — unified control-center canvas */}
        <main className="relative z-0 flex-1 overflow-y-auto bg-[var(--background)]">
          {/* Subtle top-edge border to separate sidebar from content */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--border-base)]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-[800px] px-12 py-12"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Auto-save indicator */}
        <SettingsSaveIndicator />
      </div>
      </BrandProvider>
    </HydrationGate>
  );
}
