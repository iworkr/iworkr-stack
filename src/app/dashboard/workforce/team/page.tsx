"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  UserPlus,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Zap,
  ShieldCheck,
  BarChart3,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  getWorkforceDirectory,
  getWorkerDossier,
  type WorkforceMember,
  type WorkforceTelemetry,
} from "@/app/actions/workforce-dossier";
import { getSchadsRates } from "@/app/actions/staff-profiles";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ── Constants ────────────────────────────────────────── */

const ease = [0.16, 1, 0.3, 1] as const;

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-400",
  admin: "bg-purple-500/10 text-purple-400",
  manager: "bg-blue-500/10 text-blue-400",
  senior_tech: "bg-cyan-500/10 text-cyan-400",
  technician: "bg-zinc-500/10 text-zinc-400",
  apprentice: "bg-emerald-500/10 text-emerald-400",
  subcontractor: "bg-orange-500/10 text-orange-400",
  office_admin: "bg-pink-500/10 text-pink-400",
};

/* ── Format Helpers ───────────────────────────────────── */

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHrs = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMs < 0) return "—";
  if (diffHrs < 1) return "< 1hr";
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ── Telemetry Card ───────────────────────────────────── */

function TelemetryCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  delay,
  warning,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  delay: number;
  warning?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease }}
      className="flex items-center gap-3"
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        <Icon size={14} />
      </div>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
        <p className={`font-mono text-[18px] font-bold tabular-nums tracking-tight ${warning ? "text-amber-500" : "text-zinc-100"}`}>
          {value}
          {suffix && <span className="text-[11px] font-normal text-zinc-600 ml-0.5">{suffix}</span>}
        </p>
      </div>
    </motion.div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function WorkforceTeamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId, loading: orgLoading } = useOrg();

  const { data: directoryData, isLoading: loading } = useQuery<{
    members: WorkforceMember[];
    telemetry: WorkforceTelemetry;
  }>({
    queryKey: queryKeys.workforce.directory(orgId ?? ""),
    queryFn: async () => {
      try {
        return await getWorkforceDirectory(orgId!);
      } catch (err) {
        console.error("Failed to load workforce directory:", err);
        throw err;
      }
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const members = useMemo(
    () => directoryData?.members ?? [],
    [directoryData],
  );
  const telemetry = useMemo<WorkforceTelemetry>(
    () =>
      directoryData?.telemetry ?? {
        total_headcount: 0,
        active_on_shift: 0,
        compliance_rate: 0,
        avg_utilization: 0,
      },
    [directoryData],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter members
  const filteredMembers = useMemo(() => {
    let result = members;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.phone && m.phone.includes(q)) ||
          m.role.toLowerCase().includes(q)
      );
    }

    if (roleFilter) {
      result = result.filter((m) => m.role === roleFilter);
    }

    if (statusFilter) {
      result = result.filter((m) => m.status === statusFilter);
    }

    return result;
  }, [members, searchQuery, roleFilter, statusFilter]);

  // Unique roles for filter
  const uniqueRoles = useMemo(() => [...new Set(members.map((m) => m.role))], [members]);

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[var(--background)]">
      {/* ── Command Header ── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[var(--background)]/80 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-zinc-600">WORKFORCE</span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="text-[11px] font-mono font-medium text-zinc-300">TEAM DIRECTORY</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                placeholder="Search name, phone, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-56 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-white/[0.15] transition-colors"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters((p) => !p)}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition-colors ${
                showFilters ? "border-white/[0.15] bg-white/[0.06] text-zinc-200" : "border-white/[0.08] text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Filter size={13} />
              Filters
              {(roleFilter || statusFilter) && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand)] text-[9px] font-bold text-black">
                  {(roleFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Onboard Worker */}
            <button
              onClick={() => router.push("/dashboard/team")}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12px] font-medium text-black transition-all hover:bg-zinc-200"
            >
              <UserPlus size={13} />
              Onboard Worker
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.04] px-6"
            >
              <div className="flex items-center gap-3 py-2.5">
                <span className="text-[10px] font-mono text-zinc-600 uppercase">ROLE:</span>
                <div className="flex gap-1.5">
                  {[null, ...uniqueRoles].map((role) => (
                    <button
                      key={role || "all"}
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                        roleFilter === role ? "bg-white/[0.1] text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {role ? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "All"}
                    </button>
                  ))}
                </div>
                <div className="mx-3 h-4 w-px bg-white/[0.06]" />
                <span className="text-[10px] font-mono text-zinc-600 uppercase">STATUS:</span>
                <div className="flex gap-1.5">
                  {[null, "active", "suspended", "pending"].map((status) => (
                    <button
                      key={status || "all"}
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                        statusFilter === status ? "bg-white/[0.1] text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {status ? status.replace(/\b\w/g, (c) => c.toUpperCase()) : "All"}
                    </button>
                  ))}
                </div>
                {(roleFilter || statusFilter) && (
                  <button
                    onClick={() => { setRoleFilter(null); setStatusFilter(null); }}
                    className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <XCircle size={11} /> Clear
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Telemetry Ribbon ── */}
      <div className="border-b border-white/[0.04] bg-zinc-950/30 px-6">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-10">
            <TelemetryCard
              label="Total Headcount"
              value={telemetry.total_headcount}
              icon={Users}
              color="bg-white/[0.05] text-zinc-400"
              delay={0.05}
            />
            <TelemetryCard
              label="On Shift Now"
              value={telemetry.active_on_shift}
              icon={Zap}
              color="bg-emerald-500/10 text-emerald-400"
              delay={0.1}
            />
            <TelemetryCard
              label="Compliance Rate"
              value={`${telemetry.compliance_rate}%`}
              icon={ShieldCheck}
              color={telemetry.compliance_rate < 100 ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}
              delay={0.15}
              warning={telemetry.compliance_rate < 100}
            />
            <TelemetryCard
              label="Avg Utilization"
              value={telemetry.avg_utilization}
              suffix="hrs/wk"
              icon={BarChart3}
              color="bg-blue-500/10 text-blue-400"
              delay={0.2}
            />
          </div>
        </div>
      </div>

      {/* ── Data Grid ── */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex h-14 items-center gap-4 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-white/[0.04]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-white/[0.04]" />
                  <div className="h-2.5 w-48 rounded bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Grid Header */}
            <div className="mb-2 grid grid-cols-12 items-center gap-4 px-4 py-2">
              <div className="col-span-3 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Worker</div>
              <div className="col-span-2 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Role & Branch</div>
              <div className="col-span-1 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Type</div>
              <div className="col-span-2 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">SCHADS Class</div>
              <div className="col-span-2 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Next Shift</div>
              <div className="col-span-1 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600">Compliance</div>
              <div className="col-span-1 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-600 text-right">Action</div>
            </div>

            {/* Grid Rows */}
            <div className="space-y-1">
              {filteredMembers.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-[13px] text-zinc-600">
                  {searchQuery || roleFilter || statusFilter ? "No workers match the current filters." : "No team members yet. Invite your first worker to get started."}
                </div>
              ) : (
                filteredMembers.map((member, i) => (
                  <motion.button
                    key={member.user_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.02 * i, duration: 0.3, ease }}
                    onClick={() => router.push(`/dashboard/workforce/team/${member.user_id}`)}
                    onMouseEnter={() => {
                      if (!orgId) return;
                      queryClient.prefetchQuery({
                        queryKey: queryKeys.workforce.dossier(orgId, member.user_id),
                        queryFn: async () => {
                          const [dossier, rates] = await Promise.all([
                            getWorkerDossier(member.user_id, orgId),
                            getSchadsRates(),
                          ]);
                          return { dossier, rates };
                        },
                        staleTime: 60_000,
                      });
                    }}
                    className="grid w-full grid-cols-12 items-center gap-4 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-3 text-left transition-all hover:bg-white/[0.025] hover:border-white/[0.08] cursor-pointer group"
                  >
                    {/* Worker */}
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="relative shrink-0">
                        <LetterAvatar name={member.full_name} src={member.avatar_url} size={36} variant="rounded" />
                        <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0A0A0A] ${
                          member.status === "active" ? "bg-emerald-500" : member.status === "suspended" ? "bg-rose-500" : "bg-zinc-600"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                          {member.full_name}
                        </p>
                        <p className="text-[11px] text-zinc-600 truncate">{member.email}</p>
                      </div>
                    </div>

                    {/* Role & Branch */}
                    <div className="col-span-2">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        ROLE_COLORS[member.role] || "bg-zinc-500/10 text-zinc-400"
                      }`}>
                        {member.role.replace(/_/g, " ")}
                      </span>
                      <p className="mt-0.5 text-[10px] text-zinc-600">{member.branch}</p>
                    </div>

                    {/* Employment Type */}
                    <div className="col-span-1">
                      <p className="text-[12px] text-zinc-400 capitalize">
                        {member.employment_type?.replace(/_/g, " ") || "—"}
                      </p>
                    </div>

                    {/* SCHADS Classification */}
                    <div className="col-span-2">
                      {member.schads_level ? (
                        <p className="font-mono text-[12px] text-white tabular-nums">
                          Level {member.schads_level.split(".")[0]}
                          <span className="text-zinc-500">, Paypoint {member.schads_level.split(".")[1] || "1"}</span>
                        </p>
                      ) : (
                        <p className="text-[12px] text-zinc-600 italic">Not classified</p>
                      )}
                    </div>

                    {/* Next Shift */}
                    <div className="col-span-2">
                      {member.next_shift ? (
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-zinc-600" />
                          <p className="font-mono text-[11px] text-zinc-400 tabular-nums">
                            {formatRelativeTime(member.next_shift)}
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            {new Date(member.next_shift).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-600">No upcoming</p>
                      )}
                    </div>

                    {/* Compliance */}
                    <div className="col-span-1 flex items-center justify-center">
                      {member.credential_status === "compliant" ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : member.credential_status === "expiring" ? (
                        <AlertTriangle size={16} className="text-amber-500" />
                      ) : member.credential_status === "non_compliant" ? (
                        <AlertTriangle size={16} className="text-rose-500 animate-pulse" />
                      ) : (
                        <AlertCircle size={16} className="text-zinc-600" />
                      )}
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end">
                      <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    </div>
                  </motion.button>
                ))
              )}
            </div>

            {/* Count footer */}
            {filteredMembers.length > 0 && (
              <div className="mt-4 flex items-center justify-between px-4">
                <p className="text-[11px] text-zinc-600">
                  Showing <span className="font-mono text-zinc-400">{filteredMembers.length}</span> of{" "}
                  <span className="font-mono text-zinc-400">{members.length}</span> workers
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
