"use client";

/**
 * @page Sync Health Monitor
 * @route /dashboard/settings/sync-health
 * @description Project Vault-Sync: Admin dashboard for monitoring the offline-first
 *   mobile sync engine. Shows device sync health, mutation volume, failure rates.
 */

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchSyncHealth,
  fetchSyncLogs,
  type SyncHealth,
  type SyncDeviceLog,
} from "@/app/actions/vault-sync";
import {
  Smartphone,
  Cloud,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  Database,
  Wifi,
  WifiOff,
} from "lucide-react";

/* ── Stats Card ───────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-semibold text-neutral-100 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function SyncHealthPage() {
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;

  const [health, setHealth] = useState<SyncHealth | null>(null);
  const [logs, setLogs] = useState<SyncDeviceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [healthData, logsData] = await Promise.all([
      fetchSyncHealth(orgId),
      fetchSyncLogs(orgId, { limit: 30 }),
    ]);
    setHealth(healthData);
    setLogs(logsData.data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (!orgId) {
    return <div className="flex items-center justify-center h-64"><p className="text-neutral-500">Select an organization</p></div>;
  }

  const timeSince = (date: string | null) => {
    if (!date) return "Never";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            Sync Health Monitor
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">Offline-first mobile sync engine status</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-400 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Syncs (24h)" value={health?.total_syncs_24h ?? 0} icon={Activity} color="text-emerald-400" />
            <StatCard label="Devices (24h)" value={health?.unique_devices_24h ?? 0} icon={Smartphone} color="text-blue-400" />
            <StatCard label="Mutations (24h)" value={health?.total_mutations_24h ?? 0} icon={Database} color="text-purple-400" />
            <StatCard label="Failures (24h)" value={health?.failed_mutations_24h ?? 0} icon={AlertTriangle} color="text-red-400" />
            <StatCard label="Last Sync" value={timeSince(health?.last_sync ?? null)} icon={Clock} color="text-neutral-400" />
          </div>

          {/* Success Rate */}
          {health && health.total_mutations_24h > 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400">Sync Success Rate (24h)</span>
                <span className="text-sm font-medium text-emerald-400">
                  {(((health.total_mutations_24h - health.failed_mutations_24h) / health.total_mutations_24h) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{
                    width: `${((health.total_mutations_24h - health.failed_mutations_24h) / health.total_mutations_24h) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Recent Sync Logs */}
          <div>
            <h2 className="text-sm font-medium text-neutral-400 mb-3 flex items-center gap-2">
              <Wifi className="w-4 h-4" /> Recent Sync Activity
            </h2>
            {logs.length === 0 ? (
              <div className="text-center py-12 text-neutral-600 text-sm rounded-xl border border-neutral-800 bg-neutral-900/30">
                <WifiOff className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                No sync activity recorded
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 flex items-center gap-3"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      (log.failed_count || 0) > 0 ? "bg-red-500/10" : "bg-emerald-500/10"
                    }`}>
                      {(log.failed_count || 0) > 0 ? (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-200">{log.user_name || "Unknown Worker"}</p>
                      <p className="text-[10px] text-neutral-500">
                        {log.mutation_count} mutations · Device {log.device_id?.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-neutral-500">{timeSince(log.synced_at)}</p>
                      {(log.failed_count || 0) > 0 && (
                        <p className="text-[10px] text-red-400">{log.failed_count} failed</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
