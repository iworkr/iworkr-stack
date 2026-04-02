/**
 * @component components/site-editor/panels/GlobalStylesPanel.tsx
 * @status STABLE
 * @description Loom site builder — GlobalStylesPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useSiteEditorStore } from "@/lib/stores/site-editor-store";
import { Palette, Type } from "lucide-react";

const FONT_OPTIONS = ["Inter", "DM Sans", "Plus Jakarta Sans", "Manrope", "Outfit", "Poppins", "Lora", "Merriweather", "Playfair Display"];

export function GlobalStylesPanel() {
  const globalStyles = useSiteEditorStore((s) => s.globalStyles);
  const set = useSiteEditorStore((s) => s.setGlobalStyles);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
        <Palette size={12} />
        Global Styles
      </div>

      {/* Colors */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Colors</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Primary</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={globalStyles.primaryColor}
                onChange={(e) => set({ primaryColor: e.target.value })}
                className="h-6 w-6 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
              <input
                type="text"
                value={globalStyles.primaryColor}
                onChange={(e) => set({ primaryColor: e.target.value })}
                className="w-20 rounded border border-[var(--border-base)] bg-transparent px-2 py-1 text-[10px] text-zinc-300 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Secondary</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={globalStyles.secondaryColor}
                onChange={(e) => set({ secondaryColor: e.target.value })}
                className="h-6 w-6 cursor-pointer rounded border border-zinc-700 bg-transparent"
              />
              <input
                type="text"
                value={globalStyles.secondaryColor}
                onChange={(e) => set({ secondaryColor: e.target.value })}
                className="w-20 rounded border border-[var(--border-base)] bg-transparent px-2 py-1 text-[10px] text-zinc-300 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <Type size={10} /> Typography
        </h4>
        <div className="space-y-2">
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Heading Font</span>
            <select
              value={globalStyles.fontHeading}
              onChange={(e) => set({ fontHeading: e.target.value })}
              className="w-full rounded border border-[var(--border-base)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px] text-zinc-300"
            >
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 block mb-1">Body Font</span>
            <select
              value={globalStyles.fontBody}
              onChange={(e) => set({ fontBody: e.target.value })}
              className="w-full rounded border border-[var(--border-base)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px] text-zinc-300"
            >
              {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Button Radius */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Button Style</h4>
        <div>
          <span className="text-[11px] text-zinc-400 block mb-1">Corner Radius: {globalStyles.buttonRadius}px</span>
          <input
            type="range"
            min={0}
            max={24}
            value={globalStyles.buttonRadius}
            onChange={(e) => set({ buttonRadius: Number(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>
      </div>

      {/* Header/Footer Style */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Layout</h4>
        <div>
          <span className="text-[11px] text-zinc-400 block mb-1">Header Style</span>
          <select
            value={globalStyles.headerStyle}
            onChange={(e) => set({ headerStyle: e.target.value as "sticky" | "static" | "transparent" })}
            className="w-full rounded border border-[var(--border-base)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px] text-zinc-300"
          >
            <option value="sticky">Sticky</option>
            <option value="static">Static</option>
            <option value="transparent">Transparent</option>
          </select>
        </div>
      </div>
    </div>
  );
}
