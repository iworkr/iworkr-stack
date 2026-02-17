"use client";

import { motion } from "framer-motion";
import { Truck, Wrench, Cog, UserCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Asset, type AssetCategory } from "@/lib/assets-data";
import { useAssetsStore } from "@/lib/assets-store";
import { CustodyModal } from "./custody-modal";

/* ── Icons ────────────────────────────────────────────── */

const categoryIcons: Record<AssetCategory, typeof Truck> = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Cog,
};

const categoryColors: Record<AssetCategory, string> = {
  vehicle: "from-zinc-600/30 to-zinc-800/20",
  tool: "from-amber-600/30 to-amber-800/20",
  equipment: "from-zinc-500/30 to-zinc-700/20",
};

const statusConfig = {
  available: { color: "bg-emerald-500", ring: "ring-emerald-500/30", label: "Available" },
  assigned: { color: "bg-emerald-400", ring: "ring-emerald-400/30", label: "Assigned" },
  maintenance: { color: "bg-rose-500", ring: "ring-rose-500/30", label: "Maintenance" },
};

interface FleetGridProps {
  assets: Asset[];
}

export function FleetGrid({ assets }: FleetGridProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset, i) => (
        <AssetCard key={asset.id} asset={asset} index={i} />
      ))}
    </div>
  );
}

function AssetCard({ asset, index }: { asset: Asset; index: number }) {
  const router = useRouter();
  const { updateAssetStatusServer } = useAssetsStore();
  const [hovered, setHovered] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(false);
  const CatIcon = categoryIcons[asset.category];
  const status = statusConfig[asset.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(`/dashboard/assets/${asset.id}`)}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.05] bg-zinc-900/40 transition-all duration-300 hover:border-white/[0.1] hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.03)]"
      whileHover={{ scale: 1.02 }}
    >
      {/* Image placeholder / category background */}
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${categoryColors[asset.category]}`}>
        <CatIcon
          size={48}
          strokeWidth={0.8}
          className="text-white/20"
        />

        {/* Status dot — top right */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <div className={`h-2.5 w-2.5 rounded-full ${status.color} ring-2 ring-black ${status.ring}`} />
          {asset.status === "assigned" && asset.assignee && (
            <span className="rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-zinc-300 backdrop-blur-sm">
              {asset.assignee.split(" ")[0]}
            </span>
          )}
        </div>

        {/* Category badge — top left */}
        <div className="absolute left-3 top-3">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-400 backdrop-blur-sm">
            {asset.category}
          </span>
        </div>

        {/* Hover actions overlay */}
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 backdrop-blur-sm"
          >
            {asset.status === "available" && (
              <button
                onClick={(e) => { e.stopPropagation(); setCustodyOpen(true); }}
                className="rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.15)]"
              >
                <UserCheck size={12} className="mr-1 inline" />
                Assign
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); updateAssetStatusServer(asset.id, "maintenance"); }}
              className="rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.15)]"
            >
              <AlertTriangle size={12} className="mr-1 inline" />
              Report Issue
            </button>
          </motion.div>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-600">{asset.tag}</span>
          <span className={`text-[9px] font-medium ${
            asset.status === "available" ? "text-emerald-400" :
            asset.status === "assigned" ? "text-emerald-400" :
            "text-rose-400"
          }`}>
            {status.label}
          </span>
        </div>
        <h3 className="mt-1 truncate text-[13px] font-medium text-zinc-200">
          {asset.name}
        </h3>
        <p className="mt-0.5 text-[10px] text-zinc-600">{asset.location}</p>

        {/* Health bar — service due proximity */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-wider text-zinc-700">Service Due</span>
            <span className={`text-[8px] font-medium ${
              asset.serviceDuePercent >= 90 ? "text-red-400" :
              asset.serviceDuePercent >= 70 ? "text-amber-400" :
              "text-zinc-600"
            }`}>
              {asset.serviceDuePercent}%
            </span>
          </div>
          <div className="mt-1 h-[3px] rounded-full bg-zinc-900">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${asset.serviceDuePercent}%` }}
              transition={{ delay: 0.3 + index * 0.04, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`h-full rounded-full ${
                asset.serviceDuePercent >= 90 ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.3)]" :
                asset.serviceDuePercent >= 70 ? "bg-amber-500" :
                "bg-emerald-500/60"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Custody Modal */}
      <CustodyModal asset={asset} isOpen={custodyOpen} onClose={() => setCustodyOpen(false)} />
    </motion.div>
  );
}
