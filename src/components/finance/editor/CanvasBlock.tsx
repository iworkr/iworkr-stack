/**
 * @component components/finance/editor/CanvasBlock.tsx
 * @status STABLE
 * @description Moneta invoice canvas — CanvasBlock
 * @lastReview 2026-03-28
 */
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Lock } from "lucide-react";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { BLOCK_RENDERER_MAP } from "./blocks";
import type { InvoiceBlock, GlobalSettings, WorkspaceBrand } from "./types";

interface CanvasBlockProps {
  block: InvoiceBlock;
  settings: GlobalSettings;
  workspace: WorkspaceBrand;
}

export function CanvasBlock({ block, settings, workspace }: CanvasBlockProps) {
  const activeBlockId = useInvoiceEditorStore((s) => s.activeBlockId);
  const editingBlockId = useInvoiceEditorStore((s) => s.editingBlockId);
  const setActiveBlock = useInvoiceEditorStore((s) => s.setActiveBlock);
  const setEditingBlock = useInvoiceEditorStore((s) => s.setEditingBlock);
  const removeBlock = useInvoiceEditorStore((s) => s.removeBlock);
  const updateBlockContent = useInvoiceEditorStore((s) => s.updateBlockContent);

  const isActive = activeBlockId === block.id;
  const isEditing = editingBlockId === block.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: !!block.locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Renderer = BLOCK_RENDERER_MAP[block.type];
  if (!Renderer) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/canvas-block relative transition-all duration-100 ${
        isDragging ? "opacity-50 z-50" : ""
      } ${
        isActive
          ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-white rounded-sm"
          : "hover:ring-1 hover:ring-blue-300/30 hover:rounded-sm"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setActiveBlock(block.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setActiveBlock(block.id);
        setEditingBlock(block.id);
      }}
    >
      {/* Drag handle + actions (visible on hover or active) */}
      <div
        className={`absolute -left-7 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 transition-opacity ${
          isActive || isDragging ? "opacity-100" : "opacity-0 group-hover/canvas-block:opacity-100"
        }`}
      >
        {block.locked ? (
          <div className="flex h-5 w-5 items-center justify-center rounded text-gray-300">
            <Lock size={10} />
          </div>
        ) : (
          <>
            <button
              className="flex h-5 w-5 cursor-grab items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={12} />
            </button>
            {block.deletable !== false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeBlock(block.id);
                }}
                className="flex h-5 w-5 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-400"
              >
                <Trash2 size={10} />
              </button>
            )}
          </>
        )}
      </div>

      <Renderer
        block={block}
        isActive={isActive}
        isEditing={isEditing}
        settings={settings}
        workspace={workspace}
        onContentChange={(patch) => updateBlockContent(block.id, patch)}
      />
    </div>
  );
}
