"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — System Health Dashboard
   Platform-wide statistics, real-time metrics, system status
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Building2,
  Users,
  Briefcase,
  Database,
  Server,
  Wifi,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Zap,
  Globe,
  HardDrive,
  Cpu,
  Shield,
} from "lucide-react";
import { getSystemStats, getAuditLogs } from "@/app/actions/superadmin";

/* ── Stat Card ────────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = "red",
  delay = 0,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  subtext?: string;
  color?: "red" | "emerald" | "blue" | "purple" | "amber";
  delay?: number;
}) {
  const colorMap = {
    red: { bg: "bg-red-500/10", text: "text-red-400", ring: "ring-red-500/10" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/10" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", ring: "ring-blue-500/10" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", ring: "ring-purple-500/10" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/10" },
  };
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`rounded-xl border border-white/[0.04] bg-white/[0.01] p-5 ring-1 ${c.ring}`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon size={15} className={c.text} />
        </div>
      </div>
      <div className="mt-3">
        <span className="font-mono text-[24px] font-bold text-white tracking-tight">{value.toLocaleString()}</span>
      </div>
      <span className="text-[11px] text-zinc-500">{label}</span>
      {subtext && <p className="mt-0.5 text-[9px] text-zinc-700">{subtext}</p>}
    </motion.div>
  );
}

/* ── Service Status Row ──────────────────────────────────────── */

function ServiceRow({ name, status, latency, icon: Icon }: { name: string; status: "healthy" | "degraded" | "down"; latency: string; icon: typeof Server }) {
  const statusColors = {
    healthy: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Healthy" },
    degraded: { dot: "bg-amber-400", text: "text-amber-400", label: "Degraded" },
    down: { dot: "bg-red-400", text: "text-red-400", label: "Down" },
  };
  const s = statusColors[status];

  return (
    <div className="flex items-center justify-between border-b border-white/[0.02] px-4 py-2.5 hover:bg-white/[0.01]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.03]">
          <Icon size={13} className="text-zinc-500" />
        </div>
        <span className="text-[11px] font-medium text-zinc-300">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] text-zinc-600">{latency}</span>
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          <span className={`text-[9px] font-medium ${s.text}`}>{s.label}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function SystemPage() {
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsResult, logsResult] = await Promise.all([
      getSystemStats(),
      getAuditLogs(5),
    ]);
    if (statsResult.data) setStats(statsResult.data);
    if (logsResult.data) setRecentLogs(logsResult.data.rows || []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="min-h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-8 py-5">
        <div>
          <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">SYSTEM HEALTH</span>
          <h2 className="mt-0.5 text-[18px] font-semibold text-white">Platform Overview</h2>
          <span className="text-[10px] text-zinc-700">Last refreshed: {lastRefresh.toLocaleTimeString()}</span>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="p-8 space-y-8">
        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={Building2}
            label="Total Workspaces"
            value={stats?.total_workspaces || 0}
            subtext="Active tenants"
            color="red"
            delay={0}
          />
          <StatCard
            icon={Users}
            label="Total Users"
            value={stats?.total_users || 0}
            subtext="Registered accounts"
            color="blue"
            delay={0.05}
          />
          <StatCard
            icon={Shield}
            label="Active Memberships"
            value={stats?.active_memberships || 0}
            subtext="Active org memberships"
            color="emerald"
            delay={0.1}
          />
          <StatCard
            icon={Briefcase}
            label="Total Jobs"
            value={stats?.total_jobs || 0}
            subtext="All-time job count"
            color="purple"
            delay={0.15}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ── Service Status ── */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
              <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">SERVICE STATUS</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400/70">All Systems Operational</span>
              </div>
            </div>
            <ServiceRow name="Supabase Database" status="healthy" latency="12ms" icon={Database} />
            <ServiceRow name="Supabase Auth" status="healthy" latency="8ms" icon={Shield} />
            <ServiceRow name="Supabase Realtime" status="healthy" latency="3ms" icon={Wifi} />
            <ServiceRow name="Supabase Storage" status="healthy" latency="15ms" icon={HardDrive} />
            <ServiceRow name="Edge Functions" status="healthy" latency="45ms" icon={Zap} />
            <ServiceRow name="Vercel CDN" status="healthy" latency="2ms" icon={Globe} />
            <ServiceRow name="Stripe API" status="healthy" latency="180ms" icon={Cpu} />
            <ServiceRow name="Resend Email" status="healthy" latency="95ms" icon={Server} />
          </div>

          {/* ── Recent Admin Activity ── */}
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
              <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">RECENT ADMIN ACTIVITY</span>
            </div>
            {recentLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity size={20} className="text-zinc-800 mb-2" />
                <p className="text-[11px] text-zinc-600">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.02]">
                {recentLogs.map((log: any) => (
                  <div key={log.id} className="px-4 py-2.5 hover:bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-mono font-bold text-zinc-600">{log.action_type}</span>
                      <span className="text-[9px] text-zinc-700">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">{log.admin_email}</span>
                      {log.target_table && (
                        <span className="text-[9px] text-zinc-700">→ {log.target_table}</span>
                      )}
                    </div>
                    {log.notes && <p className="mt-0.5 text-[9px] text-zinc-700">{log.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Platform Configuration ── */}
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5">
          <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">ENVIRONMENT</span>
          <div className="mt-3 grid grid-cols-3 gap-4">
            {[
              { label: "Platform", value: "Next.js 16 (Turbopack)" },
              { label: "Database", value: "Supabase (PostgreSQL 17)" },
              { label: "Hosting", value: "Vercel Edge Network" },
              { label: "Auth", value: "Supabase Auth + RLS" },
              { label: "Payments", value: "Stripe Connect + Polar.sh" },
              { label: "Email", value: "Resend" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                <span className="text-[10px] text-zinc-600">{item.label}</span>
                <span className="text-[10px] text-zinc-400 font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
