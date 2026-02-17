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
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormsStore, type FormsTab } from "@/lib/forms-store";
import { FormCard } from "@/components/forms/form-card";
import { SubmissionsList } from "@/components/forms/submissions-list";

/* ── Tab Config ───────────────────────────────────────── */

const tabs: { id: FormsTab; label: string; icon: typeof FileText }[] = [
  { id: "my_forms", label: "My Forms", icon: FileText },
  { id: "library", label: "iWorkr Library", icon: BookOpen },
  { id: "submissions", label: "Submissions", icon: ClipboardCheck },
];

/* ── Lottie-style Empty State ────────────────────────── */

function ForensicEmptyState({
  title,
  subtitle,
  cta,
  onCta,
}: {
  title: string;
  subtitle: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
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
      {cta && onCta && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onCta}
          className="mt-4 flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
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

/* ── Page ─────────────────────────────────────────────── */

export default function FormsPage() {
  const router = useRouter();
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
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-white/[0.05]">
        {/* Title row */}
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-medium text-white">Forms & Compliance</h1>
            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
              {templateCount} templates
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="mr-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle size={11} className="text-emerald-500" />
                <span className="font-mono text-[10px] text-emerald-400">{signedCount}</span>
                <span className="text-[10px] text-zinc-600">signed</span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-amber-500" />
                  <span className="font-mono text-[10px] text-amber-400">{pendingCount}</span>
                  <span className="text-[10px] text-zinc-600">pending</span>
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
              New Form
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
                  <ForensicEmptyState
                    title={activeTab === "my_forms" ? "No forms deployed" : "No library templates found"}
                    subtitle={
                      activeTab === "my_forms"
                        ? "Build your first digital blueprint for forensic traceability."
                        : "Try adjusting your search."
                    }
                    cta={activeTab === "my_forms" ? "New Form" : undefined}
                    onCta={activeTab === "my_forms" ? () => router.push("/dashboard/forms/builder/new") : undefined}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
