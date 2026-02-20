"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  GripVertical,
  Plus,
  Copy,
  Trash2,
  Settings,
  EyeOff,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { FormBlock } from "@/lib/forms-data";
import { BlockPreview } from "./block-preview";

interface BlockRowProps {
  block: FormBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<FormBlock>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAddBelow: () => void;
  onOpenSettings?: () => void;
  hasConditionalLogic?: boolean;
}

export function BlockRow({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onDuplicate,
  onDelete,
  onAddBelow,
  onOpenSettings,
  hasConditionalLogic,
}: BlockRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const contextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenuOpen]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/row relative"
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative rounded-lg transition-shadow ${
          isSelected ? "ring-1 ring-white/20" : ""
        } ${isDragging ? "opacity-50" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {/* Left margin: + and ::: on hover */}
        <div className="absolute -left-10 top-0 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddBelow();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:bg-white/10 hover:text-white"
            aria-label="Add block below"
          >
            <Plus size={12} />
          </button>
          <button
            type="button"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded active:cursor-grabbing text-zinc-600 hover:bg-white/10 hover:text-white"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <span className="font-mono text-[10px] tracking-wider">⋯</span>
          </button>
        </div>

        {/* Block content */}
        <div className="min-h-[40px] pl-1 pr-2 py-2">
          {/* Field label row */}
          <div className="mb-1.5 flex items-center justify-between gap-2">
            {block.type === "heading" ? null : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={block.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-[200px] bg-transparent text-[12px] font-medium text-zinc-400 outline-none placeholder-zinc-600 focus:text-zinc-200"
                  placeholder="Field title"
                />
                {block.required && (
                  <span className="text-rose-500" aria-hidden>*</span>
                )}
                {hasConditionalLogic && (
                  <span title="Has conditional logic" className="inline-flex">
                    <EyeOff size={10} className="text-zinc-600" />
                  </span>
                )}
              </div>
            )}
            {isSelected && (
              <div ref={contextRef} className="relative flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenuOpen((v) => !v);
                  }}
                  className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white"
                  aria-label="Options"
                >
                  <span className="font-mono text-[10px]">⋯</span>
                </button>
                <AnimatePresence>
                  {contextMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute right-0 top-full z-20 mt-1 flex flex-col rounded-lg border border-white/10 bg-zinc-900/95 py-1 shadow-xl backdrop-blur-md"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onUpdate({ required: !block.required });
                          setContextMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white"
                      >
                        {block.required ? "Required ✓" : "Optional"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDuplicate();
                          setContextMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white"
                      >
                        <Copy size={11} /> Duplicate
                      </button>
                      {onOpenSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenSettings();
                            setContextMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white"
                        >
                          <Settings size={11} /> Settings
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onDelete();
                          setContextMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-rose-400/90 hover:bg-rose-500/10"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          <BlockPreview block={block} isBuilder />
        </div>
      </motion.div>
    </div>
  );
}
