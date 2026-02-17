"use client";

import { motion } from "framer-motion";
import { Plus, Minus, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { type StockItem, getStockAlertLevel } from "@/lib/assets-data";
import { useAssetsStore } from "@/lib/assets-store";

interface InventoryTableProps {
  items: StockItem[];
}

export function InventoryTable({ items }: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)]">
      {/* Table header */}
      <div className="grid grid-cols-[100px_1fr_200px_90px_140px_80px] gap-3 border-b border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">SKU</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Name</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Level</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Cost</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Supplier</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Bin</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {items.map((item, i) => (
          <StockRow key={item.id} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}

function StockRow({ item, index }: { item: StockItem; index: number }) {
  const { adjustStockServer } = useAssetsStore();
  const [hovered, setHovered] = useState(false);
  const alertLevel = getStockAlertLevel(item);
  const fillPercent = (item.currentQty / item.maxQty) * 100;
  const reorderPercent = (item.minLevel / item.maxQty) * 100;
  const isLow = alertLevel === "low" || alertLevel === "critical";

  const handleAdjust = async (delta: number) => {
    await adjustStockServer(item.id, delta);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.03,
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group grid grid-cols-[100px_1fr_200px_90px_140px_80px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02] ${
        isLow ? "bg-amber-500/[0.02]" : ""
      }`}
    >
      {/* SKU */}
      <span className="font-mono text-[11px] text-zinc-500">{item.sku}</span>

      {/* Name */}
      <div className="flex items-center gap-2">
        {isLow && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertTriangle size={12} className={alertLevel === "critical" ? "text-red-400" : "text-amber-400"} />
          </motion.div>
        )}
        <span className="truncate text-[12px] text-zinc-300">{item.name}</span>
        {isLow && (
          <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
            alertLevel === "critical" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
          }`}>
            {alertLevel === "critical" ? "Critical" : "Low Stock"}
          </span>
        )}
      </div>

      {/* Level — Bullet Chart */}
      <div className="flex items-center gap-2">
        <div className="relative h-[6px] flex-1 rounded-full bg-zinc-900">
          {/* Reorder point marker */}
          <div
            className="absolute top-0 h-full w-px bg-zinc-700"
            style={{ left: `${reorderPercent}%` }}
          />
          {/* Current level bar */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${fillPercent}%` }}
            transition={{ delay: 0.2 + index * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full transition-colors ${
              alertLevel === "critical" ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.4)]" :
              alertLevel === "low" ? "bg-amber-500" :
              "bg-white/70"
            } ${isLow ? "animate-pulse" : ""}`}
          />
        </div>

        {/* Inline stepper on hover */}
        {hovered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-0.5"
          >
            <button
              onClick={() => handleAdjust(-1)}
              className="flex h-5 w-5 items-center justify-center rounded border border-[rgba(255,255,255,0.1)] bg-zinc-900 text-zinc-400 transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              <Minus size={10} />
            </button>
            <span className="w-8 text-center font-mono text-[10px] text-zinc-400">{item.currentQty}</span>
            <button
              onClick={() => handleAdjust(1)}
              className="flex h-5 w-5 items-center justify-center rounded border border-[rgba(255,255,255,0.1)] bg-zinc-900 text-zinc-400 transition-colors hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <Plus size={10} />
            </button>
          </motion.div>
        ) : (
          <span className="w-16 text-right font-mono text-[10px] text-zinc-500">
            {item.currentQty}/{item.maxQty}
          </span>
        )}
      </div>

      {/* Cost */}
      <span className="text-right font-mono text-[11px] text-zinc-400">
        ${item.unitCost.toFixed(2)}
      </span>

      {/* Supplier */}
      <span className="truncate text-[11px] text-zinc-500">{item.supplier}</span>

      {/* Bin */}
      <span className="font-mono text-[10px] text-zinc-600">{item.binLocation}</span>
    </motion.div>
  );
}
