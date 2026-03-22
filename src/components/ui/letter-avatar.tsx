/**
 * @component LetterAvatar
 * @status COMPLETE
 * @description Deterministic letter-based avatar with persistent colour and optional image fallback
 * @lastAudit 2026-03-22
 */
"use client";

import { useMemo, useState } from "react";

/**
 * LetterAvatar — Deterministic letter-based avatar with persistent colour.
 *
 * Usage:
 *   <LetterAvatar name="John Smith" size={32} />
 *   <LetterAvatar name="Acme Corp" src={logoUrl} size={24} />
 *
 * Rules:
 *   - If `src` is provided and truthy, renders an <img>.
 *   - Otherwise, renders 1–2 initials on a deterministic background colour.
 *   - The colour is seeded by the `name` string via a simple hash so the same
 *     name always gets the same colour — consistent and persistent.
 *   - Supports `variant="round"` (user) or `variant="rounded"` (workspace).
 */

// ── Colour palette — solid flat colours, dark-friendly ──
// Each is [bg, text] — clean solid backgrounds, white/light text
const PALETTE: [string, string][] = [
  ["#6366F1", "#FFFFFF"], // Indigo
  ["#8B5CF6", "#FFFFFF"], // Violet
  ["#EC4899", "#FFFFFF"], // Pink
  ["#EF4444", "#FFFFFF"], // Red
  ["#F97316", "#FFFFFF"], // Orange
  ["#EAB308", "#18181B"], // Yellow (dark text)
  ["#22C55E", "#FFFFFF"], // Green
  ["#14B8A6", "#FFFFFF"], // Teal
  ["#06B6D4", "#FFFFFF"], // Cyan
  ["#3B82F6", "#FFFFFF"], // Blue
  ["#A855F7", "#FFFFFF"], // Purple
  ["#D946EF", "#FFFFFF"], // Fuchsia
  ["#F43F5E", "#FFFFFF"], // Rose
  ["#0EA5E9", "#FFFFFF"], // Sky
  ["#10B981", "#FFFFFF"], // Emerald
  ["#84CC16", "#18181B"], // Lime (dark text)
];

/** Simple string hash → deterministic index into PALETTE */
function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTE.length;
}

/** Extract 1–2 initials from a name */
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface LetterAvatarProps {
  /** Display name — used for initials and colour seed */
  name: string;
  /** Optional image URL — renders <img> when truthy */
  src?: string | null;
  /** Pixel size (width & height) */
  size?: number;
  /** "round" for users, "rounded" for workspaces */
  variant?: "round" | "rounded";
  /** Extra className */
  className?: string;
  /** Ring style — adds a subtle border ring */
  ring?: boolean;
}

export function LetterAvatar({
  name,
  src,
  size = 32,
  variant = "round",
  className = "",
  ring = false,
}: LetterAvatarProps) {
  const initials = useMemo(() => getInitials(name), [name]);
  const [bg, fg] = useMemo(() => PALETTE[hashName(name)], [name]);
  const [imgFailed, setImgFailed] = useState(false);

  const borderRadius = variant === "round" ? "50%" : `${Math.max(4, size * 0.2)}px`;
  const fontSize = Math.max(8, Math.round(size * 0.38));

  if (src && !imgFailed) {
    return (
      <div
        className={`shrink-0 overflow-hidden ${ring ? "ring-1 ring-white/[0.08]" : ""} ${className}`}
        style={{ width: size, height: size, borderRadius }}
      >
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center font-semibold select-none ${ring ? "ring-1 ring-white/[0.08]" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bg,
        color: fg,
        fontSize,
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </div>
  );
}
