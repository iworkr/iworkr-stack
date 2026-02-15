"use client";

import { motion } from "framer-motion";

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
      className={`relative h-[20px] w-[36px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-[#5E6AD2]" : "bg-zinc-700"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[2px] h-4 w-4 rounded-full bg-white shadow-sm"
        style={{ left: checked ? 18 : 2 }}
      />
    </button>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0 flex-1 pr-4">
        <div className="text-[13px] font-medium text-zinc-200">{label}</div>
        {description && (
          <div className="mt-0.5 text-[12px] text-zinc-600">{description}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="mb-1 text-[15px] font-medium text-zinc-300">{title}</h3>
      <div className="divide-y divide-[rgba(255,255,255,0.06)] rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4">
        {children}
      </div>
    </div>
  );
}

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
      className="cursor-pointer rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] text-zinc-300 outline-none transition-colors hover:border-[rgba(255,255,255,0.18)] focus:border-[rgba(255,255,255,0.25)]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-300">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
