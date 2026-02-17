"use client";

import { motion, Reorder } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Eye,
  Trash2,
  GripVertical,
  Type,
  Hash,
  AlignLeft,
  Calendar,
  ChevronDown,
  CheckSquare,
  PenTool,
  MapPin,
  Camera,
  AlertTriangle,
  Plus,
  Loader2,
  FileText,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useFormsStore } from "@/lib/forms-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getForm } from "@/app/actions/forms";
import type { FormBlock, BlockType } from "@/lib/forms-data";

/* ── Toolbox items ──────────────────────────────────── */

const toolboxItems: { type: BlockType; label: string; icon: typeof Type }[] = [
  { type: "short_text", label: "Text Input", icon: Type },
  { type: "long_text", label: "Text Area", icon: AlignLeft },
  { type: "heading", label: "Section Heading", icon: Hash },
  { type: "date", label: "Date Picker", icon: Calendar },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "signature", label: "Signature", icon: PenTool },
  { type: "gps_stamp", label: "GPS Stamp", icon: MapPin },
  { type: "photo_evidence", label: "Photo Upload", icon: Camera },
  { type: "risk_matrix", label: "Risk Matrix", icon: AlertTriangle },
];

function makeBlock(type: BlockType): FormBlock {
  const labels: Record<string, string> = {
    short_text: "Text Field",
    long_text: "Text Area",
    heading: "Section Title",
    date: "Date",
    dropdown: "Select Option",
    checkbox: "Checkbox",
    signature: "Signature",
    gps_stamp: "GPS Location",
    photo_evidence: "Photo Evidence",
    risk_matrix: "Risk Assessment",
  };
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: labels[type] || "Field",
    required: false,
    placeholder: "",
    options: type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
  };
}

/* ── Block Preview ──────────────────────────────────── */

function BlockPreview({ block }: { block: FormBlock }) {
  switch (block.type) {
    case "heading":
      return <div className="border-b border-[rgba(255,255,255,0.06)] pb-1 text-[13px] font-semibold text-zinc-300">{block.label}</div>;
    case "short_text":
      return <div className="h-8 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 text-[11px] leading-8 text-zinc-700">{block.placeholder || "Enter text…"}</div>;
    case "long_text":
      return <div className="h-16 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 pt-2 text-[11px] text-zinc-700">{block.placeholder || "Enter long text…"}</div>;
    case "date":
      return <div className="flex h-8 items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 text-[11px] text-zinc-700"><Calendar size={12} className="mr-2 text-zinc-600" />Select date…</div>;
    case "dropdown":
      return <div className="flex h-8 items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 text-[11px] text-zinc-700"><span>Select…</span><ChevronDown size={12} className="text-zinc-600" /></div>;
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)]" />
          <span className="text-[11px] text-zinc-500">{block.label}</span>
        </div>
      );
    case "signature":
      return (
        <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.01)]">
          <PenTool size={16} className="mr-2 text-zinc-700" />
          <span className="text-[11px] text-zinc-600">Sign here</span>
        </div>
      );
    case "gps_stamp":
      return (
        <div className="flex h-10 items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-emerald-500/5 px-3">
          <MapPin size={12} className="mr-2 text-emerald-500" />
          <span className="text-[11px] text-zinc-500">Capture GPS on submit</span>
        </div>
      );
    case "photo_evidence":
      return (
        <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.01)]">
          <Camera size={16} className="mr-2 text-zinc-700" />
          <span className="text-[11px] text-zinc-600">Upload photo</span>
        </div>
      );
    case "risk_matrix":
      return (
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-2">
          {["Low", "Med", "High"].map((l) => (
            <div key={l} className={`rounded px-2 py-1 text-center text-[9px] font-medium ${l === "Low" ? "bg-emerald-500/10 text-emerald-400" : l === "Med" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>{l}</div>
          ))}
        </div>
      );
    default:
      return <div className="h-8 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]" />;
  }
}

/* ── Main Page ──────────────────────────────────────── */

export default function FormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { orgId } = useOrg();
  const { updateFormServer, createFormServer, publishFormServer } = useFormsStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

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
        setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      }
      setLoadingForm(false);
    });
  }, [params.id, isNew]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    if (formId) {
      await updateFormServer(formId, { title, description, category, blocks });
    } else if (orgId) {
      const res = await createFormServer({ organization_id: orgId, title, description, category, blocks });
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

  const addBlock = (type: BlockType) => {
    setBlocks((prev) => [...prev, makeBlock(type)]);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBlock = (id: string, patch: Partial<FormBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  if (loadingForm) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/forms")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] text-zinc-500 transition-colors hover:text-zinc-300">
            <ArrowLeft size={14} />
          </button>
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-[15px] font-medium text-zinc-200 outline-none placeholder-zinc-600"
              placeholder="Form title…"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full bg-transparent text-[11px] text-zinc-600 outline-none placeholder-zinc-700"
              placeholder="Add a description…"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200 disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || blocks.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Publish
          </button>
        </div>
      </div>

      {/* Builder Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Toolbox (left sidebar) */}
        <div className="w-56 shrink-0 overflow-y-auto border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Toolbox</p>
          <div className="space-y-1.5">
            {toolboxItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => addBlock(item.type)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-left text-[11px] text-zinc-500 transition-all hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
                >
                  <Icon size={13} strokeWidth={1.5} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas (center) */}
        <div className="flex-1 overflow-y-auto bg-[#080808] px-8 py-6">
          <div className="mx-auto max-w-xl">
            {/* Document preview header */}
            <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0C0C0C] p-6">
              <div className="flex items-center gap-2 text-zinc-400">
                <FileText size={16} />
                <span className="text-[13px] font-medium text-zinc-300">{title || "Untitled Form"}</span>
              </div>
              {description && <p className="mt-1 text-[11px] text-zinc-600">{description}</p>}
            </div>

            {/* Blocks */}
            {blocks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[rgba(255,255,255,0.06)] py-16 text-center"
              >
                <Plus size={24} strokeWidth={0.8} className="mb-3 text-zinc-800" />
                <p className="text-[12px] text-zinc-600">Click items from the toolbox to add fields</p>
                <p className="mt-1 text-[10px] text-zinc-700">Or drag blocks to reorder them</p>
              </motion.div>
            ) : (
              <Reorder.Group
                axis="y"
                values={blocks}
                onReorder={setBlocks}
                className="space-y-3"
              >
                {blocks.map((block) => (
                  <Reorder.Item key={block.id} value={block}>
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group relative rounded-xl border bg-[#0C0C0C] p-4 transition-colors ${
                        editingBlockId === block.id
                          ? "border-[rgba(0,230,118,0.3)]"
                          : "border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"
                      }`}
                    >
                      {/* Drag handle + controls */}
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical size={12} className="cursor-grab text-zinc-700 active:cursor-grabbing" />
                          {editingBlockId === block.id ? (
                            <input
                              type="text"
                              value={block.label}
                              onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                              onBlur={() => setEditingBlockId(null)}
                              onKeyDown={(e) => e.key === "Enter" && setEditingBlockId(null)}
                              autoFocus
                              className="bg-transparent text-[11px] font-medium text-zinc-300 outline-none"
                            />
                          ) : (
                            <span
                              onClick={() => setEditingBlockId(block.id)}
                              className="cursor-text text-[11px] font-medium text-zinc-400"
                            >
                              {block.label}
                              {block.required && <span className="ml-1 text-red-400">*</span>}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => updateBlock(block.id, { required: !block.required })}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                              block.required
                                ? "bg-red-500/10 text-red-400"
                                : "text-zinc-600 hover:text-zinc-400"
                            }`}
                          >
                            {block.required ? "Required" : "Optional"}
                          </button>
                          <button
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-1 text-zinc-700 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Block preview */}
                      <BlockPreview block={block} />
                    </motion.div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}

            {/* Quick add at bottom */}
            {blocks.length > 0 && (
              <button
                onClick={() => addBlock("short_text")}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] py-3 text-[11px] text-zinc-600 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-400"
              >
                <Plus size={12} />
                Add Field
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
