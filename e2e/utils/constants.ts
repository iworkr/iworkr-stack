/** Golden User (Admin) — Project Panopticon / full coverage runs */
export const GOLDEN_EMAIL = "theo.caleb.lewis@gmail.com";
export const GOLDEN_PASSWORD = "lowerUPPER#123";

export const TEST_EMAIL = "qa-test@iworkrapp.com";
export const TEST_PASSWORD = "QATestPass123!";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", testId: "nav_dashboard" },
  { label: "Messages", href: "/dashboard/inbox", testId: "nav_inbox" },
  { label: "My Jobs", href: "/dashboard/jobs", testId: "nav_jobs" },
  { label: "Schedule", href: "/dashboard/schedule", testId: "nav_schedule" },
  { label: "Dispatch", href: "/dashboard/dispatch", testId: "nav_dispatch" },
  { label: "Clients", href: "/dashboard/clients", testId: "nav_clients" },
  { label: "Sales Pipeline", href: "/dashboard/crm", testId: "nav_crm" },
  { label: "Finance", href: "/dashboard/finance", testId: "nav_invoices" },
  { label: "Assets", href: "/dashboard/assets", testId: "nav_assets" },
  { label: "Forms", href: "/dashboard/forms", testId: "nav_forms" },
  { label: "Team", href: "/dashboard/team", testId: "nav_team" },
  { label: "Automations", href: "/dashboard/automations", testId: "nav_automations" },
  { label: "Integrations", href: "/dashboard/integrations", testId: "nav_integrations" },
  { label: "AI Agent", href: "/dashboard/ai-agent", testId: "nav_ai_agent" },
] as const;

export const SETTINGS_ROUTES = [
  { label: "Preferences", href: "/settings/preferences" },
  { label: "Profile", href: "/settings/profile" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Security", href: "/settings/security" },
  { label: "Connected", href: "/settings/connected" },
  { label: "Workspace", href: "/settings/workspace" },
  { label: "Members", href: "/settings/members" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Integrations", href: "/settings/integrations" },
  { label: "Branches", href: "/settings/branches" },
  { label: "Developer", href: "/settings/developers" },
  { label: "Import", href: "/settings/import" },
  { label: "Labels", href: "/settings/labels" },
  { label: "Templates", href: "/settings/templates" },
  { label: "Statuses", href: "/settings/statuses" },
  { label: "Workflow", href: "/settings/workflow" },
] as const;

/** Core (dashboard) protected routes — used by smoke-core.spec.ts */
export const PROTECTED_ROUTES_CORE = [
  "/dashboard",
  "/dashboard/inbox",
  "/dashboard/jobs",
  "/dashboard/schedule",
  "/dashboard/clients",
  "/dashboard/finance",
  "/dashboard/assets",
  "/dashboard/forms",
  "/dashboard/team",
  "/dashboard/automations",
  "/dashboard/integrations",
  "/dashboard/ai-agent",
  "/dashboard/get-app",
  "/dashboard/help",
] as const;

/** Settings protected routes — used by smoke-settings.spec.ts (longer timeout) */
export const PROTECTED_ROUTES_SETTINGS = [
  "/settings",
  "/settings/preferences",
  "/settings/profile",
  "/settings/notifications",
  "/settings/security",
  "/settings/connected",
  "/settings/workspace",
  "/settings/members",
  "/settings/billing",
  "/settings/integrations",
  "/settings/branches",
  "/settings/developers",
  "/settings/import",
  "/settings/labels",
  "/settings/templates",
  "/settings/statuses",
  "/settings/workflow",
] as const;

export const ALL_PROTECTED_ROUTES = [
  ...PROTECTED_ROUTES_CORE,
  ...PROTECTED_ROUTES_SETTINGS,
] as const;

export const PUBLIC_ROUTES = [
  "/",
  "/auth",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
] as const;
