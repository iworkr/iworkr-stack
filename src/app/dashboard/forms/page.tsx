"use client";

import { motion } from "framer-motion";
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
} from "lucide-react";
import { useMemo } from "react";
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

    // Tab filter: my_forms = custom only, library = verified library only
    if (activeTab === "my_forms") {
      items = items.filter((t) => t.source === "custom");
    } else if (activeTab === "library") {
      items = items.filter((t) => t.source === "library");
    }

    // Search
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
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-4 pb-0 pt-4 md:px-6 md:pt-5">
        {/* Title row */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">Forms & Compliance</h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">
              Build, deploy, and audit digital forms with forensic-grade traceability.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats ticker */}
            <div className="flex items-center gap-4 pr-3">
              <div className="flex items-center gap-1.5">
                <Layers size={12} className="text-zinc-500" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{templateCount}</span> templates
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-emerald-500" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-emerald-400">{signedCount}</span> signed
                </span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-amber-500" />
                  <span className="text-[11px] text-zinc-500">
                    <span className="font-medium text-amber-400">{pendingCount}</span> pending
                  </span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search forms..."
                className="h-8 w-48 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-[rgba(255,255,255,0.2)]"
              />
            </div>

            {/* New Form button */}
            <button
              onClick={() => router.push("/dashboard/forms/builder/new")}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-white/[0.05] px-3 text-[12px] font-medium text-zinc-300 transition-all hover:border-[rgba(255,255,255,0.2)] hover:bg-white/[0.08]"
            >
              <Plus size={13} strokeWidth={2} />
              New Form
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${
                  isActive ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Icon size={13} strokeWidth={1.5} />
                {tab.label}
                {tab.id === "submissions" && submissions.length > 0 && (
                  <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] px-1 text-[9px] font-medium text-zinc-500">
                    {submissions.length}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="forms-tab-indicator"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === "submissions" ? (
          <SubmissionsList submissions={filteredSubmissions} />
        ) : (
          <>
            {/* Template Grid — 3:4 aspect ratio document cards */}
            {filteredTemplates.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredTemplates.map((template, i) => (
                  <FormCard key={template.id} template={template} index={i} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText size={28} strokeWidth={0.8} className="mb-3 text-zinc-800" />
                <p className="text-[13px] text-zinc-500">
                  {activeTab === "my_forms"
                    ? "No custom forms yet."
                    : "No library templates found."}
                </p>
                <p className="mt-1 text-[11px] text-zinc-700">
                  {activeTab === "my_forms"
                    ? "Create your first form to get started."
                    : "Try adjusting your search."}
                </p>
                {activeTab === "my_forms" && (
                  <button
                    onClick={() => router.push("/dashboard/forms/builder/new")}
                    className="mt-4 flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-white/[0.05] px-4 py-2 text-[12px] font-medium text-zinc-300 transition-all hover:border-[rgba(255,255,255,0.2)] hover:bg-white/[0.08]"
                  >
                    <Plus size={13} />
                    New Form
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
