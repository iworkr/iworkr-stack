/**
 * @component components/finance/editor/panels/DividerPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — DividerPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";
import type { DividerContent } from "../types";

const COLOR_PRESETS = [
  { label: "Light Gray", value: "#e5e5e5" },
  { label: "Medium Gray", value: "#a3a3a3" },
  { label: "Dark Gray", value: "#525252" },
  { label: "Black", value: "#171717" },
  { label: "Brand", value: "__brand__" },
];

export function DividerPanel({ blockId }: { blockId: string }) {
  const block = useInvoiceEditorStore((s) => s.blocks.find((b) => b.id === blockId));
  const update = useInvoiceEditorStore((s) => s.updateBlockContent);
  const brandColor = useInvoiceEditorStore((s) => s.globalSettings.brandColor);
  if (!block || block.type !== "divider") return null;
  const c = block.content as DividerContent;

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
        Divider Settings
      </h3>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Thickness (px)</label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={c.thickness}
            min={1}
            max={8}
            onChange={(e) => update(blockId, { thickness: Math.max(1, Math.min(8, Number(e.target.value))) })}
            className="w-16 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
          />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((t) => (
              <button
                key={t}
                onClick={() => update(blockId, { thickness: t })}
                className={`rounded-md border px-2.5 py-1 text-[10px] font-mono transition-colors ${
                  c.thickness === t
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-[var(--border-base)] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Color</label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="color"
            value={c.color || "#e5e5e5"}
            onChange={(e) => update(blockId, { color: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded-md border border-[var(--border-base)] bg-transparent"
          />
          <input
            type="text"
            value={c.color || "#e5e5e5"}
            onChange={(e) => update(blockId, { color: e.target.value })}
            className="flex-1 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none focus:border-emerald-500/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_PRESETS.map((preset) => {
            const resolvedColor = preset.value === "__brand__" ? brandColor : preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => update(blockId, { color: resolvedColor })}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors ${
                  c.color === resolvedColor
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-[var(--border-base)] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full border border-zinc-700"
                  style={{ backgroundColor: resolvedColor }}
                />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div>
        <label className="mb-1.5 block text-[11px] text-zinc-400">Preview</label>
        <div className="rounded-lg border border-[var(--border-base)] bg-white p-4">
          <div
            style={{
              height: c.thickness,
              backgroundColor: c.color || "#e5e5e5",
            }}
          />
        </div>
      </div>
    </div>
  );
}
