"use client";

import { motion } from "framer-motion";
import {
  FileText,
  ShieldCheck,
  PenTool,
  ClipboardList,
  Star,
  MoreVertical,
  Copy,
  Archive,
  Edit3,
  Eye,
  Camera,
  MapPin,
  CheckSquare,
  AlertTriangle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { type FormTemplate, type BlockType } from "@/lib/forms-data";
import { useFormsStore } from "@/lib/forms-store";

/* ── Category Config ──────────────────────────────────── */

const categoryConfig: Record<string, { icon: typeof FileText; gradient: string; accent: string }> = {
  Safety: { icon: ShieldCheck, gradient: "from-amber-600/20 to-orange-700/10", accent: "text-amber-400" },
  Compliance: { icon: ShieldCheck, gradient: "from-blue-600/20 to-indigo-700/10", accent: "text-blue-400" },
  Handover: { icon: ClipboardList, gradient: "from-emerald-600/20 to-teal-700/10", accent: "text-emerald-400" },
  Feedback: { icon: Star, gradient: "from-violet-600/20 to-purple-700/10", accent: "text-violet-400" },
  Maintenance: { icon: FileText, gradient: "from-zinc-600/20 to-zinc-700/10", accent: "text-zinc-400" },
};

const blockIcons: Partial<Record<BlockType, typeof FileText>> = {
  signature: PenTool,
  photo_evidence: Camera,
  gps_stamp: MapPin,
  risk_matrix: AlertTriangle,
  checkbox: CheckSquare,
};

/* ── Form Card ────────────────────────────────────────── */

interface FormCardProps {
  template: FormTemplate;
  index: number;
}

export function FormCard({ template, index }: FormCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { archiveTemplate, duplicateTemplate } = useFormsStore();

  const config = categoryConfig[template.category] || categoryConfig.Maintenance;
  const CatIcon = config.icon;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Count special blocks
  const specialBlocks = template.blocks.filter(
    (b) => b.type === "signature" || b.type === "photo_evidence" || b.type === "gps_stamp" || b.type === "risk_matrix"
  );

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
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C0C0C] transition-all duration-300 hover:border-[rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_-8px_rgba(255,255,255,0.04)]"
      style={{ aspectRatio: "3 / 4" }}
      whileHover={{ y: -4 }}
    >
      {/* ── Document Preview (top area) ─────────────── */}
      <div className={`relative flex flex-col items-center justify-center bg-gradient-to-br px-4 pt-5 pb-4 ${config.gradient}`} style={{ height: "55%" }}>
        {/* Mini document lines (faked preview) */}
        <div className="w-full max-w-[140px] rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.3)] p-3 backdrop-blur-sm">
          {/* Title line */}
          <div className="mb-2 h-1.5 w-[80%] rounded-full bg-[rgba(255,255,255,0.12)]" />
          {/* Body lines */}
          <div className="mb-1.5 h-1 w-full rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="mb-1.5 h-1 w-[90%] rounded-full bg-[rgba(255,255,255,0.06)]" />
          <div className="mb-2.5 h-1 w-[60%] rounded-full bg-[rgba(255,255,255,0.06)]" />
          {/* Input field placeholder */}
          <div className="mb-1.5 h-2 w-full rounded border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]" />
          <div className="mb-1.5 h-2 w-full rounded border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]" />
          {/* Checkbox lines */}
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-sm bg-[rgba(255,255,255,0.1)]" />
            <div className="h-1 w-[70%] rounded-full bg-[rgba(255,255,255,0.06)]" />
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-sm bg-[rgba(255,255,255,0.1)]" />
            <div className="h-1 w-[55%] rounded-full bg-[rgba(255,255,255,0.06)]" />
          </div>
          {/* Signature box */}
          {specialBlocks.some((b) => b.type === "signature") && (
            <div className="mt-2 flex h-3 items-center justify-center rounded border border-dashed border-[rgba(255,255,255,0.08)]">
              <PenTool size={6} className="text-[rgba(255,255,255,0.1)]" />
            </div>
          )}
        </div>

        {/* Category badge */}
        <div className="absolute left-3 top-3">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[8px] font-medium uppercase tracking-wider text-zinc-400 backdrop-blur-sm">
            <CatIcon size={8} strokeWidth={1.5} />
            {template.category}
          </span>
        </div>

        {/* Verified badge */}
        {template.verified && (
          <div className="absolute right-3 top-3">
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-400 backdrop-blur-sm">
              <ShieldCheck size={8} />
              Verified
            </span>
          </div>
        )}

        {/* Draft badge */}
        {template.status === "draft" && (
          <div className="absolute right-3 top-3">
            <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[8px] font-medium uppercase tracking-wider text-zinc-500 backdrop-blur-sm">
              Draft
            </span>
          </div>
        )}

        {/* Hover overlay — "Use" / "Edit" */}
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 backdrop-blur-sm"
          >
            <button className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.08)] px-3.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.15)]">
              <Eye size={12} />
              Use
            </button>
            {template.source === "custom" && (
              <button className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.08)] px-3.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[rgba(255,255,255,0.15)]">
                <Edit3 size={12} />
                Edit
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Card Body ──────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-between px-4 py-3" style={{ height: "45%" }}>
        <div>
          <h3 className="truncate text-[13px] font-medium text-zinc-200">
            {template.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-[14px] text-zinc-600">
            {template.description}
          </p>
        </div>

        {/* Special block icons */}
        {specialBlocks.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {specialBlocks.map((b) => {
              const Icon = blockIcons[b.type] || FileText;
              return (
                <div
                  key={b.id}
                  className="flex h-5 w-5 items-center justify-center rounded bg-[rgba(255,255,255,0.04)] text-zinc-600"
                  title={b.label}
                >
                  <Icon size={10} strokeWidth={1.5} />
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row */}
        <div className="mt-auto flex items-center justify-between pt-2 text-[10px] text-zinc-600">
          <span>Used {template.usedCount} times</span>
          <span>v{template.version} · {template.lastEdited}</span>
        </div>
      </div>

      {/* ── Context Menu Trigger ───────────────────── */}
      <div className="absolute right-2 bottom-2" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400 group-hover:opacity-100"
        >
          <MoreVertical size={12} />
        </button>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute right-0 bottom-8 z-50 w-36 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#161616] py-1 shadow-xl"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
            >
              <Edit3 size={11} /> Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateTemplate(template.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
            >
              <Copy size={11} /> Duplicate
            </button>
            <div className="my-1 h-px bg-[rgba(255,255,255,0.06)]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                archiveTemplate(template.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Archive size={11} /> Archive
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
