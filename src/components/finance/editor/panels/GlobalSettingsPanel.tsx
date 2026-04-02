/**
 * @component components/finance/editor/panels/GlobalSettingsPanel.tsx
 * @status STABLE
 * @description Moneta invoice canvas — GlobalSettingsPanel
 * @lastReview 2026-03-28
 */
"use client";

import { useInvoiceEditorStore } from "@/lib/stores/invoice-editor-store";

const FONTS = ["Inter", "Roboto", "Merriweather", "JetBrains Mono"];
const CURRENCIES = ["AUD", "USD", "GBP", "EUR", "NZD", "CAD"];

export function GlobalSettingsPanel() {
  const settings = useInvoiceEditorStore((s) => s.globalSettings);
  const setGlobalSettings = useInvoiceEditorStore((s) => s.setGlobalSettings);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-3 font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Document Settings
        </h3>
        <p className="text-[10px] text-zinc-500 mb-4">
          Click a block on the canvas to edit its properties.
        </p>
      </div>

      {/* Brand Color */}
      <div>
        <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Brand Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={settings.brandColor}
            onChange={(e) => setGlobalSettings({ brandColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded-md border border-[var(--border-base)] bg-transparent"
          />
          <input
            type="text"
            value={settings.brandColor}
            onChange={(e) => setGlobalSettings({ brandColor: e.target.value })}
            className="flex-1 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-1.5 font-mono text-xs text-zinc-300 outline-none focus:border-emerald-500/30"
          />
        </div>
      </div>

      {/* Font */}
      <div>
        <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Font Family
        </label>
        <select
          value={settings.fontFamily}
          onChange={(e) => setGlobalSettings({ fontFamily: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-zinc-900 px-3 py-2 text-xs text-zinc-300 outline-none"
        >
          {FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Currency */}
      <div>
        <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Currency
        </label>
        <select
          value={settings.currency}
          onChange={(e) => setGlobalSettings({ currency: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-base)] bg-zinc-900 px-3 py-2 text-xs text-zinc-300 outline-none"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Tax Rate */}
      <div>
        <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Tax Rate (%)
        </label>
        <input
          type="number"
          value={settings.taxRate}
          onChange={(e) => setGlobalSettings({ taxRate: Math.max(0, Number(e.target.value)) })}
          className="w-24 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
        />
      </div>

      {/* Tax Inclusive */}
      <div className="flex items-center justify-between">
        <label className="font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Prices include Tax
        </label>
        <button
          onClick={() => setGlobalSettings({ taxInclusive: !settings.taxInclusive })}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            settings.taxInclusive ? "bg-emerald-500" : "bg-zinc-700"
          }`}
        >
          <div
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              settings.taxInclusive ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Discount */}
      <div>
        <label className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2px] text-zinc-600">
          Discount
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setGlobalSettings({
                discountType: settings.discountType === "percent" ? null : "percent",
                discountValue: settings.discountType === "percent" ? 0 : settings.discountValue,
              })
            }
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors ${
              settings.discountType === "percent"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-[var(--border-base)] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            %
          </button>
          <button
            onClick={() =>
              setGlobalSettings({
                discountType: settings.discountType === "fixed" ? null : "fixed",
                discountValue: settings.discountType === "fixed" ? 0 : settings.discountValue,
              })
            }
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-medium transition-colors ${
              settings.discountType === "fixed"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-[var(--border-base)] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            $
          </button>
          {settings.discountType && (
            <input
              type="number"
              value={settings.discountValue}
              onChange={(e) => setGlobalSettings({ discountValue: Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded-lg border border-[var(--border-base)] bg-white/[0.02] px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
            />
          )}
        </div>
      </div>
    </div>
  );
}
