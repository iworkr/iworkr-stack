import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFresh } from "./cache-utils";
import {
  type TeamMember,
  type RoleDefinition,
  type RoleId,
  type PermissionModule,
  type PermissionAction,
} from "./team-data";
import {
  getTeamMembers,
  getTeamInvites,
  getTeamOverview,
  getRoles,
  updateMemberRole as updateMemberRoleServer,
  updateMemberDetails as updateMemberDetailsServer,
  removeMember as removeMemberServer,
  inviteMember as inviteMemberServer,
  resendInvite as resendInviteServer,
  cancelInvite as cancelInviteServer,
  updateRolePermissions as updateRolePermissionsServer,
  createRole as createRoleServer,
  deleteRole as deleteRoleServer,
  type TeamOverview,
} from "@/app/actions/team";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function formatJoinDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

const roleEnumToId: Record<string, RoleId> = {
  owner: "owner",
  admin: "office_admin",
  manager: "manager",
  senior_tech: "senior_tech",
  technician: "technician",
  apprentice: "apprentice",
  subcontractor: "subcontractor",
  office_admin: "office_admin",
};

function mapServerMember(s: any): TeamMember {
  const profile = s.profiles || {};
  const name = profile.full_name || profile.email || "Unknown";
  const roleEnum = s.role || "technician";

  return {
    id: s.user_id,
    name,
    initials: getInitials(name),
    email: profile.email || "",
    phone: profile.phone || "",
    avatar: profile.avatar_url || undefined,
    role: roleEnumToId[roleEnum] || "technician",
    branch: s.branch || "HQ",
    status: s.status || "active",
    onlineStatus: "offline",
    skills: Array.isArray(s.skills) ? s.skills : [],
    lastActive: timeSince(s.last_active_at),
    joinedAt: formatJoinDate(s.joined_at),
    jobsCompleted: 0,
    avgRating: 0,
    hourlyRate: s.hourly_rate ? Number(s.hourly_rate) : 0,
    twoFactorEnabled: false,
    lastLoginIp: "—",
    recentActivity: [],
  };
}

function mapServerRole(s: any): RoleDefinition {
  const perms = s.permissions || {};
  const scopes = s.scopes || {};

  const allModules: PermissionModule[] = [
    "jobs", "clients", "finance", "schedule",
    "assets", "forms", "team", "settings", "integrations",
  ];

  const allActions: PermissionAction[] = ["view", "create", "edit", "delete", "export"];

  const permissions: Record<PermissionModule, PermissionAction[]> = {} as any;
  for (const mod of allModules) {
    const modPerms = perms[mod] || {};
    const actions: PermissionAction[] = [];
    for (const act of allActions) {
      const val = modPerms[act];
      if (val === true || (typeof val === "string" && val !== "none")) {
        actions.push(act);
      }
    }
    permissions[mod] = actions;
  }

  const nameToRoleId: Record<string, RoleId> = {
    Owner: "owner",
    Manager: "manager",
    "Office Admin": "office_admin",
    "Senior Tech": "senior_tech",
    Technician: "technician",
    Apprentice: "apprentice",
    Subcontractor: "subcontractor",
  };

  return {
    id: nameToRoleId[s.name] || (s.id as RoleId),
    label: s.name,
    description: "",
    color: s.color || "cyan",
    permissions,
    scopes: {
      jobVisibility: scopes.jobVisibility || "assigned",
      invoiceApproval: scopes.invoiceApproval || false,
      canManageTeam: scopes.canManageTeam || false,
    },
  };
}

/* ── Store ────────────────────────────────────────────── */

interface TeamState {
  members: TeamMember[];
  roles: RoleDefinition[];
  overview: TeamOverview | null;
  searchQuery: string;
  filterBranch: string;
  filterRole: string;
  filterSkill: string;
  selectedMemberId: string | null;
  inviteModalOpen: boolean;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;
  _stale: boolean;
  _lastFetchedAt: number | null;

  setSearchQuery: (q: string) => void;
  setFilterBranch: (b: string) => void;
  setFilterRole: (r: string) => void;
  setFilterSkill: (s: string) => void;
  setSelectedMemberId: (id: string | null) => void;
  setInviteModalOpen: (open: boolean) => void;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  handleRealtimeUpdate: () => void;

  updateMemberRole: (memberId: string, newRole: RoleId) => void;
  suspendMember: (memberId: string) => void;
  reactivateMember: (memberId: string) => void;
  archiveMember: (memberId: string) => void;
  resendInvite: (memberId: string) => void;
  addPendingMember: (name: string, email: string, role: RoleId, branch: string) => void;

  togglePermission: (roleId: RoleId, module: PermissionModule, action: PermissionAction) => void;

  inviteMemberServer: (params: {
    email: string;
    role: string;
    branch?: string;
  }) => Promise<{ error: string | null }>;

  updateMemberRoleServer: (
    userId: string,
    role: string,
    roleId?: string
  ) => Promise<{ error: string | null }>;

  suspendMemberServer: (userId: string) => Promise<{ error: string | null }>;
  reactivateMemberServer: (userId: string) => Promise<{ error: string | null }>;
  removeMemberServer: (userId: string) => Promise<{ error: string | null }>;

  saveRolePermissionsServer: (
    roleDbId: string,
    permissions: any,
    scopes?: any
  ) => Promise<{ error: string | null }>;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
  members: [],
  roles: [],
  overview: null,
  searchQuery: "",
  filterBranch: "all",
  filterRole: "all",
  filterSkill: "all",
  selectedMemberId: null,
  inviteModalOpen: false,
  loaded: false,
  loading: false,
  orgId: null,
  _stale: true,
  _lastFetchedAt: null,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterBranch: (b) => set({ filterBranch: b }),
  setFilterRole: (r) => set({ filterRole: r }),
  setFilterSkill: (s) => set({ filterSkill: s }),
  setSelectedMemberId: (id) => set({ selectedMemberId: id }),
  setInviteModalOpen: (open) => set({ inviteModalOpen: open }),

  /* ── Load from server ──────────────────────── */

  loadFromServer: async (orgId: string) => {
    const state = get();
    if (state.loading) return;
    if (isFresh(state._lastFetchedAt) && state.orgId === orgId) return;

    const hasCache = state.members.length > 0 && state.orgId === orgId;
    set({ loading: !hasCache, orgId });

    try {
      const [membersRes, rolesRes, overviewRes, invitesRes] = await Promise.all([
        getTeamMembers(orgId),
        getRoles(orgId),
        getTeamOverview(orgId),
        getTeamInvites(orgId),
      ]);

      const serverMembers = membersRes.data
        ? membersRes.data.map(mapServerMember)
        : [];

      const serverRoles = rolesRes.data
        ? rolesRes.data.map(mapServerRole)
        : [];

      // Add pending invites as pending members
      if (invitesRes.data) {
        for (const invite of invitesRes.data) {
          if (invite.status === "pending") {
            serverMembers.push({
              id: `invite-${invite.id}`,
              name: invite.email.split("@")[0],
              initials: invite.email[0].toUpperCase(),
              email: invite.email,
              phone: "",
              role: roleEnumToId[invite.role] || "technician",
              branch: "HQ",
              status: "pending",
              onlineStatus: "offline",
              skills: [],
              lastActive: "Invite sent",
              joinedAt: formatJoinDate(invite.created_at),
              jobsCompleted: 0,
              avgRating: 0,
              hourlyRate: 0,
              twoFactorEnabled: false,
              lastLoginIp: "—",
              recentActivity: [],
            });
          }
        }
      }

      set({
        members: serverMembers,
        roles: serverRoles,
        overview: overviewRes.data || null,
        loaded: true,
        loading: false,
        _stale: false,
        _lastFetchedAt: Date.now(),
      });
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;

    try {
      const [membersRes, rolesRes, overviewRes] = await Promise.all([
        getTeamMembers(orgId),
        getRoles(orgId),
        getTeamOverview(orgId),
      ]);

      if (membersRes.data) set({ members: membersRes.data.map(mapServerMember) });
      if (rolesRes.data) set({ roles: rolesRes.data.map(mapServerRole) });
      if (overviewRes.data) set({ overview: overviewRes.data });
      set({ _lastFetchedAt: Date.now(), _stale: false });
    } catch {
      // Silently fail on refresh
    }
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },

  /* ── Local optimistic actions ──────────────── */

  updateMemberRole: (memberId, newRole) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, role: newRole } : m
      ),
    })),

  suspendMember: (memberId) =>
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId
          ? { ...m, status: "suspended" as const, onlineStatus: "offline" as const }
          : m
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
        m.id === memberId
          ? { ...m, status: "archived" as const, onlineStatus: "offline" as const }
          : m
      ),
    })),

  resendInvite: (memberId) => {
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, lastActive: "Invite resent" } : m
      ),
    }));
    // Call server if it's a real invite
    if (memberId.startsWith("invite-")) {
      const inviteId = memberId.replace("invite-", "");
      resendInviteServer(inviteId);
    }
  },

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

  /* ── Server-backed actions ─────────────────── */

  inviteMemberServer: async (params) => {
    const orgId = get().orgId;
    if (!orgId) return { error: "No organization" };

    const res = await inviteMemberServer({
      organization_id: orgId,
      email: params.email,
      role: params.role,
      branch: params.branch,
    });

    if (!res.error) {
      get().addPendingMember(params.email.split("@")[0], params.email, params.role as RoleId, params.branch || "HQ");
      get().refresh();
    }

    return { error: res.error };
  },

  updateMemberRoleServer: async (userId, role, roleId) => {
    const orgId = get().orgId;
    if (!orgId) return { error: "No organization" };

    // Optimistic
    set((s) => ({
      members: s.members.map((m) =>
        m.id === userId ? { ...m, role: roleEnumToId[role] || ("technician" as RoleId) } : m
      ),
    }));

    const res = await updateMemberRoleServer(orgId, userId, role, roleId);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  suspendMemberServer: async (userId) => {
    const orgId = get().orgId;
    if (!orgId) return { error: "No organization" };

    get().suspendMember(userId);
    const res = await updateMemberDetailsServer(orgId, userId, { status: "suspended" });
    if (res.error) get().refresh();
    return { error: res.error };
  },

  reactivateMemberServer: async (userId) => {
    const orgId = get().orgId;
    if (!orgId) return { error: "No organization" };

    get().reactivateMember(userId);
    const res = await updateMemberDetailsServer(orgId, userId, { status: "active" });
    if (res.error) get().refresh();
    return { error: res.error };
  },

  removeMemberServer: async (userId) => {
    const orgId = get().orgId;
    if (!orgId) return { error: "No organization" };

    get().archiveMember(userId);
    const res = await removeMemberServer(orgId, userId);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  saveRolePermissionsServer: async (roleDbId, permissions, scopes) => {
    const res = await updateRolePermissionsServer(roleDbId, permissions, scopes);
    if (!res.error) get().refresh();
    return { error: res.error };
  },
    }),
    {
      name: "iworkr-team",
      partialize: (state) => ({
        members: state.members,
        roles: state.roles,
        overview: state.overview,
        orgId: state.orgId,
        _lastFetchedAt: state._lastFetchedAt,
      }),
    }
  )
);
