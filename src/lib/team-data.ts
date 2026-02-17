/* ── Team & RBAC Data ──────────────────────────────────── */

export type MemberStatus = "active" | "pending" | "suspended" | "archived";
export type OnlineStatus = "online" | "idle" | "offline";
export type RoleId = "owner" | "manager" | "senior_tech" | "technician" | "apprentice" | "subcontractor" | "office_admin";

export interface Skill {
  id: string;
  label: string;
  icon: string; // lucide icon name
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  avatar?: string;
  role: RoleId;
  branch: string;
  status: MemberStatus;
  onlineStatus: OnlineStatus;
  skills: string[];
  lastActive: string;
  joinedAt: string;
  jobsCompleted: number;
  avgRating: number;
  hourlyRate: number;
  twoFactorEnabled: boolean;
  lastLoginIp: string;
  recentActivity: MemberActivity[];
}

export interface MemberActivity {
  id: string;
  type: "check_in" | "job_complete" | "invoice_update" | "form_signed" | "login" | "role_change";
  text: string;
  time: string;
}

/* ── Permission Matrix ────────────────────────────────── */

export type PermissionModule = "jobs" | "clients" | "finance" | "schedule" | "assets" | "forms" | "team" | "settings" | "integrations";
export type PermissionAction = "view" | "create" | "edit" | "delete" | "export";

export interface RoleDefinition {
  id: RoleId;
  label: string;
  description: string;
  color: string; // tailwind color token
  permissions: Record<PermissionModule, PermissionAction[]>;
  scopes: {
    jobVisibility: "all" | "assigned" | "branch";
    invoiceApproval: boolean;
    canManageTeam: boolean;
  };
}

/* ── Skill Definitions ────────────────────────────────── */

export const skillDefinitions: Skill[] = [
  { id: "plumbing", label: "Plumbing", icon: "Droplets" },
  { id: "electrical", label: "Electrical", icon: "Zap" },
  { id: "gas", label: "Gas Fitting", icon: "Flame" },
  { id: "hvac", label: "HVAC", icon: "Wind" },
  { id: "drainage", label: "Drainage", icon: "Waves" },
  { id: "roofing", label: "Roofing", icon: "Home" },
  { id: "welding", label: "Welding", icon: "Wrench" },
  { id: "carpentry", label: "Carpentry", icon: "Hammer" },
];

/* ── Role Definitions ─────────────────────────────────── */

export const roleDefinitions: RoleDefinition[] = [
  {
    id: "owner",
    label: "Owner",
    description: "Full access to everything. Cannot be removed.",
    color: "owner",
    permissions: {
      jobs: ["view", "create", "edit", "delete", "export"],
      clients: ["view", "create", "edit", "delete", "export"],
      finance: ["view", "create", "edit", "delete", "export"],
      schedule: ["view", "create", "edit", "delete", "export"],
      assets: ["view", "create", "edit", "delete", "export"],
      forms: ["view", "create", "edit", "delete", "export"],
      team: ["view", "create", "edit", "delete", "export"],
      settings: ["view", "create", "edit", "delete", "export"],
      integrations: ["view", "create", "edit", "delete", "export"],
    },
    scopes: { jobVisibility: "all", invoiceApproval: true, canManageTeam: true },
  },
  {
    id: "manager",
    label: "Manager",
    description: "Manages operations, team, and finances.",
    color: "admin",
    permissions: {
      jobs: ["view", "create", "edit", "delete", "export"],
      clients: ["view", "create", "edit", "delete", "export"],
      finance: ["view", "create", "edit", "export"],
      schedule: ["view", "create", "edit", "delete"],
      assets: ["view", "create", "edit", "delete"],
      forms: ["view", "create", "edit", "delete"],
      team: ["view", "create", "edit"],
      settings: ["view", "edit"],
      integrations: ["view", "edit"],
    },
    scopes: { jobVisibility: "all", invoiceApproval: true, canManageTeam: true },
  },
  {
    id: "office_admin",
    label: "Office Admin",
    description: "Handles scheduling, invoicing, and client communication.",
    color: "admin",
    permissions: {
      jobs: ["view", "create", "edit"],
      clients: ["view", "create", "edit"],
      finance: ["view", "create", "edit"],
      schedule: ["view", "create", "edit"],
      assets: ["view"],
      forms: ["view", "create"],
      team: ["view"],
      settings: ["view"],
      integrations: ["view"],
    },
    scopes: { jobVisibility: "all", invoiceApproval: false, canManageTeam: false },
  },
  {
    id: "senior_tech",
    label: "Senior Tech",
    description: "Experienced technician. Can manage their own jobs and mentees.",
    color: "tech",
    permissions: {
      jobs: ["view", "create", "edit"],
      clients: ["view"],
      finance: ["view"],
      schedule: ["view", "edit"],
      assets: ["view", "edit"],
      forms: ["view", "create", "edit"],
      team: ["view"],
      settings: [],
      integrations: [],
    },
    scopes: { jobVisibility: "branch", invoiceApproval: false, canManageTeam: false },
  },
  {
    id: "technician",
    label: "Technician",
    description: "Field tech. Views assigned jobs, tracks time, fills forms.",
    color: "tech",
    permissions: {
      jobs: ["view", "edit"],
      clients: ["view"],
      finance: [],
      schedule: ["view"],
      assets: ["view"],
      forms: ["view", "create"],
      team: [],
      settings: [],
      integrations: [],
    },
    scopes: { jobVisibility: "assigned", invoiceApproval: false, canManageTeam: false },
  },
  {
    id: "apprentice",
    label: "Apprentice",
    description: "Learning. Supervised access only.",
    color: "tech",
    permissions: {
      jobs: ["view"],
      clients: ["view"],
      finance: [],
      schedule: ["view"],
      assets: ["view"],
      forms: ["view"],
      team: [],
      settings: [],
      integrations: [],
    },
    scopes: { jobVisibility: "assigned", invoiceApproval: false, canManageTeam: false },
  },
  {
    id: "subcontractor",
    label: "Subcontractor",
    description: "External contractor. Limited to assigned jobs only.",
    color: "tech",
    permissions: {
      jobs: ["view"],
      clients: [],
      finance: [],
      schedule: ["view"],
      assets: [],
      forms: ["view", "create"],
      team: [],
      settings: [],
      integrations: [],
    },
    scopes: { jobVisibility: "assigned", invoiceApproval: false, canManageTeam: false },
  },
];

/* ── Mock Members ─────────────────────────────────────── */

export const teamMembers: TeamMember[] = [
  {
    id: "mem-1",
    name: "Mike Thompson",
    initials: "MT",
    email: "mike@apexplumbing.com.au",
    phone: "+61 412 345 678",
    role: "owner",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "online",
    skills: ["plumbing", "gas", "drainage"],
    lastActive: "2m ago",
    joinedAt: "Jan 2024",
    jobsCompleted: 284,
    avgRating: 4.9,
    hourlyRate: 95,
    twoFactorEnabled: true,
    lastLoginIp: "103.42.176.89",
    recentActivity: [
      { id: "a1", type: "check_in", text: "Checked in at JOB-401 — Water Heater Install", time: "2m ago" },
      { id: "a2", type: "job_complete", text: "Completed JOB-399 — Blocked Drain", time: "1h ago" },
      { id: "a3", type: "form_signed", text: "Signed Electrical SWMS for JOB-401", time: "2h ago" },
      { id: "a4", type: "invoice_update", text: "Updated Invoice #1384 — $880", time: "3h ago" },
    ],
  },
  {
    id: "mem-2",
    name: "Sarah Chen",
    initials: "SC",
    email: "sarah@apexplumbing.com.au",
    phone: "+61 413 456 789",
    role: "manager",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "online",
    skills: ["plumbing", "hvac"],
    lastActive: "5m ago",
    joinedAt: "Mar 2024",
    jobsCompleted: 198,
    avgRating: 4.8,
    hourlyRate: 85,
    twoFactorEnabled: true,
    lastLoginIp: "103.42.176.92",
    recentActivity: [
      { id: "a1", type: "check_in", text: "Checked in at JOB-406 — Emergency Burst Pipe", time: "5m ago" },
      { id: "a2", type: "job_complete", text: "Completed JOB-405 — AC Install", time: "2h ago" },
      { id: "a3", type: "login", text: "Logged in from Chrome / iOS 17.4", time: "6h ago" },
    ],
  },
  {
    id: "mem-3",
    name: "James O'Brien",
    initials: "JO",
    email: "james@apexplumbing.com.au",
    phone: "+61 414 567 890",
    role: "senior_tech",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "idle",
    skills: ["plumbing", "gas", "welding"],
    lastActive: "15m ago",
    joinedAt: "Jun 2024",
    jobsCompleted: 142,
    avgRating: 4.7,
    hourlyRate: 78,
    twoFactorEnabled: true,
    lastLoginIp: "103.42.176.95",
    recentActivity: [
      { id: "a1", type: "job_complete", text: "Completed JOB-404 — Bathroom Renovation", time: "15m ago" },
      { id: "a2", type: "form_signed", text: "Signed Gas Compliance for JOB-404", time: "20m ago" },
    ],
  },
  {
    id: "mem-4",
    name: "David Park",
    initials: "DP",
    email: "david@apexplumbing.com.au",
    phone: "+61 415 678 901",
    role: "technician",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "online",
    skills: ["plumbing", "drainage"],
    lastActive: "Just now",
    joinedAt: "Sep 2024",
    jobsCompleted: 87,
    avgRating: 4.6,
    hourlyRate: 65,
    twoFactorEnabled: false,
    lastLoginIp: "103.42.176.98",
    recentActivity: [
      { id: "a1", type: "check_in", text: "Checked in at JOB-408 — Drain Clearing", time: "Just now" },
      { id: "a2", type: "form_signed", text: "Signed Daily Safety Checklist", time: "30m ago" },
    ],
  },
  {
    id: "mem-5",
    name: "Tom Liu",
    initials: "TL",
    email: "tom@apexplumbing.com.au",
    phone: "+61 416 789 012",
    role: "technician",
    branch: "Gold Coast",
    status: "active",
    onlineStatus: "offline",
    skills: ["plumbing", "electrical"],
    lastActive: "3h ago",
    joinedAt: "Oct 2024",
    jobsCompleted: 63,
    avgRating: 4.5,
    hourlyRate: 62,
    twoFactorEnabled: false,
    lastLoginIp: "110.18.45.22",
    recentActivity: [
      { id: "a1", type: "job_complete", text: "Completed JOB-407 — HWS Replacement", time: "3h ago" },
    ],
  },
  {
    id: "mem-6",
    name: "Emma Walsh",
    initials: "EW",
    email: "emma@apexplumbing.com.au",
    phone: "+61 417 890 123",
    role: "office_admin",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "online",
    skills: [],
    lastActive: "1m ago",
    joinedAt: "Nov 2024",
    jobsCompleted: 0,
    avgRating: 0,
    hourlyRate: 55,
    twoFactorEnabled: true,
    lastLoginIp: "103.42.176.89",
    recentActivity: [
      { id: "a1", type: "invoice_update", text: "Created Invoice #1390 for Sarah Mitchell", time: "1m ago" },
      { id: "a2", type: "invoice_update", text: "Sent Invoice #1389 — $880", time: "25m ago" },
    ],
  },
  {
    id: "mem-7",
    name: "Ryan Kowalski",
    initials: "RK",
    email: "ryan@apexplumbing.com.au",
    phone: "+61 418 901 234",
    role: "apprentice",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "online",
    skills: ["plumbing"],
    lastActive: "10m ago",
    joinedAt: "Jan 2025",
    jobsCompleted: 24,
    avgRating: 4.3,
    hourlyRate: 32,
    twoFactorEnabled: false,
    lastLoginIp: "103.42.176.101",
    recentActivity: [
      { id: "a1", type: "check_in", text: "Checked in at JOB-401 with Mike Thompson", time: "10m ago" },
    ],
  },
  {
    id: "mem-8",
    name: "Carlos Mendez",
    initials: "CM",
    email: "carlos@cmelectrical.com.au",
    phone: "+61 419 012 345",
    role: "subcontractor",
    branch: "Brisbane HQ",
    status: "active",
    onlineStatus: "offline",
    skills: ["electrical"],
    lastActive: "1d ago",
    joinedAt: "Feb 2025",
    jobsCompleted: 12,
    avgRating: 4.4,
    hourlyRate: 90,
    twoFactorEnabled: false,
    lastLoginIp: "202.14.85.60",
    recentActivity: [
      { id: "a1", type: "job_complete", text: "Completed JOB-395 — Switchboard Upgrade", time: "1d ago" },
    ],
  },
  {
    id: "mem-9",
    name: "Lisa Nakamura",
    initials: "LN",
    email: "lisa@apexplumbing.com.au",
    phone: "+61 420 123 456",
    role: "technician",
    branch: "Gold Coast",
    status: "active",
    onlineStatus: "idle",
    skills: ["plumbing", "gas", "hvac"],
    lastActive: "45m ago",
    joinedAt: "Dec 2024",
    jobsCompleted: 56,
    avgRating: 4.8,
    hourlyRate: 68,
    twoFactorEnabled: true,
    lastLoginIp: "110.18.45.30",
    recentActivity: [
      { id: "a1", type: "check_in", text: "Checked in at JOB-410 — Gas Heater Service", time: "45m ago" },
    ],
  },
  {
    id: "mem-10",
    name: "Alex Turner",
    initials: "AT",
    email: "alex.t@gmail.com",
    phone: "+61 421 234 567",
    role: "technician",
    branch: "Brisbane HQ",
    status: "pending",
    onlineStatus: "offline",
    skills: ["plumbing", "drainage"],
    lastActive: "Never",
    joinedAt: "Feb 2026",
    jobsCompleted: 0,
    avgRating: 0,
    hourlyRate: 60,
    twoFactorEnabled: false,
    lastLoginIp: "—",
    recentActivity: [],
  },
  {
    id: "mem-11",
    name: "Sophie Williams",
    initials: "SW",
    email: "sophie.w@outlook.com",
    phone: "+61 422 345 678",
    role: "apprentice",
    branch: "Gold Coast",
    status: "pending",
    onlineStatus: "offline",
    skills: ["plumbing"],
    lastActive: "Never",
    joinedAt: "Feb 2026",
    jobsCompleted: 0,
    avgRating: 0,
    hourlyRate: 30,
    twoFactorEnabled: false,
    lastLoginIp: "—",
    recentActivity: [],
  },
  {
    id: "mem-12",
    name: "Ben Harrison",
    initials: "BH",
    email: "ben.h@apexplumbing.com.au",
    phone: "+61 423 456 789",
    role: "senior_tech",
    branch: "Brisbane HQ",
    status: "archived",
    onlineStatus: "offline",
    skills: ["plumbing", "gas", "roofing"],
    lastActive: "2w ago",
    joinedAt: "Apr 2024",
    jobsCompleted: 167,
    avgRating: 4.2,
    hourlyRate: 75,
    twoFactorEnabled: false,
    lastLoginIp: "103.42.176.89",
    recentActivity: [
      { id: "a1", type: "role_change", text: "Account archived by Mike Thompson", time: "2w ago" },
    ],
  },
];

/* ── Helpers ───────────────────────────────────────────── */

export function getActiveCount(): number {
  return teamMembers.filter((m) => m.status === "active").length;
}

export function getPendingCount(): number {
  return teamMembers.filter((m) => m.status === "pending").length;
}

export function getRoleLabel(roleId: RoleId): string {
  return roleDefinitions.find((r) => r.id === roleId)?.label || roleId;
}

export function getRoleColor(roleId: RoleId): string {
  return roleDefinitions.find((r) => r.id === roleId)?.color || "zinc";
}

export const branches = ["Brisbane HQ", "Gold Coast"];

export const permissionModules: { id: PermissionModule; label: string }[] = [
  { id: "jobs", label: "Jobs" },
  { id: "clients", label: "Clients" },
  { id: "finance", label: "Finance" },
  { id: "schedule", label: "Schedule" },
  { id: "assets", label: "Assets" },
  { id: "forms", label: "Forms" },
  { id: "team", label: "Team" },
  { id: "settings", label: "Settings" },
  { id: "integrations", label: "Integrations" },
];

export const permissionActions: PermissionAction[] = ["view", "create", "edit", "delete", "export"];
