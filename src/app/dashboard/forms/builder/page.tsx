"use client";

/**
 * Zenith-Launch: New Form Creation Page
 *
 * Route: /dashboard/forms/builder
 *
 * Creates a new form template and redirects to the DnD builder at
 * /dashboard/forms/builder/[id]. This is the entry point for
 * "Create New Form" from the Forms & Compliance hub.
 */

import { motion } from "framer-motion";
import {
  FileText,
  Shield,
  HardHat,
  Stethoscope,
  ClipboardCheck,
  AlertTriangle,
  Activity,
  Loader2,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { createBrowserClient } from "@supabase/ssr";

/* ── Template Presets ─────────────────────────────────────────── */

interface FormPreset {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  sector: "trades" | "care" | "universal";
  blocks: Array<{
    type: string;
    label: string;
    required?: boolean;
    options?: string[];
    placeholder?: string;
  }>;
}

const FORM_PRESETS: FormPreset[] = [
  {
    id: "swms",
    title: "Safe Work Method Statement",
    description:
      "WHS-compliant SWMS with hazard identification, risk matrix, PPE checklist, and worker signatures.",
    icon: HardHat,
    category: "safety",
    sector: "trades",
    blocks: [
      { type: "heading", label: "Safe Work Method Statement (SWMS)" },
      { type: "short_text", label: "Job/Site Location", required: true },
      { type: "short_text", label: "Principal Contractor", required: true },
      { type: "dropdown", label: "High-Risk Work Category", required: true, options: [
        "Working at heights", "Confined spaces", "Demolition", "Trenching/Excavation",
        "Hot work", "Electrical work", "Asbestos removal", "Other"
      ]},
      { type: "long_text", label: "Description of Work Activity", required: true },
      { type: "long_text", label: "Identified Hazards" },
      { type: "risk_matrix", label: "Risk Assessment" },
      { type: "checkbox", label: "PPE Required", options: [
        "Hard hat", "Safety glasses", "Hi-vis vest", "Steel cap boots",
        "Hearing protection", "Gloves", "Dust mask / P2 respirator", "Harness"
      ]},
      { type: "long_text", label: "Control Measures / Mitigation Steps" },
      { type: "photo_evidence", label: "Site Photo (Before Work)" },
      { type: "signature", label: "Worker Signature", required: true },
      { type: "signature", label: "Supervisor Signature", required: true },
      { type: "gps_stamp", label: "GPS Location Stamp" },
    ],
  },
  {
    id: "prestart",
    title: "Pre-Start Safety Checklist",
    description:
      "Daily pre-start inspection form for vehicles, plant, and equipment.",
    icon: ClipboardCheck,
    category: "safety",
    sector: "trades",
    blocks: [
      { type: "heading", label: "Pre-Start Safety Checklist" },
      { type: "short_text", label: "Vehicle / Plant ID", required: true },
      { type: "date", label: "Inspection Date", required: true },
      { type: "checkbox", label: "Exterior Checks", options: [
        "Tyres — condition & pressure", "Lights & indicators", "Windscreen — no cracks",
        "Mirrors — clean & adjusted", "Fire extinguisher — serviced", "First aid kit — stocked"
      ]},
      { type: "checkbox", label: "Interior / Cabin Checks", options: [
        "Seatbelts — functional", "Horn — working", "Brakes — responsive",
        "Dashboard warnings — nil", "Fuel / charge level — adequate"
      ]},
      { type: "dropdown", label: "Overall Condition", required: true, options: [
        "Serviceable — OK to use", "Minor issues — proceed with caution",
        "Unserviceable — DO NOT USE"
      ]},
      { type: "long_text", label: "Defects / Issues Found" },
      { type: "photo_evidence", label: "Photo of Defect (if any)" },
      { type: "signature", label: "Operator Signature", required: true },
    ],
  },
  {
    id: "incident-report",
    title: "Incident / Near Miss Report",
    description:
      "WHS incident reporting form for injuries, near misses, and hazards.",
    icon: AlertTriangle,
    category: "safety",
    sector: "universal",
    blocks: [
      { type: "heading", label: "Incident / Near Miss Report" },
      { type: "date", label: "Date & Time of Incident", required: true },
      { type: "short_text", label: "Location of Incident", required: true },
      { type: "dropdown", label: "Incident Type", required: true, options: [
        "Injury — first aid", "Injury — medical treatment", "Near miss",
        "Property damage", "Environmental", "Other"
      ]},
      { type: "long_text", label: "Description of Incident", required: true },
      { type: "long_text", label: "Immediate Actions Taken" },
      { type: "short_text", label: "Injured Person Name (if applicable)" },
      { type: "photo_evidence", label: "Scene Photo" },
      { type: "long_text", label: "Root Cause / Contributing Factors" },
      { type: "long_text", label: "Corrective Actions Required" },
      { type: "signature", label: "Reporting Person Signature", required: true },
      { type: "gps_stamp", label: "GPS Location" },
    ],
  },
  {
    id: "bowel-chart",
    title: "Bowel Output Chart",
    description:
      "NDIS care documentation for participant bowel health monitoring.",
    icon: Activity,
    category: "health",
    sector: "care",
    blocks: [
      { type: "heading", label: "Bowel Output Chart" },
      { type: "date", label: "Date", required: true },
      { type: "short_text", label: "Participant Name", required: true },
      { type: "dropdown", label: "Time of Day", required: true, options: [
        "Morning (6 AM – 12 PM)", "Afternoon (12 PM – 6 PM)",
        "Evening (6 PM – 10 PM)", "Night (10 PM – 6 AM)"
      ]},
      { type: "dropdown", label: "Bristol Stool Type", required: true, options: [
        "Type 1 — Hard lumps", "Type 2 — Lumpy sausage", "Type 3 — Cracked sausage",
        "Type 4 — Smooth snake (ideal)", "Type 5 — Soft blobs", "Type 6 — Mushy",
        "Type 7 — Watery"
      ]},
      { type: "dropdown", label: "Amount", options: ["Small", "Medium", "Large"] },
      { type: "long_text", label: "Notes / Concerns" },
      { type: "signature", label: "Support Worker Signature", required: true },
    ],
  },
  {
    id: "progress-note",
    title: "Participant Progress Note",
    description:
      "Daily progress notes for NDIS participants with goal tracking.",
    icon: Stethoscope,
    category: "care",
    sector: "care",
    blocks: [
      { type: "heading", label: "Participant Progress Note" },
      { type: "date", label: "Date", required: true },
      { type: "short_text", label: "Participant Name", required: true },
      { type: "dropdown", label: "Shift Type", options: [
        "AM Shift", "PM Shift", "Night Shift", "Sleepover", "Community Access"
      ]},
      { type: "long_text", label: "Activities & Supports Provided", required: true },
      { type: "long_text", label: "Goal Progress Observations" },
      { type: "dropdown", label: "Participant Mood", options: [
        "Happy / Engaged", "Calm / Settled", "Anxious / Agitated",
        "Withdrawn / Flat", "Distressed"
      ]},
      { type: "long_text", label: "Meals / Nutrition" },
      { type: "long_text", label: "Medications Administered" },
      { type: "long_text", label: "Incidents / Concerns" },
      { type: "photo_evidence", label: "Activity Photo (optional)" },
      { type: "signature", label: "Support Worker Signature", required: true },
    ],
  },
  {
    id: "blank",
    title: "Blank Form",
    description: "Start from scratch — add your own fields in the drag-and-drop builder.",
    icon: FileText,
    category: "custom",
    sector: "universal",
    blocks: [],
  },
];

/* ── Page Component ──────────────────────────────────────────── */

export default function FormBuilderEntryPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const { isCare } = useIndustryLexicon();
  const [creating, setCreating] = useState<string | null>(null);

  const createForm = useCallback(
    async (preset: FormPreset) => {
      if (!orgId || creating) return;
      setCreating(preset.id);

      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Transform preset blocks to builder format
        const blocks = preset.blocks.map((b, i) => ({
          id: crypto.randomUUID(),
          type: b.type,
          label: b.label,
          required: b.required ?? false,
          options: b.options ?? [],
          placeholder: b.placeholder ?? "",
          order: i,
        }));

        const { data: form, error } = await supabase
          .from("forms")
          .insert({
            organization_id: orgId,
            title: preset.id === "blank" ? "Untitled Form" : preset.title,
            description: preset.id === "blank" ? "" : preset.description,
            category: preset.category,
            status: "draft",
            blocks,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (!form?.id) throw new Error("Failed to create form");

        router.push(`/dashboard/forms/builder/${form.id}`);
      } catch (err) {
        console.error("[FormBuilder] Creation error:", err);
        setCreating(null);
      }
    },
    [orgId, creating, router]
  );

  // Filter presets based on sector
  const visiblePresets = FORM_PRESETS.filter(
    (p) => p.sector === "universal" || (isCare ? p.sector === "care" : p.sector === "trades")
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative min-h-screen bg-[var(--background)]"
    >
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(16,185,129,0.03) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400 mb-1">
            FORM BUILDER
          </p>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Create New Form
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Choose a template to get started, or start from a blank canvas.
          </p>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visiblePresets.map((preset) => {
            const Icon = preset.icon;
            const isCreating = creating === preset.id;

            return (
              <motion.button
                key={preset.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => createForm(preset)}
                disabled={!!creating}
                className="relative group text-left p-6 rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] hover:border-emerald-500/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ boxShadow: "var(--shadow-inset-bevel)" }}
              >
                {/* Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/15 transition-colors">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>

                {/* Sector badge */}
                {preset.sector !== "universal" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider mb-2 bg-zinc-500/10 text-zinc-500">
                    {preset.sector}
                  </span>
                )}

                {/* Content */}
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {preset.title}
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                  {preset.description}
                </p>

                {/* Block count */}
                {preset.blocks.length > 0 && (
                  <div className="flex items-center gap-1 mt-3 text-[10px] font-mono text-[var(--text-muted)]">
                    <Zap className="w-3 h-3" />
                    {preset.blocks.length} fields pre-configured
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Sector toggle hint */}
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">
            {isCare
              ? "Showing Care sector templates. Switch to Trades mode in Settings to see SWMS and Pre-Start forms."
              : "Showing Trades sector templates. Switch to Care mode in Settings to see health documentation forms."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
