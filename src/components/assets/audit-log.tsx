"use client";

import { motion } from "framer-motion";
import { ArrowRightLeft, Wrench, PlusCircle, Trash2, Package } from "lucide-react";
import { type AssetAuditEntry } from "@/lib/assets-data";

const typeConfig = {
  transfer: { icon: ArrowRightLeft, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Transfer" },
  service: { icon: Wrench, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Service" },
  create: { icon: PlusCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Created" },
  retire: { icon: Trash2, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Retired" },
  stock_adjust: { icon: Package, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", label: "Stock" },
};

interface AuditLogProps {
  entries: AssetAuditEntry[];
}

export function AuditLog({ entries }: AuditLogProps) {
  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const cfg = typeConfig[entry.type];
        const Icon = cfg.icon;

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: i * 0.04,
              duration: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="group flex items-start gap-3 border-b border-[rgba(255,255,255,0.04)] px-1 py-3 last:border-0"
          >
            {/* Timeline column */}
            <div className="flex flex-col items-center pt-0.5">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${cfg.bg} ${cfg.border}`}>
                <Icon size={13} strokeWidth={1.5} className={cfg.color} />
              </div>
              {i < entries.length - 1 && (
                <div className="mt-1 h-8 w-px bg-zinc-900" />
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-600">{entry.assetTag}</span>
                <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-300">{entry.description}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-600">
                <span>{entry.user}</span>
                <span>·</span>
                <span>{entry.time}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
