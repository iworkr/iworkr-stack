/* ── Document Forge: block types & defaults ───────────────── */

import type { FormBlock, BlockType } from "@/lib/forms-data";
import type { LucideIcon } from "lucide-react";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  CheckSquare,
  PenTool,
  MapPin,
  Camera,
  AlertTriangle,
} from "lucide-react";

export const TOOLBOX_ITEMS: { type: BlockType; label: string; icon: LucideIcon }[] = [
  { type: "heading", label: "Section Heading", icon: Hash },
  { type: "short_text", label: "Short Text", icon: Type },
  { type: "long_text", label: "Long Text", icon: AlignLeft },
  { type: "date", label: "Date", icon: Calendar },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "signature", label: "Signature", icon: PenTool },
  { type: "photo_evidence", label: "Photo / Evidence", icon: Camera },
  { type: "gps_stamp", label: "GPS / Timestamp", icon: MapPin },
  { type: "risk_matrix", label: "Risk Matrix", icon: AlertTriangle },
];

const DEFAULT_LABELS: Record<BlockType, string> = {
  heading: "Section Title",
  text: "Text",
  short_text: "Short Text",
  long_text: "Long Text",
  date: "Date",
  dropdown: "Select Option",
  checkbox: "Checkbox",
  signature: "Signature",
  gps_stamp: "GPS & Timestamp",
  photo_evidence: "Photo Evidence",
  risk_matrix: "Risk Assessment",
};

export function makeBlock(type: BlockType): FormBlock {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: DEFAULT_LABELS[type],
    required: false,
    placeholder: type === "short_text" ? "Enter text…" : type === "long_text" ? "Enter longer text…" : "",
    options: type === "dropdown" ? ["Option 1", "Option 2"] : undefined,
  };
}

export function filterTools(query: string): typeof TOOLBOX_ITEMS {
  if (!query.trim()) return TOOLBOX_ITEMS;
  const q = query.toLowerCase();
  return TOOLBOX_ITEMS.filter(
    (t) =>
      t.label.toLowerCase().includes(q) ||
      t.type.toLowerCase().replace("_", " ").includes(q)
  );
}
