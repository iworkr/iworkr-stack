"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Shield,
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

/* ── Stealth Role Styles ─────────────────────────────── */

const roleBadgeStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  owner: { bg: "bg-amber-500/[0.06]", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
  admin: { bg: "bg-purple-500/[0.06]", text: "text-purple-400", border: "border-purple-500/20", dot: "bg-purple-500" },
  tech: { bg: "bg-sky-500/[0.06]", text: "text-sky-400", border: "border-sky-500/20", dot: "bg-sky-500" },
};

/* ── Action icon map ──────────────────────────────────── */

const actionIcons: Record<PermissionAction, typeof Eye> = {
  view: Eye,
  create: Plus,
  edit: Edit3,
  delete: Trash2,
  export: Download,
};

/* ── Custom Switch Toggle ────────────────────────────── */

function SwitchToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-all duration-200 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${
        checked ? "bg-emerald-500" : "bg-zinc-800"
      }`}
    >
      <motion.span
        animate={{ x: checked ? 16 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${
          checked ? "bg-white" : "bg-zinc-600"
        }`}
      />
    </button>
  );
}

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
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Back Nav ──────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 px-5 py-2.5 backdrop-blur-xl">
        <button
          onClick={() => router.push("/dashboard/team")}
          className="flex items-center gap-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={13} />
          <span>Command Roster</span>
          <span className="text-zinc-700">/</span>
          <span className="font-medium text-white">Roles & Permissions</span>
        </button>
      </div>

      {/* ── Split View ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Role List */}
        <div className="w-[240px] shrink-0 border-r border-white/[0.04] bg-[#080808]">
          <div className="border-b border-white/[0.04] px-4 py-3">
            <h2 className="text-[12px] font-medium text-zinc-300">Roles</h2>
            <p className="text-[10px] text-zinc-600">{roles.length} configured</p>
          </div>

          <div className="p-2">
            {roles.map((role, i) => {
              const rc = roleBadgeStyles[role.color] || roleBadgeStyles.tech;
              const isSelected = selectedRoleId === role.id;
              const count = memberCountByRole[role.id] || 0;

              return (
                <motion.button
                  key={role.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-all ${
                    isSelected
                      ? `${rc.bg} border ${rc.border}`
                      : "border border-transparent hover:bg-white/[0.02]"
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${rc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] font-medium ${isSelected ? rc.text : "text-zinc-400"}`}>
                      {role.label}
                    </p>
                    <p className="truncate text-[9px] text-zinc-600">{role.description}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[9px] text-zinc-700">{count}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Right: Permission Grid */}
        <div className="flex-1 overflow-y-auto">
          {selectedRole && (
            <div className="p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedRoleId}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Role header */}
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${(roleBadgeStyles[selectedRole.color] || roleBadgeStyles.tech).bg}`}>
                        <Shield size={16} className={(roleBadgeStyles[selectedRole.color] || roleBadgeStyles.tech).text} />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-medium text-white">
                          {selectedRole.label}
                        </h2>
                        <p className="text-[11px] text-zinc-500">{selectedRole.description}</p>
                      </div>
                    </div>
                    {isOwnerRole && (
                      <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1 text-[9px] text-zinc-600">
                        <Lock size={9} /> Owner role cannot be modified
                      </div>
                    )}
                  </div>

                  {/* Scopes */}
                  <div className="mb-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-zinc-900/30 p-3 transition-colors hover:bg-zinc-900/40">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Job Visibility</p>
                      <p className="mt-1 font-mono text-[11px] font-medium capitalize text-zinc-300">{selectedRole.scopes.jobVisibility} Jobs</p>
                    </div>
                    <div className="rounded-xl bg-zinc-900/30 p-3 transition-colors hover:bg-zinc-900/40">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Invoice Approval</p>
                      <p className="mt-1 font-mono text-[11px] font-medium text-zinc-300">
                        {selectedRole.scopes.invoiceApproval ? "Can Approve" : "View Only"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-zinc-900/30 p-3 transition-colors hover:bg-zinc-900/40">
                      <p className="text-[8px] font-bold uppercase tracking-widest text-zinc-600">Team Management</p>
                      <p className="mt-1 font-mono text-[11px] font-medium text-zinc-300">
                        {selectedRole.scopes.canManageTeam ? "Full Access" : "No Access"}
                      </p>
                    </div>
                  </div>

                  {/* Permission Matrix */}
                  <div className="overflow-hidden rounded-lg border border-white/[0.04]">
                    {/* Header row */}
                    <div className="sticky top-0 z-10 grid grid-cols-6 gap-0 bg-[#0A0A0A]">
                      <div className="border-b border-r border-white/[0.04] px-3 py-2.5">
                        <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">Module</span>
                      </div>
                      {permissionActions.map((action) => {
                        const Icon = actionIcons[action];
                        return (
                          <div key={action} className="flex items-center justify-center border-b border-white/[0.04] px-2 py-2.5">
                            <div className="flex items-center gap-1">
                              <Icon size={9} className="text-zinc-600" />
                              <span className="text-[9px] font-medium capitalize text-zinc-600">{action}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Module rows */}
                    {permissionModules.map((mod, rowIdx) => (
                      <div
                        key={mod.id}
                        className={`grid grid-cols-6 gap-0 transition-colors hover:bg-white/[0.015] ${
                          rowIdx < permissionModules.length - 1 ? "border-b border-white/[0.03]" : ""
                        }`}
                      >
                        <div className="flex items-center border-r border-white/[0.04] px-3 py-2.5">
                          <span className="text-[11px] font-medium text-zinc-400">{mod.label}</span>
                        </div>
                        {permissionActions.map((action) => {
                          const hasPermission = selectedRole.permissions[mod.id]?.includes(action);
                          return (
                            <div key={action} className="flex items-center justify-center px-2 py-2.5">
                              <SwitchToggle
                                checked={!!hasPermission}
                                onChange={() => handleToggle(mod.id, action)}
                                disabled={isOwnerRole || saving}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  {/* Info */}
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-white/[0.015] px-3 py-2">
                    <Info size={10} className="mt-0.5 shrink-0 text-zinc-700" />
                    <p className="text-[9px] leading-relaxed text-zinc-600">
                      Toggle switches to grant or revoke permissions. Changes are saved instantly.
                      {saving && <span className="ml-1 font-medium text-emerald-400">Saving…</span>}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
