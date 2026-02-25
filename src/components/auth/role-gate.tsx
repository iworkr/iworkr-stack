"use client";

import { useAuthStore } from "@/lib/auth-store";
import { roleDefinitions, type RoleId, type PermissionModule, type PermissionAction } from "@/lib/team-data";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════
// ── RoleGate — Conditional rendering based on user role ──
// ═══════════════════════════════════════════════════════════

interface RoleGateProps {
  /** Roles that are allowed to see the children */
  allowedRoles?: RoleId[];
  /** Alternatively, specify module + action for fine-grained checks */
  module?: PermissionModule;
  action?: PermissionAction;
  /** Minimum clearance level (owner=5, admin=5, manager=3, tech=1) */
  minClearance?: number;
  /** Content rendered when authorized */
  children: ReactNode;
  /** Content rendered when unauthorized (default: nothing) */
  fallback?: ReactNode;
  /** If true, shows the Obsidian locked overlay instead of hiding */
  showLocked?: boolean;
  /** Custom lock message */
  lockMessage?: string;
}

const CLEARANCE_MAP: Record<string, number> = {
  owner: 5,
  admin: 5,
  manager: 3,
  office_admin: 3,
  senior_tech: 2,
  technician: 1,
  apprentice: 1,
  subcontractor: 1,
};

export function RoleGate({
  allowedRoles,
  module,
  action,
  minClearance,
  children,
  fallback,
  showLocked = false,
  lockMessage,
}: RoleGateProps) {
  const membership = useAuthStore((s) => s.currentMembership);
  const role = (membership?.role ?? "technician") as RoleId;

  let authorized = false;

  if (allowedRoles) {
    authorized = allowedRoles.includes(role);
  } else if (module && action) {
    const def = roleDefinitions.find((r) => r.id === role);
    authorized = def?.permissions[module]?.includes(action) ?? false;
  } else if (minClearance !== undefined) {
    authorized = (CLEARANCE_MAP[role] ?? 0) >= minClearance;
  } else {
    authorized = true;
  }

  if (authorized) return <>{children}</>;

  if (showLocked) return <LockedOverlay message={lockMessage} />;

  return fallback ? <>{fallback}</> : null;
}

// ── Locked Overlay (The Obsidian Gate) ───────────────────

function LockedOverlay({ message }: { message?: string }) {
  return (
    <div className="relative w-full min-h-[200px] rounded-xl overflow-hidden">
      <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md border border-white/5 rounded-xl flex flex-col items-center justify-center gap-3 z-10">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/50 border border-white/10 flex items-center justify-center">
          <Lock className="w-5 h-5 text-zinc-500" />
        </div>
        <p className="text-sm font-medium text-white">
          Restricted Access
        </p>
        <p className="text-xs text-zinc-500 max-w-[260px] text-center">
          {message || "You don't have permission to view this content."}
        </p>
      </div>
    </div>
  );
}

// ── Data Masking Helper ──────────────────────────────────

interface DataMaskProps {
  module: PermissionModule;
  action?: PermissionAction;
  children: ReactNode;
  mask?: ReactNode;
}

export function DataMask({
  module,
  action = "view",
  children,
  mask,
}: DataMaskProps) {
  const membership = useAuthStore((s) => s.currentMembership);
  const role = (membership?.role ?? "technician") as RoleId;
  const def = roleDefinitions.find((r) => r.id === role);
  const allowed = def?.permissions[module]?.includes(action) ?? false;

  if (allowed) return <>{children}</>;

  return (
    <>{mask ?? <span className="font-mono text-xs text-zinc-600">---</span>}</>
  );
}
