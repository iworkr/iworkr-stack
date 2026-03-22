/**
 * @component RoleGate
 * @status COMPLETE
 * @description Conditionally renders children based on user role in current workspace
 * @lastAudit 2026-03-22
 */
"use client";

/**
 * RoleGate — Project Yggdrasil-Sync
 *
 * Conditionally renders children based on the user's active role in
 * the current workspace. Subscribes to the auth store so it re-evaluates
 * the instant a workspace switch updates `currentMembership`.
 *
 * Usage:
 *   <RoleGate allowedRoles={["owner", "admin"]}>
 *     <FinancialSidebar />
 *   </RoleGate>
 *
 *   <RoleGate allowedRoles={["owner", "admin"]} fallback={<AccessDenied />}>
 *     <PayrollSettings />
 *   </RoleGate>
 */

import { type ReactNode } from "react";
import { useAuthStore } from "@/lib/auth-store";

type WorkspaceRole = "owner" | "admin" | "manager" | "dispatcher" | "worker" | "technician" | "office_admin";

interface RoleGateProps {
  /** Roles allowed to see the children. */
  allowedRoles: WorkspaceRole[];
  /** Optional content to render when role doesn't match. Defaults to null. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({ allowedRoles, fallback = null, children }: RoleGateProps) {
  const role = useAuthStore((s) => {
    const membershipRole = s.currentMembership?.role as string | undefined;
    const jwtRole = s.user?.app_metadata?.role as string | undefined;
    return (membershipRole ?? jwtRole ?? "technician") as WorkspaceRole;
  });

  if (!allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
