"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Receipt,
  Clock,
  UserCheck,
  FileText,
  Package,
  Mail,
  FileCheck,
  MoreVertical,
  Copy,
  Archive,
  Edit3,
  Zap,
  CreditCard,
  MessageSquare,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type AutomationFlow } from "@/lib/automations-data";
import { useAutomationsStore } from "@/lib/automations-store";
import { useToastStore } from "@/components/app/action-toast";

/* ── Icon map ─────────────────────────────────────────── */

const iconMap: Record<string, typeof Star> = {
  Star, Receipt, Clock, UserCheck, FileText, Package, Mail, FileCheck, CreditCard, MessageSquare,
};

/* ── PRD: Monochrome icon style — no rainbow categories ── */

const iconStyle = { text: "text-zinc-400", bg: "bg-zinc-800/60" };

/* ── Green Sparkline ──────────────────────────────────── */

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const width = 100;
  const height = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id="spark-green-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00E676" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00E676" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="#00E676"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#spark-green-fill)"
      />
    </svg>
  );
}

/* ── Custom Switch Toggle ────────────────────────────── */

function FlowToggle({
  checked,
  loading,
  onChange,
}: {
  checked: boolean;
  loading: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-200 ${
        loading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-[#00E676] shadow-[0_0_8px_rgba(0,230,118,0.3)]" : "bg-zinc-800"}`}
    >
      <motion.span
        animate={{ x: checked ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`inline-block h-3.5 w-3.5 rounded-full transition-colors ${
          checked ? "bg-white" : "bg-zinc-950"
        }`}
      />
    </button>
  );
}

/* ── Flow Card ────────────────────────────────────────── */

interface FlowCardProps {
  flow: AutomationFlow;
  index: number;
}

export function FlowCard({ flow, index }: FlowCardProps) {
  const router = useRouter();
  const { toggleFlowStatusServer, archiveFlowServer, duplicateFlowServer } = useAutomationsStore();
  const { addToast } = useToastStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [borderFlash, setBorderFlash] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const Icon = iconMap[flow.icon] || Zap;
  const isActive = flow.status === "active";
  const isPaused = flow.status === "paused";
  const isDraft = flow.status === "draft";

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const handleToggle = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    const wasActive = isActive;
    const { error } = await toggleFlowStatusServer(flow.id);
    if (error) {
      addToast(`Failed to toggle: ${error}`);
    } else {
      addToast(wasActive ? `${flow.title} paused` : `${flow.title} activated`);
      if (!wasActive) {
        setBorderFlash(true);
        setTimeout(() => setBorderFlash(false), 600);
      }
    }
    setActionLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(`/dashboard/automations/${flow.id}`)}
      whileHover={{ y: -4, boxShadow: "0 10px 40px -10px rgba(0, 230, 118, 0.2)" }}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 hover:border-[#00E676]/30 ${
        borderFlash ? "border-[#00E676]/60 shadow-[0_0_30px_-8px_rgba(0,230,118,0.5)]" : ""
      } ${isActive && !borderFlash ? "border-[#00E676]/20" : ""} ${
        !isActive && !borderFlash ? "border-white/5" : ""
      } ${isPaused ? "opacity-60" : ""} ${isDraft ? "opacity-50" : ""}`}
      style={{ aspectRatio: "3 / 2" }}
    >
      {/* Content */}
      <div className="flex h-full flex-col p-4">
        {/* Top row: icon + toggle + status */}
        <div className="flex items-start justify-between">
          {/* Animated icon — glows on hover */}
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0], scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyle.bg} transition-colors group-hover:bg-[rgba(0,230,118,0.08)]`}
          >
            <Icon size={20} strokeWidth={1.5} className={`${iconStyle.text} transition-colors group-hover:text-[#00E676]`} />
          </motion.div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            {isActive && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E676] opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#00E676]" />
              </span>
            )}
            {isPaused && (
              <span className="inline-flex h-2.5 w-2.5 rounded-full border-[1.5px] border-zinc-600" />
            )}
            {isDraft && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                Draft
              </span>
            )}

            {/* Toggle — PRD: Neon green on, zinc off */}
            <FlowToggle checked={isActive} loading={actionLoading} onChange={handleToggle} />
          </div>
        </div>

        {/* Title + Description */}
        <div className="mt-3 flex-1">
          <h3 className="text-[13px] font-medium text-white">{flow.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-[14px] text-zinc-500">
            {flow.description}
          </p>
        </div>

        {/* Metrics */}
        {isActive && (
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            <span className="text-zinc-500">{flow.metrics.successRate}% success</span>
            <span className="text-zinc-600">{flow.metrics.runs24h} runs/24h</span>
          </div>
        )}

        {/* Green Gradient Sparkline */}
        <div className="mt-2">
          <Sparkline data={flow.sparkline} />
        </div>
      </div>

      {/* Version badge */}
      <div className="absolute bottom-3 right-3 font-mono text-[9px] text-zinc-700">
        v{flow.version}
      </div>

      {/* Context menu */}
      <div className="absolute right-2 top-2" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-white/[0.06] hover:text-zinc-400 group-hover:opacity-100"
        >
          <MoreVertical size={12} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-white/[0.08] bg-[#161616] py-1 shadow-xl"
            >
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); router.push(`/dashboard/automations/${flow.id}`); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              >
                <Edit3 size={11} /> Edit Flow
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  const { error } = await duplicateFlowServer(flow.id);
                  if (error) addToast(`Failed to duplicate: ${error}`);
                  else addToast(`${flow.title} duplicated`);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
              >
                <Copy size={11} /> Duplicate
              </button>
              <div className="my-1 h-px bg-white/[0.06]" />
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  const { error } = await archiveFlowServer(flow.id);
                  if (error) addToast(`Failed to archive: ${error}`);
                  else addToast(`${flow.title} archived`);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-500/10"
              >
                <Archive size={11} /> Archive
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
