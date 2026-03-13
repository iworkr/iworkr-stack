"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Global User Directory & Impersonation Engine
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Users,
  ChevronRight,
  X,
  Eye,
  Mail,
  LogOut,
  Shield,
  Check,
  Copy,
  RefreshCw,
  AlertTriangle,
  Smartphone,
  Monitor,
  KeyRound,
} from "lucide-react";
import {
  listUsers,
  getUserDetail,
  sendPasswordReset,
  forceLogoutUser,
  impersonateUser,
} from "@/app/actions/superadmin";

/* ── Types ────────────────────────────────────────────────────── */

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_super_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
  organization_members?: {
    organization_id: string;
    role: string;
    status: string;
    organizations: { name: string } | null;
  }[];
}

interface UserDetail {
  profile: any;
  memberships: any[];
}

/* ── Page ─────────────────────────────────────────────────────── */

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonationData, setImpersonationData] = useState<any>(null);

  const PAGE_SIZE = 30;

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listUsers(search || undefined, PAGE_SIZE, page * PAGE_SIZE);
      if (result.error) {
        setLoadError(result.error);
        setUsers([]);
        setTotal(0);
      } else if (result.data) {
        setUsers(result.data.rows as UserRow[]);
        setTotal(result.data.total || 0);
      }
    } catch (e: any) {
      setLoadError(e.message || "Failed to load users");
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedId(id);
    setActionFeedback(null);
    setImpersonationData(null);
    const result = await getUserDetail(id);
    if (result.data) setDetail(result.data);
    setDetailLoading(false);
  }, []);

  const handlePasswordReset = useCallback(async (email: string) => {
    const result = await sendPasswordReset(email);
    setActionFeedback(result.error ? `Error: ${result.error}` : "Password reset email sent");
    setTimeout(() => setActionFeedback(null), 3000);
  }, []);

  const handleForceLogout = useCallback(async (userId: string) => {
    const result = await forceLogoutUser(userId);
    setActionFeedback(result.error ? `Error: ${result.error}` : "All sessions terminated");
    setTimeout(() => setActionFeedback(null), 3000);
  }, []);

  const handleImpersonate = useCallback(async (userId: string) => {
    setImpersonating(true);
    const result = await impersonateUser(userId);
    if (result.error) {
      setActionFeedback(`Error: ${result.error}`);
      setImpersonating(false);
      return;
    }
    setImpersonationData(result.data);
    setImpersonating(false);
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setActionFeedback("Copied to clipboard");
    setTimeout(() => setActionFeedback(null), 2000);
  }, []);

  return (
    <div className="flex h-full">
      {/* ── Left: User Directory ── */}
      <div className={`flex flex-col ${selectedId ? "w-[55%]" : "w-full"} border-r border-white/[0.04]`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div>
            <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
              IDENTITY MATRIX
            </span>
            <h2 className="mt-0.5 text-[16px] font-semibold text-white">
              Global Users
              <span className="ml-2 text-[12px] font-normal text-zinc-600">{total} total</span>
            </h2>
          </div>
          <button onClick={loadUsers} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400">
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="relative border-b border-white/[0.04] px-6 py-2">
          <Search size={13} className="pointer-events-none absolute left-9 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name or email…"
            className="w-full rounded-lg bg-white/[0.02] py-1.5 pl-8 pr-3 text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none border border-transparent focus:border-red-500/20 transition-colors"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.06] bg-black/90 backdrop-blur px-6 py-2">
            <span className="w-[200px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Name</span>
            <span className="w-[220px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Email</span>
            <span className="w-[140px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Workspace</span>
            <span className="w-[70px] text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Role</span>
            <span className="flex-1 text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase">Joined</span>
          </div>

          {loadError ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <AlertTriangle size={24} className="text-red-400 mb-2" />
              <p className="text-[12px] text-red-400 font-medium">Failed to load</p>
              <p className="mt-1 text-[10px] text-red-400/60 text-center max-w-[300px] font-mono">{loadError}</p>
              <button onClick={loadUsers} className="mt-3 rounded-md bg-red-500/10 px-3 py-1.5 text-[10px] text-red-400 hover:bg-red-500/15">Retry</button>
            </div>
          ) : loading ? (
            <div className="space-y-0.5 p-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-white/[0.02]" style={{ animationDelay: `${i * 30}ms` }} />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Users size={24} className="text-zinc-800 mb-2" />
              <p className="text-[12px] text-zinc-600">No users found</p>
            </div>
          ) : (
            users.map((u) => {
              const primaryOrg = u.organization_members?.[0];
              return (
                <button
                  key={u.id}
                  onClick={() => loadDetail(u.id)}
                  className={`flex w-full items-center gap-3 border-b px-6 py-2.5 text-left transition-colors ${
                    selectedId === u.id ? "border-red-500/10 bg-red-500/[0.04]" : "border-white/[0.02] hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="w-[200px] flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-zinc-500">
                      {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[11px] font-medium text-zinc-300 truncate">
                      {u.full_name || "—"}
                      {u.is_super_admin && (
                        <Shield size={9} className="inline ml-1 text-red-400" />
                      )}
                    </span>
                  </div>
                  <span className="w-[220px] text-[10px] text-zinc-600 truncate font-mono">{u.email}</span>
                  <span className="w-[140px] text-[10px] text-zinc-600 truncate">
                    {primaryOrg?.organizations?.name || "—"}
                  </span>
                  <span className="w-[70px]">
                    <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium text-zinc-600">
                      {primaryOrg?.role || "—"}
                    </span>
                  </span>
                  <span className="flex-1 text-[10px] text-zinc-700">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </span>
                  <ChevronRight size={12} className="text-zinc-700" />
                </button>
              );
            })
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 border-t border-white/[0.04] py-3">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded px-3 py-1 text-[10px] font-medium text-zinc-500 hover:bg-white/[0.04] disabled:opacity-30">Previous</button>
              <span className="text-[10px] text-zinc-600">Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button onClick={() => setPage(page + 1)} disabled={(page + 1) * PAGE_SIZE >= total} className="rounded px-3 py-1 text-[10px] font-medium text-zinc-500 hover:bg-white/[0.04] disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: User Detail ── */}
      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex w-[45%] flex-col overflow-y-auto"
          >
            {detailLoading || !detail ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
              </div>
            ) : (
              <div className="space-y-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
                  <div>
                    <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">USER PROFILE</span>
                    <h3 className="mt-0.5 text-[15px] font-semibold text-white">{detail.profile?.full_name || "Unknown"}</h3>
                    <span className="font-mono text-[9px] text-zinc-700">{detail.profile?.email}</span>
                  </div>
                  <button onClick={() => { setSelectedId(null); setDetail(null); }} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white/[0.04]">
                    <X size={14} />
                  </button>
                </div>

                {/* Action Feedback */}
                <AnimatePresence>
                  {actionFeedback && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-white/[0.04] px-6 py-2"
                    >
                      <span className={`text-[10px] font-medium ${actionFeedback.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                        {actionFeedback}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Properties */}
                <div className="border-b border-white/[0.04] px-6 py-4 space-y-2">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Details</span>
                  {[
                    { label: "User ID", value: detail.profile?.id },
                    { label: "Email", value: detail.profile?.email },
                    { label: "Phone", value: detail.profile?.phone || "—" },
                    { label: "Timezone", value: detail.profile?.timezone || "—" },
                    { label: "Super Admin", value: detail.profile?.is_super_admin ? "Yes" : "No" },
                    { label: "Last Updated", value: detail.profile?.updated_at ? new Date(detail.profile.updated_at).toLocaleString() : "—" },
                  ].map((prop) => (
                    <div key={prop.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">{prop.label}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-zinc-400 font-mono">{prop.value}</span>
                        {prop.label === "User ID" && (
                          <button onClick={() => copyToClipboard(prop.value)} className="text-zinc-700 hover:text-zinc-400">
                            <Copy size={9} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Workspace Memberships */}
                <div className="border-b border-white/[0.04] px-6 py-4">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                    Workspaces ({detail.memberships.length})
                  </span>
                  <div className="mt-2 space-y-1">
                    {detail.memberships.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-white/[0.02]">
                        <span className="text-[10px] text-zinc-400">{m.organizations?.name || "Unknown"}</span>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium text-zinc-600">{m.role}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${
                            m.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-500"
                          }`}>{m.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Support Actions */}
                <div className="border-b border-white/[0.04] px-6 py-4 space-y-2">
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Support Actions</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handlePasswordReset(detail.profile?.email)}
                      className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <KeyRound size={11} />
                      Send Password Reset
                    </button>
                    <button
                      onClick={() => handleForceLogout(selectedId!)}
                      className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <LogOut size={11} />
                      Force Log Out All
                    </button>
                  </div>
                </div>

                {/* Impersonation Engine */}
                <div className="px-6 py-4">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.02] p-4">
                    <div className="flex items-center gap-2">
                      <Eye size={13} className="text-red-400" />
                      <span className="font-mono text-[9px] font-bold tracking-widest text-red-500 uppercase">IMPERSONATION ENGINE</span>
                    </div>
                    <p className="mt-1 text-[10px] text-red-400/60">
                      Generate a session to view the app as this user. All actions are logged.
                    </p>

                    {impersonationData ? (
                      <div className="mt-3 space-y-2">
                        <div className="rounded-lg bg-black/40 p-3 border border-red-500/10">
                          <span className="text-[9px] text-zinc-600 font-mono">IMPERSONATION LINK</span>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="flex-1 text-[10px] text-red-300 font-mono truncate">
                              {impersonationData.verification_url || "Link generated"}
                            </code>
                            <button
                              onClick={() => copyToClipboard(impersonationData.verification_url || "")}
                              className="flex h-6 w-6 items-center justify-center rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            >
                              <Copy size={10} />
                            </button>
                          </div>
                          <p className="mt-2 text-[9px] text-zinc-700">
                            Opens as: {impersonationData.name} ({impersonationData.email}). Link expires in 15 minutes.
                          </p>
                        </div>
                        {impersonationData.verification_url && (
                          <a
                            href={impersonationData.verification_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-[11px] font-medium text-white transition-colors hover:bg-red-500"
                          >
                            <Eye size={12} />
                            Open Impersonated Session
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleImpersonate(selectedId!)}
                        disabled={impersonating}
                        className="mt-3 flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
                      >
                        {impersonating ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-red-500/30 border-t-red-400" />
                        ) : (
                          <Eye size={12} />
                        )}
                        {impersonating ? "Generating…" : "Impersonate User"}
                      </button>
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
