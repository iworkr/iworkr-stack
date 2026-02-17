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
import { useRouter } from "next/navigation";
import { type FormTemplate, type BlockType } from "@/lib/forms-data";
import { useFormsStore } from "@/lib/forms-store";

/* ── Category Config ──────────────────────────────────── */

const categoryConfig: Record<string, { icon: typeof FileText; accent: string }> = {
  Safety: { icon: ShieldCheck, accent: "text-amber-400" },
  Compliance: { icon: ShieldCheck, accent: "text-emerald-400" },
  Handover: { icon: ClipboardList, accent: "text-emerald-400" },
  Feedback: { icon: Star, accent: "text-zinc-400" },
  Maintenance: { icon: FileText, accent: "text-zinc-400" },
};

const blockIcons: Partial<Record<BlockType, typeof FileText>> = {
  signature: PenTool,
  photo_evidence: Camera,
  gps_stamp: MapPin,
  risk_matrix: AlertTriangle,
  checkbox: CheckSquare,
};

/* ── Form Card (Blueprint Style) ─────────────────────── */

interface FormCardProps {
  template: FormTemplate;
  index: number;
}

export function FormCard({ template, index }: FormCardProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { archiveTemplate, duplicateTemplate } = useFormsStore();

  const config = categoryConfig[template.category] || categoryConfig.Maintenance;
  const CatIcon = config.icon;

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

  const specialBlocks = template.blocks.filter(
    (b) => b.type === "signature" || b.type === "photo_evidence" || b.type === "gps_stamp" || b.type === "risk_matrix"
  );

  const isPublished = template.status === "published";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.05] bg-zinc-950/40 transition-all duration-300 hover:border-emerald-500/20 hover:shadow-[0_0_30px_-10px_rgba(16,185,129,0.08)]"
      style={{ aspectRatio: "3 / 4" }}
      whileHover={{ scale: 1.02 }}
    >
      {/* ── Document Preview (Blueprint wireframe) ──── */}
      <div className="relative flex flex-col items-center justify-center px-4 pt-5 pb-4 bg-[#0A0A0A]" style={{ height: "55%" }}>
        {/* Mini document wireframe */}
        <div className="w-full max-w-[140px] rounded-lg border border-white/[0.05] bg-[#050505] p-3">
          {/* Title line */}
          <div className="mb-2 h-1.5 w-[80%] rounded-full bg-white/[0.08]" />
          {/* Body lines */}
          <div className="mb-1.5 h-1 w-full rounded-full bg-white/[0.04]" />
          <div className="mb-1.5 h-1 w-[90%] rounded-full bg-white/[0.04]" />
          <div className="mb-2.5 h-1 w-[60%] rounded-full bg-white/[0.04]" />
          {/* Input fields */}
          <div className="mb-1.5 h-2 w-full rounded border border-white/[0.04] bg-white/[0.01]" />
          <div className="mb-1.5 h-2 w-full rounded border border-white/[0.04] bg-white/[0.01]" />
          {/* Checkboxes */}
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-sm bg-white/[0.06]" />
            <div className="h-1 w-[70%] rounded-full bg-white/[0.04]" />
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-sm bg-white/[0.06]" />
            <div className="h-1 w-[55%] rounded-full bg-white/[0.04]" />
          </div>
          {/* Signature box */}
          {specialBlocks.some((b) => b.type === "signature") && (
            <div className="mt-2 flex h-3 items-center justify-center rounded border border-dashed border-white/[0.06]">
              <PenTool size={6} className="text-white/[0.08]" />
            </div>
          )}
        </div>

        {/* Status pip — top left */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`inline-block h-[6px] w-[6px] rounded-full ${isPublished ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-[8px] font-medium uppercase tracking-wider text-zinc-600">
            {isPublished ? "Published" : "Draft"}
          </span>
        </div>

        {/* Category + Verified — top right */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {template.verified && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-amber-400">
              <ShieldCheck size={7} />
              Verified
            </span>
          )}
          <span className="rounded-full bg-white/[0.03] px-1.5 py-0.5 text-[7px] font-medium uppercase tracking-wider text-zinc-600">
            {template.category}
          </span>
        </div>

        {/* Hover overlay — "Use" / "Edit" */}
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 backdrop-blur-sm"
          >
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/forms/fill/${template.id}`); }}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-white/[0.1]"
            >
              <Eye size={12} />
              Use
            </button>
            {template.source === "custom" && (
              <button
                onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/forms/builder/${template.id}`); }}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-white/[0.1]"
              >
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
          <h3 className="truncate text-[13px] font-medium text-white">
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
                  className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.03] text-zinc-600"
                  title={b.label}
                >
                  <Icon size={10} strokeWidth={1.5} />
                </div>
              );
            })}
          </div>
        )}

        {/* Forensic metadata row */}
        <div className="mt-auto flex items-center justify-between border-t border-white/[0.03] pt-2 font-mono text-[9px] text-zinc-700">
          <span>{template.usedCount} uses</span>
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
          className="rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-white/[0.04] hover:text-zinc-400 group-hover:opacity-100"
        >
          <MoreVertical size={12} />
        </button>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute right-0 bottom-8 z-50 w-36 rounded-lg border border-white/[0.06] bg-[#0C0C0C] py-1 shadow-xl"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                router.push(`/dashboard/forms/builder/${template.id}`);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
            >
              <Edit3 size={11} /> Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateTemplate(template.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
            >
              <Copy size={11} /> Duplicate
            </button>
            <div className="my-1 h-px bg-white/[0.04]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                archiveTemplate(template.id);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-rose-400 transition-colors hover:bg-rose-500/10"
            >
              <Archive size={11} /> Archive
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
