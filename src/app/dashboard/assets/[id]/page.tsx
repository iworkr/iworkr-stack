"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  Printer,
  Flag,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAssetsStore } from "@/lib/assets-store";
import { type AssetCategory } from "@/lib/assets-data";
import { CustodyModal } from "@/components/assets/custody-modal";
import { ServiceLogModal } from "@/components/assets/service-log-modal";
import { AuditTimeline } from "@/components/assets/audit-timeline";

const categoryIcons: Record<AssetCategory, typeof Truck> = {
  vehicle: Truck,
  tool: Wrench,
  equipment: Cog,
};

const statusConfig: Record<string, { color: string; text: string; border: string; bg: string; label: string }> = {
  available: { color: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/10", label: "Available" },
  assigned: { color: "bg-sky-400", text: "text-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/10", label: "On Job" },
  maintenance: { color: "bg-rose-500", text: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10", label: "Maintenance" },
};

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { assets, toggleCustodyServer, updateAssetStatusServer } = useAssetsStore();
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [serviceLogOpen, setServiceLogOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [activePanel, setActivePanel] = useState<"custody" | "timeline">("timeline");

  const asset = useMemo(
    () => assets.find((a) => a.id === params.id),
    [assets, params.id]
  );

  if (!asset) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Package size={20} className="text-zinc-600" />
        </div>
        <p className="text-[13px] text-zinc-500">Asset not found</p>
        <button
          onClick={() => router.push("/dashboard/assets")}
          className="text-[12px] text-emerald-500 transition-colors hover:text-emerald-400"
        >
          ← Back to Assets
        </button>
      </div>
    );
  }

  const CatIcon = categoryIcons[asset.category];
  const status = statusConfig[asset.status];

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-white/[0.04] bg-zinc-950/80 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/assets")}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="flex items-center gap-1.5 text-[12px]">
              <Link href="/dashboard/assets" className="text-zinc-600 transition-colors hover:text-zinc-400">Assets</Link>
              <ChevronRight size={10} className="text-zinc-700" />
              <span className="font-mono text-zinc-400">{asset.tag}</span>
              <ChevronRight size={10} className="text-zinc-700" />
              <span className="font-medium text-white">{asset.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-medium ${status.bg} ${status.text} ${status.border}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── Content Split ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Blueprint (60%) */}
        <div className="flex w-[60%] flex-col overflow-y-auto border-r border-white/[0.04] scrollbar-none">
          {/* Hero image */}
          <div className="relative flex h-56 items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <CatIcon size={80} strokeWidth={0.4} className="text-white/[0.06]" />

            {/* Category badge */}
            <div className="absolute left-4 top-4 rounded-md bg-black/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500 backdrop-blur-sm">
              {asset.category}
            </div>

            {/* QR Code placeholder */}
            <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/[0.06] bg-black/40 backdrop-blur-sm">
              <QrCode size={20} strokeWidth={1} className="text-zinc-600" />
            </div>

            {/* Name overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#050505] to-transparent px-6 pb-5 pt-12">
              <span className="font-mono text-[10px] text-zinc-600">{asset.tag} • {asset.serialNumber}</span>
              <h1 className="mt-0.5 text-[22px] font-medium tracking-tight text-zinc-100">{asset.name}</h1>
            </div>
          </div>

          {/* Map Widget */}
          <div className="border-b border-white/[0.04] p-6">
            <div className="mb-3 flex items-center gap-2">
              <MapPin size={12} className="text-zinc-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Last Known Location</span>
            </div>
            <div className="relative h-40 overflow-hidden rounded-xl border border-white/[0.04] bg-[#080808]">
              <div
                className="absolute inset-0 opacity-[0.03]"
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
                    className="absolute rounded-full border border-emerald-500/8"
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
                    background: "conic-gradient(from 0deg, rgba(16,185,129,0.06) 0deg, transparent 50deg)",
                    borderRadius: "50%",
                  }}
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
              </div>

              {/* Pin */}
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

              <div className="absolute bottom-3 left-3 rounded-lg border border-white/[0.06] bg-[#0A0A0A]/90 px-3 py-2 backdrop-blur-sm">
                <p className="text-[11px] font-medium text-zinc-300">{asset.location}</p>
                {asset.assignee && (
                  <p className="mt-0.5 text-[9px] text-zinc-600">
                    Tracked via {asset.assignee}&apos;s device
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Specifications Grid */}
          <div className="p-6">
            <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Specifications</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Hash, label: "Serial Number", value: asset.serialNumber },
                { icon: Calendar, label: "Purchase Date", value: asset.purchaseDate },
                { icon: DollarSign, label: "Purchase Price", value: `$${asset.purchasePrice.toLocaleString()}`, mono: true },
                { icon: Shield, label: "Warranty Expiry", value: asset.warrantyExpiry },
                { icon: Clock, label: "Service Interval", value: `Every ${asset.serviceInterval} months` },
                { icon: Calendar, label: "Last Serviced", value: asset.lastServiceDate },
              ].map((spec, i) => {
                const Icon = spec.icon;
                return (
                  <motion.div
                    key={spec.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.03, duration: 0.3 }}
                    className="rounded-xl bg-zinc-900/30 p-3 transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} className="text-zinc-600" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">{spec.label}</span>
                    </div>
                    <p className={`mt-1 text-[12px] text-zinc-300 ${spec.mono ? "font-mono text-emerald-400" : ""}`}>
                      {spec.value}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Service due bar */}
            <div className="mt-4 rounded-xl bg-zinc-900/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Service Due Progress</span>
                <span className={`font-mono text-[11px] font-medium ${
                  asset.serviceDuePercent >= 90 ? "text-rose-400" :
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
                    asset.serviceDuePercent >= 90 ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" :
                    asset.serviceDuePercent >= 70 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" :
                    "bg-emerald-500"
                  }`}
                />
              </div>
            </div>

            {/* Notes */}
            {asset.notes && (
              <div className="mt-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-400" />
                  <span className="text-[11px] font-medium text-amber-400">Note</span>
                </div>
                <p className="mt-1 text-[12px] text-zinc-400">{asset.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Lifecycle (40%) */}
        <div className="flex w-[40%] flex-col overflow-hidden">
          {/* Custody Section */}
          <div className="border-b border-white/[0.04] p-6">
            <h2 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600">Current Custody</h2>

            {asset.assignee ? (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 text-lg font-semibold text-emerald-400">
                  {asset.assigneeInitials}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-zinc-200">{asset.assignee}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">Checked out</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setCheckingIn(true);
                      await toggleCustodyServer(asset.id, null, "Checked in");
                      setCheckingIn(false);
                    }}
                    disabled={checkingIn}
                    className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200 disabled:opacity-40"
                  >
                    {checkingIn ? "Checking in…" : "Check In"}
                  </button>
                  <button
                    onClick={() => setCustodyOpen(true)}
                    className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
                  >
                    <ArrowRightLeft size={12} className="mr-1 inline" />
                    Transfer
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/[0.06] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-zinc-700">
                  <UserCheck size={22} strokeWidth={1} />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] text-zinc-500">No one assigned</p>
                  <p className="text-[10px] text-zinc-700">Asset is at {asset.location}</p>
                </div>
                <button
                  onClick={() => setCustodyOpen(true)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-none transition-colors hover:bg-emerald-500"
                >
                  <UserCheck size={12} className="mr-1 inline" />
                  Assign
                </button>
              </div>
            )}

            <CustodyModal asset={asset} isOpen={custodyOpen} onClose={() => setCustodyOpen(false)} />
          </div>

          {/* Activity Timeline */}
          <div className="flex flex-1 flex-col overflow-y-auto p-6 scrollbar-none">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Activity & Service Log</h2>
              <button
                onClick={() => setServiceLogOpen(true)}
                className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-emerald-400"
              >
                <Wrench size={10} className="mr-1 inline" />
                Log Service
              </button>
            </div>

            <AuditTimeline entityId={asset.id} entityType="asset" />
          </div>

          {/* Sticky Footer Actions */}
          <div className="border-t border-white/[0.04] bg-zinc-950/80 px-6 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCustodyOpen(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
              >
                <ArrowRightLeft size={12} />
                Transfer
              </button>
              <button
                onClick={() => updateAssetStatusServer(asset.id, "maintenance")}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-rose-400"
              >
                <Flag size={12} />
                Report Issue
              </button>
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] py-2 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200">
                <Printer size={12} />
                Print Tag
              </button>
            </div>
          </div>
        </div>
      </div>

      <ServiceLogModal asset={asset} isOpen={serviceLogOpen} onClose={() => setServiceLogOpen(false)} />
    </div>
  );
}

function Package({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}
