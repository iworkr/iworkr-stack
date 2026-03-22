/**
 * @module IndustryLexicon
 * @status COMPLETE
 * @description Maps trade-specific UI labels to care-specific labels based on workspace industry type
 * @lastAudit 2026-03-22
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
  "Add Lead": "Add Referral",
  "Add New Lead": "Add New Referral",
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
  "Job Locations": "Participant Locations",
  "Active Techs": "Support Workers",
  "Job Sites": "Participant Homes",
  "Active Jobs": "Active Shifts",

  // Team
  "On Job": "On Shift",
  "En Route": "Travelling",

  // General
  "job site": "participant home",
  "Job Site": "Participant Home",
  Backlog: "Unassigned",

  // Revenue / Finance widget
  "Revenue MTD": "Funding MTD",
  "Revenue": "Funding",
  revenue: "funding",
  "REVENUE MTD": "FUNDING MTD",
  "Total Revenue": "Total Funding",

  // Dispatch widget empty states
  "No active dispatches": "No workers assigned",
  "No active dispatches.": "No workers assigned.",

  // AI Insight widget
  "Schedule looks optimized": "Roster looks optimized",
  "All jobs are assigned and invoices are up to date. Your operations are running smoothly.":
    "All shifts are assigned and claims are up to date. Your care operations are running smoothly.",

  // Clients / Participants empty state
  "No clients yet": "No participants yet",
  "No clients match": "No participants match",
  "Add your first client to start building your CRM.":
    "Add your first participant to start building your records.",
  "Add First Client": "Add First Participant",
  "Search clients, emails, phones...": "Search participants, emails, phones...",
  "No email configured": "No email configured",

  // Assets page
  "ASSET COMMAND": "CARE EQUIPMENT",
  "Fleet Value": "Equipment Value",
  "FLEET VALUE": "EQUIPMENT VALUE",
  "Fleet & Tools": "Equipment & Supplies",
  "The depot is empty": "No care equipment tracked",
  "Assets will appear here once added.": "Track mobility aids, medical devices, and assistive technology for your participants.",
  "Add First Asset": "Add Equipment",
  "Low Stock": "Low Stock",
  Tools: "Medical Devices",
  Equipment: "Mobility Aids",
  "Service Due": "Calibration Due",
  "assigned to job": "assigned to shift",

  // Forms page
  "Safety checks": "Care plans",
  "Field inspections": "Risk assessments",
  "Digital signatures": "Progress notes",
  "No forms deployed": "No forms deployed",
  "Build your first digital blueprint for forensic traceability.":
    "Build your first care form for compliance and documentation.",

  // Automations page
  "Automate the Boring Stuff.": "Automate Care Workflows.",
  "Build logic flows that send reminders, chase invoices, and notify your team — all on autopilot.":
    "Build logic flows that send shift reminders, follow up on claims, and notify your support team — all on autopilot.",
  "Automate the Boring Stuff": "Automate Care Workflows",
  "Handle 10x jobs without 10x effort": "Handle 10x shifts without 10x effort",
  "Jobs created from phone calls": "Shifts created from phone calls",
  "Zero missed leads, ever": "Zero missed referrals, ever",
  "Technician efficiency metrics": "Support worker efficiency metrics",
  "Client LTV": "Participant Funding",
  "Scale with Automations": "Scale with Automations",
  "Put your business on autopilot. Save 20+ hours a week.":
    "Put your care operations on autopilot. Save 20+ hours a week.",

  // AI Agent page
  "AI Workforce Hub": "AI Care Hub",
  "Deploy synthetic receptionists and automated dispatchers to scale your operations without scaling payroll.":
    "Deploy synthetic receptionists and automated care coordinators to scale your operations without scaling payroll.",
  "The Synthetic Roster": "The Synthetic Care Team",
  "Deploy synthetic agents to automate your operations.":
    "Deploy synthetic agents to automate your care coordination.",
  "Dispatch Copilot": "Roster Copilot",
  "Analyzes schedule density and suggests optimal routing and reassignment to reduce windshield time.":
    "Analyzes roster density and suggests optimal scheduling and reassignment to improve coverage.",
  "Answers calls 24/7, books jobs, and handles FAQs via Vapi/Twilio.":
    "Answers calls 24/7, books shifts, and handles FAQs via Vapi/Twilio.",
  "qualifying leads into the Triage inbox.":
    "qualifying referral leads into the Triage inbox.",
  "texts clients for reviews 24hrs post-job.":
    "texts participants for feedback 24hrs post-shift.",

  // Integrations page
  "Scale with Integrations": "Scale with Integrations",
  "Connected Tools": "Connected Systems",
  "Connect your workspace to your favourite tools — Stripe, Xero, and more.":
    "Connect your workspace to NDIS portals, Stripe, Xero, and more.",

  // Settings sidebar
  JOBS: "SHIFTS",

  // ── Phase 4: Full natural parity ─────────────────────────────────────────

  // Finance page hardcoded labels
  FINANCE: "FUNDING",
  Finance: "Funding",
  finance: "funding",
  "Total Revenue MTD": "Total Funding MTD",
  Payouts: "Payouts",
  Outstanding: "Outstanding Claims",
  Overdue: "Overdue Claims",
  "NDIS Claims": "NDIS Claims",
  "Start earning.": "Submit your first NDIS claim to begin tracking funding.",

  // Job status labels (visible on jobs/shifts page)
  // NOTE: "En Route" and "Backlog" already defined above — not duplicated here
  Draft: "Unrostered",
  draft: "unrostered",
  "On Site": "On Location",
  "On site": "On location",
  Invoiced: "Claimed",
  invoiced: "claimed",
  "In Progress": "Active",
  Scheduled: "Rostered",
  scheduled: "rostered",
  backlog: "unassigned",
  Done: "Completed",
  done: "completed",
  "To Do": "To Do",

  // Invoice / Claim builder labels
  "Line Items": "Support Items",
  "line items": "support items",
  "Send Invoice": "Submit Claim",
  "Save Draft": "Save Draft",
  "Invoice Details": "Claim Details",
  "Invoice #": "Claim #",
  "Bill To": "Claim For",
  "Submit Claim": "Submit Claim",
  "New line item": "New support item",
  "Add line item": "Add support item",
  "Payment Status": "Funding Status",

  // Context menu items
  "Open Invoice": "Open Claim",
  "Void Invoice": "Void Claim",
  "Copy Link": "Copy Link",

  // Schedule page
  "No location set for this job": "No location set for this shift",
  "No blocks scheduled": "No shifts rostered",

  // Settings sections
  Branches: "Service Regions",
  branches: "service regions",
  Templates: "Templates",
  Statuses: "Statuses",
  Workflow: "Workflow",
  Administration: "Administration",

  // Team roles (displayed in team page, sidebar, widgets)
  // NOTE: "Senior Tech", Apprentice, Subcontractor, Technician already defined above — not duplicated
  "Office Admin": "Care Coordinator",
  "office_admin": "Care Coordinator",
  "Experienced technician. Can manage their own jobs and mentees.":
    "Experienced support worker. Can manage their own shifts and mentees.",
  "Field tech. Views assigned jobs, tracks time, fills forms.":
    "Support worker. Views assigned shifts, tracks time, fills progress notes.",
  "Learning. Supervised access only.":
    "Trainee. Supervised access only.",
  "Handles scheduling, invoicing, and client communication.":
    "Handles rostering, claiming, and participant coordination.",
  "Manages operations, team, and finances.":
    "Manages care operations, support team, and funding.",
  "External contractor with limited access.":
    "Agency worker with limited access.",

  // Skill definitions
  Plumbing: "Personal Care",
  Electrical: "Community Access",
  "Gas Fitting": "Behaviour Support",
  HVAC: "Allied Health",
  Drainage: "Social Support",
  Roofing: "Transport",
  Welding: "Meal Preparation",
  Carpentry: "Domestic Assistance",

  // Live indicator
  Live: "Live",

  // Jobs/Shifts page empty state
  "No jobs yet": "No shifts rostered",
  "Create your first job to start tracking work.":
    "Create a shift to get started with participant support.",
  "No jobs match your filters": "No shifts match your filters",

  // Clients/Participants page context menu
  "View Care Plan": "View Care Plan",
  "View Funding": "View Funding",

  // Credentials page
  "Team Credentials": "Worker Credentials",
  "Workforce Credentials": "Worker Credentials",
  "Add team member credentials to track compliance.":
    "Add worker credentials such as NDIS Screening, First Aid, or WWCC to track compliance.",
  "Add Credential": "Add Credential",

  // Forms CTA
  "New Form": "Create Care Form",
  "Create Form": "Create Care Form",

  // Misc hardcoded labels
  "No clients match your search": "No participants match your search",
  "job order": "shift",
  "Job #": "Shift #",
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
