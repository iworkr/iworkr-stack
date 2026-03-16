/* ── Document Forge: block types & defaults ───────────────── */

import type { FormBlock, BlockType } from "@/lib/forms-data";
import type { LucideIcon } from "lucide-react";
import {
  Type,
  AlignLeft,
  Hash,
  Clock3,
  Calendar,
  ChevronDown,
  CircleDot,
  CheckSquare,
  PenTool,
  MapPin,
  Camera,
  AlertTriangle,
  Droplets,
  Activity,
  Scale,
  Smile,
  Accessibility,
  Target,
} from "lucide-react";

export const TOOLBOX_ITEMS: { type: BlockType; label: string; icon: LucideIcon }[] = [
  { type: "heading", label: "Section Heading", icon: Hash },
  { type: "short_text", label: "Short Text", icon: Type },
  { type: "long_text", label: "Long Text", icon: AlignLeft },
  { type: "number", label: "Number", icon: Type },
  { type: "date", label: "Date", icon: Calendar },
  { type: "time", label: "Time", icon: Clock3 },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown },
  { type: "radio", label: "Radio", icon: CircleDot },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "signature", label: "Signature", icon: PenTool },
  { type: "photo_upload", label: "Photo Upload", icon: Camera },
  { type: "goal_linker", label: "Goal Linker", icon: Target },
  { type: "blood_pressure", label: "Blood Pressure", icon: Activity },
  { type: "blood_glucose", label: "Blood Glucose", icon: Droplets },
  { type: "weight", label: "Weight", icon: Scale },
  { type: "mood_slider", label: "Mood Slider", icon: Smile },
  { type: "body_map", label: "Body Map", icon: Accessibility },
  { type: "photo_evidence", label: "Photo / Evidence", icon: Camera },
  { type: "gps_stamp", label: "GPS / Timestamp", icon: MapPin },
  { type: "risk_matrix", label: "Risk Matrix", icon: AlertTriangle },
];

const DEFAULT_LABELS: Record<BlockType, string> = {
  heading: "Section Title",
  text: "Text",
  short_text: "Short Text",
  long_text: "Long Text",
  number: "Number",
  date: "Date",
  time: "Time",
  dropdown: "Select Option",
  radio: "Radio Options",
  checkbox: "Checkbox",
  signature: "Signature",
  gps_stamp: "GPS & Timestamp",
  photo_evidence: "Photo Evidence",
  photo_upload: "Photo Upload",
  goal_linker: "Goal Linker",
  blood_pressure: "Blood Pressure",
  blood_glucose: "Blood Glucose",
  weight: "Weight",
  mood_slider: "Mood Slider",
  body_map: "Body Map",
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
