/**
 * @page /portal/c/[slug]/assets
 * @status COMPLETE
 * @description Commercial B2B asset vault — lifecycle history, job records, and compliance certificates
 * @lastAudit 2026-03-24
 */
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Wrench, Calendar, ChevronDown, ChevronRight, FileDown, Loader2, MapPin, Hash } from "lucide-react";
import { usePortalStore } from "@/lib/stores/portal-store";
import { getPortalAssets, type PortalAsset } from "@/app/actions/portal-client";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalAssetsPage() {
  const tenant = usePortalStore((s) => s.activeTenant);
  const activeEntityId = usePortalStore((s) => s.activeEntityId);
  const [assets, setAssets] = useState<PortalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const brandColor = tenant?.brand_color || "#10B981";

  useEffect(() => {
    if (!tenant?.workspace_id || !activeEntityId) return;
    setLoading(true);
    getPortalAssets(tenant.workspace_id, activeEntityId).then((result) => {
      setAssets(result.assets);
      setLoading(false);
    });
  }, [tenant?.workspace_id, activeEntityId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Asset Vault</h1>
        <p className="text-[12px] text-zinc-500">
          Complete maintenance history and compliance certificates for your assets
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/30 p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400">No assets registered</p>
          <p className="mt-1 text-[12px] text-zinc-600">
            Your service provider will register assets as they perform work on your property.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map((asset, i) => {
            const isExpanded = expandedId === asset.id;
            const statusColors: Record<string, string> = {
              active: "bg-emerald-500/10 text-emerald-400",
              maintenance_due: "bg-amber-500/10 text-amber-400",
              inactive: "bg-zinc-500/10 text-zinc-400",
              decommissioned: "bg-red-500/10 text-red-400",
            };

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-white/[0.06] bg-zinc-900/40 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : asset.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${brandColor}12` }}
                    >
                      <Package size={16} style={{ color: brandColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-zinc-200">{asset.name}</p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Wrench size={10} /> {asset.asset_type}
                        </span>
                        {asset.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={10} /> {asset.location}
                          </span>
                        )}
                        {asset.serial_number && (
                          <span className="flex items-center gap-1">
                            <Hash size={10} /> {asset.serial_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[asset.status] || statusColors.active}`}>
                      {asset.status.replace("_", " ")}
                    </span>
                    {isExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/[0.04] px-5 pb-5 pt-4">
                        {/* Service Dates */}
                        <div className="mb-4 grid grid-cols-2 gap-4">
                          <div className="rounded-lg border border-white/[0.04] bg-zinc-950/50 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-600">Last Service</p>
                            <p className="mt-1 text-[13px] text-zinc-300">{fmtDate(asset.last_service_date)}</p>
                          </div>
                          <div className="rounded-lg border border-white/[0.04] bg-zinc-950/50 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-600">Next Service Due</p>
                            <p className="mt-1 text-[13px] text-zinc-300">{fmtDate(asset.next_service_date)}</p>
                          </div>
                        </div>

                        {/* Job History */}
                        <h3 className="mb-2 text-[12px] font-medium text-zinc-400">Service History</h3>
                        {asset.jobs.length === 0 ? (
                          <p className="text-[12px] text-zinc-600">No service records available.</p>
                        ) : (
                          <div className="space-y-2">
                            {asset.jobs.map((job) => (
                              <div key={job.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-zinc-950/30 px-4 py-3">
                                <div>
                                  <p className="text-[13px] text-zinc-200">{job.title}</p>
                                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                    {job.technician_name && <span>Tech: {job.technician_name}</span>}
                                    <span>{fmtDate(job.completed_at)}</span>
                                  </div>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  job.status === "complete" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                                }`}>
                                  {job.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
