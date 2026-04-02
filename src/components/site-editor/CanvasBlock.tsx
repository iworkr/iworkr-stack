/**
 * @component components/site-editor/CanvasBlock.tsx
 * @status STABLE
 * @description Loom site builder — CanvasBlock
 * @lastReview 2026-03-28
 */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import type { SiteBlock, SiteBlockType, SiteBlockContentMap, SiteGlobalStyles } from "./types";
import { SITE_BLOCK_LABELS } from "./types";
import { EDITOR_BLOCK_REGISTRY } from "./blocks";

interface Props {
  block: SiteBlock;
  isActive: boolean;
  isEditing: boolean;
  globalStyles: SiteGlobalStyles;
  onSelect: () => void;
  onDoubleClick: () => void;
  onContentChange: (patch: Partial<SiteBlockContentMap[SiteBlockType]>) => void;
  onRemove: () => void;
}

export function SiteCanvasBlock({
  block,
  isActive,
  isEditing,
  globalStyles,
  onSelect,
  onDoubleClick,
  onContentChange,
  onRemove,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: block.locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Renderer = EDITOR_BLOCK_REGISTRY[block.type];
  if (!Renderer) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative transition-all ${
        isActive
          ? "ring-2 ring-emerald-500/60 rounded-lg"
          : "hover:ring-1 hover:ring-zinc-300/30 rounded-lg"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
    >
      {/* Drag handle + block type label */}
      <div className={`absolute -left-8 top-2 flex items-center gap-1 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
      </div>

      {/* Block label badge */}
      {isActive && (
        <div className="absolute -top-6 left-2 flex items-center gap-2">
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            {SITE_BLOCK_LABELS[block.type]}
          </span>
          {block.deletable !== false && !block.locked && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      <Renderer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        block={block as any}
        isActive={isActive}
        isEditing={isEditing}
        globalStyles={globalStyles}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onContentChange={onContentChange as any}
      />
    </div>
  );
}
