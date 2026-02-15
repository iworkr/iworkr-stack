"use client";

import { motion } from "framer-motion";
import { Search, Bell, ChevronRight, Wifi, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

function getBreadcrumbs(pathname: string, companyName: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: companyName, href: "/dashboard" }];

  const labelMap: Record<string, string> = {
    dashboard: "Dashboard",
    inbox: "Inbox",
    jobs: "My Jobs",
    schedule: "Schedule",
    clients: "Clients",
    finance: "Finance",
    settings: "Settings",
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === "dashboard" && i === 0) {
      crumbs.push({ label: "Dashboard", href: "/dashboard" });
    } else if (labelMap[seg]) {
      crumbs.push({
        label: labelMap[seg],
        href: "/" + segments.slice(0, i + 1).join("/"),
      });
    }
  }

  return crumbs;
}

export function Topbar() {
  const pathname = usePathname();
  const { setCommandMenuOpen, setMobileSidebarOpen } = useShellStore();
  const companyName =
    useOnboardingStore((s) => s.companyName) || "Apex Plumbing";
  const breadcrumbs = getBreadcrumbs(pathname, companyName);

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.5)] px-3 backdrop-blur-xl md:px-4">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="mr-2 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300 md:hidden"
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {/* Breadcrumbs — thin, monochromatic */}
      <nav className="flex min-w-0 items-center gap-1 text-[13px]">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href + i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={11} className="text-zinc-700" />
            )}
            <a
              href={crumb.href}
              className={`transition-colors duration-150 ${
                i === breadcrumbs.length - 1
                  ? "font-medium text-zinc-300"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {crumb.label}
            </a>
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right — tightly packed */}
      <div className="flex items-center gap-1.5">
        {/* Sync status */}
        <div className="mr-1 flex items-center gap-1.5">
          <Wifi size={11} className="text-emerald-500/70" />
          <span className="hidden text-[10px] text-zinc-600 lg:inline">
            Synced
          </span>
        </div>

        {/* Command Search Trigger */}
        <button
          onClick={() => setCommandMenuOpen(true)}
          className="flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-transparent px-2.5 py-1 text-[13px] text-zinc-600 transition-colors duration-150 hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-400"
        >
          <Search size={13} strokeWidth={1.5} />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden rounded border border-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[9px] text-zinc-600 sm:inline-block">
            ⌘K
          </kbd>
        </button>

        {/* Notification Bell — 24px touch target */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="relative flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
        >
          <Bell size={14} strokeWidth={1.5} />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-1 ring-black" />
        </motion.button>

        {/* User Avatar — 24px circle */}
        <button className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-medium text-zinc-400 ring-1 ring-[rgba(255,255,255,0.08)] transition-all duration-150 hover:ring-[rgba(255,255,255,0.15)]">
          MT
        </button>
      </div>
    </header>
  );
}
