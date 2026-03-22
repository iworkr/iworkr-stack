/**
 * @page /dashboard/forms
 * @status COMPLETE
 * @description Forms & compliance hub with template list, search, and quick fill
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  FileText,
  BookOpen,
  ClipboardCheck,
  ShieldCheck,
  Clock,
  CheckCircle,
  Layers,
  X,
  PenTool,
  Heart,
  AlertTriangle,
  Activity,
  Pill,
  FileCheck,
  Brain,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormsStore, type FormsTab } from "@/lib/forms-store";
import { FormCard } from "@/components/forms/form-card";
import { SubmissionsList } from "@/components/forms/submissions-list";
import { useIndustryLexicon } from "@/lib/industry-lexicon";

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: FormsTab; label: string; icon: typeof FileText }[] = [
  { id: "my_forms", label: "My Forms", icon: FileText },
  { id: "library", label: "Template Library", icon: BookOpen },
  { id: "submissions", label: "Submissions", icon: ClipboardCheck },
];

/* ── Lottie-style Empty State ────────────────────────── */

function ForensicEmptyState({
  title,
  subtitle,
  cta,
  onCta,
  hints,
}: {
  title: string;
  subtitle: string;
  cta?: string;
  onCta?: () => void;
  hints?: { icon: typeof ShieldCheck; label: string }[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      {/* Subtle radial glow behind icon */}
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-[160px] w-[160px] rounded-full bg-white/[0.015] blur-[60px]" />
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        {/* Blueprint wireframe rings */}
        <div className="absolute inset-0 rounded-xl border border-white/[0.04] animate-signal-pulse" />
        <div className="absolute inset-2 rounded-lg border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
        {/* Laser line drawing the blueprint */}
        <motion.div
          className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
          animate={{ top: ["20%", "80%", "20%"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Orbit particle */}
        <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "6s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
            <div className="h-1 w-1 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <FileText size={16} strokeWidth={1.5} className="text-zinc-600" />
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-[280px] text-[12px] text-zinc-600">{subtitle}</p>

      {/* Capability hints — show system potential */}
      <div className="mt-6 flex items-center gap-4">
        {(hints ?? [
          { icon: ShieldCheck, label: "Safety checks" },
          { icon: ClipboardCheck, label: "Field inspections" },
          { icon: PenTool, label: "Digital signatures" },
        ]).map(({ icon: HintIcon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-700">
            <HintIcon size={10} strokeWidth={1.5} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCta}
          className="mt-5 flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
        >
          <Plus size={12} />
          {cta}
        </motion.button>
      )}
    </motion.div>
  );
}

/* ── Heartbeat Loader ────────────────────────────────── */

function HeartbeatLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ scale: [1, 0.85, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.04]"
      >
        <div className="h-3 w-3 rounded-full bg-emerald-500/40" />
      </motion.div>
      <p className="text-[12px] text-zinc-600">Loading vault…</p>
    </div>
  );
}

/* ── Care Form Suggestions ────────────────────────────── */

const CARE_FORM_SUGGESTIONS = [
  { icon: AlertTriangle, label: "Incident Report Form", desc: "Document workplace incidents and near-misses for NDIS compliance." },
  { icon: FileCheck, label: "Progress Note Template", desc: "Standardised shift-level participant progress notes." },
  { icon: Activity, label: "Health Observation Form", desc: "Record vitals, symptoms, and daily health observations." },
  { icon: Pill, label: "Medication Administration Record", desc: "Track medication dispensing with time, dose, and worker sign-off." },
  { icon: ShieldCheck, label: "Risk Assessment", desc: "Assess participant and environment risks before service delivery." },
  { icon: Brain, label: "Behaviour Support Plan", desc: "Document behaviour triggers, strategies, and de-escalation protocols." },
];

function CareFormSuggestions({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="mt-6 w-full max-w-2xl mx-auto">
      <p className="text-[11px] font-mono font-bold uppercase tracking-[0.12em] text-zinc-600 mb-3">
        Suggested Care Templates
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CARE_FORM_SUGGESTIONS.map(({ icon: Icon, label, desc }) => (
          <button
            key={label}
            onClick={onSelect}
            className="group flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.01] px-3.5 py-3 text-left transition-all duration-150 hover:border-emerald-500/20 hover:bg-emerald-500/[0.03]"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] transition-colors group-hover:border-emerald-500/20">
              <Icon size={13} strokeWidth={1.5} className="text-zinc-500 transition-colors group-hover:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-zinc-300 group-hover:text-white transition-colors">{label}</p>
              <p className="text-[10px] text-zinc-600 leading-relaxed mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function FormsPage() {
  const router = useRouter();
  const { t, isCare } = useIndustryLexicon();
  const {
    templates,
    submissions,
    activeTab,
    searchQuery,
    loading,
    setActiveTab,
    setSearchQuery,
  } = useFormsStore();

  const [showSearch, setShowSearch] = useState(false);

  /* ── Stats ──────────────────────────────────────────── */
  const templateCount = useMemo(
    () => templates.filter((t) => t.status !== "archived").length,
    [templates]
  );
  const signedCount = useMemo(
    () => submissions.filter((s) => s.status === "signed").length,
    [submissions]
  );
  const pendingCount = useMemo(
    () => submissions.filter((s) => s.status === "pending").length,
    [submissions]
  );

  /* ── Filtering ──────────────────────────────────────── */
  const filteredTemplates = useMemo(() => {
    let items = templates.filter((t) => t.status !== "archived");

    if (activeTab === "my_forms") {
      items = items.filter((t) => t.source === "custom");
    } else if (activeTab === "library") {
      items = items.filter((t) => t.source === "library");
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return items;
  }, [templates, activeTab, searchQuery]);

  const filteredSubmissions = useMemo(() => {
    if (activeTab !== "submissions") return [];
    let items = submissions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (s) =>
          s.formTitle.toLowerCase().includes(q) ||
          s.submittedBy.toLowerCase().includes(q) ||
          (s.jobRef && s.jobRef.toLowerCase().includes(q)) ||
          (s.clientName && s.clientName.toLowerCase().includes(q))
      );
    }
    return items;
  }, [submissions, activeTab, searchQuery]);

  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      {/* Noise texture */}
      <div className="stealth-noise" />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />
      {/* ── Header ───────────────────────────────────── */}
      <div className="relative z-10 border-b border-white/[0.05]">
        {/* Title row */}
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">COMPLIANCE</span>
            <div className="flex items-center gap-3">
              <h1 className="text-[15px] font-medium text-white">Forms & Compliance</h1>
              <span className="rounded-full bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                {templateCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats — mono analytical readout */}
            <div className="mr-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-md bg-white/[0.02] px-2 py-1">
                <CheckCircle size={10} className="text-emerald-500" />
                <span className="font-mono text-[10px] tabular-nums text-emerald-400">{signedCount}</span>
                <span className="font-mono text-[9px] tracking-wide text-zinc-600">SIGNED</span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-md bg-white/[0.02] px-2 py-1">
                  <Clock size={10} className="text-amber-500" />
                  <span className="font-mono text-[10px] tabular-nums text-amber-400">{pendingCount}</span>
                  <span className="font-mono text-[9px] tracking-wide text-zinc-600">PENDING</span>
                </div>
              )}
            </div>

            {/* Search toggle */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 200, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900/50 px-2 py-1">
                    <Search size={12} className="shrink-0 text-zinc-600" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setShowSearch(false); } }}
                      placeholder="Search forms…"
                      className="w-full bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-zinc-600 hover:text-zinc-400">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!showSearch && (
              <button
                onClick={() => setShowSearch(true)}
                className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400"
              >
                <Search size={14} />
              </button>
            )}

            {/* New Form — Ghost button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/dashboard/forms/builder/new")}
              className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#1A1A1A] px-3 text-[11px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <Plus size={13} strokeWidth={2} />
              {isCare ? "Create Care Form" : "New Form"}
            </motion.button>
          </div>
        </div>

        {/* Tabs — Emerald underscore */}
        <div className="flex gap-0.5 px-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-[12px] transition-colors duration-150 ${
                  isActive ? "font-medium text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={13} strokeWidth={1.5} />
                {tab.label}
                {tab.id === "submissions" && submissions.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/[0.04] px-1 font-mono text-[9px] font-medium text-zinc-500">
                    {submissions.length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="forms-tab-indicator"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <HeartbeatLoader />
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "submissions" ? (
              <motion.div
                key="submissions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="px-5 py-4"
              >
                <SubmissionsList submissions={filteredSubmissions} />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="px-5 py-4"
              >
                {filteredTemplates.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {filteredTemplates.map((template, i) => (
                      <FormCard key={template.id} template={template} index={i} />
                    ))}
                  </div>
                ) : (
                  <>
                    <ForensicEmptyState
                      title={activeTab === "my_forms" ? t("No forms deployed") : "No library templates found"}
                      subtitle={
                        activeTab === "my_forms"
                          ? t("Build your first digital blueprint for forensic traceability.")
                          : "Try adjusting your search."
                      }
                      cta={activeTab === "my_forms" ? (isCare ? "Create Care Form" : "New Form") : undefined}
                      onCta={activeTab === "my_forms" ? () => router.push("/dashboard/forms/builder/new") : undefined}
                      hints={isCare ? [
                        { icon: ShieldCheck, label: "Care plans" },
                        { icon: ClipboardCheck, label: "Risk assessments" },
                        { icon: PenTool, label: "Progress notes" },
                      ] : undefined}
                    />
                    {isCare && activeTab === "my_forms" && (
                      <CareFormSuggestions onSelect={() => router.push("/dashboard/forms/builder/new")} />
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
