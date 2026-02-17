/* ── Integrations & Ecosystem Data ──────────────────── */

export type IntegrationCategory = "financial" | "communication" | "storage" | "calendar" | "maps" | "marketing";
export type IntegrationStatus = "connected" | "disconnected" | "error" | "syncing";

export interface SyncSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface AccountMapping {
  id: string;
  label: string;
  value: string;
  options: string[];
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  lastSynced?: string;
  connectedAs?: string;
  brandColor: string;      // primary brand color
  iconBg: string;          // icon background gradient
  /** SVG path or letter abbreviation for the logo */
  logoType: "letter" | "svg";
  logoContent: string;     // letter(s) or SVG path data
  syncSettings?: SyncSetting[];
  accountMappings?: AccountMapping[];
  error?: string;
  features?: string[];
}

export interface IntegrationEvent {
  id: string;
  integrationId: string;
  integrationName: string;
  type: "connected" | "disconnected" | "synced" | "error" | "configured";
  description: string;
  time: string;
}

/* ── Mock Integrations ─────────────────────────────── */

export const integrations: Integration[] = [
  {
    id: "int-stripe",
    name: "Stripe",
    description: "Accept payments, manage subscriptions, and track payouts.",
    category: "financial",
    status: "connected",
    lastSynced: "2m ago",
    connectedAs: "Apex Plumbing Pty Ltd",
    brandColor: "#635BFF",
    iconBg: "from-[#635BFF] to-[#4B45C6]",
    logoType: "letter",
    logoContent: "S",
    syncSettings: [
      { id: "ss-1", label: "Auto-capture payments", description: "Automatically capture authorized payments", enabled: true },
      { id: "ss-2", label: "Send payment receipts", description: "Email receipts to customers after payment", enabled: true },
      { id: "ss-3", label: "Sync payouts to Finance", description: "Automatically record payouts in your ledger", enabled: true },
    ],
    features: ["Payment Links", "Invoicing", "Payouts", "Subscriptions"],
  },
  {
    id: "int-xero",
    name: "Xero",
    description: "Two-way sync invoices, contacts, and chart of accounts.",
    category: "financial",
    status: "connected",
    lastSynced: "15m ago",
    connectedAs: "Apex Plumbing",
    brandColor: "#13B5EA",
    iconBg: "from-[#13B5EA] to-[#0D8CC2]",
    logoType: "letter",
    logoContent: "X",
    syncSettings: [
      { id: "ss-4", label: "Sync Invoices", description: "Push invoices to Xero when sent", enabled: true },
      { id: "ss-5", label: "Sync Contacts", description: "Keep client records in sync", enabled: true },
      { id: "ss-6", label: "Sync Payments", description: "Record payments in Xero automatically", enabled: false },
    ],
    accountMappings: [
      { id: "am-1", label: "Sales Account", value: "200 - Sales", options: ["200 - Sales", "210 - Service Revenue", "220 - Consulting", "230 - Other Revenue"] },
      { id: "am-2", label: "Payments Account", value: "090 - Business Bank", options: ["090 - Business Bank", "091 - Savings Account", "092 - Stripe Clearing"] },
      { id: "am-3", label: "Expense Account", value: "400 - Cost of Goods", options: ["400 - Cost of Goods", "410 - Materials", "420 - Subcontractor Costs"] },
    ],
    features: ["Invoice Sync", "Contact Sync", "Bank Feeds", "Reports"],
  },
  {
    id: "int-quickbooks",
    name: "QuickBooks",
    description: "Connect to QuickBooks Online for accounting sync.",
    category: "financial",
    status: "disconnected",
    brandColor: "#2CA01C",
    iconBg: "from-[#2CA01C] to-[#1D7513]",
    logoType: "letter",
    logoContent: "QB",
    features: ["Invoice Sync", "Contact Sync", "Expense Tracking"],
  },
  {
    id: "int-myob",
    name: "MYOB",
    description: "Australian accounting software integration.",
    category: "financial",
    status: "disconnected",
    brandColor: "#6B21A8",
    iconBg: "from-[#6B21A8] to-[#4C1D7A]",
    logoType: "letter",
    logoContent: "M",
    features: ["Invoice Sync", "Payroll", "Tax Reporting"],
  },
  {
    id: "int-gmail",
    name: "Gmail",
    description: "Two-way email sync. Pull threads into client dossiers.",
    category: "communication",
    status: "connected",
    lastSynced: "Just now",
    connectedAs: "admin@apexplumbing.com.au",
    brandColor: "#EA4335",
    iconBg: "from-[#EA4335] to-[#C5221F]",
    logoType: "letter",
    logoContent: "G",
    syncSettings: [
      { id: "ss-7", label: "Thread Sync", description: "Pull emails matching client addresses into their dossier", enabled: true },
      { id: "ss-8", label: "Send As", description: "Send emails from iWorkr using your Gmail address", enabled: true },
    ],
    features: ["Thread Sync", "Send As", "Contact Match", "Attachments"],
  },
  {
    id: "int-outlook",
    name: "Outlook",
    description: "Microsoft 365 email and calendar integration.",
    category: "communication",
    status: "disconnected",
    brandColor: "#0078D4",
    iconBg: "from-[#0078D4] to-[#005A9E]",
    logoType: "letter",
    logoContent: "O",
    features: ["Email Sync", "Calendar Sync", "Contact Sync"],
  },
  {
    id: "int-slack",
    name: "Slack",
    description: "Get notifications and updates in your Slack channels.",
    category: "communication",
    status: "connected",
    lastSynced: "5m ago",
    connectedAs: "#apex-plumbing",
    brandColor: "#E01E5A",
    iconBg: "from-[#E01E5A] to-[#ECB22E]",
    logoType: "letter",
    logoContent: "S",
    syncSettings: [
      { id: "ss-9", label: "Job Notifications", description: "Post new job assignments to Slack", enabled: true },
      { id: "ss-10", label: "Invoice Alerts", description: "Notify when invoices are paid", enabled: false },
    ],
    features: ["Notifications", "Commands", "File Sharing"],
  },
  {
    id: "int-twilio",
    name: "Twilio",
    description: "SMS notifications and two-way messaging with clients.",
    category: "communication",
    status: "error",
    brandColor: "#F22F46",
    iconBg: "from-[#F22F46] to-[#CC1833]",
    logoType: "letter",
    logoContent: "T",
    error: "Auth token expired. Re-authenticate to resume SMS delivery.",
    features: ["SMS Alerts", "Two-way Chat", "Broadcasts"],
  },
  {
    id: "int-gdrive",
    name: "Google Drive",
    description: "Store job photos, documents, and compliance certs.",
    category: "storage",
    status: "connected",
    lastSynced: "1h ago",
    connectedAs: "admin@apexplumbing.com.au",
    brandColor: "#4285F4",
    iconBg: "from-[#4285F4] to-[#0D47A1]",
    logoType: "letter",
    logoContent: "D",
    syncSettings: [
      { id: "ss-11", label: "Auto-upload photos", description: "Upload job photos to shared Drive folder", enabled: true },
      { id: "ss-12", label: "Compliance docs", description: "Store compliance certificates automatically", enabled: true },
    ],
    features: ["Photo Backup", "Document Storage", "Shared Folders"],
  },
  {
    id: "int-dropbox",
    name: "Dropbox",
    description: "Cloud file storage and sharing.",
    category: "storage",
    status: "disconnected",
    brandColor: "#0061FF",
    iconBg: "from-[#0061FF] to-[#004AC7]",
    logoType: "letter",
    logoContent: "D",
    features: ["File Sync", "Shared Links", "Team Folders"],
  },
  {
    id: "int-gcal",
    name: "Google Calendar",
    description: "Sync jobs and appointments to Google Calendar.",
    category: "calendar",
    status: "connected",
    lastSynced: "10m ago",
    connectedAs: "admin@apexplumbing.com.au",
    brandColor: "#4285F4",
    iconBg: "from-[#4285F4] to-[#1A73E8]",
    logoType: "letter",
    logoContent: "C",
    syncSettings: [
      { id: "ss-13", label: "Push jobs to calendar", description: "Create calendar events for scheduled jobs", enabled: true },
      { id: "ss-14", label: "Two-way sync", description: "Changes in Google Calendar update iWorkr", enabled: false },
    ],
    features: ["Job Sync", "Event Creation", "Reminders"],
  },
  {
    id: "int-gmaps",
    name: "Google Maps",
    description: "Route optimization, geocoding, and live tracking.",
    category: "maps",
    status: "connected",
    lastSynced: "Live",
    brandColor: "#34A853",
    iconBg: "from-[#34A853] to-[#0F9D58]",
    logoType: "letter",
    logoContent: "M",
    syncSettings: [
      { id: "ss-15", label: "Geocode addresses", description: "Auto-convert addresses to coordinates", enabled: true },
      { id: "ss-16", label: "Route optimization", description: "Calculate optimal routes for technicians", enabled: true },
    ],
    features: ["Geocoding", "Routing", "Live Tracking", "Distance Matrix"],
  },
  {
    id: "int-ghl",
    name: "GoHighLevel",
    description: "Lead ingestion and automated review requests.",
    category: "marketing",
    status: "disconnected",
    brandColor: "#FF6B35",
    iconBg: "from-[#FF6B35] to-[#E85D26]",
    logoType: "letter",
    logoContent: "GHL",
    syncSettings: [
      { id: "ss-17", label: "Sync Leads", description: "Import leads from GHL pipelines into iWorkr clients", enabled: true },
      { id: "ss-18", label: "Review Trigger", description: "Send review request via GHL when a job is completed", enabled: true },
    ],
    accountMappings: [
      { id: "am-4", label: "Pipeline", value: "Default Pipeline", options: ["Default Pipeline", "Sales Pipeline", "Service Pipeline"] },
      { id: "am-5", label: "Lead Status Mapping", value: "Won → Active", options: ["Won → Active", "Lost → Archived", "New → Lead"] },
    ],
    features: ["Lead Import", "Review Requests", "Pipeline Sync", "Contact Merge"],
  },
  {
    id: "int-ocal",
    name: "Outlook Calendar",
    description: "Sync jobs to Microsoft 365 Calendar.",
    category: "calendar",
    status: "disconnected",
    brandColor: "#0078D4",
    iconBg: "from-[#0078D4] to-[#005A9E]",
    logoType: "letter",
    logoContent: "OC",
    features: ["Job Sync", "Busy Blocks", "Event Creation"],
  },
];

/* ── Mock Event Log ────────────────────────────────── */

export const integrationEvents: IntegrationEvent[] = [
  { id: "ie-1", integrationId: "int-stripe", integrationName: "Stripe", type: "synced", description: "Payout $7,587.00 synced to Finance", time: "2m ago" },
  { id: "ie-2", integrationId: "int-xero", integrationName: "Xero", type: "synced", description: "3 invoices pushed to Xero", time: "15m ago" },
  { id: "ie-3", integrationId: "int-gmail", integrationName: "Gmail", type: "synced", description: "12 threads matched to clients", time: "30m ago" },
  { id: "ie-4", integrationId: "int-twilio", integrationName: "Twilio", type: "error", description: "Auth token expired — SMS delivery paused", time: "1h ago" },
  { id: "ie-5", integrationId: "int-slack", integrationName: "Slack", type: "synced", description: "Job notification posted to #dispatch", time: "2h ago" },
  { id: "ie-6", integrationId: "int-gdrive", integrationName: "Google Drive", type: "synced", description: "8 photos uploaded to Job-401 folder", time: "3h ago" },
  { id: "ie-7", integrationId: "int-gcal", integrationName: "Google Calendar", type: "synced", description: "4 jobs synced to Mike Thompson's calendar", time: "5h ago" },
  { id: "ie-8", integrationId: "int-stripe", integrationName: "Stripe", type: "connected", description: "Stripe Connect onboarding completed", time: "2d ago" },
];

/* ── Helpers ────────────────────────────────────────── */

export function getConnectedCount(): number {
  return integrations.filter((i) => i.status === "connected").length;
}

export function getErrorCount(): number {
  return integrations.filter((i) => i.status === "error").length;
}

export function getCategoryLabel(cat: IntegrationCategory): string {
  const labels: Record<IntegrationCategory, string> = {
    financial: "Financial",
    communication: "Communication",
    storage: "Storage",
    calendar: "Calendar",
    maps: "Maps & Location",
    marketing: "Marketing & Automation",
  };
  return labels[cat];
}
