/**
 * Industry Lexicon — Project Nightingale
 *
 * Maps trade-specific UI labels to care-specific labels based on the
 * workspace's `industry_type` setting. For "trades" workspaces, all
 * labels pass through unchanged (zero regression).
 *
 * Usage:
 *   const { t, isCare } = useIndustryLexicon();
 *   return <Button>Create New {t("Job")}</Button>;
 *   // Trades → "Create New Job"
 *   // Care   → "Create New Shift"
 */

import { useAuthStore } from "@/lib/auth-store";

// ─── Nomenclature Dictionary ────────────────────────────────────────────────

const CARE_LEXICON: Record<string, string> = {
  // Core entities
  Job: "Shift",
  Jobs: "Shifts",
  job: "shift",
  jobs: "shifts",
  Client: "Participant",
  Clients: "Participants",
  client: "participant",
  clients: "participants",
  Quote: "Service Agreement",
  Quotes: "Service Agreements",
  quote: "service agreement",
  quotes: "service agreements",
  Technician: "Support Worker",
  Technicians: "Support Workers",
  technician: "support worker",
  technicians: "support workers",
  Techs: "Workers",
  techs: "workers",
  Invoice: "Claim",
  Invoices: "Claims",
  invoice: "claim",
  invoices: "claims",

  // Navigation & UI labels
  "My Jobs": "My Shifts",
  Dispatch: "Roster",
  Dispatcher: "Roster Coordinator",
  Team: "Support Team",
  "Your Team": "Your Support Team",

  // Actions & descriptions
  "Create Job": "Create Shift",
  "New Job": "New Shift",
  "New Invoice": "New Claim",
  "Add Client": "Add Participant",
  "Create a new job order": "Create a new shift",
  "Generate a new invoice": "Generate a new claim",
  "Register a new client": "Register a new participant",
  "Go to Jobs": "Go to Shifts",
  "Go to Clients": "Go to Participants",
  "Go to Team": "Go to Support Team",

  // Schedule
  Schedule: "Roster",
  schedule: "roster",
  "Tactical Timeline": "Roster Timeline",

  // Team roles
  "Senior Tech": "Senior Support Worker",
  senior_tech: "Senior Support Worker",
  Apprentice: "Trainee",
  apprentice: "trainee",
  Subcontractor: "Agency Worker",
  subcontractor: "agency worker",

  // Finance
  "Sales Pipeline": "Referral Pipeline",
  "sales pipeline": "referral pipeline",

  // Widget library labels & descriptions
  "Live Dispatch": "Live Roster",
  "My Schedule": "My Roster",
  "Team Status": "Support Team Status",
  "Real-time technician locations": "Real-time support worker locations",
  "Today's job schedule": "Today\u2019s shift roster",
  "Create jobs, invoices, clients": "Create shifts, claims, participants",

  // Dashboard
  "COMMAND CENTER": "CARE CENTER",
  "Command Center": "Care Center",
  Dashboard: "Care Dashboard",
  "active jobs": "active shifts",
  "active job": "active shift",

  // CRM / Pipeline
  Deal: "Referral",
  Deals: "Referrals",
  deal: "referral",
  deals: "referrals",
  Lead: "Referral Lead",
  Leads: "Referral Leads",
  "New Lead": "New Referral Lead",
  "new lead": "new referral lead",
  "New Deal": "New Referral",
  Pipeline: "Referral Pipeline",
  "Add Lead": "Add Referral Lead",
  "Add New Lead": "Add New Referral Lead",
  "No closed deals yet": "No closed referrals yet",
  "Closed deals appear here. Keep it up!": "Closed referrals appear here. Keep it up!",
  "Review lost deals to improve your close rate.": "Review lost referrals to improve your intake rate.",
  "Add your first lead to get the pipeline started.": "Add your first referral lead to get the pipeline started.",
  "New leads land here": "New referral leads land here",
  "Drag leads here once you've started quoting.": "Drag referral leads here once you've started quoting.",
  "Quotes sent to clients will appear here.": "Agreements sent to participants will appear here.",
  "No active quotes": "No active agreements",
  "No pending approvals": "No pending approvals",
  "No lost opportunities": "No lost referrals",
  "Add a new prospect to your sales pipeline": "Add a new referral to your pipeline",

  // Clients page
  VIP: "Priority",
  "Client Dossier": "Participant Profile",
  Residential: "Home Care",
  Commercial: "Facility",
  LTV: "Funding",
  "Total LTV": "Total Funding",
  "Open Dossier": "Open Profile",

  // Dispatch
  "Fleet Command": "Roster Command",
  "God Mode Dispatch": "Live Roster",
  "Fleet Tracking": "Worker Tracking",
  fleet: "workers",

  // Team
  "On Job": "On Shift",
  "En Route": "Travelling",

  // General
  "job site": "participant home",
  "Job Site": "Participant Home",
  Backlog: "Unassigned",
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export type IndustryType = "trades" | "care";

export interface IndustryLexicon {
  /** Translate a label. Returns the original key for trades workspaces. */
  t: (key: string) => string;
  /** True if the current workspace is a care-sector workspace. */
  isCare: boolean;
  /** The raw industry type value. */
  industryType: IndustryType;
}

/**
 * Hook: reads the current org's `industry_type` and returns a translation
 * function `t()` that maps trades labels to care labels.
 *
 * For trades workspaces (the default), `t()` is a pass-through — it returns
 * the exact key you give it. Zero regression risk.
 */
export function useIndustryLexicon(): IndustryLexicon {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const industryType: IndustryType =
    (currentOrg as Record<string, unknown> | null)?.industry_type === "care"
      ? "care"
      : "trades";
  const isCare = industryType === "care";

  const t = (key: string): string => {
    if (!isCare) return key;
    return CARE_LEXICON[key] ?? key;
  };

  return { t, isCare, industryType };
}

/**
 * Non-hook utility: get the industry type from an org object directly.
 * Useful in server actions or non-React contexts.
 */
export function getIndustryType(
  org: Record<string, unknown> | null | undefined
): IndustryType {
  return org?.industry_type === "care" ? "care" : "trades";
}

/**
 * Non-hook utility: translate a label given an industry type.
 */
export function translateLabel(
  key: string,
  industryType: IndustryType
): string {
  if (industryType !== "care") return key;
  return CARE_LEXICON[key] ?? key;
}
