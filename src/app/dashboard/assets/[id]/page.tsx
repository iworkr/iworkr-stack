"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Truck,
  Wrench,
  Cog,
  MapPin,
  UserCheck,
  ArrowRightLeft,
  Shield,
  Calendar,
  Hash,
  DollarSign,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAssetsStore } from "@/lib/assets-store";
import { type AssetCategory } from "@/lib/assets-data";
import { CustodyModal } from "@/components/assets/custody-modal";
import { ServiceLogModal } from "@/components/assets/service-log-modal";
import { AuditTimeline } from "@/components/assets/audit-timeline";

/* ── Icons ────────────────────────────────────────────── */

const categoryIcons: Record<AssetCategory, typeof Truck> = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Cog,
};

const categoryGradients: Record<AssetCategory, string> = {
  vehicle: "from-zinc-600/40 to-zinc-800/30",
  tool: "from-amber-600/40 to-orange-800/30",
  equipment: "from-zinc-500/40 to-zinc-700/30",
};

const statusConfig = {
  available: { color: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", label: "Available" },
  assigned: { color: "bg-[#00E676]", text: "text-[#00E676]", border: "border-[rgba(0,230,118,0.2)]", bg: "bg-[rgba(0,230,118,0.08)]", label: "Assigned" },
  maintenance: { color: "bg-red-500", text: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/10", label: "Maintenance Required" },
};

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { assets, toggleCustodyServer, updateAssetStatusServer } = useAssetsStore();
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [serviceLogOpen, setServiceLogOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const asset = useMemo(
    () => assets.find((a) => a.id === params.id),
    [assets, params.id]
  );

  if (!asset) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-600">Asset not found.</p>
      </div>
    );
  }

  const CatIcon = categoryIcons[asset.category];
  const status = statusConfig[asset.status];

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/assets")}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex items-center gap-2 text-[12px] text-zinc-600">
            <Link href="/dashboard/assets" className="transition-colors hover:text-zinc-400">Assets</Link>
            <ChevronRight size={12} />
            <span className="font-mono text-zinc-400">{asset.tag}</span>
          </div>
        </div>
      </div>

      {/* ── Content — Blueprint Split ────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Column: The Blueprint (60%) ─────── */}
        <div className="flex w-[60%] flex-col overflow-y-auto border-r border-[rgba(255,255,255,0.06)]">
          {/* Hero image area */}
          <div className={`relative flex h-64 items-center justify-center bg-gradient-to-br ${categoryGradients[asset.category]}`}>
            <CatIcon size={80} strokeWidth={0.5} className="text-white/15" />

            {/* Status badge */}
            <div className={`absolute right-4 top-4 flex items-center gap-2 rounded-full border px-3 py-1.5 ${status.bg} ${status.border}`}>
              <div className={`h-2 w-2 rounded-full ${status.color}`} />
              <span className={`text-[11px] font-medium ${status.text}`}>{status.label}</span>
            </div>

            {/* Category badge */}
            <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 backdrop-blur-sm">
              {asset.category}
            </div>

            {/* Asset name overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-5 pt-12">
              <span className="font-mono text-[10px] text-zinc-500">{asset.tag}</span>
              <h1 className="mt-0.5 text-[20px] font-medium text-zinc-100">{asset.name}</h1>
            </div>
          </div>

          {/* Map Widget — Last Known Location */}
          <div className="border-b border-[rgba(255,255,255,0.06)] p-6">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={14} className="text-zinc-500" />
              <span className="text-[12px] font-medium text-zinc-400">Last Known Location</span>
            </div>
            <div className="relative h-44 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
              {/* Grid background */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
                  backgroundSize: "30px 30px",
                }}
              />
              {/* Radar sweep */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {[50, 90].map((r) => (
                  <div
                    key={r}
                    className="absolute rounded-full border border-emerald-500/10"
                    style={{
                      width: r * 2,
                      height: r * 2,
                      left: `calc(50% - ${r}px)`,
                      top: `calc(50% - ${r}px)`,
                    }}
                  />
                ))}
                <motion.div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: 100,
                    height: 100,
                    marginLeft: -50,
                    marginTop: -50,
                    background: "conic-gradient(from 0deg, rgba(16,185,129,0.08) 0deg, transparent 50deg)",
                    borderRadius: "50%",
                  }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
              </div>

              {/* Location pin */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -inset-3 rounded-full bg-emerald-500"
                />
                <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              </div>

              {/* Address overlay */}
              <div className="absolute bottom-3 left-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0C0C0C]/90 px-3 py-2 backdrop-blur-sm">
                <p className="text-[11px] font-medium text-zinc-300">{asset.location}</p>
                {asset.assignee && (
                  <p className="mt-0.5 text-[9px] text-zinc-600">
                    Last tracked via {asset.assignee}&apos;s device
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Specs Grid */}
          <div className="p-6">
            <h2 className="mb-3 text-[12px] font-medium text-zinc-400">Specifications</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Hash, label: "Serial Number", value: asset.serialNumber },
                { icon: Calendar, label: "Purchase Date", value: asset.purchaseDate },
                { icon: DollarSign, label: "Purchase Price", value: `$${asset.purchasePrice.toLocaleString()}` },
                { icon: Shield, label: "Warranty Expiry", value: asset.warrantyExpiry },
                { icon: Clock, label: "Service Interval", value: `Every ${asset.serviceInterval} months` },
                { icon: Calendar, label: "Last Serviced", value: asset.lastServiceDate },
              ].map((spec) => {
                const Icon = spec.icon;
                return (
                  <motion.div
                    key={spec.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} className="text-zinc-600" />
                      <span className="text-[9px] uppercase tracking-wider text-zinc-600">{spec.label}</span>
                    </div>
                    <p className="mt-1 font-mono text-[12px] text-zinc-300">{spec.value}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Service due progress */}
            <div className="mt-4 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600">Service Due Progress</span>
                <span className={`text-[11px] font-medium ${
                  asset.serviceDuePercent >= 90 ? "text-red-400" :
                  asset.serviceDuePercent >= 70 ? "text-amber-400" :
                  "text-emerald-400"
                }`}>
                  {asset.serviceDuePercent}% — Next: {asset.nextServiceDate}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-zinc-900">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${asset.serviceDuePercent}%` }}
                  transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${
                    asset.serviceDuePercent >= 90 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" :
                    asset.serviceDuePercent >= 70 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" :
                    "bg-emerald-500"
                  }`}
                />
              </div>
            </div>

            {/* Notes */}
            {asset.notes && (
              <div className="mt-4 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-[11px] font-medium text-amber-400">Note</span>
                </div>
                <p className="mt-1 text-[12px] text-zinc-400">{asset.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: The Lifecycle (40%) ─────── */}
        <div className="flex w-[40%] flex-col overflow-y-auto">
          {/* Current Custody */}
          <div className="border-b border-[rgba(255,255,255,0.06)] p-6">
            <h2 className="mb-4 text-[12px] font-medium text-zinc-400">Current Custody</h2>

            {asset.assignee ? (
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-600/20 to-zinc-800/20 text-lg font-semibold text-[#00E676]">
                  {asset.assigneeInitials}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-zinc-200">{asset.assignee}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">Checked out</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setCheckingIn(true);
                      await toggleCustodyServer(asset.id, null, "Checked in");
                      setCheckingIn(false);
                    }}
                    disabled={checkingIn}
                    className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200 disabled:opacity-40"
                  >
                    {checkingIn ? "Checking in…" : "Check In"}
                  </button>
                  <button
                    onClick={() => setCustodyOpen(true)}
                    className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
                  >
                    <ArrowRightLeft size={12} className="mr-1 inline" />
                    Re-Assign
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-zinc-700">
                  <UserCheck size={24} strokeWidth={1} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] text-zinc-500">No one assigned</p>
                  <p className="text-[10px] text-zinc-700">Asset is at {asset.location}</p>
                </div>
                <button
                  onClick={() => setCustodyOpen(true)}
                  className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-zinc-200"
                >
                  <UserCheck size={12} className="mr-1 inline" />
                  Assign
                </button>
              </div>
            )}

            {/* Custody Modal */}
            <CustodyModal asset={asset} isOpen={custodyOpen} onClose={() => setCustodyOpen(false)} />
          </div>

          {/* Service Log / Activity Timeline */}
          <div className="flex-1 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[12px] font-medium text-zinc-400">Activity & Service Log</h2>
              <button
                onClick={() => setServiceLogOpen(true)}
                className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300"
              >
                <Wrench size={10} className="mr-1 inline" />
                Log Service
              </button>
            </div>

            <AuditTimeline entityId={asset.id} entityType="asset" />
          </div>
        </div>
      </div>

      {/* Service Log Modal */}
      <ServiceLogModal asset={asset} isOpen={serviceLogOpen} onClose={() => setServiceLogOpen(false)} />
    </div>
  );
}
