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
  "Add Client": "Add Participant",
  "Go to Jobs": "Go to Shifts",
  "Go to Clients": "Go to Participants",
  "Go to Team": "Go to Support Team",

  // Schedule
  Schedule: "Roster",
  "Tactical Timeline": "Roster Timeline",

  // Team roles
  "Senior Tech": "Senior Support Worker",
  Apprentice: "Trainee",
  Subcontractor: "Agency Worker",

  // Finance
  "Sales Pipeline": "Referral Pipeline",
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
