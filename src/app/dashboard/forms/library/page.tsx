"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Crown, FileText, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import {
  cloneGlobalTemplateToWorkspace,
  getGlobalFormTemplates,
  type GlobalFormTemplate,
} from "@/app/actions/forms";
import { useToastStore } from "@/components/app/action-toast";

const categoryTone: Record<GlobalFormTemplate["category"], string> = {
  SAFETY: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  COMPLIANCE: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  CLINICAL: "text-sky-400 border-sky-500/20 bg-sky-500/10",
  INSPECTION: "text-violet-400 border-violet-500/20 bg-violet-500/10",
};

export default function FormsLibraryPage() {
  const router = useRouter();
  const { orgId } = useOrg();
  const { isCare } = useIndustryLexicon();
  const { addToast } = useToastStore();

  const [templates, setTemplates] = useState<GlobalFormTemplate[] | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  const sector = isCare ? "CARE" : "TRADES";

  useEffect(() => {
    if (!orgId) return;

    let active = true;
    (async () => {
      const { data, error } = await getGlobalFormTemplates({ orgId, sector });
      if (!active) return;

      if (error) {
        addToast(error);
        setTemplates([]);
        return;
      }

      setTemplates(data ?? []);
    })();

    return () => {
      active = false;
    };
  }, [orgId, sector, addToast]);

  const handleUseTemplate = useCallback(
    async (template: GlobalFormTemplate) => {
      if (!orgId || cloningId) return;
      setCloningId(template.id);
      const { data, error } = await cloneGlobalTemplateToWorkspace({
        globalTemplateId: template.id,
        orgId,
      });

      if (error || !data?.templateId) {
        addToast(error ?? "Unable to clone template");
        setCloningId(null);
        return;
      }

      addToast("Template cloned to draft.");
      router.push(`/dashboard/forms/builder/${data.templateId}`);
    },
    [orgId, cloningId, addToast, router]
  );

  const subtitle = useMemo(() => {
    return isCare
      ? "Clinical and compliance-ready templates curated for care teams."
      : "Safety and field operations templates curated for trades teams.";
  }, [isCare]);

  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div className="relative z-10 border-b border-white/[0.05] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/forms"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
              aria-label="Back to forms"
            >
              <ArrowLeft size={14} />
            </Link>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                TEMPLATE LIBRARY
              </p>
              <h1 className="text-[16px] font-semibold text-zinc-100">Global Form Store</h1>
              <p className="text-[12px] text-zinc-600">{subtitle}</p>
            </div>
          </div>
          <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-zinc-500">
            {templates?.length ?? 0} templates
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {templates === null ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 text-zinc-500">
              <Loader2 size={14} className="animate-spin" />
              Loading templates...
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
              <FileText size={18} className="text-zinc-600" />
            </div>
            <h3 className="text-[14px] font-medium text-zinc-300">No templates available</h3>
            <p className="mt-1 text-[12px] text-zinc-600">
              Global templates have not been seeded yet for this environment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template, idx) => {
              const isCloning = cloningId === template.id;
              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.2), duration: 0.2 }}
                  className="rounded-xl border border-white/[0.06] bg-zinc-950/40 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-medium text-white">{template.title}</h3>
                      <p className="mt-1 text-[11px] text-zinc-600">{template.description}</p>
                    </div>
                    {template.is_premium && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-400">
                        <Crown size={10} />
                        Premium
                      </span>
                    )}
                  </div>

                  <div className="mb-4 flex items-center gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] ${categoryTone[template.category]}`}
                    >
                      {template.category}
                    </span>
                    <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                      {template.sector}
                    </span>
                    {template.clone_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                        <Sparkles size={10} />
                        {template.clone_count}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleUseTemplate(template)}
                    disabled={isCloning}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {isCloning ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    {isCloning ? "Cloning..." : "Use Template"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
