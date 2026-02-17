"use client";

import { motion } from "framer-motion";
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
  Pause,
  Play,
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

/* ── Category colors ──────────────────────────────────── */

/* Category icon colors are subtle/muted — the card border & glow use brand green */
const categoryIconColors: Record<string, { text: string; bg: string }> = {
  marketing: { text: "text-violet-400/60", bg: "bg-violet-500/8" },
  billing: { text: "text-amber-400/60", bg: "bg-amber-500/8" },
  operations: { text: "text-zinc-400", bg: "bg-zinc-500/10" },
};

const activeCardStyle = {
  border: "border-[rgba(0,230,118,0.3)]",
  glow: "shadow-[0_0_20px_-4px_rgba(0,230,118,0.3)]",
};

/* ── Sparkline component ──────────────────────────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const width = 100;
  const height = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
      />
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color})`}
        className={color}
      />
    </svg>
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
  const menuRef = useRef<HTMLDivElement>(null);

  const Icon = iconMap[flow.icon] || Zap;
  const catIcon = categoryIconColors[flow.category] || categoryIconColors.operations;
  const isActive = flow.status === "active";
  const isPaused = flow.status === "paused";
  const isDraft = flow.status === "draft";

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(`/dashboard/automations/${flow.id}`)}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300 hover:border-[rgba(0,230,118,0.25)] hover:shadow-[0_0_20px_-4px_rgba(0,230,118,0.2)] ${
        isActive ? `${activeCardStyle.border} ${activeCardStyle.glow}` : "border-[rgba(255,255,255,0.06)]"
      } ${isPaused ? "opacity-60" : ""} ${isDraft ? "opacity-50" : ""}`}
      style={{ background: "var(--surface-1)", aspectRatio: "3 / 2" }}
      whileHover={{ y: -3 }}
    >
      {/* Active pulse border animation */}
      {isActive && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ border: `1px solid`, borderColor: "inherit" }}
        />
      )}

      {/* Content */}
      <div className="flex h-full flex-col p-4">
        {/* Top row: icon + status */}
        <div className="flex items-start justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${catIcon.bg}`}>
            <Icon size={20} strokeWidth={1.5} className={catIcon.text} />
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-zinc-500">
                Draft
              </span>
            )}

            {/* Toggle */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (actionLoading) return;
                setActionLoading(true);
                const { error } = await toggleFlowStatusServer(flow.id);
                if (error) addToast(`Failed to toggle: ${error}`);
                else addToast(isActive ? `${flow.title} paused` : `${flow.title} activated`);
                setActionLoading(false);
              }}
              disabled={actionLoading}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                isActive ? "bg-[#00E676]" : "bg-zinc-800"
              } ${actionLoading ? "opacity-50" : ""}`}
            >
              <motion.div
                animate={{ x: isActive ? 16 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
        </div>

        {/* Title + Description */}
        <div className="mt-3 flex-1">
          <h3 className="text-[13px] font-medium text-zinc-200">{flow.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-[14px] text-zinc-600">
            {flow.description}
          </p>
        </div>

        {/* Metrics */}
        {isActive && (
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            {flow.metrics.openRate !== undefined && (
              <span className="text-zinc-500">{flow.metrics.openRate}% Open Rate</span>
            )}
            {flow.metrics.replies !== undefined && (
              <span className="text-zinc-500">{flow.metrics.replies} Replies</span>
            )}
            <span className="text-zinc-600">{flow.metrics.runs24h} runs/24h</span>
          </div>
        )}

        {/* Sparkline */}
        <div className="mt-2">
          <Sparkline data={flow.sparkline} color="text-[#00E676]" />
        </div>
      </div>

      {/* Version badge */}
      <div className="absolute bottom-3 right-3 text-[9px] font-mono text-zinc-700">
        v{flow.version}
      </div>

      {/* Context menu */}
      <div className="absolute right-2 top-2" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400 group-hover:opacity-100"
        >
          <MoreVertical size={12} />
        </button>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#161616] py-1 shadow-xl"
          >
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); router.push(`/dashboard/automations/${flow.id}`); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
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
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
            >
              <Copy size={11} /> Duplicate
            </button>
            <div className="my-1 h-px bg-[rgba(255,255,255,0.06)]" />
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
      </div>
    </motion.div>
  );
}
