/**
 * @page /dashboard
 * @status COMPLETE
 * @description Main dashboard with configurable bento grid widgets and live KPI snapshot
 * @dataSource server-action: getDashboardSnapshot, loadDashboardLayout
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { useOrg } from "@/lib/hooks/use-org";
import { useJobsStore } from "@/lib/jobs-store";
import { useDashboardStore } from "@/lib/dashboard-store";
import { getDashboardSnapshot, loadDashboardLayout } from "@/app/actions/dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard-store";
import type { DashboardLayoutItem } from "@/lib/schemas/dashboard";
import { motion } from "framer-motion";
import { useIndustryLexicon } from "@/lib/industry-lexicon";

function formatDate() {
  const now = new Date();
  return {
    dayName: now.toLocaleDateString("en-US", { weekday: "long" }),
    monthDay: now.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
  };
}

export default function DashboardPage() {
  const [dateLabel, setDateLabel] = useState({ dayName: "", monthDay: "" });
  useEffect(() => { setDateLabel(formatDate()); }, []);

  const { orgId } = useOrg();
  const { t, isCare } = useIndustryLexicon();
  const jobsLoaded = useJobsStore((s) => s.loaded);
  const jobsFromStore = useJobsStore((s) => s.jobs);
  const editMode = useDashboardStore((s) => s.editMode);
  const setEditMode = useDashboardStore((s) => s.setEditMode);
  const snapshot = useDashboardStore((s) => s.snapshot);
  const snapshotFetchedAt = useDashboardStore((s) => s.snapshotFetchedAt);
  const setSnapshot = useDashboardStore((s) => s.setSnapshot);
  const setSnapshotLoading = useDashboardStore((s) => s.setSnapshotLoading);
  const setLayouts = useDashboardStore((s) => s.setLayouts);
  const setActiveWidgets = useDashboardStore((s) => s.setActiveWidgets);

  useEffect(() => {
    if (!orgId) return;
    const STALE_MS = 5 * 60 * 1000;
    const isFresh = snapshotFetchedAt && Date.now() - snapshotFetchedAt < STALE_MS;
    if (!snapshot || !isFresh) {
      if (!snapshot) setSnapshotLoading(true);
      getDashboardSnapshot(orgId).then(({ data }) => {
        if (data) setSnapshot(data as DashboardSnapshot);
      });
    }
  }, [orgId, snapshot, snapshotFetchedAt, setSnapshot, setSnapshotLoading]);

  useEffect(() => {
    loadDashboardLayout().then(({ data }) => {
      if (data && Array.isArray(data) && data.length > 0) {
        const items = data as DashboardLayoutItem[];
        setLayouts({ lg: items });
        setActiveWidgets(items.map((l) => l.i));
      }
    });
  }, [setLayouts, setActiveWidgets]);

  const activeJobCount = snapshot?.active_jobs
    ?? (jobsLoaded ? jobsFromStore.filter(j => j.status !== "done" && j.status !== "cancelled").length : null);

  return (
    <div className="relative p-6 lg:p-8">
      {/* Noise texture */}
      <div className="stealth-noise" />

      {/* Radial glow — neutral atmosphere behind header */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* Page header — stagger in first */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 flex items-center justify-between"
      >
        <div>
          <span className="font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            {t("COMMAND CENTER")}
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
            {t("Dashboard")}
          </h1>
          <p className="mt-1 border-l-2 pl-2 text-[12px] text-zinc-600" style={{ borderColor: isCare ? "rgba(59,130,246,0.3)" : "rgb(63,63,70)" }}>
            {dateLabel.dayName}{dateLabel.dayName && `, ${dateLabel.monthDay}`}
            {activeJobCount !== null ? ` — ${activeJobCount} ${t(activeJobCount !== 1 ? "active jobs" : "active job")}` : ""}
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => setEditMode(!editMode)}
            className={`stealth-btn-ghost gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-medium ${
              editMode
                ? "!border-white/20 !bg-white/10 !text-white shadow-[0_0_20px_-6px_rgba(255,255,255,0.08)]"
                : ""
            }`}
          >
            <Pencil size={11} />
            {editMode ? "Editing" : "Edit Layout"}
          </button>

          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.04] px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
            </span>
            <span className="text-[11px] text-zinc-500">Live</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Grid */}
      <DashboardGrid />
    </div>
  );
}
