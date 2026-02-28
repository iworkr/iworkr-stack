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
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Eye,
  Send,
  Loader2,
  FileText,
  Plus,
  FileDown,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFormsStore } from "@/lib/forms-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getForm } from "@/app/actions/forms";
import type { FormBlock, BlockType } from "@/lib/forms-data";
import { useToastStore } from "@/components/app/action-toast";
import { makeBlock } from "@/components/forms/document-forge/forge-config";
import { BlockRow } from "@/components/forms/document-forge/block-row";
import { EmptyBlock } from "@/components/forms/document-forge/empty-block";

/* ── Blueprint grid background ───────────────────────────── */

function BlueprintGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-xl"
      style={{
        backgroundImage: `
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)
        `,
        backgroundSize: "10px 10px",
      }}
    />
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function FormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const { updateFormServer, createFormServer, publishFormServer } = useFormsStore();
  const { addToast } = useToastStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);

  const isNew = params.id === "new";

  useEffect(() => {
    if (isNew) {
      setTitle("Untitled Form");
      setLoadingForm(false);
      return;
    }
    getForm(params.id as string).then(({ data }) => {
      if (data) {
        setFormId(data.id);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setCategory(data.category || "custom");
        setBlocks(Array.isArray(data.blocks) ? data.blocks as unknown as FormBlock[] : []);
      }
      setLoadingForm(false);
    });
  }, [params.id, isNew]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    if (formId) {
      await updateFormServer(formId, { title, description, category, blocks });
    } else if (orgId) {
      const res = await createFormServer({
        organization_id: orgId,
        title,
        description,
        category,
        blocks,
      });
      if (res.data?.id) {
        setFormId(res.data.id);
        window.history.replaceState(null, "", `/dashboard/forms/builder/${res.data.id}`);
      }
    }
    setSaving(false);
  }, [formId, orgId, title, description, category, blocks, updateFormServer, createFormServer]);

  const handlePublish = async () => {
    if (!formId) await handleSave();
    if (!formId && !orgId) return;
    setPublishing(true);
    const id = formId || "";
    if (id) await publishFormServer(id);
    setPublishing(false);
    router.push("/dashboard/forms");
  };

  const addBlock = useCallback((type: BlockType, index?: number) => {
    const next = makeBlock(type);
    setBlocks((prev) => {
      if (index !== undefined) {
        const copy = [...prev];
        copy.splice(index + 1, 0, next);
        return copy;
      }
      return [...prev, next];
    });
    setSelectedId(next.id);
  }, []);

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateBlock = (id: string, patch: Partial<FormBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const duplicateBlock = (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const copy = { ...block, id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
    const idx = blocks.findIndex((b) => b.id === id);
    setBlocks((prev) => {
      const p = [...prev];
      p.splice(idx + 1, 0, copy);
      return p;
    });
    setSelectedId(copy.id);
  };

  const handleExportPdf = useCallback(async () => {
    setExportPdfLoading(true);
    try {
      const [{ pdf }, { FormPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/forms/document-forge/form-pdf-document"),
      ]);
      const doc = (
        <FormPdfDocument
          title={title || "Untitled Form"}
          blocks={blocks}
          generatedAt={new Date().toISOString().slice(0, 10)}
        />
      );
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "form").replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportPdfLoading(false);
    }
  }, [title, blocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = [...blocks];
    const [removed] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, removed);
    setBlocks(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (loadingForm) {
    return (
      <div className="flex h-full flex-col bg-[#050505]">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="h-8 w-64 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-9 w-28 rounded-xl bg-white/10 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="mx-auto max-w-3xl flex-1 space-y-4 px-6 py-12">
            <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#050505]/95 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/forms"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
            aria-label="Back to forms"
          >
            <ArrowLeft size={14} />
          </Link>
          <div className="flex flex-col">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-display text-2xl font-bold text-white bg-transparent outline-none placeholder-zinc-600 md:text-4xl"
              placeholder="Untitled Form"
            />
            {description !== undefined && (
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-0.5 bg-transparent text-[12px] text-zinc-500 outline-none placeholder-zinc-700"
                placeholder="Description (optional)"
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* INCOMPLETE:TODO — Form preview not implemented; should render the form in a read-only modal as a client would see it. Done when clicking opens a preview modal with filled-in sample data. */}
          <button
            type="button"
            onClick={() => { addToast("Form preview coming soon"); }}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <Eye size={13} /> Preview
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportPdfLoading || blocks.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
          >
            {exportPdfLoading ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || blocks.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {/* Canvas: centered column with blueprint */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="relative min-h-[420px] rounded-xl border border-white/[0.04] bg-zinc-950/60 p-8">
            <BlueprintGrid />

            {/* Document header on canvas */}
            <div className="relative mb-8 flex items-center gap-2 text-zinc-500">
              <FileText size={18} className="shrink-0" />
              <span className="font-display text-[15px] font-semibold text-zinc-300">
                {title || "Untitled Form"}
              </span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="relative space-y-1 pl-10">
                  {blocks.map((block, index) => (
                    <BlockRow
                      key={block.id}
                      block={block}
                      isSelected={selectedId === block.id}
                      onSelect={() => setSelectedId(block.id)}
                      onUpdate={(patch) => updateBlock(block.id, patch)}
                      onDuplicate={() => duplicateBlock(block.id)}
                      onDelete={() => removeBlock(block.id)}
                      onAddBelow={() => addBlock("short_text", index)}
                      onOpenSettings={undefined}
                    />
                  ))}
                  <EmptyBlock onSelectType={(type) => addBlock(type, blocks.length - 1)} />
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}
