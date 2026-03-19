"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Copy,
  Save,
  Loader2,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Users,
  ScrollText,
  Eye,
  EyeOff,
  Star,
  Search,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  UserCog,
  ArrowRightLeft,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  getAllPermissions,
  getPermissionsByModule,
  getRoles,
  getRoleDetail,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  toggleRolePermission,
  assignRoleToMember,
  getMembersWithRoles,
  getUserPermissions,
  getRbacStats,
  duplicateRole,
  getAuditLog,
  setDefaultRole,
  getImpersonationPermissions,
  migrateToCustomRole,
  type Permission,
  type WorkspaceRole,
  type RbacStats,
  type AuditEntry,
} from "@/app/actions/aegis-rbac";
import { useOrg } from "@/lib/hooks/use-org";

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { id: "roles", label: "Roles", icon: Shield },
  { id: "members", label: "Members", icon: Users },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "impersonation", label: "Impersonation", icon: Eye },
] as const;

type TabId = (typeof TABS)[number]["id"];

const MODULE_ORDER = [
  "DASHBOARD",
  "JOBS",
  "ROSTER",
  "CLIENTS",
  "PARTICIPANTS",
  "FINANCE",
  "TIMESHEETS",
  "CLINICAL",
  "FLEET",
  "ASSETS",
  "TEAM",
  "SETTINGS",
  "FORMS",
  "AUTOMATIONS",
  "SAFETY",
];

const MODULE_COLORS: Record<string, string> = {
  DASHBOARD: "text-sky-400",
  JOBS: "text-amber-400",
  ROSTER: "text-violet-400",
  CLIENTS: "text-teal-400",
  PARTICIPANTS: "text-pink-400",
  FINANCE: "text-emerald-400",
  TIMESHEETS: "text-orange-400",
  CLINICAL: "text-rose-400",
  FLEET: "text-cyan-400",
  ASSETS: "text-lime-400",
  TEAM: "text-indigo-400",
  SETTINGS: "text-zinc-400",
  FORMS: "text-fuchsia-400",
  AUTOMATIONS: "text-yellow-400",
  SAFETY: "text-red-400",
};

const ROLE_COLORS = [
  "#10B981", "#06B6D4", "#8B5CF6", "#F59E0B", "#EF4444",
  "#EC4899", "#3B82F6", "#14B8A6", "#F97316", "#6366F1",
  "#84CC16", "#A855F7",
];

const LEGACY_ROLES = [
  "owner", "admin", "manager", "senior_tech",
  "technician", "apprentice", "subcontractor", "office_admin",
];

// ── Fade animation ────────────────────────────────────────────
const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-zinc-800/60 rounded-lg ${className}`} />
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-emerald-500",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-zinc-950 border border-white/5 rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white font-mono">{value}</p>
      </div>
    </div>
  );
}

// ── Toggle Switch ─────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        disabled
          ? "opacity-30 cursor-not-allowed bg-zinc-800"
          : checked
          ? "bg-emerald-500"
          : "bg-zinc-700 hover:bg-zinc-600"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ── Permission Row ────────────────────────────────────────────
function PermissionRow({
  permission,
  enabled,
  disabled,
  disabledReason,
  onToggle,
}: {
  permission: Permission;
  enabled: boolean;
  disabled: boolean;
  disabledReason?: string;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${
        disabled ? "opacity-40" : "hover:bg-white/[0.02]"
      }`}
      title={disabled && disabledReason ? disabledReason : undefined}
    >
      <Toggle
        checked={enabled}
        onChange={(val) => onToggle(permission.id, val)}
        disabled={disabled}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white">{permission.human_description}</span>
          {permission.is_dangerous && (
            <ShieldAlert size={13} className="text-rose-500 flex-shrink-0" />
          )}
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">{permission.id}</span>
      </div>
      {disabled && disabledReason && (
        <span className="text-[9px] text-zinc-600 hidden group-hover:inline">
          {disabledReason}
        </span>
      )}
    </div>
  );
}

// ── Module Group ──────────────────────────────────────────────
function ModuleGroup({
  module,
  permissions,
  enabledIds,
  allPermissions,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: {
  module: string;
  permissions: Permission[];
  enabledIds: Set<string>;
  allPermissions: Permission[];
  onToggle: (id: string, enabled: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const enabledCount = permissions.filter((p) => enabledIds.has(p.id)).length;
  const colorClass = MODULE_COLORS[module] ?? "text-zinc-400";

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      {/* Module header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-zinc-500" />
        ) : (
          <ChevronRight size={14} className="text-zinc-500" />
        )}
        <span className={`text-xs font-semibold uppercase tracking-wider ${colorClass}`}>
          {module}
        </span>
        <span className="text-[10px] text-zinc-500 font-mono">
          {enabledCount}/{permissions.length}
        </span>
        <div className="ml-auto flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onSelectAll}
            className="px-2 py-0.5 text-[9px] text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors uppercase tracking-wider"
          >
            All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="px-2 py-0.5 text-[9px] text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors uppercase tracking-wider"
          >
            None
          </button>
        </div>
      </button>

      {/* Permission rows */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-white/[0.03]">
              {permissions.map((perm) => {
                const parentOff =
                  perm.depends_on != null && !enabledIds.has(perm.depends_on);
                const parentPerm = perm.depends_on
                  ? allPermissions.find((p) => p.id === perm.depends_on)
                  : null;

                return (
                  <PermissionRow
                    key={perm.id}
                    permission={perm}
                    enabled={enabledIds.has(perm.id)}
                    disabled={parentOff}
                    disabledReason={
                      parentOff && parentPerm
                        ? `Requires "${parentPerm.human_description}"`
                        : undefined
                    }
                    onToggle={onToggle}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Color Dot ─────────────────────────────────────────────────
function ColorDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function RolesPage() {
  const { orgId } = useOrg();

  // ── Global state ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("roles");
  const [stats, setStats] = useState<RbacStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(true);

  // ── Roles tab ─────────────────────────────────────────────
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [permsByModule, setPermsByModule] = useState<Record<string, Permission[]>>({});
  const [enabledPerms, setEnabledPerms] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [roleColor, setRoleColor] = useState(ROLE_COLORS[0]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");

  // ── Members tab ───────────────────────────────────────────
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getMembersWithRoles>>["data"]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [migrateFrom, setMigrateFrom] = useState("");
  const [migrateTo, setMigrateTo] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);

  // ── Audit tab ─────────────────────────────────────────────
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Impersonation tab ─────────────────────────────────────
  const [impersonateRoleId, setImpersonateRoleId] = useState<string | null>(null);
  const [impersonatePerms, setImpersonatePerms] = useState<string[]>([]);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateLoading, setImpersonateLoading] = useState(false);

  // ── Computed ──────────────────────────────────────────────
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const filteredRoles = useMemo(
    () =>
      roleSearch
        ? roles.filter((r) => r.name.toLowerCase().includes(roleSearch.toLowerCase()))
        : roles,
    [roles, roleSearch]
  );

  const sortedModules = useMemo(() => {
    const keys = Object.keys(permsByModule);
    return MODULE_ORDER.filter((m) => keys.includes(m)).concat(
      keys.filter((k) => !MODULE_ORDER.includes(k))
    );
  }, [permsByModule]);

  // ── Data loaders ──────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!orgId) return;
    const { data } = await getRbacStats(orgId);
    setStats(data ?? null);
  }, [orgId]);

  const loadPermissions = useCallback(async () => {
    const [allRes, groupedRes] = await Promise.all([
      getAllPermissions(),
      getPermissionsByModule(),
    ]);
    setAllPermissions(allRes.data ?? []);
    setPermsByModule(groupedRes.data ?? {});
  }, []);

  const loadRoles = useCallback(async () => {
    if (!orgId) return;
    setRolesLoading(true);
    const { data, error: err } = await getRoles(orgId);
    if (err) setError(err);
    else setRoles(data ?? []);
    setRolesLoading(false);
  }, [orgId]);

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    setMembersLoading(true);
    const { data, error: err } = await getMembersWithRoles(orgId);
    if (err) setError(err);
    else setMembers(data ?? []);
    setMembersLoading(false);
  }, [orgId]);

  const loadAudit = useCallback(async () => {
    if (!orgId) return;
    setAuditLoading(true);
    const { data, error: err } = await getAuditLog(orgId);
    if (err) setError(err);
    else setAuditLog(data ?? []);
    setAuditLoading(false);
  }, [orgId]);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    setGlobalLoading(true);
    Promise.all([loadStats(), loadPermissions(), loadRoles()]).finally(() =>
      setGlobalLoading(false)
    );
  }, [orgId, loadStats, loadPermissions, loadRoles]);

  // ── Tab-specific loads ────────────────────────────────────
  useEffect(() => {
    if (activeTab === "members") loadMembers();
    if (activeTab === "audit") loadAudit();
  }, [activeTab, loadMembers, loadAudit]);

  // ── Select a role ─────────────────────────────────────────
  const selectRole = useCallback(
    (role: WorkspaceRole) => {
      setSelectedRoleId(role.id);
      setRoleName(role.name);
      setRoleDesc(role.description ?? "");
      setRoleColor(role.color);
      setEnabledPerms(new Set(role.permission_ids ?? []));
      setSaveSuccess(false);
    },
    []
  );

  // ── Toggle a permission with cascade ──────────────────────
  const handleToggle = useCallback(
    (permId: string, enabled: boolean) => {
      setEnabledPerms((prev) => {
        const next = new Set(prev);
        if (enabled) {
          next.add(permId);
          // Also enable parent if not enabled
          const perm = allPermissions.find((p) => p.id === permId);
          if (perm?.depends_on && !next.has(perm.depends_on)) {
            next.add(perm.depends_on);
          }
        } else {
          next.delete(permId);
          // Cascade: disable all children
          for (const p of allPermissions) {
            if (p.depends_on === permId) {
              next.delete(p.id);
            }
          }
        }
        return next;
      });
    },
    [allPermissions]
  );

  // ── Select/deselect all in a module ───────────────────────
  const handleSelectAllModule = useCallback(
    (module: string) => {
      setEnabledPerms((prev) => {
        const next = new Set(prev);
        for (const p of permsByModule[module] ?? []) {
          next.add(p.id);
        }
        return next;
      });
    },
    [permsByModule]
  );

  const handleDeselectAllModule = useCallback(
    (module: string) => {
      setEnabledPerms((prev) => {
        const next = new Set(prev);
        for (const p of permsByModule[module] ?? []) {
          next.delete(p.id);
        }
        return next;
      });
    },
    [permsByModule]
  );

  // ── Save role ─────────────────────────────────────────────
  const handleSaveRole = useCallback(async () => {
    if (!selectedRoleId || !orgId) return;
    setSaving(true);
    setError(null);

    try {
      await updateRole(selectedRoleId, {
        name: roleName,
        color: roleColor,
        description: roleDesc || undefined,
      });
      await setRolePermissions(selectedRoleId, Array.from(enabledPerms), orgId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await Promise.all([loadRoles(), loadStats()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save role");
    } finally {
      setSaving(false);
    }
  }, [selectedRoleId, orgId, roleName, roleColor, roleDesc, enabledPerms, loadRoles, loadStats]);

  // ── Create role ───────────────────────────────────────────
  const handleCreateRole = useCallback(async () => {
    if (!orgId) return;
    setCreating(true);
    setError(null);

    try {
      const { data, error: err } = await createRole(orgId, "New Role", ROLE_COLORS[roles.length % ROLE_COLORS.length]);
      if (err) throw new Error(err);
      if (data) {
        await loadRoles();
        await loadStats();
        selectRole(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setCreating(false);
    }
  }, [orgId, roles.length, loadRoles, loadStats, selectRole]);

  // ── Duplicate role ────────────────────────────────────────
  const handleDuplicateRole = useCallback(async () => {
    if (!selectedRoleId || !orgId) return;
    setError(null);
    try {
      const { data, error: err } = await duplicateRole(selectedRoleId, orgId, `${roleName} (Copy)`);
      if (err) throw new Error(err);
      if (data) {
        await loadRoles();
        await loadStats();
        selectRole(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate role");
    }
  }, [selectedRoleId, orgId, roleName, loadRoles, loadStats, selectRole]);

  // ── Delete role ───────────────────────────────────────────
  const handleDeleteRole = useCallback(async () => {
    if (!selectedRoleId || !orgId) return;
    if (!window.confirm(`Delete role "${roleName}"? Members will be unassigned.`)) return;

    setError(null);
    try {
      const { error: err } = await deleteRole(selectedRoleId, orgId);
      if (err) throw new Error(err);
      setSelectedRoleId(null);
      await loadRoles();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    }
  }, [selectedRoleId, orgId, roleName, loadRoles, loadStats]);

  // ── Set default role ──────────────────────────────────────
  const handleSetDefault = useCallback(async () => {
    if (!selectedRoleId || !orgId) return;
    try {
      await setDefaultRole(orgId, selectedRoleId);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set default");
    }
  }, [selectedRoleId, orgId, loadRoles]);

  // ── Assign member role ────────────────────────────────────
  const handleAssignRole = useCallback(
    async (userId: string, roleId: string | null) => {
      if (!orgId) return;
      try {
        await assignRoleToMember(orgId, userId, roleId);
        await loadMembers();
        await loadStats();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign role");
      }
    },
    [orgId, loadMembers, loadStats]
  );

  // ── Batch migrate ─────────────────────────────────────────
  const handleMigrate = useCallback(async () => {
    if (!orgId || !migrateFrom || !migrateTo) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      const { count, error: err } = await migrateToCustomRole(orgId, migrateFrom, migrateTo);
      if (err) throw new Error(err);
      setMigrateResult(`Migrated ${count} member${count !== 1 ? "s" : ""} successfully.`);
      await loadMembers();
      await loadStats();
    } catch (err) {
      setMigrateResult(err instanceof Error ? err.message : "Migration failed");
    } finally {
      setMigrating(false);
    }
  }, [orgId, migrateFrom, migrateTo, loadMembers, loadStats]);

  // ── Impersonation ─────────────────────────────────────────
  const handleImpersonate = useCallback(async () => {
    if (!impersonateRoleId) return;
    setImpersonateLoading(true);
    try {
      const { data, error: err } = await getImpersonationPermissions(impersonateRoleId);
      if (err) throw new Error(err);
      setImpersonatePerms(data ?? []);
      setImpersonating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setImpersonateLoading(false);
    }
  }, [impersonateRoleId]);

  const exitImpersonation = useCallback(() => {
    setImpersonating(false);
    setImpersonatePerms([]);
    setImpersonateRoleId(null);
  }, []);

  // ── Format timestamp ──────────────────────────────────────
  function formatTime(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function actionLabel(action: string): string {
    const map: Record<string, string> = {
      role_created: "Created role",
      role_deleted: "Deleted role",
      permissions_updated: "Updated permissions",
      permission_granted: "Granted permission",
      permission_revoked: "Revoked permission",
      role_assigned: "Assigned role",
      role_unassigned: "Unassigned role",
      batch_migration: "Batch migration",
    };
    return map[action] ?? action;
  }

  // ── RENDER ────────────────────────────────────────────────

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505]">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen bg-[#050505] overflow-hidden transition-all ${
        impersonating ? "ring-2 ring-rose-500/50 ring-inset" : ""
      }`}
    >
      {/* ── Impersonation Banner ───────────────────────────── */}
      <AnimatePresence>
        {impersonating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-2 flex items-center gap-3"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs text-rose-400 font-semibold">
              IMPERSONATION MODE — Viewing as "{roles.find((r) => r.id === impersonateRoleId)?.name}"
            </span>
            <button
              onClick={exitImpersonation}
              className="ml-auto px-3 py-1 text-xs text-rose-400 border border-rose-500/30 rounded-lg hover:bg-rose-500/10 transition-colors"
            >
              Exit
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="h-14 border-b border-white/5 flex items-center px-6 gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span>SETTINGS</span>
          <ChevronRight size={12} />
          <span className="text-zinc-300">ROLES & PERMISSIONS</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              loadStats();
              loadRoles();
              if (activeTab === "members") loadMembers();
              if (activeTab === "audit") loadAudit();
            }}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} className={globalLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Telemetry Ribbon ───────────────────────────────── */}
      <div className="border-b border-white/5 px-6 py-4 flex-shrink-0">
        {globalLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
        ) : (
          <motion.div className="grid grid-cols-4 gap-4" {...fadeIn}>
            <StatCard
              label="Total Roles"
              value={stats?.total_roles ?? 0}
              icon={Shield}
              color="text-emerald-500"
            />
            <StatCard
              label="System Permissions"
              value={stats?.total_permissions ?? 0}
              icon={ShieldCheck}
              color="text-sky-500"
            />
            <StatCard
              label="Custom Roles"
              value={stats?.custom_roles ?? 0}
              icon={UserCog}
              color="text-violet-500"
            />
            <StatCard
              label="Legacy Members"
              value={stats?.members_on_legacy_roles ?? 0}
              icon={AlertTriangle}
              color="text-amber-500"
            />
          </motion.div>
        )}
      </div>

      {/* ── Tab Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-white/5 flex-shrink-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Error Banner ───────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-3 flex items-center gap-3"
          >
            <AlertTriangle size={14} className="text-rose-400" />
            <p className="text-xs text-rose-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-400">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab Content ────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════
              TAB 1: ROLES — THE MATRIX BUILDER
             ═══════════════════════════════════════════════════ */}
          {activeTab === "roles" && (
            <motion.div key="roles" className="flex h-full" {...fadeIn}>
              {/* ── Left Pane: Role List ──────────────────── */}
              <div className="w-[300px] border-r border-white/5 flex flex-col flex-shrink-0">
                {/* Search */}
                <div className="px-4 pt-4 pb-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={roleSearch}
                      onChange={(e) => setRoleSearch(e.target.value)}
                      placeholder="Search roles…"
                      className="w-full bg-zinc-900/80 border border-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Role list */}
                <div className="flex-1 overflow-y-auto px-2 py-1">
                  {rolesLoading ? (
                    <div className="space-y-2 px-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : filteredRoles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                      <Shield size={24} />
                      <p className="text-xs mt-2">No roles found</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredRoles.map((role) => (
                        <button
                          key={role.id}
                          onClick={() => selectRole(role)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedRoleId === role.id
                              ? "bg-white/10 text-white"
                              : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                          }`}
                        >
                          <ColorDot color={role.color} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium truncate">{role.name}</span>
                              {role.is_system_role && (
                                <span className="text-[8px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded uppercase tracking-wider flex-shrink-0">
                                  System
                                </span>
                              )}
                              {role.is_default_for_new_members && (
                                <Star size={10} className="text-amber-400 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-600">
                            {(role.permission_ids ?? []).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create button */}
                <div className="p-3 border-t border-white/5">
                  <button
                    onClick={handleCreateRole}
                    disabled={creating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create Role
                  </button>
                </div>
              </div>

              {/* ── Right Pane: Permission Matrix ─────────── */}
              <div className="flex-1 overflow-y-auto">
                {!selectedRole ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                    <Shield size={40} className="mb-3 opacity-20" />
                    <p className="text-sm">Select a role to edit permissions</p>
                    <p className="text-xs text-zinc-700 mt-1">
                      Or create a new role to get started
                    </p>
                  </div>
                ) : (
                  <motion.div key={selectedRoleId} className="p-6" {...fadeIn}>
                    {/* Role header */}
                    <div className="mb-6">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-1 space-y-3">
                          {/* Name */}
                          <input
                            type="text"
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            disabled={selectedRole.is_immutable}
                            className="w-full bg-transparent text-xl font-bold text-white border-b border-transparent hover:border-white/10 focus:border-emerald-500/50 focus:outline-none pb-1 disabled:opacity-50"
                            placeholder="Role name"
                          />

                          {/* Description */}
                          <textarea
                            value={roleDesc}
                            onChange={(e) => setRoleDesc(e.target.value)}
                            disabled={selectedRole.is_immutable}
                            className="w-full bg-zinc-900/50 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 resize-none disabled:opacity-50"
                            rows={2}
                            placeholder="Role description (optional)"
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={handleSetDefault}
                            title="Set as default for new members"
                            className={`p-2 rounded-lg transition-colors ${
                              selectedRole.is_default_for_new_members
                                ? "text-amber-400 bg-amber-500/10"
                                : "text-zinc-500 hover:text-amber-400 hover:bg-white/5"
                            }`}
                          >
                            <Star size={14} />
                          </button>
                          <button
                            onClick={handleDuplicateRole}
                            title="Duplicate role"
                            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Copy size={14} />
                          </button>
                          {!selectedRole.is_immutable && (
                            <button
                              onClick={handleDeleteRole}
                              title="Delete role"
                              className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Color selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider mr-1">
                          Color
                        </span>
                        {ROLE_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setRoleColor(c)}
                            className={`w-5 h-5 rounded-full transition-all ${
                              roleColor === c
                                ? "ring-2 ring-white/40 scale-110"
                                : "hover:scale-110 opacity-60 hover:opacity-100"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Immutable warning */}
                    {selectedRole.is_immutable && (
                      <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                        <Info size={14} className="text-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-400">
                          This is an immutable system role. Permissions cannot be modified.
                        </p>
                      </div>
                    )}

                    {/* Permission matrix grid */}
                    <div className="space-y-3">
                      {sortedModules.map((module) => (
                        <ModuleGroup
                          key={module}
                          module={module}
                          permissions={permsByModule[module] ?? []}
                          enabledIds={enabledPerms}
                          allPermissions={allPermissions}
                          onToggle={handleToggle}
                          onSelectAll={() => handleSelectAllModule(module)}
                          onDeselectAll={() => handleDeselectAllModule(module)}
                        />
                      ))}
                    </div>

                    {/* Save button */}
                    {!selectedRole.is_immutable && (
                      <div className="sticky bottom-0 pt-6 pb-4 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent">
                        <button
                          onClick={handleSaveRole}
                          disabled={saving}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                            saveSuccess
                              ? "bg-emerald-500 text-black"
                              : "bg-white text-black hover:bg-zinc-200"
                          } disabled:opacity-50`}
                        >
                          {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : saveSuccess ? (
                            <Check size={16} />
                          ) : (
                            <Save size={16} />
                          )}
                          {saving ? "Saving…" : saveSuccess ? "Saved!" : "Save Permissions"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 2: MEMBERS
             ═══════════════════════════════════════════════════ */}
          {activeTab === "members" && (
            <motion.div key="members" className="p-6 overflow-y-auto h-full" {...fadeIn}>
              <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white mb-1">Members & Role Assignment</h2>
                  <p className="text-sm text-zinc-500">
                    Assign custom roles to team members or batch-migrate from legacy roles.
                  </p>
                </div>

                {/* Batch migrate */}
                <div className="mb-6 bg-zinc-950 border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRightLeft size={14} className="text-violet-400" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                      Batch Migration
                    </h3>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
                        From Legacy Role
                      </label>
                      <select
                        value={migrateFrom}
                        onChange={(e) => setMigrateFrom(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Select legacy role…</option>
                        {LEGACY_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center pb-2">
                      <ChevronRight size={16} className="text-zinc-600" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">
                        To Custom Role
                      </label>
                      <select
                        value={migrateTo}
                        onChange={(e) => setMigrateTo(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Select custom role…</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleMigrate}
                      disabled={migrating || !migrateFrom || !migrateTo}
                      className="px-4 py-2 bg-violet-500/10 text-violet-400 text-xs font-semibold rounded-lg border border-violet-500/20 hover:bg-violet-500/20 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {migrating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Migrate All"
                      )}
                    </button>
                  </div>
                  {migrateResult && (
                    <p className="text-xs text-emerald-400 mt-2">{migrateResult}</p>
                  )}
                </div>

                {/* Members data grid */}
                {membersLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <div className="border border-white/5 rounded-xl overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_1fr_120px_160px_100px] gap-4 px-4 py-2.5 bg-zinc-900/50 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      <span>Name</span>
                      <span>Email</span>
                      <span>Legacy Role</span>
                      <span>Custom Role</span>
                      <span>Actions</span>
                    </div>

                    {/* Table body */}
                    <div className="divide-y divide-white/[0.03]">
                      {(members ?? []).map((member) => (
                        <div
                          key={member.user_id}
                          className="grid grid-cols-[1fr_1fr_120px_160px_100px] gap-4 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 flex-shrink-0">
                              {(member.full_name ?? "?")[0]?.toUpperCase()}
                            </div>
                            <span className="text-xs text-white truncate">
                              {member.full_name ?? "Unknown"}
                            </span>
                          </div>
                          <span className="text-xs text-zinc-500 truncate">
                            {member.email ?? "—"}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {member.org_role}
                          </span>
                          <div className="flex items-center gap-2">
                            {member.role_name ? (
                              <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                                <ColorDot color={member.role_color ?? "#666"} size={6} />
                                {member.role_name}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-600 italic">No custom role</span>
                            )}
                          </div>
                          <div>
                            <select
                              value={member.role_id ?? ""}
                              onChange={(e) =>
                                handleAssignRole(member.user_id, e.target.value || null)
                              }
                              className="bg-zinc-900 border border-white/10 rounded-md px-2 py-1 text-[10px] text-zinc-400 focus:outline-none focus:border-emerald-500/30 w-full"
                            >
                              <option value="">None</option>
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}

                      {(members ?? []).length === 0 && (
                        <div className="py-12 text-center text-sm text-zinc-600">
                          No active members found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 3: AUDIT LOG
             ═══════════════════════════════════════════════════ */}
          {activeTab === "audit" && (
            <motion.div key="audit" className="p-6 overflow-y-auto h-full" {...fadeIn}>
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white mb-1">Permission Audit Log</h2>
                  <p className="text-sm text-zinc-500">
                    Every role change, permission grant, and migration is recorded here.
                  </p>
                </div>

                {auditLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-14" />
                    ))}
                  </div>
                ) : auditLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                    <ScrollText size={32} className="mb-3 opacity-30" />
                    <p className="text-sm">No audit entries yet</p>
                    <p className="text-xs text-zinc-700 mt-1">
                      Actions will appear here once you modify roles or permissions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {auditLog.map((entry) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-4 px-4 py-3 rounded-lg hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-[9px] font-bold text-zinc-500 flex-shrink-0 mt-0.5">
                          {(entry.actor_name ?? "?")[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white font-medium">
                              {entry.actor_name ?? "Unknown"}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {actionLabel(entry.action)}
                            </span>
                            {entry.role_name && (
                              <span className="text-xs text-emerald-400 font-mono">
                                {entry.role_name}
                              </span>
                            )}
                          </div>
                          {Object.keys(entry.details).length > 0 && (
                            <p className="text-[10px] text-zinc-600 font-mono mt-0.5 truncate">
                              {JSON.stringify(entry.details)}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0 mt-1">
                          {formatTime(entry.created_at)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              TAB 4: IMPERSONATION
             ═══════════════════════════════════════════════════ */}
          {activeTab === "impersonation" && (
            <motion.div key="impersonation" className="p-6 overflow-y-auto h-full" {...fadeIn}>
              <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white mb-1">Role Impersonation</h2>
                  <p className="text-sm text-zinc-500">
                    Preview the exact permission set a role would have in the JWT — without affecting live users.
                  </p>
                </div>

                {/* Role selector */}
                <div className="bg-zinc-950 border border-white/5 rounded-xl p-5 mb-6">
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 block">
                        Select Role to Impersonate
                      </label>
                      <select
                        value={impersonateRoleId ?? ""}
                        onChange={(e) => setImpersonateRoleId(e.target.value || null)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Choose a role…</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={impersonating ? exitImpersonation : handleImpersonate}
                      disabled={!impersonateRoleId || impersonateLoading}
                      className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                        impersonating
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                      }`}
                    >
                      {impersonateLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : impersonating ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                      {impersonating ? "Exit View" : "View As This Role"}
                    </button>
                  </div>
                </div>

                {/* Impersonation results */}
                <AnimatePresence>
                  {impersonating && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      {/* JWT preview */}
                      <div className="mb-4 bg-zinc-950 border border-rose-500/20 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldCheck size={14} className="text-rose-400" />
                          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                            JWT Permission Array
                          </h3>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {impersonatePerms.length} permissions
                          </span>
                        </div>
                        <pre className="bg-zinc-900/80 rounded-lg p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[400px] overflow-y-auto">
                          {JSON.stringify(impersonatePerms, null, 2)}
                        </pre>
                      </div>

                      {/* Permission breakdown by module */}
                      <div className="bg-zinc-950 border border-white/5 rounded-xl p-5">
                        <h3 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                          Permission Breakdown
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {sortedModules.map((module) => {
                            const modulePerms = (permsByModule[module] ?? []).filter((p) =>
                              impersonatePerms.includes(p.id)
                            );
                            const totalPerms = (permsByModule[module] ?? []).length;
                            const colorClass = MODULE_COLORS[module] ?? "text-zinc-400";

                            return (
                              <div
                                key={module}
                                className="bg-zinc-900/50 rounded-lg p-3 border border-white/[0.03]"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>
                                    {module}
                                  </span>
                                  <span className="text-[10px] font-mono text-zinc-500">
                                    {modulePerms.length}/{totalPerms}
                                  </span>
                                </div>
                                {/* Progress bar */}
                                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{
                                      width: `${totalPerms > 0 ? (modulePerms.length / totalPerms) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                                {modulePerms.length > 0 && (
                                  <div className="mt-2 space-y-0.5">
                                    {modulePerms.map((p) => (
                                      <p key={p.id} className="text-[9px] text-zinc-500 font-mono truncate">
                                        {p.id}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Idle state */}
                {!impersonating && (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                    <Eye size={40} className="mb-3 opacity-20" />
                    <p className="text-sm">Select a role and click "View As This Role"</p>
                    <p className="text-xs text-zinc-700 mt-1">
                      This is a read-only preview — no changes are made to live sessions.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
