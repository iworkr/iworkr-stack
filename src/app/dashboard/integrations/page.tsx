"use client";

import { motion } from "framer-motion";
import {
  Search,
  Plug,
  Banknote,
  MessageSquare,
  HardDrive,
  Calendar,
  MapPin,
  Zap,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useMemo } from "react";
import {
  useIntegrationsStore,
  type IntegrationsTab,
} from "@/lib/integrations-store";
import { type IntegrationCategory, getConnectedCount, getErrorCount } from "@/lib/integrations-data";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { ConfigPanel } from "@/components/integrations/config-panel";
import { StripeConnectModal } from "@/components/integrations/stripe-modal";

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: IntegrationsTab; label: string; icon: typeof Plug }[] = [
  { id: "all", label: "All", icon: Plug },
  { id: "financial", label: "Financial", icon: Banknote },
  { id: "communication", label: "Communication", icon: MessageSquare },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "maps", label: "Maps", icon: MapPin },
];

export default function IntegrationsPage() {
  const {
    integrations,
    activeTab,
    searchQuery,
    setActiveTab,
    setSearchQuery,
  } = useIntegrationsStore();

  /* ── Stats ──────────────────────────────────────────── */
  const connectedCount = useMemo(
    () => integrations.filter((i) => i.status === "connected" || i.status === "syncing").length,
    [integrations]
  );
  const errorCount = useMemo(
    () => integrations.filter((i) => i.status === "error").length,
    [integrations]
  );

  /* ── Filtering ──────────────────────────────────────── */
  const filteredIntegrations = useMemo(() => {
    let items = integrations;

    // Tab filter
    if (activeTab !== "all") {
      items = items.filter((i) => i.category === activeTab);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }

    return items;
  }, [integrations, activeTab, searchQuery]);

  /* ── Group by category (for "All" view) ─────────────── */
  const grouped = useMemo(() => {
    if (activeTab !== "all") return null;

    const groups: Record<string, typeof filteredIntegrations> = {};
    filteredIntegrations.forEach((i) => {
      if (!groups[i.category]) groups[i.category] = [];
      groups[i.category].push(i);
    });
    return groups;
  }, [filteredIntegrations, activeTab]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 pb-0 pt-5">
        {/* Title row */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">Integrations</h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">
              Supercharge your workflow with connected tools.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-4 pr-3">
              <div className="flex items-center gap-1.5">
                <Check size={12} className="text-emerald-500" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{connectedCount}</span> connected
                </span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="text-[11px] text-zinc-500">
                    <span className="font-medium text-red-400">{errorCount}</span> error{errorCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find an integration..."
                className="h-8 w-52 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-[rgba(255,255,255,0.2)]"
              />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${
                  isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Icon size={13} strokeWidth={1.5} />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="integrations-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === "all" && grouped ? (
          /* Grouped view */
          Object.entries(grouped).map(([category, items], groupIdx) => {
            const catLabel: Record<string, string> = {
              financial: "Financial & Accounting",
              communication: "Communication & Messaging",
              storage: "File Storage",
              calendar: "Calendar & Scheduling",
              maps: "Maps & Location",
            };
            return (
              <div key={category} className="mb-8">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: groupIdx * 0.05 }}
                  className="mb-3 flex items-center gap-2"
                >
                  <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                    {catLabel[category] || category}
                  </h2>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.04)]" />
                  <span className="text-[10px] text-zinc-700">{items.length}</span>
                </motion.div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((int, i) => (
                    <IntegrationCard key={int.id} integration={int} index={groupIdx * 4 + i} />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          /* Flat grid for specific category */
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredIntegrations.map((int, i) => (
              <IntegrationCard key={int.id} integration={int} index={i} />
            ))}
          </div>
        )}

        {filteredIntegrations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={24} strokeWidth={0.8} className="mb-2 text-zinc-800" />
            <p className="text-[12px] text-zinc-600">No integrations found.</p>
            <p className="mt-0.5 text-[10px] text-zinc-700">Try adjusting your search or filter.</p>
          </div>
        )}
      </div>

      {/* ── Overlays ─────────────────────────────────── */}
      <ConfigPanel />
      <StripeConnectModal />
    </div>
  );
}
