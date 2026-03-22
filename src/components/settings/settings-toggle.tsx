/**
 * @component SettingsToggle
 * @status COMPLETE
 * @description Animated toggle switch using Signal Green brand color with spring motion
 * @lastAudit 2026-03-22
 */
"use client";

import { motion } from "framer-motion";

/* ─── Toggle ────────────────────────────────────────────────
   Uses Signal Green via var(--brand), not a hardcoded hex.
   Consistent size, track radius, and spring motion per PRD §8.7.
   Off state is legible (not muddy), on state is refined. */

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`toggle-track relative h-[20px] w-[36px] shrink-0 rounded-full ${
        checked ? "bg-[var(--brand)]" : "bg-[rgba(255,255,255,0.1)]"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="toggle-thumb absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-sm"
        style={{ left: checked ? 18 : 2 }}
      />
    </button>
  );
}

/* ─── SettingRow ─────────────────────────────────────────────
   Maps to `.stealth-settings-row` pattern from globals.css.
   Stronger label/description hierarchy per PRD §11.3. */

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="stealth-settings-row">
      <div className="min-w-0 flex-1 pr-4">
        <div className="text-[13px] font-medium text-[var(--text-primary)]">
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ─── SettingSection ────────────────────────────────────────
   Maps to `.stealth-settings-group` / `.stealth-settings-group-title`.
   Section card uses subtle surface elevation + inset bevel per PRD §7.2. */

export function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="stealth-settings-group">
      <h3 className="stealth-settings-group-title">{title}</h3>
      <div className="rounded-[var(--radius-card)] border border-[var(--border-base)] bg-[var(--surface-1)] px-5 shadow-[var(--shadow-inset-bevel)]">
        {children}
      </div>
    </div>
  );
}

/* ─── Select ────────────────────────────────────────────────
   System-native select with token-based borders and surfaces.
   Focus ring uses brand color per PRD §8.2. */

interface SelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function Select({ value, options, onChange }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-[var(--radius-input)] border border-[var(--border-base)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-active)] focus:border-[var(--brand)] focus:ring-1 focus:ring-[rgba(16,185,129,0.25)]"
    >
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          className="bg-[var(--surface-1)] text-[var(--text-primary)]"
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}
