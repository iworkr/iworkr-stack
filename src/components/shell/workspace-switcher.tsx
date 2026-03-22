/**
 * @component WorkspaceSwitcher
 * @status COMPLETE
 * @description Dropdown switcher for navigating between organization workspaces
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronsUpDown,
  Check,
  GitBranch,
  Loader2,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { cachedFetch } from "@/lib/cache-utils";
import { clearOrgCache } from "@/lib/hooks/use-org";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { getDashboardPath } from "@/lib/hooks/use-dashboard-path";
import { useActiveBranch, setActiveBranchId as setGlobalBranch } from "@/lib/hooks/use-active-branch";
import { LetterAvatar } from "@/components/ui/letter-avatar";
import { NewWorkspaceModal } from "@/components/shell/new-workspace-modal";

interface Branch {
  id: string;
  name: string;
  timezone?: string;
}

interface WorkspaceSwitcherProps {
  collapsed?: boolean;
}

/**
 * Obsidian WorkspaceSwitcher — Project Yggdrasil-Sync
 *
 * Multi-tenant workspace switch:
 *   1. POST /api/auth/switch-context → HTTP-only cookie
 *   2. switchOrg() → auth store + Supabase singleton
 *   3. clearOrgCache + branch reset + queryClient.clear() — fresh org-scoped data
 *   4. Stay on dashboard sub-routes when possible; otherwise push to sector home
 */
export function WorkspaceSwitcher({ collapsed = false }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useActiveBranch();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentOrg = useAuthStore((s) => s.currentOrg);
  const organizations = useAuthStore((s) => s.organizations);
  const currentMembership = useAuthStore((s) => s.currentMembership);
  const switchOrg = useAuthStore((s) => s.switchOrg);

  const companyName = currentOrg?.name ?? "";
  const logoUrl = currentOrg?.logo_url;
  const currentRole = currentMembership?.role as string | undefined;
  const isAdminOrOwner = currentRole === "owner" || currentRole === "admin";

  // Load branches for current org (cached — avoids refetch on every open)
  useEffect(() => {
    if (!currentOrg?.id || !open) return;
    let cancelled = false;

    cachedFetch(
      `workspace-branches:${currentOrg.id}`,
      async () => {
        const res = await fetch(`/api/user/organization?include=branches`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.branches ?? [];
      },
      5 * 60 * 1000
    ).then(({ data }) => {
      if (!cancelled) setBranches(data as any[]);
    });

    return () => { cancelled = true; };
  }, [currentOrg?.id, open]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSwitchError(null);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSwitchOrg = useCallback(async (newOrgId: string) => {
    if (switching || newOrgId === currentOrg?.id) {
      setOpen(false);
      return;
    }

    setSwitching(true);
    setSwitchError(null);
    setOpen(false);

    try {
      const result = await switchOrg(newOrgId);

      if (!result.ok) {
        setSwitchError(result.error ?? "Failed to switch workspace");
        setSwitching(false);
        return;
      }

      // Purge org module cache + clear branch selection + reset settings for new workspace
      clearOrgCache();
      setGlobalBranch(null);
      useSettingsStore.getState().reset();

      // TanStack Query: drop cached data so hooks refetch with the new orgId from useOrg()
      queryClient.clear();

      // Update Supabase browser client header dynamically
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        // @ts-expect-error — internal header injection
        if (supabase.rest?.headers) {
          // @ts-expect-error — internal header injection
          supabase.rest.headers["x-active-workspace-id"] = newOrgId;
        }
      } catch {
        // non-fatal
      }

      const targetPath = getDashboardPath();
      const currentPath =
        typeof window !== "undefined" ? window.location.pathname : "";

      if (!currentPath.startsWith("/dashboard/") || currentPath === "/dashboard") {
        router.push(targetPath);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("[WorkspaceSwitcher] switch error:", err);
      setSwitchError("An unexpected error occurred");
    } finally {
      setSwitching(false);
    }
  }, [switching, currentOrg?.id, switchOrg, router, queryClient]);

  const handleSwitchBranch = useCallback((branchId: string | null) => {
    setActiveBranchId(branchId);
    setOpen(false);
    // Branch switches are client-side filter-only — no full cache purge.
    // setActiveBranchId (from useActiveBranch) writes to localStorage and
    // dispatches the iworkr:branch-change event automatically.
  }, [setActiveBranchId]);

  if (collapsed) {
    return (
      <div className="px-3 pt-3 pb-1 flex justify-center">
        <button
          onClick={() => setOpen((p) => !p)}
          disabled={switching}
          className="flex h-7 w-7 items-center justify-center rounded-md overflow-hidden transition-colors hover:bg-white/[0.04] disabled:opacity-50"
          title={companyName}
        >
          {switching ? (
            <Loader2 size={14} className="animate-spin text-zinc-400" />
          ) : (
            <LetterAvatar name={companyName || "W"} src={logoUrl} size={20} variant="rounded" />
          )}
        </button>
      </div>
    );
  }

  const activeOrg = currentOrg;
  const otherOrgs = organizations.filter((o) => o.id !== activeOrg?.id);

  return (
    <div ref={ref} className="relative px-3 pt-3 pb-1">
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen((p) => !p);
          setSwitchError(null);
        }}
        disabled={switching}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-white/[0.04] disabled:opacity-60"
      >
        {switching ? (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <Loader2 size={14} className="animate-spin text-emerald-400" />
          </div>
        ) : (
          <LetterAvatar name={companyName || "W"} src={logoUrl} size={20} variant="rounded" />
        )}

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
            {companyName || <span className="text-zinc-500">Loading…</span>}
          </p>
          {branches.length > 0 && activeBranchId && (
            <p className="truncate font-mono text-[10px] text-zinc-500 leading-tight">
              {branches.find((b) => b.id === activeBranchId)?.name ?? "All Branches"}
            </p>
          )}
        </div>

        <ChevronsUpDown size={12} className="ml-auto shrink-0 text-zinc-600" />
      </button>

      {/* Error toast */}
      <AnimatePresence>
        {switchError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-3 right-3 z-50 mt-1 flex items-center gap-1.5 rounded-md border border-red-500/20 bg-red-950/60 px-2.5 py-1.5 text-[11px] text-red-300"
          >
            <ShieldAlert size={11} className="shrink-0" />
            {switchError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-3 right-3 z-50 mt-1 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f0f0f] shadow-[0_20px_60px_-8px_rgba(0,0,0,0.8)]"
          >
            {/* Current org header */}
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
              <LetterAvatar name={companyName || "W"} src={logoUrl} size={28} variant="rounded" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-zinc-100">{companyName}</p>
                {currentRole && (
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    {currentRole}
                  </p>
                )}
              </div>
            </div>

            {/* Branches (micro-tenancy) — only shown for admins with branches */}
            {isAdminOrOwner && branches.length > 0 && (
              <div className="py-1.5">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Branch
                </p>
                {/* "All Branches" option */}
                <button
                  onClick={() => handleSwitchBranch(null)}
                  className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:bg-white/[0.05]"
                >
                  <GitBranch size={12} className="shrink-0 text-zinc-500" />
                  <span className={activeBranchId === null ? "text-zinc-100" : "text-zinc-400"}>
                    All Branches
                  </span>
                  {activeBranchId === null && (
                    <Check size={11} className="ml-auto text-emerald-400" />
                  )}
                </button>
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSwitchBranch(b.id)}
                    className="mx-1 flex w-[calc(100%-8px)] items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors hover:bg-white/[0.05]"
                  >
                    <GitBranch size={12} className="shrink-0 text-zinc-500" />
                    <span className={activeBranchId === b.id ? "text-zinc-100" : "text-zinc-400"}>
                      {b.name}
                    </span>
                    {activeBranchId === b.id && (
                      <Check size={11} className="ml-auto text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Workspace settings links */}
            <div className={isAdminOrOwner && branches.length > 0 ? "border-t border-white/[0.05] py-1.5" : "py-1.5"}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Workspace
              </p>
              {[
                { label: "Settings", href: "/settings/workspace" },
                { label: "Branding", href: "/settings/branding" },
                { label: "Members", href: "/dashboard/team" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                  className="mx-1 flex w-[calc(100%-8px)] items-center rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Other workspaces (macro-tenancy switch) */}
            {otherOrgs.length > 0 && (
              <div className="border-t border-white/[0.05] py-1.5">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Switch Workspace
                </p>
                {otherOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrg(org.id)}
                    className="mx-1 flex w-[calc(100%-8px)] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-100"
                  >
                    <LetterAvatar name={org.name || "W"} src={org.logo_url} size={20} variant="rounded" />
                    <span className="truncate">{org.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Create new workspace */}
            <div className="border-t border-white/[0.05] p-1.5">
              <button
                onClick={() => {
                  setOpen(false);
                  setNewWorkspaceOpen(true);
                }}
                className="mx-0 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-emerald-500/[0.08] hover:text-emerald-400"
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-dashed border-zinc-600 transition-colors group-hover:border-emerald-500/60">
                  <Plus size={9} className="text-zinc-600" />
                </div>
                Create new workspace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen workspace creation modal */}
      <NewWorkspaceModal
        open={newWorkspaceOpen}
        onClose={() => setNewWorkspaceOpen(false)}
      />
    </div>
  );
}
