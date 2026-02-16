"use client";

import { useEffect, useState } from "react";
import { WidgetRevenue } from "@/components/dashboard/widget-revenue";
import { WidgetMap } from "@/components/dashboard/widget-map";
import { WidgetInbox } from "@/components/dashboard/widget-inbox";
import { WidgetSchedule } from "@/components/dashboard/widget-schedule";
import { WidgetActions } from "@/components/dashboard/widget-actions";
import { WidgetInsights } from "@/components/dashboard/widget-insights";
import { useJobsStore } from "@/lib/jobs-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getDashboardStats } from "@/app/actions/dashboard";

export default function DashboardPage() {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const { orgId } = useOrg();
  const jobsLoaded = useJobsStore((s) => s.loaded);
  const jobsFromStore = useJobsStore((s) => s.jobs);

  const [activeJobCount, setActiveJobCount] = useState<number | null>(null);

  // Get live active job count from RPC or store
  useEffect(() => {
    if (!orgId) return;
    getDashboardStats(orgId).then(({ data }) => {
      if (data) setActiveJobCount(data.active_jobs_count);
    });
  }, [orgId]);

  // Fallback to store count
  const displayCount = activeJobCount
    ?? (jobsLoaded ? jobsFromStore.filter(j => j.status !== "done" && j.status !== "cancelled").length : null);

  return (
    <div className="relative p-4 lg:p-6">
      {/* Subtle dot grid background */}
      <div className="pointer-events-none fixed inset-0 bg-dot-grid opacity-[0.015]" />
      {/* Page header */}
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <h1 className="text-[15px] font-medium text-zinc-200">Dashboard</h1>
          <p className="mt-0.5 text-[12px] text-zinc-600">
            {dayName}, {monthDay}
            {displayCount !== null && ` — ${displayCount} active job${displayCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] text-zinc-600">Live</span>
        </div>
      </div>

      {/* Bento Grid — 4 column responsive */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Row 1: Financial Pulse (span 2) + War Room Map (span 2) */}
        <div className="md:col-span-2">
          <WidgetRevenue />
        </div>
        <div className="md:col-span-2">
          <WidgetMap />
        </div>

        {/* Row 2: Triage Inbox (1) + My Schedule (1) + Quick Actions (1) + AI Insights (1) */}
        <div className="md:col-span-1">
          <WidgetInbox />
        </div>
        <div className="md:col-span-1">
          <WidgetSchedule />
        </div>
        <div className="md:col-span-1">
          <WidgetActions />
        </div>
        <div className="md:col-span-1">
          <WidgetInsights />
        </div>
      </div>
    </div>
  );
}
