/**
 * @component components/finance/editor/PaperCanvas.tsx
 * @status STABLE
 * @description Moneta invoice canvas — PaperCanvas
 * @lastReview 2026-03-28
 */
"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback } from "react";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { CanvasBlock } from "./CanvasBlock";

export function PaperCanvas() {
  const blocks = useInvoiceEditorStore((s) => s.blocks);
  const settings = useInvoiceEditorStore((s) => s.globalSettings);
  const workspace = useInvoiceEditorStore((s) => s.workspace);
  const reorderBlocks = useInvoiceEditorStore((s) => s.reorderBlocks);
  const setActiveBlock = useInvoiceEditorStore((s) => s.setActiveBlock);
  const setEditingBlock = useInvoiceEditorStore((s) => s.setEditingBlock);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      reorderBlocks(oldIndex, newIndex);
    },
    [blocks, reorderBlocks],
  );

  function handleCanvasClick() {
    setActiveBlock(null);
    setEditingBlock(null);
  }

  return (
    <div className="flex flex-1 items-start justify-center overflow-auto p-6 bg-[var(--background)]">
      <div
        onClick={handleCanvasClick}
        className="relative w-full max-w-[800px] bg-white shadow-2xl rounded-sm overflow-hidden"
        style={{ aspectRatio: "1 / 1.414", minHeight: 900, fontFamily: settings.fontFamily || "Inter" }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={blocks.map((b) => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="relative pl-8">
              {blocks.map((block) => (
                <CanvasBlock
                  key={block.id}
                  block={block}
                  settings={settings}
                  workspace={workspace}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Footer watermark */}
        <div className="absolute bottom-4 left-10 right-10 flex justify-between text-[7px] text-gray-300">
          <span>{workspace.name}</span>
          <span>Powered by iWorkr</span>
        </div>
      </div>
    </div>
  );
}
