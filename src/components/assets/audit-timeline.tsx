"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusCircle,
  ArrowRightLeft,
  Wrench,
  Trash2,
  Package,
  ClipboardCheck,
  User,
  Loader2,
} from "lucide-react";
import { getEntityAudits, type AssetAudit } from "@/app/actions/assets";

interface AuditTimelineProps {
  entityId: string;
  entityType: "asset" | "inventory";
}

const actionConfig: Record<string, { icon: typeof PlusCircle; color: string; bg: string; border: string; label: string }> = {
  created: { icon: PlusCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Created" },
  updated: { icon: ClipboardCheck, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Updated" },
  check_out: { icon: ArrowRightLeft, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Checked Out" },
  check_in: { icon: ArrowRightLeft, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "Checked In" },
  service: { icon: Wrench, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Service" },
  consumed: { icon: Package, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Consumed" },
  stock_adjust: { icon: Package, color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", label: "Stock" },
  retired: { icon: Trash2, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Retired" },
};

const defaultConfig = { icon: ClipboardCheck, color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", label: "Event" };

function formatAuditTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
}

export function AuditTimeline({ entityId, entityType }: AuditTimelineProps) {
  const [audits, setAudits] = useState<AssetAudit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getEntityAudits(entityId, entityType);
      if (!cancelled && result.data) {
        setAudits(result.data);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [entityId, entityType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ClipboardCheck size={24} strokeWidth={0.8} className="mb-2 text-zinc-800" />
        <p className="text-[12px] text-zinc-600">No audit entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {audits.map((audit, i) => {
        const cfg = actionConfig[audit.action] || defaultConfig;
        const Icon = cfg.icon;

        return (
          <motion.div
            key={audit.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="flex items-start gap-3 py-3"
          >
            {/* Timeline column */}
            <div className="flex flex-col items-center pt-0.5">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${cfg.bg} ${cfg.border}`}>
                <Icon size={13} strokeWidth={1.5} className={cfg.color} />
              </div>
              {i < audits.length - 1 && (
                <div className="mt-1 h-8 w-px bg-zinc-900" />
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {formatAuditTime(audit.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-zinc-300">{audit.notes || audit.action}</p>
              {audit.user_name && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-600">
                  <User size={10} />
                  <span>{audit.user_name}</span>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
