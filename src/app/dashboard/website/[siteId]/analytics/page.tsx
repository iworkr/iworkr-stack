/**
 * @page app/dashboard/website/[siteId]/analytics/page.tsx
 * @status STABLE
 * @description Route — dashboard/website/[siteId]/analytics
 * @lastReview 2026-03-28
 */
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { BarChart3, Users, Eye, Globe, Smartphone, Monitor, Loader2 } from "lucide-react";
import { getSiteAnalytics } from "@/app/actions/sites";

type AnalyticsRow = {
  page_path: string;
  visitor_hash: string;
  referrer: string | null;
  country: string | null;
  city: string | null;
  device_type: string | null;
  created_at: string;
};

type Range = "7d" | "30d" | "90d";

export default function SiteAnalyticsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [data, setData] = useState<AnalyticsRow[]>([]);
  const [range, setRange] = useState<Range>("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    getSiteAnalytics(siteId, range)
      .then((rows) => setData(rows as AnalyticsRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId, range]);

  const stats = useMemo(() => {
    const uniqueVisitors = new Set(data.map((r) => r.visitor_hash)).size;
    const pageViews = data.length;
    const topPages = Object.entries(
      data.reduce<Record<string, number>>((acc, r) => {
        acc[r.page_path] = (acc[r.page_path] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topReferrers = Object.entries(
      data.reduce<Record<string, number>>((acc, r) => {
        const ref = r.referrer ? new URL(r.referrer).hostname : "Direct";
        acc[ref] = (acc[ref] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const devices = data.reduce<Record<string, number>>((acc, r) => {
      const d = r.device_type || "desktop";
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});

    const countries = Object.entries(
      data.reduce<Record<string, number>>((acc, r) => {
        const c = r.country || "Unknown";
        acc[c] = (acc[c] || 0) + 1;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return { uniqueVisitors, pageViews, topPages, topReferrers, devices, countries };
  }, [data]);

  return (
    <div className="stealth-page-wrapper">
      <div className="stealth-page-header">
        <div>
          <h1 className="stealth-page-title">Site Analytics</h1>
          <p className="stealth-page-subtitle">Privacy-first, cookie-less visitor insights</p>
        </div>
        <div className="flex gap-1">
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors ${
                range === r
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Users size={14} />
                <span className="text-[11px] font-medium">Unique Visitors</span>
              </div>
              <div className="text-2xl font-bold text-zinc-200">{stats.uniqueVisitors.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Eye size={14} />
                <span className="text-[11px] font-medium">Page Views</span>
              </div>
              <div className="text-2xl font-bold text-zinc-200">{stats.pageViews.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Monitor size={14} />
                <span className="text-[11px] font-medium">Desktop</span>
              </div>
              <div className="text-2xl font-bold text-zinc-200">{(stats.devices.desktop || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center gap-2 text-zinc-500 mb-2">
                <Smartphone size={14} />
                <span className="text-[11px] font-medium">Mobile</span>
              </div>
              <div className="text-2xl font-bold text-zinc-200">{(stats.devices.mobile || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Pages */}
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-base)]">
                <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <BarChart3 size={12} />
                  Top Pages
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-base)]">
                {stats.topPages.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">No data yet</div>
                ) : (
                  stats.topPages.map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[11px] text-zinc-300 font-mono">{path}</span>
                      <span className="text-[11px] text-zinc-500">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Referrers */}
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-base)]">
                <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Globe size={12} />
                  Top Referrers
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-base)]">
                {stats.topReferrers.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">No data yet</div>
                ) : (
                  stats.topReferrers.map(([ref, count]) => (
                    <div key={ref} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[11px] text-zinc-300">{ref}</span>
                      <span className="text-[11px] text-zinc-500">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Countries */}
            <div className="rounded-xl border border-[var(--border-base)] bg-[var(--surface-1)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-base)]">
                <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Globe size={12} />
                  Countries
                </h3>
              </div>
              <div className="divide-y divide-[var(--border-base)]">
                {stats.countries.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-zinc-500">No data yet</div>
                ) : (
                  stats.countries.map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[11px] text-zinc-300">{country}</span>
                      <span className="text-[11px] text-zinc-500">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
