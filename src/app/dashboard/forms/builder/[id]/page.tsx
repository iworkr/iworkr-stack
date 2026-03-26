/**
 * @page /dashboard/forms/builder/[id]
 * @status COMPLETE
 * @description Drag-and-drop form builder with field palette and live preview
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Eye,
  Send,
  Loader2,
  FileText,
  FileDown,
  X,
  Calendar,
  Camera,
  PenTool,
  ChevronDown,
  CheckSquare,
  Type,
  AlignLeft,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFormsStore } from "@/lib/forms-store";
import { getFormTemplateById } from "@/app/actions/forms";
import type { FormBlock } from "@/lib/forms-data";
import { useToastStore } from "@/components/app/action-toast";
import { FormBuilder } from "@/components/forms/FormBuilder";
import { useDebounce } from "@/lib/hooks/use-debounce";

/* ── Page ───────────────────────────────────────────────── */

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "offline_local" | "error";

type DraftPayload = {
  title: string;
  description: string;
  category: string;
  blocks: FormBlock[];
};

type LocalDraftSnapshot = {
  templateId: string;
  payload: DraftPayload;
  savedAt: string;
  cloudUpdatedAt?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function draftKey(templateId: string): string {
  return `iworkr_form_draft_${templateId}`;
}

function serializeDraft(payload: DraftPayload): string {
  return JSON.stringify(payload);
}

export default function FormBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { updateFormTemplateDraftServer, publishFormTemplateServer } = useFormsStore();
  const { addToast } = useToastStore();
  const paramsId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [blocks, setBlocks] = useState<FormBlock[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<LocalDraftSnapshot | null>(null);

  const lastCloudSnapshotRef = useRef<string>("");
  const autosaveInFlightRef = useRef(false);

  const persistedTemplateId = formId || (isUuid(paramsId) ? paramsId : null);

  const currentDraftPayload = useMemo<DraftPayload>(
    () => ({ title, description, category, blocks }),
    [title, description, category, blocks]
  );

  const draftFingerprint = useMemo(
    () => serializeDraft(currentDraftPayload),
    [currentDraftPayload]
  );
  const debouncedDraftFingerprint = useDebounce(draftFingerprint, 1500);

  useEffect(() => {
    if (!isUuid(paramsId)) {
      router.replace("/dashboard/forms/builder");
      return;
    }

    getFormTemplateById(paramsId).then(({ data, error }) => {
      if (error) {
        addToast(error, undefined, "error");
        router.replace("/dashboard/forms");
      }
      if (data) {
        const cloudPayload: DraftPayload = {
          title: data.title || "",
          description: data.description || "",
          category: data.category || "custom",
          blocks: Array.isArray(data.schema_jsonb)
            ? (data.schema_jsonb as unknown as FormBlock[])
            : [],
        };

        setFormId(data.id);
        setTitle(cloudPayload.title);
        setDescription(cloudPayload.description);
        setCategory(cloudPayload.category);
        setBlocks(cloudPayload.blocks);
        setCloudUpdatedAt(data.updated_at || data.created_at || null);
        setLastSavedAt(data.updated_at || data.created_at || null);
        lastCloudSnapshotRef.current = serializeDraft(cloudPayload);
        setSaveStatus("saved");

        try {
          const raw = localStorage.getItem(draftKey(data.id));
          if (raw) {
            const local = JSON.parse(raw) as LocalDraftSnapshot;
            const localTs = new Date(local.savedAt).getTime();
            const cloudTs = new Date(
              (data.updated_at || data.created_at || 0) as string
            ).getTime();
            const localFingerprint = serializeDraft(local.payload);
            const cloudFingerprint = serializeDraft(cloudPayload);

            if (
              Number.isFinite(localTs) &&
              localTs > cloudTs &&
              localFingerprint !== cloudFingerprint
            ) {
              setRestoreSnapshot(local);
              setSaveStatus("offline_local");
            }
          }
        } catch {
          // Ignore malformed local draft cache.
        }
      }
      setLoadingForm(false);
    });
  }, [addToast, paramsId, router]);

  useEffect(() => {
    if (loadingForm) return;
    if (!lastCloudSnapshotRef.current) return;
    if (saveStatus === "saving") return;
    const isDirty = draftFingerprint !== lastCloudSnapshotRef.current;
    setSaveStatus((prev) => {
      if (isDirty) return "dirty";
      if (prev === "offline_local") return prev;
      return prev === "error" ? prev : "saved";
    });
  }, [draftFingerprint, loadingForm, saveStatus]);

  useEffect(() => {
    if (!persistedTemplateId) return;
    try {
      const snapshot: LocalDraftSnapshot = {
        templateId: persistedTemplateId,
        payload: currentDraftPayload,
        savedAt: new Date().toISOString(),
        cloudUpdatedAt,
      };
      localStorage.setItem(draftKey(persistedTemplateId), JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota / privacy mode errors.
    }
  }, [persistedTemplateId, currentDraftPayload, cloudUpdatedAt]);

  const handleSaveDraft = useCallback(
    async (mode: "manual" | "auto" = "manual"): Promise<string | null> => {
      const templateIdFromRoute = isUuid(paramsId) ? paramsId : null;
      const targetId = formId || templateIdFromRoute;
      if (!targetId) return null;

      if (mode === "manual") {
        setSaving(true);
      } else {
        autosaveInFlightRef.current = true;
      }
      setSaveStatus("saving");

      try {
        const updated = await updateFormTemplateDraftServer(targetId, {
          title,
          description,
          category,
          schema_jsonb: blocks,
          status: "draft",
        });
        if (updated.error) {
          throw new Error(updated.error);
        }

        const now = new Date().toISOString();
        setLastSavedAt(now);
        setCloudUpdatedAt(now);
        lastCloudSnapshotRef.current = serializeDraft({ title, description, category, blocks });
        setSaveStatus("saved");

        try {
          const snapshot: LocalDraftSnapshot = {
            templateId: targetId,
            payload: { title, description, category, blocks },
            savedAt: now,
            cloudUpdatedAt: now,
          };
          localStorage.setItem(draftKey(targetId), JSON.stringify(snapshot));
        } catch {
          // Best effort local sync.
        }
        return targetId;
      } catch (error) {
        if (mode === "manual") {
          const message =
            error instanceof Error ? error.message : "Failed to save draft.";
          addToast(message, undefined, "error");
          setSaveStatus("error");
        } else {
          setSaveStatus("offline_local");
        }
        return null;
      } finally {
        if (mode === "manual") {
          setSaving(false);
        } else {
          autosaveInFlightRef.current = false;
        }
      }
    },
    [
      addToast,
      blocks,
      category,
      description,
      formId,
      paramsId,
      title,
      updateFormTemplateDraftServer,
    ]
  );

  useEffect(() => {
    if (loadingForm) return;
    if (!persistedTemplateId) return;
    if (saving || publishing || autosaveInFlightRef.current) return;
    if (debouncedDraftFingerprint === lastCloudSnapshotRef.current) return;
    void handleSaveDraft("auto");
  }, [
    debouncedDraftFingerprint,
    handleSaveDraft,
    loadingForm,
    persistedTemplateId,
    publishing,
    saving,
  ]);

  const handlePublish = async () => {
    const targetId = await handleSaveDraft("manual");
    if (!targetId) return;
    if (blocks.length === 0) {
      addToast("Add at least one field before publishing.", undefined, "error");
      return;
    }
    setPublishing(true);
    const published = await publishFormTemplateServer(targetId);
    if (published.error) {
      addToast(published.error, undefined, "error");
      setPublishing(false);
      return;
    }
    setPublishing(false);
    router.push("/dashboard/forms");
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

  const saveStatusLabel = useMemo(() => {
    if (saveStatus === "dirty") return "Unsaved changes…";
    if (saveStatus === "saving") return "Saving…";
    if (saveStatus === "offline_local") return "Offline. Saved locally";
    if (saveStatus === "error") return "Save failed";
    if (saveStatus === "saved" && lastSavedAt) {
      return `Saved to Cloud · ${new Date(lastSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return "Idle";
  }, [lastSavedAt, saveStatus]);

  const restoreLocalDraft = useCallback(() => {
    if (!restoreSnapshot) return;
    setTitle(restoreSnapshot.payload.title || "Untitled Form");
    setDescription(restoreSnapshot.payload.description || "");
    setCategory(restoreSnapshot.payload.category || "custom");
    setBlocks(restoreSnapshot.payload.blocks || []);
    setSaveStatus("offline_local");
    setRestoreSnapshot(null);
  }, [restoreSnapshot]);

  const keepCloudVersion = useCallback(() => {
    if (persistedTemplateId) {
      try {
        localStorage.removeItem(draftKey(persistedTemplateId));
      } catch {
        // Ignore storage errors.
      }
    }
    setRestoreSnapshot(null);
    setSaveStatus("saved");
  }, [persistedTemplateId]);

  if (loadingForm) {
    return (
      <div className="flex h-full flex-col bg-[var(--background)]">
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
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[var(--background)]/95 px-6 py-4 backdrop-blur-xl">
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
          <div className="hidden rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-500 sm:block">
            {saveStatusLabel}
          </div>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
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
            onClick={() => void handleSaveDraft("manual")}
            disabled={saving || publishing}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {publishing ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {restoreSnapshot && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-[12px] text-amber-300">
            A newer local draft was found for this form. Restore local changes or keep the cloud version.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={restoreLocalDraft}
              className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/30"
            >
              Restore Local Draft
            </button>
            <button
              type="button"
              onClick={keepCloudVersion}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5"
            >
              Keep Cloud Version
            </button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto">
        <FormBuilder
          title={title}
          schemaElements={blocks}
          selectedId={selectedId}
          onSchemaChange={setBlocks}
          onSelectedIdChange={setSelectedId}
        />
      </div>

      {/* ── Form Preview Modal ────────────────────────── */}
      <FormPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={title || "Untitled Form"}
        blocks={blocks}
      />
    </div>
  );
}

/* ── Form Preview Modal ───────────────────────────────── */

function FormPreviewModal({
  open,
  onClose,
  title,
  blocks,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  blocks: FormBlock[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/90"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 mx-4 flex h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-white/[0.06] bg-[var(--surface-1)] shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Eye size={16} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white">
                    Form Preview
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Read-only preview as seen by the field worker
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* Form title */}
              <div className="mb-6 flex items-center gap-2">
                <FileText size={18} className="shrink-0 text-zinc-500" />
                <h2 className="font-display text-xl font-bold text-white">
                  {title}
                </h2>
              </div>

              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText size={32} className="mb-3 text-zinc-700" />
                  <p className="text-[13px] text-zinc-500">
                    No blocks added yet
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    Add blocks in the builder to see a preview
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {blocks.map((block, idx) => (
                    <motion.div
                      key={block.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.2 }}
                    >
                      <PreviewBlock block={block} />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/[0.06] px-6 py-4">
              <button
                onClick={onClose}
                className="w-full rounded-lg border border-white/[0.08] px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5"
              >
                Close Preview
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Preview Block Renderer ───────────────────────────── */

function PreviewBlock({ block }: { block: FormBlock }) {
  const blockTypeIcons: Record<string, React.ReactNode> = {
    short_text: <Type size={12} className="text-zinc-600" />,
    long_text: <AlignLeft size={12} className="text-zinc-600" />,
    date: <Calendar size={12} className="text-zinc-600" />,
    signature: <PenTool size={12} className="text-zinc-600" />,
    photo_evidence: <Camera size={12} className="text-zinc-600" />,
    checkbox: <CheckSquare size={12} className="text-zinc-600" />,
    dropdown: <ChevronDown size={12} className="text-zinc-600" />,
    heading: null,
    text: null,
    gps_stamp: <MapPin size={12} className="text-zinc-600" />,
    risk_matrix: <AlertTriangle size={12} className="text-zinc-600" />,
  };

  // Section header / heading
  if (block.type === "heading") {
    return (
      <div className="border-b border-white/[0.04] pb-2 pt-2">
        <h3 className="font-display text-[15px] font-semibold text-white">
          {block.label || "Section Header"}
        </h3>
      </div>
    );
  }

  // Static text block
  if (block.type === "text") {
    return (
      <p className="text-[13px] leading-relaxed text-zinc-400">
        {block.label}
      </p>
    );
  }

  return (
    <div>
      {/* Label */}
      <div className="mb-1.5 flex items-center gap-1.5">
        {blockTypeIcons[block.type]}
        <label className="text-[12px] font-medium text-zinc-300">
          {block.label || "Untitled field"}
        </label>
        {block.required && (
          <span className="text-[10px] text-red-400/70">*</span>
        )}
      </div>

      {/* Field renderers */}
      {block.type === "short_text" && (
        <input
          type="text"
          disabled
          placeholder={block.placeholder || "Enter text..."}
          className="w-full rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2 text-[13px] text-zinc-500 placeholder:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}

      {block.type === "long_text" && (
        <textarea
          disabled
          rows={3}
          placeholder={block.placeholder || "Enter details..."}
          className="w-full resize-none rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2 text-[13px] text-zinc-500 placeholder:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
        />
      )}

      {block.type === "date" && (
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2">
          <Calendar size={14} className="text-zinc-600" />
          <span className="text-[13px] text-zinc-600">Select date...</span>
        </div>
      )}

      {block.type === "signature" && (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-[#141414]">
          <div className="flex flex-col items-center gap-1.5 text-zinc-700">
            <PenTool size={20} />
            <span className="text-[11px]">Tap to sign</span>
          </div>
        </div>
      )}

      {block.type === "photo_evidence" && (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-white/[0.08] bg-[#141414]">
          <div className="flex flex-col items-center gap-1.5 text-zinc-700">
            <Camera size={20} />
            <span className="text-[11px]">Tap to capture photo</span>
          </div>
        </div>
      )}

      {block.type === "checkbox" && (
        <div className="flex items-center gap-2.5">
          <div className="flex h-4 w-4 items-center justify-center rounded border border-white/[0.1] bg-[#141414]" />
          <span className="text-[13px] text-zinc-500">{block.label}</span>
        </div>
      )}

      {block.type === "dropdown" && (
        <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2">
          <span className="text-[13px] text-zinc-600">
            {block.options && block.options.length > 0
              ? `Select from ${block.options.length} options...`
              : "Select..."}
          </span>
          <ChevronDown size={14} className="text-zinc-600" />
        </div>
      )}

      {block.type === "gps_stamp" && (
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2">
          <MapPin size={14} className="text-zinc-600" />
          <span className="text-[13px] text-zinc-600">
            GPS location will be captured automatically
          </span>
        </div>
      )}

      {block.type === "risk_matrix" && (
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-[#141414] px-3 py-2.5">
          <AlertTriangle size={14} className="text-amber-500/60" />
          <span className="text-[13px] text-zinc-600">
            Risk assessment matrix
          </span>
        </div>
      )}
    </div>
  );
}
