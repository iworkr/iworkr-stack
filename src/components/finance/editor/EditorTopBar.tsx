/**
 * @component components/finance/editor/EditorTopBar.tsx
 * @status STABLE
 * @description Moneta invoice canvas — EditorTopBar
 * @lastReview 2026-03-28
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Send, Loader2, FileDown, ChevronDown, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import { TEMPLATE_OPTIONS, loadTemplate, type TemplateId } from "./templates";
import { useIndustryLexicon } from "@/lib/industry-lexicon";

interface EditorTopBarProps {
  onSave: (mode: "draft" | "send") => Promise<void>;
  onPreviewPdf: () => void;
  saving: boolean;
  isValid: boolean;
}

export function EditorTopBar({ onSave, onPreviewPdf, saving, isValid }: EditorTopBarProps) {
  const router = useRouter();
  const { t, isCare } = useIndustryLexicon();
  const setBlocks = useInvoiceEditorStore((s) => s.setBlocks);
  const templateId = useInvoiceEditorStore((s) => s.templateId);
  const [showTemplates, setShowTemplates] = useState(false);

  function handleTemplateSelect(id: TemplateId) {
    const blocks = loadTemplate(id);
    setBlocks(blocks);
    setShowTemplates(false);
  }

  return (
    <div className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-base)] px-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/finance")}
          className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-zinc-200">{t("New Invoice")}</h1>
          <p className="text-[10px] text-zinc-600">
            {isCare ? "NDIS Claim Builder" : "Moneta-Canvas Editor"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Template selector */}
        <div className="relative">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-base)] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200"
          >
            Template
            <ChevronDown size={12} />
          </button>
          <AnimatePresence>
            {showTemplates && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-[var(--border-active)] bg-zinc-900 shadow-2xl"
              >
                {TEMPLATE_OPTIONS.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateSelect(tpl.id)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex-1">
                      <div className="text-[11px] font-medium text-zinc-300">{tpl.label}</div>
                      <div className="text-[10px] text-zinc-600">{tpl.description}</div>
                    </div>
                    {templateId === tpl.id && <Check size={12} className="mt-0.5 text-emerald-400" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onPreviewPdf}
          disabled={!isValid}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-base)] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:opacity-40"
        >
          <FileDown size={12} />
          Preview PDF
        </button>

        <button
          disabled={!isValid || saving}
          onClick={() => onSave("draft")}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-base)] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:opacity-40"
        >
          <Save size={12} />
          Save Draft
        </button>

        <button
          disabled={!isValid || saving}
          onClick={() => onSave("send")}
          className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-[11px] font-semibold text-black transition-all hover:bg-zinc-200 disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          {t("Send Invoice")}
        </button>
      </div>
    </div>
  );
}
