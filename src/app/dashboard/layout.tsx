"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SlideOver } from "@/components/shell/slide-over";
import { ActionToastContainer } from "@/components/app/action-toast";
import { DataProvider } from "@/components/app/data-provider";
import { HydrationGate } from "@/components/app/hydration-gate";
import { useShellStore } from "@/lib/shell-store";

// Lazy-load modals and overlays (only rendered when opened)
const CommandMenu = dynamic(() => import("@/components/shell/command-menu").then((m) => m.CommandMenu), { ssr: false });
const CreateJobModal = dynamic(() => import("@/components/app/create-job-modal").then((m) => m.CreateJobModal), { ssr: false });
const CreateClientModal = dynamic(() => import("@/components/app/create-client-modal").then((m) => m.CreateClientModal), { ssr: false });
const CreateInvoiceModal = dynamic(() => import("@/components/app/create-invoice-modal").then((m) => m.CreateInvoiceModal), { ssr: false });
const KeyboardShortcuts = dynamic(() => import("@/components/app/keyboard-shortcuts").then((m) => m.KeyboardShortcuts), { ssr: false });
const UpgradeCelebration = dynamic(() => import("@/components/monetization/upgrade-celebration").then((m) => m.UpgradeCelebration), { ssr: false });

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sidebarCollapsed,
    slideOverOpen,
    toggleSidebar,
    commandMenuOpen,
    createJobModalOpen,
    setCreateJobModalOpen,
    createClientModalOpen,
    setCreateClientModalOpen,
    createInvoiceModalOpen,
    setCreateInvoiceModalOpen,
  } = useShellStore();

  const createModalOpen = createJobModalOpen;
  const setCreateModalOpen = setCreateJobModalOpen;
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingGRef = useRef(false);
  const gTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Global keyboard shortcuts ────────────────────── */
  const handleGlobalKey = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (commandMenuOpen || createModalOpen || createClientModalOpen || createInvoiceModalOpen || shortcutsOpen) return;

      // ⌘[ sidebar toggle
      if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // ⌘, open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }

      // G then ... navigation
      if (e.key === "g" || e.key === "G") {
        if (!pendingGRef.current) {
          pendingGRef.current = true;
          gTimeoutRef.current = setTimeout(() => {
            pendingGRef.current = false;
          }, 800);
          return;
        }
      }

      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        const map: Record<string, string> = {
          j: "/dashboard/jobs",
          s: "/dashboard/schedule",
          i: "/dashboard/inbox",
          c: "/dashboard/clients",
          f: "/dashboard/finance",
          a: "/dashboard/assets",
          o: "/dashboard/forms",
          t: "/dashboard/team",
          w: "/dashboard/automations",
          d: "/dashboard",
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          router.push(target);
          return;
        }
      }

      // ⌘⇧C — create new client
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setCreateClientModalOpen(true);
        return;
      }

      // C — create new job
      if (e.key === "c" || e.key === "C") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setCreateModalOpen(true);
          return;
        }
      }

      // ? — keyboard shortcuts
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
    },
    [
      commandMenuOpen,
      createModalOpen,
      createClientModalOpen,
      createInvoiceModalOpen,
      shortcutsOpen,
      toggleSidebar,
      router,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [handleGlobalKey]);

  /* ── Responsive sidebar margin ────────────────────── */
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const mainMarginLeft = isMobile ? 0 : sidebarCollapsed ? 64 : 240;

  return (
    <HydrationGate>
    <div className="flex h-screen overflow-hidden bg-black">
      {/* Noise grain */}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.012] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      <Sidebar onCreateClick={() => setCreateModalOpen(true)} />

      {/* Main area — no margin on mobile (sidebar overlays), sidebar width on md+ */}
      <div
        className="flex flex-1 flex-col overflow-hidden transition-[margin-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ marginLeft: mainMarginLeft }}
      >
        <Topbar />

        {/* Content canvas */}
        <motion.main
          animate={
            slideOverOpen
              ? { scale: 0.98, filter: "brightness(0.8)" }
              : { scale: 1, filter: "brightness(1)" }
          }
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 overflow-y-auto overflow-x-hidden bg-black"
        >
          <DataProvider>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </DataProvider>
        </motion.main>
      </div>

      {/* Global overlays */}
      <CommandMenu />
      <SlideOver />
      <CreateJobModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
      <CreateClientModal
        open={createClientModalOpen}
        onClose={() => setCreateClientModalOpen(false)}
        onCreateAndJob={() => {
          setCreateClientModalOpen(false);
          setCreateModalOpen(true);
        }}
      />
      <CreateInvoiceModal
        open={createInvoiceModalOpen}
        onClose={() => setCreateInvoiceModalOpen(false)}
      />
      <KeyboardShortcuts
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ActionToastContainer />
      <UpgradeCelebration />
    </div>
    </HydrationGate>
  );
}
