"use client";

import { useState, useEffect } from "react";
import { getJobCosting } from "@/app/actions/aegis-spend";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Package,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   JOB COSTING PANEL — Live Profit Progress Bar
   PRD 139.0 § 5 — Financial Telemetry Board
   ═══════════════════════════════════════════════════════════ */

interface JobCostingData {
  job_id: string;
  revenue: number;
  labor_cost: number;
  material_cost: number;
  total_cogs: number;
  gross_profit: number;
  margin_pct: number;
  labor_pct: number;
  material_pct: number;
  profit_pct: number;
}

interface Props {
  jobId: string;
  orgId: string;
  targetMargin?: number; // e.g. 50 for 50%
}

export function JobCostingPanel({ jobId, orgId, targetMargin = 50 }: Props) {
  const [data, setData] = useState<JobCostingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data: result } = await getJobCosting(jobId, orgId);
    if (result) setData(result as any);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [jobId, orgId]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const fmt = (n: number) =>
    `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-6 text-zinc-500 text-sm">
        Unable to calculate job costing
      </div>
    );
  }

  const marginHealthy = data.margin_pct >= targetMargin;
  const laborWidth = data.revenue > 0 ? Math.min((data.labor_cost / data.revenue) * 100, 100) : 0;
  const materialWidth = data.revenue > 0 ? Math.min((data.material_cost / data.revenue) * 100, 100) : 0;
  const profitWidth = data.revenue > 0 ? Math.max(Math.min((data.gross_profit / data.revenue) * 100, 100), 0) : 0;

  return (
    <div className="bg-zinc-950/40 rounded-2xl border border-zinc-800/50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Live Job Costing</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Telemetry Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Revenue</p>
          <p className="font-mono text-sm font-bold text-white mt-1">{fmt(data.revenue)}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Labor</p>
          </div>
          <p className="font-mono text-sm font-bold text-blue-400 mt-1">{fmt(data.labor_cost)}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
          <div className="flex items-center gap-1">
            <Package className="w-3 h-3 text-amber-400" />
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Materials</p>
          </div>
          <p className="font-mono text-sm font-bold text-amber-400 mt-1">{fmt(data.material_cost)}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800/40">
          <div className="flex items-center gap-1">
            {marginHealthy ? (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-rose-400" />
            )}
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Profit</p>
          </div>
          <p className={`font-mono text-sm font-bold mt-1 ${
            marginHealthy ? "text-emerald-400" : "text-rose-400"
          }`}>
            {fmt(data.gross_profit)}
          </p>
        </div>
      </div>

      {/* Profit Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-400">Cost Breakdown</span>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Labor {data.labor_pct}%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Materials {data.material_pct}%
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${marginHealthy ? "bg-emerald-500" : "bg-rose-500"}`} />
              Profit {data.profit_pct}%
            </span>
          </div>
        </div>

        <div className="w-full h-4 rounded-full bg-zinc-900 overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all duration-700"
            style={{ width: `${laborWidth}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-700"
            style={{ width: `${materialWidth}%` }}
          />
          <div
            className={`h-full transition-all duration-700 ${
              marginHealthy ? "bg-emerald-500" : "bg-rose-500"
            }`}
            style={{ width: `${profitWidth}%` }}
          />
        </div>
      </div>

      {/* Margin Alert */}
      {!marginHealthy && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span className="text-xs text-rose-400">
            <span className="font-mono font-bold">{data.margin_pct}%</span> margin is below target of{" "}
            <span className="font-mono font-bold">{targetMargin}%</span>
          </span>
        </div>
      )}

      {marginHealthy && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">
            Margin healthy at <span className="font-mono font-bold">{data.margin_pct}%</span>
            {" "}(target: {targetMargin}%)
          </span>
        </div>
      )}
    </div>
  );
}
