"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Workspace & Branch Management
   High-density data grid, context menus, detail panel, danger zone
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Building2,
  ChevronRight,
  X,
  Snowflake,
  Trash2,
  Pencil,
  Globe,
  Users,
  DollarSign,
  Calendar,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";
import {
  listWorkspaces,
  getWorkspaceDetail,
  updateWorkspace,
  toggleFreezeWorkspace,
  deleteWorkspace,
  toggleFeatureFlag,
} from "@/app/actions/superadmin";

/* ── Types ────────────────────────────────────────────────────── */

interface Workspace {
  id: string;
  name: string;
  slug: string;
  industry_type: string;
  status: string;
  owner_id: string;
  created_at: string;
  profiles?: { email: string; full_name: string } | null;
  organization_members?: { count: number }[];
}

interface WorkspaceDetail {
  organization: any;
  members: any[];
  features: any;
}

/* ── Feature flag definitions ────────────────────────────────── */

const FEATURE_FLAGS = [
  { key: "beta_proda_claims", label: "PRODA Bulk Claims", description: "Enable NDIS PRODA bulk billing" },
  { key: "beta_ai_scheduling", label: "AI Scheduling", description: "Predictive workforce scheduling" },
  { key: "beta_advanced_analytics", label: "Advanced Analytics", description: "Predictive risk signals & dashboards" },
  { key: "beta_mobile_offline", label: "Mobile Offline Mode", description: "Enhanced offline capture" },
  { key: "beta_family_portal", label: "Family Portal", description: "External family communication portal" },
];

/* ── Main Page ────────────────────────────────────────────────── */

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit states
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Danger zone
  const [showDangerDelete, setShowDangerDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const PAGE_SIZE = 30;

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    const result = await listWorkspaces(search || undefined, PAGE_SIZE, page * PAGE_SIZE);
    if (result.data) {
      setWorkspaces(result.data.rows as Workspace[]);
      setTotal(result.data.total || 0);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedId(id);
    const result = await getWorkspaceDetail(id);
    if (result.data) setDetail(result.data);
    setDetailLoading(false);
  }, []);

  const handleFreeze = useCallback(async (orgId: string, freeze: boolean) => {
    await toggleFreezeWorkspace(orgId, freeze);
    loadWorkspaces();
    if (selectedId === orgId) loadDetail(orgId);
  }, [selectedId, loadWorkspaces, loadDetail]);

  const handleUpdateField = useCallback(async (field: string, value: string) => {
    if (!selectedId) return;
    await updateWorkspace(selectedId, { [field]: value });
    loadDetail(selectedId);
    loadWorkspaces();
    setEditField(null);
  }, [selectedId, loadDetail, loadWorkspaces]);

  const handleDelete = useCallback(async () => {
    if (!selectedId || !detail) return;
    const result = await deleteWorkspace(selectedId, deleteConfirm);
    if (result.error) {
      alert(result.error);
      return;
    }
    setSelectedId(null);
    setDetail(null);
    setShowDangerDelete(false);
    setDeleteConfirm("");
    loadWorkspaces();
  }, [selectedId, detail, deleteConfirm, loadWorkspaces]);

  const handleToggleFlag = useCallback(async (flag: string, current: boolean) => {
    if (!selectedId) return;
    await toggleFeatureFlag(selectedId, flag, !current);
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  return (
    <div className="flex h-full">
      {/* ── Left: Workspace Ledger ── */}
      <div className={`flex flex-col ${selectedId ? "w-[55%]" : "w-full"} border-r border-white/[0.04]`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div>
            <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
              WORKSPACE LEDGER
            </span>
            <h2 className="mt-0.5 text-[16px] font-semibold text-white">
              All Workspaces
              <span className="ml-2 text-[12px] font-normal text-zinc-600">{total} total</span>
            </h2>
          </div>
          <button
            onClick={loadWorkspaces}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="relative border-b border-white/[0.04] px-6 py-2">
          <Search size={13} className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search workspaces by name or slug…"
            className="w-full rounded-lg bg-white/[0.02] py-1.5 pl-8 pr-3 text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none border border-transparent focus:border-red-500/20 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {/* Table header */}
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.06] bg-black/90 backdrop-blur px-6 py-2">
            <span className="w-[200px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Name</span>
            <span className="w-[80px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Type</span>
            <span className="w-[160px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Owner</span>
            <span className="w-[60px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Users</span>
            <span className="w-[80px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Status</span>
            <span className="flex-1 text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Created</span>
          </div>

          {loading ? (
            <div className="space-y-0.5 p-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-white/[0.02]" style={{ animationDelay: `${i * 30}ms` }} />
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Building2 size={24} className="text-zinc-800 mb-2" />
              <p className="text-[12px] text-zinc-600">No workspaces found</p>
            </div>
          ) : (
            workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => loadDetail(ws.id)}
                className={`flex w-full items-center gap-3 border-b px-6 py-2.5 text-left transition-colors ${
                  selectedId === ws.id
                    ? "border-red-500/10 bg-red-500/[0.04]"
                    : "border-white/[0.02] hover:bg-white/[0.02]"
                }`}
              >
                <span className="w-[200px] text-[11px] font-medium text-zinc-300 truncate">{ws.name}</span>
                <span className="w-[80px]">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    ws.industry_type === "care"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {ws.industry_type || "trades"}
                  </span>
                </span>
                <span className="w-[160px] text-[10px] text-zinc-600 truncate">
                  {(ws.profiles as any)?.email || "—"}
                </span>
                <span className="w-[60px] text-[10px] text-zinc-500 font-mono">
                  {ws.organization_members?.[0]?.count || 0}
                </span>
                <span className="w-[80px]">
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    ws.status === "frozen"
                      ? "bg-cyan-500/10 text-cyan-400"
                      : ws.status === "churned"
                      ? "bg-zinc-500/10 text-zinc-500"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {ws.status || "active"}
                  </span>
                </span>
                <span className="flex-1 text-[10px] text-zinc-700">
                  {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "—"}
                </span>
                <ChevronRight size={12} className="text-zinc-700" />
              </button>
            ))
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 border-t border-white/[0.04] py-3">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="rounded px-3 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-[10px] text-zinc-600">
                Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total}
                className="rounded px-3 py-1 text-[10px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail Panel ── */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.15 }}
            className="flex w-[45%] flex-col overflow-y-auto"
          >
            {detailLoading || !detail ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
              </div>
            ) : (
              <div className="space-y-0">
                {/* Detail Header */}
                <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
                  <div>
                    <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                      WORKSPACE DETAIL
                    </span>
                    <h3 className="mt-0.5 text-[15px] font-semibold text-white">
                      {detail.organization?.name}
                    </h3>
                    <span className="font-mono text-[9px] text-zinc-700">{detail.organization?.id}</span>
                  </div>
                  <button
                    onClick={() => { setSelectedId(null); setDetail(null); }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Properties */}
                <div className="border-b border-white/[0.04] px-6 py-4 space-y-3">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Properties</span>
                  {[
                    { key: "name", label: "Name", value: detail.organization?.name },
                    { key: "slug", label: "Slug", value: detail.organization?.slug },
                    { key: "industry_type", label: "Industry", value: detail.organization?.industry_type },
                    { key: "status", label: "Status", value: detail.organization?.status || "active" },
                  ].map((prop) => (
                    <div key={prop.key} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">{prop.label}</span>
                      {editField === prop.key ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="rounded bg-white/[0.04] px-2 py-0.5 text-[11px] text-white outline-none border border-red-500/20 w-[140px]"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateField(prop.key, editValue)}
                            className="flex h-5 w-5 items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          >
                            <Check size={10} />
                          </button>
                          <button
                            onClick={() => setEditField(null)}
                            className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-zinc-500 hover:bg-white/[0.06]"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditField(prop.key); setEditValue(prop.value || ""); }}
                          className="group flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white"
                        >
                          {prop.value || "—"}
                          <Pencil size={9} className="opacity-0 group-hover:opacity-100 text-zinc-600" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="border-b border-white/[0.04] px-6 py-4 space-y-2">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Actions</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFreeze(selectedId!, detail.organization?.status === "frozen" ? false : true)}
                      className="flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-3 py-1.5 text-[10px] font-medium text-cyan-400 transition-colors hover:bg-cyan-500/15"
                    >
                      <Snowflake size={11} />
                      {detail.organization?.status === "frozen" ? "Unfreeze" : "Freeze"}
                    </button>
                  </div>
                </div>

                {/* Members */}
                <div className="border-b border-white/[0.04] px-6 py-4">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                    Members ({detail.members.length})
                  </span>
                  <div className="mt-2 space-y-1">
                    {detail.members.slice(0, 10).map((m: any) => (
                      <div key={m.user_id || m.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[7px] font-bold text-zinc-500">
                            {(m.profiles?.full_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[10px] text-zinc-400">{m.profiles?.full_name || m.profiles?.email || "Unknown"}</span>
                        </div>
                        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium text-zinc-600">{m.role}</span>
                      </div>
                    ))}
                    {detail.members.length > 10 && (
                      <span className="block text-[9px] text-zinc-700 px-2">+{detail.members.length - 10} more</span>
                    )}
                  </div>
                </div>

                {/* Feature Flags */}
                <div className="border-b border-white/[0.04] px-6 py-4">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Feature Flags</span>
                  <div className="mt-2 space-y-2">
                    {FEATURE_FLAGS.map((flag) => {
                      const isEnabled = detail.features?.[flag.key] || false;
                      return (
                        <div key={flag.key} className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-medium text-zinc-400">{flag.label}</span>
                            <span className="ml-2 text-[9px] text-zinc-700">{flag.description}</span>
                          </div>
                          <button
                            onClick={() => handleToggleFlag(flag.key, isEnabled)}
                            className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                              isEnabled ? "bg-red-500/30" : "bg-white/[0.06]"
                            }`}
                          >
                            <motion.div
                              animate={{ x: isEnabled ? 16 : 0 }}
                              className={`h-4 w-4 rounded-full ${isEnabled ? "bg-red-400" : "bg-zinc-600"}`}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DANGER ZONE */}
                <div className="px-6 py-4">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.02] p-4">
                    <span className="font-mono text-[9px] font-bold tracking-widest text-red-500 uppercase">DANGER ZONE</span>
                    <p className="mt-1 text-[10px] text-red-400/60">These actions are irreversible and affect production data.</p>

                    {!showDangerDelete ? (
                      <button
                        onClick={() => setShowDangerDelete(true)}
                        className="mt-3 flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/15"
                      >
                        <Trash2 size={11} />
                        Hard Delete Tenant Data
                      </button>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] text-red-300/70">
                          Type <strong className="text-red-400">{detail.organization?.name}</strong> to confirm:
                        </p>
                        <input
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          className="w-full rounded bg-red-500/[0.06] px-3 py-1.5 text-[11px] text-red-300 placeholder:text-red-500/30 outline-none border border-red-500/20"
                          placeholder="Type workspace name…"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleDelete}
                            disabled={deleteConfirm !== detail.organization?.name}
                            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-30"
                          >
                            <Trash2 size={11} />
                            Permanently Delete
                          </button>
                          <button
                            onClick={() => { setShowDangerDelete(false); setDeleteConfirm(""); }}
                            className="rounded-md px-3 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
