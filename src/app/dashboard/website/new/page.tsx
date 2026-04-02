/**
 * @page app/dashboard/website/new/page.tsx
 * @status STABLE
 * @description Route — dashboard/website/new
 * @lastReview 2026-03-28
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Paintbrush,
  Sparkles,
} from "lucide-react";
import { createSite, createPage } from "@/app/actions/sites";
import { SITE_THEMES, type SiteTheme } from "@/components/site-editor/themes";

export default function NewSitePage() {
  const router = useRouter();
  const [step, setStep] = useState<"name" | "theme">("name");
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<SiteTheme | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(val: string) {
    setName(val);
    setSubdomain(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    );
  }

  async function handleCreate() {
    if (!name.trim() || !subdomain.trim()) return;
    setCreating(true);
    setError("");
    try {
      const site = await createSite({
        name: name.trim(),
        subdomain,
        themeId: selectedTheme?.id,
        globalStyles: selectedTheme?.globalStyles,
      });

      if (selectedTheme) {
        for (const page of selectedTheme.pages) {
          await createPage(site.id, {
            slug: page.slug,
            title: page.title,
            layoutJsonb: page.blocks,
          });
        }
      } else {
        await createPage(site.id, { slug: "/", title: "Home" });
      }

      router.push(`/dashboard/website/${site.id}/editor`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setCreating(false);
    }
  }

  const tradeThemes = SITE_THEMES.filter((t) => t.sector === "trades");
  const careThemes = SITE_THEMES.filter((t) => t.sector === "care");

  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 border-b border-white/[0.05]">
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              WEBSITE BUILDER
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-[15px] font-medium text-white">
                Create a New Website
              </h1>
              <div className="flex items-center gap-1">
                <div
                  className={`h-1.5 w-6 rounded-full transition-colors ${step === "name" || step === "theme" ? "bg-emerald-500" : "bg-white/[0.06]"}`}
                />
                <div
                  className={`h-1.5 w-6 rounded-full transition-colors ${step === "theme" ? "bg-emerald-500" : "bg-white/[0.06]"}`}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push("/dashboard/website")}
            className="flex items-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === "name" && (
            <motion.div
              key="step-name"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-md px-5 pt-12 pb-8"
            >
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Globe size={18} strokeWidth={1.5} className="text-zinc-500" />
              </div>

              <h2 className="text-[14px] font-medium text-zinc-200 mb-1">
                Name your site
              </h2>
              <p className="text-[12px] text-zinc-600 mb-6">
                Choose a name and subdomain for your business website.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Acme Plumbing"
                    autoFocus
                    className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 transition-colors focus:border-white/[0.12] focus:bg-white/[0.03]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                    Subdomain
                  </label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={subdomain}
                      onChange={(e) =>
                        setSubdomain(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        )
                      }
                      className="h-9 flex-1 rounded-l-md border border-white/[0.06] bg-white/[0.02] px-3 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 transition-colors focus:border-white/[0.12] focus:bg-white/[0.03]"
                    />
                    <span className="flex h-9 items-center rounded-r-md border border-l-0 border-white/[0.06] bg-white/[0.01] px-3 text-[11px] text-zinc-600">
                      .iworkrsites.com
                    </span>
                  </div>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep("theme")}
                disabled={!name.trim() || !subdomain.trim()}
                className="mt-8 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
              >
                Choose Theme
                <ArrowRight size={13} />
              </motion.button>
            </motion.div>
          )}

          {step === "theme" && (
            <motion.div
              key="step-theme"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="px-5 pt-8 pb-8"
            >
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <Paintbrush
                    size={18}
                    strokeWidth={1.5}
                    className="text-zinc-500"
                  />
                </div>
                <div>
                  <h2 className="text-[14px] font-medium text-zinc-200">
                    Pick a starting theme
                  </h2>
                  <p className="text-[12px] text-zinc-600">
                    Pre-built templates to get you live in minutes. Everything
                    is customizable.
                  </p>
                </div>
              </div>

              {/* Trades */}
              <div className="mb-6">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">
                  Trades
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tradeThemes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      selected={selectedTheme?.id === theme.id}
                      onSelect={() => setSelectedTheme(theme)}
                    />
                  ))}
                </div>
              </div>

              {/* Care */}
              <div className="mb-6">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">
                  Care
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {careThemes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      selected={selectedTheme?.id === theme.id}
                      onSelect={() => setSelectedTheme(theme)}
                    />
                  ))}
                </div>
              </div>

              {/* Blank */}
              <div className="mb-6">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">
                  Blank
                </p>
                <button
                  onClick={() => setSelectedTheme(null)}
                  className={`group rounded-lg border p-4 text-left transition-all duration-150 ${
                    selectedTheme === null
                      ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                      : "border-white/[0.05] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                    <Sparkles
                      size={13}
                      strokeWidth={1.5}
                      className="text-zinc-500"
                    />
                  </div>
                  <p className="text-[12px] font-medium text-zinc-300">
                    Blank Canvas
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    Start from scratch with an empty page
                  </p>
                </button>
              </div>

              {error && (
                <p className="mb-3 text-[12px] text-red-400">{error}</p>
              )}

              <div className="flex items-center gap-3 border-t border-white/[0.05] pt-5">
                <button
                  onClick={() => setStep("name")}
                  className="flex items-center gap-1.5 rounded-md border border-white/[0.06] px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                >
                  <ArrowLeft size={13} />
                  Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {creating && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  Create Site
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: SiteTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative rounded-lg border p-4 text-left transition-all duration-150 ${
        selected
          ? "border-emerald-500/40 bg-emerald-500/[0.04]"
          : "border-white/[0.05] bg-white/[0.01] hover:border-white/[0.1] hover:bg-white/[0.02]"
      }`}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className="text-white"
          >
            <path
              d="M1 4L3 6L7 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div
          className="h-2 w-8 rounded-full"
          style={{ backgroundColor: theme.globalStyles.primaryColor }}
        />
        <div
          className="h-2 w-4 rounded-full opacity-50"
          style={{ backgroundColor: theme.globalStyles.secondaryColor }}
        />
      </div>

      <p className="text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">
        {theme.name}
      </p>
      <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">
        {theme.description}
      </p>
    </button>
  );
}
