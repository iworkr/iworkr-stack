import { create } from "zustand";
import {
  teamMembers as initialMembers,
  roleDefinitions as initialRoles,
  type TeamMember,
  type RoleDefinition,
  type RoleId,
  type PermissionModule,
  type PermissionAction,
} from "./team-data";

/* ── Store ────────────────────────────────────────────── */

interface TeamState {
  members: TeamMember[];
  roles: RoleDefinition[];
  searchQuery: string;
  filterBranch: string;
  filterRole: string;
  filterSkill: string;
  selectedMemberId: string | null;
  inviteModalOpen: boolean;

  setSearchQuery: (q: string) => void;
  setFilterBranch: (b: string) => void;
  setFilterRole: (r: string) => void;
  setFilterSkill: (s: string) => void;
  setSelectedMemberId: (id: string | null) => void;
  setInviteModalOpen: (open: boolean) => void;

  updateMemberRole: (memberId: string, newRole: RoleId) => void;
  suspendMember: (memberId: string) => void;
  reactivateMember: (memberId: string) => void;
  archiveMember: (memberId: string) => void;
  resendInvite: (memberId: string) => void;
  addPendingMember: (name: string, email: string, role: RoleId, branch: string) => void;

  togglePermission: (roleId: RoleId, module: PermissionModule, action: PermissionAction) => void;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: initialMembers,
  roles: initialRoles,
  searchQuery: "",
  filterBranch: "all",
  filterRole: "all",
  filterSkill: "all",
  selectedMemberId: null,
  inviteModalOpen: false,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterBranch: (b) => set({ filterBranch: b }),
  setFilterRole: (r) => set({ filterRole: r }),
  setFilterSkill: (s) => set({ filterSkill: s }),
  setSelectedMemberId: (id) => set({ selectedMemberId: id }),
  setInviteModalOpen: (open) => set({ inviteModalOpen: open }),

  updateMemberRole: (memberId, newRole) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, role: newRole } : m
      ),
    })),

  suspendMember: (memberId) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, status: "suspended" as const, onlineStatus: "offline" as const } : m
      ),
    })),

  reactivateMember: (memberId) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, status: "active" as const } : m
      ),
    })),

  archiveMember: (memberId) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, status: "archived" as const, onlineStatus: "offline" as const } : m
      ),
    })),

  resendInvite: (memberId) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, lastActive: "Invite resent" } : m
      ),
    })),

  addPendingMember: (name, email, role, branch) => {
    const initials = name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const newMember: TeamMember = {
      id: `mem-${Date.now()}`,
      name,
      initials,
      email,
      phone: "",
      role,
      branch,
      status: "pending",
      onlineStatus: "offline",
      skills: [],
      lastActive: "Never",
      joinedAt: new Date().toLocaleDateString("en-AU", { month: "short", year: "numeric" }),
      jobsCompleted: 0,
      avgRating: 0,
      hourlyRate: 0,
      twoFactorEnabled: false,
      lastLoginIp: "—",
      recentActivity: [],
    };
    set((s) => ({ members: [...s.members, newMember] }));
  },

  togglePermission: (roleId, module, action) =>
    set((s) => ({
      roles: s.roles.map((r) => {
        if (r.id !== roleId) return r;
        const current = r.permissions[module];
        const has = current.includes(action);
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [module]: has ? current.filter((a) => a !== action) : [...current, action],
          },
        };
      }),
    })),
}));
