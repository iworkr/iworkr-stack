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
import { FileText } from "lucide-react";
import { useCallback } from "react";
import type { BlockType, FormBlock } from "@/lib/forms-data";
import { makeBlock } from "@/components/forms/document-forge/forge-config";
import { BlockRow } from "@/components/forms/document-forge/block-row";
import { EmptyBlock } from "@/components/forms/document-forge/empty-block";

function BlueprintGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-xl"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
        backgroundSize: "10px 10px",
      }}
    />
  );
}

interface FormBuilderProps {
  title: string;
  schemaElements: FormBlock[];
  selectedId: string | null;
  onSchemaChange: (next: FormBlock[]) => void;
  onSelectedIdChange: (next: string | null) => void;
}

export function FormBuilder({
  title,
  schemaElements,
  selectedId,
  onSchemaChange,
  onSelectedIdChange,
}: FormBuilderProps) {
  const addBlock = useCallback(
    (type: BlockType, index?: number) => {
      const next = makeBlock(type);
      if (index !== undefined) {
        const copy = [...schemaElements];
        copy.splice(index + 1, 0, next);
        onSchemaChange(copy);
      } else {
        onSchemaChange([...schemaElements, next]);
      }
      onSelectedIdChange(next.id);
    },
    [onSchemaChange, onSelectedIdChange, schemaElements]
  );

  const removeBlock = useCallback(
    (id: string) => {
      onSchemaChange(schemaElements.filter((b) => b.id !== id));
      if (selectedId === id) onSelectedIdChange(null);
    },
    [onSchemaChange, onSelectedIdChange, schemaElements, selectedId]
  );

  const updateBlock = useCallback(
    (id: string, patch: Partial<FormBlock>) => {
      onSchemaChange(schemaElements.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    },
    [onSchemaChange, schemaElements]
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const block = schemaElements.find((b) => b.id === id);
      if (!block) return;
      const copy = {
        ...block,
        id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      const idx = schemaElements.findIndex((b) => b.id === id);
      const next = [...schemaElements];
      next.splice(idx + 1, 0, copy);
      onSchemaChange(next);
      onSelectedIdChange(copy.id);
    },
    [onSchemaChange, onSelectedIdChange, schemaElements]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = schemaElements.findIndex((b) => b.id === active.id);
      const newIndex = schemaElements.findIndex((b) => b.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...schemaElements];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      onSchemaChange(next);
    },
    [onSchemaChange, schemaElements]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="relative min-h-[420px] rounded-xl border border-white/[0.04] bg-zinc-950/60 p-8">
        <BlueprintGrid />

        <div className="relative mb-8 flex items-center gap-2 text-zinc-500">
          <FileText size={18} className="shrink-0" />
          <span className="font-display text-[15px] font-semibold text-zinc-300">
            {title || "Untitled Form"}
          </span>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={schemaElements.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="relative space-y-1 pl-10">
              {schemaElements.map((block, index) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  isSelected={selectedId === block.id}
                  onSelect={() => onSelectedIdChange(block.id)}
                  onUpdate={(patch) => updateBlock(block.id, patch)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onDelete={() => removeBlock(block.id)}
                  onAddBelow={() => addBlock("short_text", index)}
                  onOpenSettings={undefined}
                />
              ))}
              <EmptyBlock
                onSelectType={(type) =>
                  addBlock(type, Math.max(0, schemaElements.length - 1))
                }
              />
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

