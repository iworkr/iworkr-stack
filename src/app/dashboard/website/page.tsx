/**
 * @page app/dashboard/website/page.tsx
 * @status STABLE
 * @description Route — dashboard/website
 * @lastReview 2026-03-28
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Globe,
  ExternalLink,
  Calendar,
  CheckCircle,
  FileEdit,
  Search,
  BarChart3,
} from "lucide-react";
import { getSites } from "@/app/actions/sites";

interface SiteRow {
  id: string;
  name: string;
  subdomain: string | null;
  custom_domain: string | null;
  is_published: boolean;
  domain_verified: boolean;
  theme_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function WebsiteDashboard() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    getSites()
      .then((data) => setSites(data as SiteRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const liveCount = sites.filter((s) => s.is_published).length;
  const filtered = search
    ? sites.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.subdomain?.toLowerCase().includes(search.toLowerCase()) ||
          s.custom_domain?.toLowerCase().includes(search.toLowerCase()),
      )
    : sites;

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
              MARKETING
            </span>
            <div className="flex items-center gap-3">
              <h1 className="text-[15px] font-medium text-white">Websites</h1>
              <span className="rounded-full bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                {sites.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {liveCount > 0 && (
              <div className="mr-2 flex items-center gap-1.5 rounded-md bg-white/[0.02] px-2 py-1">
                <CheckCircle size={10} className="text-emerald-500" />
                <span className="font-mono text-[10px] tabular-nums text-emerald-400">
                  {liveCount}
                </span>
                <span className="font-mono text-[9px] tracking-wide text-zinc-600">
                  LIVE
                </span>
              </div>
            )}

            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 180, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search sites..."
                    className="h-7 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-white/[0.12]"
                    onBlur={() => {
                      if (!search) setShowSearch(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowSearch((p) => !p)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            >
              <Search size={13} />
            </button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/dashboard/website/new")}
              className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <Plus size={13} />
              New Site
            </motion.button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <motion.div
              animate={{ scale: [1, 0.85, 1] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/[0.04]"
            >
              <div className="h-3 w-3 rounded-full bg-emerald-500/40" />
            </motion.div>
            <p className="text-[12px] text-zinc-600">Loading sites…</p>
          </div>
        ) : sites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 h-[160px] w-[160px] rounded-full bg-white/[0.015] blur-[60px]" />
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-xl border border-white/[0.04] animate-signal-pulse" />
              <div
                className="absolute inset-2 rounded-lg border border-white/[0.03] animate-signal-pulse"
                style={{ animationDelay: "0.5s" }}
              />
              <motion.div
                className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"
                animate={{ top: ["20%", "80%", "20%"] }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <div
                className="absolute inset-0 animate-orbit"
                style={{ animationDuration: "6s" }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
                  <div className="h-1 w-1 rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <Globe
                  size={16}
                  strokeWidth={1.5}
                  className="text-zinc-600"
                />
              </div>
            </div>

            <h3 className="text-[14px] font-medium text-zinc-300">
              No websites yet
            </h3>
            <p className="mt-1 max-w-[280px] text-[12px] text-zinc-600">
              Create a professional website for your business in minutes with
              the drag-and-drop builder.
            </p>

            <div className="mt-6 flex items-center gap-4">
              {[
                { icon: Globe, label: "Custom domains" },
                { icon: BarChart3, label: "Built-in analytics" },
                { icon: FileEdit, label: "Lead capture" },
              ].map(({ icon: HintIcon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-[10px] text-zinc-700"
                >
                  <HintIcon size={10} strokeWidth={1.5} />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/dashboard/website/new")}
              className="mt-5 flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-3 py-1.5 text-[12px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <Plus size={12} />
              Create Your First Site
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((site, i) => (
              <motion.button
                key={site.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: i * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                onClick={() =>
                  router.push(`/dashboard/website/${site.id}/editor`)
                }
                className="group relative rounded-lg border border-white/[0.05] bg-white/[0.01] p-4 text-left transition-all duration-150 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] transition-colors group-hover:border-emerald-500/20">
                    <Globe
                      size={15}
                      strokeWidth={1.5}
                      className="text-zinc-500 transition-colors group-hover:text-emerald-400"
                    />
                  </div>
                  {site.is_published ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                      Draft
                    </span>
                  )}
                </div>

                <h3 className="text-[13px] font-medium text-zinc-300 mb-1 transition-colors group-hover:text-white">
                  {site.name}
                </h3>

                <div className="flex items-center gap-1 text-[11px] text-zinc-600 mb-3">
                  <ExternalLink size={10} />
                  <span className="truncate">
                    {site.custom_domain ||
                      (site.subdomain
                        ? `${site.subdomain}.iworkrsites.com`
                        : "No domain")}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-zinc-700">
                  <Calendar size={10} />
                  Updated {new Date(site.updated_at).toLocaleDateString()}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
