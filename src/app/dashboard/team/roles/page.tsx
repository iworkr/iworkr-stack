"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Shield,
  Check,
  X as XIcon,
  Eye,
  Plus,
  Edit3,
  Trash2,
  Download,
  Info,
  Lock,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTeamStore } from "@/lib/team-store";
import {
  permissionModules,
  permissionActions,
  type RoleId,
  type PermissionModule,
  type PermissionAction,
} from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Role color map ───────────────────────────────────── */

const roleColorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
  purple: { bg: "bg-[rgba(0,230,118,0.08)]", text: "text-[#00E676]", border: "border-[rgba(0,230,118,0.2)]", dot: "bg-[#00E676]" },
  blue: { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20", dot: "bg-zinc-500" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", dot: "bg-cyan-500" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/20", dot: "bg-pink-500" },
};

/* ── Action icon map ──────────────────────────────────── */

const actionIcons: Record<PermissionAction, typeof Eye> = {
  view: Eye,
  create: Plus,
  edit: Edit3,
  delete: Trash2,
  export: Download,
};

export default function RolesPage() {
  const router = useRouter();
  const { roles, togglePermission, saveRolePermissionsServer, members } = useTeamStore();
  const { addToast } = useToastStore();
  const [selectedRoleId, setSelectedRoleId] = useState<RoleId>("owner");
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(async (mod: PermissionModule, action: PermissionAction) => {
    if (selectedRoleId === "owner") return;
    const hasPermission = roles.find(r => r.id === selectedRoleId)?.permissions[mod]?.includes(action);

    togglePermission(selectedRoleId, mod, action);

    setSaving(true);
    const updatedRole = useTeamStore.getState().roles.find(r => r.id === selectedRoleId);
    if (updatedRole) {
      const permObj: Record<string, Record<string, boolean>> = {};
      for (const [m, acts] of Object.entries(updatedRole.permissions)) {
        permObj[m] = {};
        for (const a of ["view", "create", "edit", "delete", "export"]) {
          permObj[m][a] = (acts as string[]).includes(a);
        }
      }
      const { error } = await saveRolePermissionsServer(selectedRoleId, permObj, updatedRole.scopes);
      if (error) {
        togglePermission(selectedRoleId, mod, action);
        addToast(`Failed to save: ${error}`);
      } else {
        addToast(`${hasPermission ? "Removed" : "Added"} ${action} ${mod} for ${updatedRole.label}`);
      }
    }
    setSaving(false);
  }, [selectedRoleId, roles, togglePermission, saveRolePermissionsServer, addToast]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId),
    [roles, selectedRoleId]
  );

  const memberCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    members.filter((m) => m.status !== "archived").forEach((m) => {
      counts[m.role] = (counts[m.role] || 0) + 1;
    });
    return counts;
  }, [members]);

  const isOwnerRole = selectedRoleId === "owner";

  return (
    <div className="flex h-full flex-col">
      {/* ── Back Nav ──────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
        <button
          onClick={() => router.push("/dashboard/team")}
          className="flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          <span>Team</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-300">Roles & Permissions</span>
        </button>
      </div>

      {/* ── Split View ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Role List */}
        <div className="w-[260px] shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[#080808]">
          <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
            <h2 className="text-[13px] font-medium text-zinc-300">Roles</h2>
            <p className="text-[10px] text-zinc-600">{roles.length} roles configured</p>
          </div>

          <div className="p-2">
            {roles.map((role, i) => {
              const rc = roleColorMap[role.color] || roleColorMap.purple;
              const isSelected = selectedRoleId === role.id;
              const count = memberCountByRole[role.id] || 0;

              return (
                <motion.button
                  key={role.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? `${rc.bg} border ${rc.border}`
                      : "border border-transparent hover:bg-[rgba(255,255,255,0.03)]"
                  }`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${rc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-medium ${isSelected ? rc.text : "text-zinc-300"}`}>
                      {role.label}
                    </p>
                    <p className="truncate text-[10px] text-zinc-600">{role.description}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-zinc-600">{count}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right: Permission Grid */}
        <div className="flex-1 overflow-y-auto">
          {selectedRole && (
            <div className="p-6">
              {/* Role header */}
              <motion.div
                key={selectedRoleId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${roleColorMap[selectedRole.color]?.bg}`}>
                      <Shield size={18} className={roleColorMap[selectedRole.color]?.text} />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-semibold text-zinc-200">
                        {selectedRole.label}
                      </h2>
                      <p className="text-[12px] text-zinc-500">{selectedRole.description}</p>
                    </div>
                  </div>
                  {isOwnerRole && (
                    <div className="flex items-center gap-1.5 rounded-full bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[10px] text-zinc-600">
                      <Lock size={10} /> Owner role cannot be modified
                    </div>
                  )}
                </div>

                {/* Scopes */}
                <div className="mb-6 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">Job Visibility</p>
                    <p className="mt-1 text-[12px] font-medium capitalize text-zinc-300">{selectedRole.scopes.jobVisibility} Jobs</p>
                  </div>
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">Invoice Approval</p>
                    <p className="mt-1 text-[12px] font-medium text-zinc-300">
                      {selectedRole.scopes.invoiceApproval ? "Can Approve" : "View Only"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">Team Management</p>
                    <p className="mt-1 text-[12px] font-medium text-zinc-300">
                      {selectedRole.scopes.canManageTeam ? "Full Access" : "No Access"}
                    </p>
                  </div>
                </div>

                {/* Permission Matrix */}
                <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)]">
                  {/* Header row */}
                  <div className="grid grid-cols-6 gap-0 bg-[rgba(255,255,255,0.02)]">
                    <div className="border-b border-r border-[rgba(255,255,255,0.06)] px-4 py-3">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Module</span>
                    </div>
                    {permissionActions.map((action) => {
                      const Icon = actionIcons[action];
                      return (
                        <div key={action} className="flex items-center justify-center border-b border-[rgba(255,255,255,0.06)] px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <Icon size={10} className="text-zinc-600" />
                            <span className="text-[10px] font-medium capitalize text-zinc-600">{action}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Module rows */}
                  {permissionModules.map((mod, rowIdx) => (
                    <div
                      key={mod.id}
                      className={`grid grid-cols-6 gap-0 ${
                        rowIdx < permissionModules.length - 1 ? "border-b border-[rgba(255,255,255,0.04)]" : ""
                      }`}
                    >
                      {/* Module name */}
                      <div className="flex items-center border-r border-[rgba(255,255,255,0.06)] px-4 py-3">
                        <span className="text-[12px] font-medium text-zinc-300">{mod.label}</span>
                      </div>

                      {/* Permission cells */}
                      {permissionActions.map((action) => {
                        const hasPermission = selectedRole.permissions[mod.id]?.includes(action);
                        return (
                          <div key={action} className="flex items-center justify-center px-3 py-3">
                            <button
                              onClick={() => handleToggle(mod.id, action)}
                              disabled={isOwnerRole || saving}
                              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200 ${
                                isOwnerRole ? "cursor-not-allowed" : "cursor-pointer"
                              } ${
                                hasPermission
                                  ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                  : "bg-[rgba(255,255,255,0.02)] text-zinc-800 hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-600"
                              }`}
                            >
                              {hasPermission ? (
                                <motion.div
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                                >
                                  <Check size={13} strokeWidth={2.5} />
                                </motion.div>
                              ) : (
                                <XIcon size={9} />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Info */}
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                  <Info size={12} className="mt-0.5 shrink-0 text-zinc-600" />
                  <p className="text-[10px] leading-relaxed text-zinc-600">
                    Click any cell to toggle a permission. Changes are saved to the database and pushed to active sessions in real-time.
                    The Owner role cannot be modified.
                    {saving && <span className="ml-1 font-medium text-amber-400">Saving…</span>}
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
