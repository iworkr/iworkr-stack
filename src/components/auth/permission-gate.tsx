"use client";

import { useAuthStore } from "@/lib/auth-store";
import { Lock, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════
// ── usePermissions — The Atomic Permission Hook ───────────────
// Reads the compiled permissions array from the JWT app_metadata
// injected by the custom_access_token_hook Auth Hook.
// Falls back to legacy role-based mapping for backward compat.
// ═══════════════════════════════════════════════════════════════

const LEGACY_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"], // Superadmin wildcard
  admin: ["*"],
  manager: [
    "dashboard:read", "dashboard:read_analytics",
    "jobs:read", "jobs:create", "jobs:edit", "jobs:assign", "jobs:close",
    "roster:read", "roster:create", "roster:edit", "roster:publish", "roster:assign",
    "clients:read", "clients:create", "clients:edit",
    "participants:read_basic", "participants:create", "participants:edit",
    "finance:read_invoices", "finance:write_invoices",
    "timesheets:read_all", "timesheets:create", "timesheets:approve", "timesheets:edit",
    "clinical:read_notes", "clinical:write_notes", "clinical:read_goals", "clinical:write_goals",
    "fleet:read", "fleet:create", "fleet:edit",
    "assets:read", "assets:create", "assets:edit",
    "team:read", "team:invite", "team:edit",
    "settings:read",
    "forms:read", "forms:create",
    "safety:read", "safety:create", "safety:submit", "safety:manage",
  ],
  office_admin: [
    "dashboard:read",
    "jobs:read", "jobs:create", "jobs:edit",
    "roster:read", "roster:create", "roster:edit",
    "clients:read", "clients:create", "clients:edit",
    "finance:read_invoices", "finance:write_invoices",
    "timesheets:read_all", "timesheets:create", "timesheets:approve",
    "forms:read", "forms:create",
  ],
  senior_tech: [
    "dashboard:read",
    "jobs:read", "jobs:edit",
    "roster:read",
    "timesheets:read_self", "timesheets:create",
    "clinical:read_notes", "clinical:write_notes",
    "safety:read", "safety:submit",
    "fleet:read",
    "assets:read",
  ],
  technician: [
    "dashboard:read",
    "jobs:read",
    "roster:read",
    "timesheets:read_self", "timesheets:create",
    "clinical:read_notes", "clinical:write_notes",
    "safety:read", "safety:submit",
  ],
  apprentice: [
    "dashboard:read",
    "jobs:read",
    "roster:read",
    "timesheets:read_self", "timesheets:create",
    "safety:read", "safety:submit",
  ],
  subcontractor: [
    "dashboard:read",
    "jobs:read",
    "timesheets:read_self", "timesheets:create",
  ],
};

/** Returns the resolved permissions array for the current user. */
export function usePermissions(): string[] {
  return useAuthStore((s) => {
    // 1. Try JWT app_metadata.permissions (injected by Auth Hook)
    const jwtPerms = s.user?.app_metadata?.permissions as string[] | undefined;
    if (jwtPerms && Array.isArray(jwtPerms) && jwtPerms.length > 0) {
      return jwtPerms;
    }

    // 2. Fallback: derive from legacy role
    const membershipRole = s.currentMembership?.role as string | undefined;
    const role = membershipRole ?? s.user?.app_metadata?.role ?? "technician";
    return LEGACY_ROLE_PERMISSIONS[role as string] ?? ["dashboard:read"];
  });
}

/** Returns the user's role name from JWT. */
export function useRoleName(): string {
  return useAuthStore((s) => {
    const jwtRoleName = s.user?.app_metadata?.role_name as string | undefined;
    if (jwtRoleName) return jwtRoleName;
    const membershipRole = s.currentMembership?.role as string | undefined;
    return membershipRole ?? "technician";
  });
}

/** O(1) permission check — works with wildcard "*" for owners/admins */
export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}

/** Check multiple permissions with AND/OR logic */
export function hasPermissions(
  permissions: string[],
  required: string[],
  requireAll: boolean = false
): boolean {
  if (permissions.includes("*")) return true;
  return requireAll
    ? required.every((p) => permissions.includes(p))
    : required.some((p) => permissions.includes(p));
}

// ═══════════════════════════════════════════════════════════════
// ── PermissionGate — The Atomic Access Control Component ──────
// Replaces the legacy <RoleGate> with granular permission checks.
// ═══════════════════════════════════════════════════════════════

interface PermissionGateProps {
  /** Single permission string or array of permission strings */
  required: string | string[];
  /** If array, require ALL (true) or ANY (false, default) */
  requireAll?: boolean;
  /** Content rendered when authorized */
  children: ReactNode;
  /** Content rendered when unauthorized (default: null) */
  fallback?: ReactNode;
  /** If true, shows the Obsidian locked overlay instead of hiding */
  showLocked?: boolean;
  /** Custom lock message */
  lockMessage?: string;
}

export function PermissionGate({
  required,
  requireAll = false,
  children,
  fallback,
  showLocked = false,
  lockMessage,
}: PermissionGateProps) {
  const permissions = usePermissions();

  const authorized = Array.isArray(required)
    ? hasPermissions(permissions, required, requireAll)
    : hasPermission(permissions, required);

  if (authorized) return <>{children}</>;

  if (showLocked) return <LockedOverlay message={lockMessage} />;

  return fallback ? <>{fallback}</> : null;
}

// ── Locked Overlay (The Obsidian Gate) ────────────────────────

function LockedOverlay({ message }: { message?: string }) {
  return (
    <div className="relative w-full min-h-[200px] rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md border border-white/5 rounded-xl flex flex-col items-center justify-center gap-3 z-10">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/50 border border-white/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-zinc-500" />
        </div>
        <p className="text-sm font-medium text-white">Restricted Access</p>
        <p className="text-xs text-zinc-500 max-w-[260px] text-center">
          {message || "You don't have permission to view this content."}
        </p>
      </div>
    </div>
  );
}

// ── Dangerous Permission Badge ────────────────────────────────

interface DangerousPermissionBadgeProps {
  required: string;
  children: ReactNode;
}

export function DangerousPermissionGate({
  required,
  children,
}: DangerousPermissionBadgeProps) {
  const permissions = usePermissions();
  const authorized = hasPermission(permissions, required);

  if (authorized) return <>{children}</>;

  return (
    <div className="relative group">
      <div className="opacity-30 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-rose-500/20 rounded-lg px-3 py-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span className="text-xs text-rose-400">Requires elevated privileges</span>
        </div>
      </div>
    </div>
  );
}

// ── Data Mask (Column-Level Obfuscation) ──────────────────────
// Replaces data with "RESTRICTED" if the user lacks the permission

interface DataMaskProps {
  required: string;
  children: ReactNode;
  mask?: ReactNode;
}

export function DataMask({ required, children, mask }: DataMaskProps) {
  const permissions = usePermissions();
  const authorized = hasPermission(permissions, required);

  if (authorized) return <>{children}</>;

  return (
    <>
      {mask ?? (
        <span className="font-mono text-xs text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded">
          ••• RESTRICTED
        </span>
      )}
    </>
  );
}
