"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { useOrg } from "@/lib/hooks/use-org";
import { useJobsStore } from "@/lib/jobs-store";
import { useDashboardStore } from "@/lib/dashboard-store";
import { getDashboardSnapshot, loadDashboardLayout } from "@/app/actions/dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard-store";

export default function DashboardPage() {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const { orgId } = useOrg();
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

  // Aggregated data fetch — SWR: render cached, revalidate in background
  useEffect(() => {
    if (!orgId) return;

    const STALE_MS = 5 * 60 * 1000; // 5 minutes
    const isFresh = snapshotFetchedAt && Date.now() - snapshotFetchedAt < STALE_MS;

    if (!snapshot || !isFresh) {
      if (!snapshot) setSnapshotLoading(true);

      getDashboardSnapshot(orgId).then(({ data }) => {
        if (data) setSnapshot(data as DashboardSnapshot);
      });
    }
  }, [orgId, snapshot, snapshotFetchedAt, setSnapshot, setSnapshotLoading]);

  // Load persisted layout from Supabase (once)
  useEffect(() => {
    loadDashboardLayout().then(({ data }) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setLayouts({ lg: data });
        setActiveWidgets(data.map((l: { i: string }) => l.i));
      }
    });
  }, [setLayouts, setActiveWidgets]);

  // Active jobs from snapshot or store
  const activeJobCount = snapshot?.active_jobs
    ?? (jobsLoaded ? jobsFromStore.filter(j => j.status !== "done" && j.status !== "cancelled").length : null);

  return (
    <div className="relative p-4 lg:p-6">
      {/* Subtle dot grid background */}
      <div className="pointer-events-none fixed inset-0 bg-dot-grid opacity-[0.015]" />

      {/* Page header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-medium text-zinc-200">Dashboard</h1>
          <p className="mt-0.5 text-[12px] text-zinc-600">
            {dayName}, {monthDay}
            {activeJobCount !== null ? ` — ${activeJobCount} active job${activeJobCount !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Edit Layout Toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
              editMode
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                : "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-300"
            }`}
          >
            <Pencil size={12} />
            {editMode ? "Editing" : "Edit Layout"}
          </button>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] text-zinc-600">Live</span>
          </div>
        </div>
      </div>

      {/* Customizable Grid */}
      <DashboardGrid />
    </div>
  );
}
