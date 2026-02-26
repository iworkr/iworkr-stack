"use client";

import { motion } from "framer-motion";
import { Truck, Wrench, Cog, UserCheck, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Asset, type AssetCategory } from "@/lib/assets-data";
import { useAssetsStore } from "@/lib/assets-store";
import { CustodyModal } from "./custody-modal";

const categoryIcons: Record<AssetCategory, typeof Truck> = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Cog,
};

const statusConfig: Record<string, { color: string; ring: string; label: string; text: string; bg: string }> = {
  available: { color: "bg-emerald-500", ring: "ring-emerald-500/30", label: "Available", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  assigned: { color: "bg-sky-400", ring: "ring-sky-400/30", label: "On Job", text: "text-sky-400", bg: "bg-sky-500/10" },
  maintenance: { color: "bg-rose-500", ring: "ring-rose-500/30", label: "Broken", text: "text-rose-400", bg: "bg-rose-500/10" },
};

interface FleetGridProps {
  assets: Asset[];
}

export function FleetGrid({ assets }: FleetGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
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
      className="group relative cursor-pointer overflow-hidden rounded-xl bg-zinc-900/40 transition-[border-color,box-shadow] duration-200 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
    >
      {/* Image area — dark gradient with wireframe icon */}
      <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <CatIcon
          size={56}
          strokeWidth={0.6}
          className="text-white/[0.08]"
        />

        {/* Status badge — top right */}
        <div className="absolute right-3 top-3">
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-medium backdrop-blur-sm ${status.bg} ${status.text} border border-white/[0.04]`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
            {status.label}
          </span>
        </div>

        {/* Category badge — top left */}
        <div className="absolute left-3 top-3">
          <span className="rounded-md bg-black/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500 backdrop-blur-sm">
            {asset.category}
          </span>
        </div>

        {/* Assignee chip */}
        {asset.status === "assigned" && asset.assignee && (
          <div className="absolute right-3 bottom-3">
            <span className="rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-medium text-zinc-300 backdrop-blur-sm">
              {asset.assignee.split(" ")[0]}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 backdrop-blur-sm"
          >
            {asset.status === "available" && (
              <button
                onClick={(e) => { e.stopPropagation(); setCustodyOpen(true); }}
                className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.12]"
              >
                <UserCheck size={12} className="mr-1 inline" />
                Assign
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); updateAssetStatusServer(asset.id, "maintenance"); }}
              className="rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              <AlertTriangle size={12} className="mr-1 inline" />
              Report Issue
            </button>
          </motion.div>
        )}
      </div>

      {/* Data area */}
      <div className="px-4 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-600">{asset.tag}</span>
          <span className="font-mono text-[10px] text-zinc-600">
            Serial: {asset.serialNumber.slice(-6)}
          </span>
        </div>
        <h3 className="mt-1 truncate text-[13px] font-medium text-zinc-200 transition-colors group-hover:text-white">
          {asset.name}
        </h3>
        <p className="mt-0.5 text-[10px] text-zinc-600">
          Loc: {asset.location}
        </p>

        {/* Service bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-700">Service Due</span>
            <span className={`text-[8px] font-medium ${
              asset.serviceDuePercent >= 90 ? "text-rose-400" :
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

      <CustodyModal asset={asset} isOpen={custodyOpen} onClose={() => setCustodyOpen(false)} />
    </motion.div>
  );
}
