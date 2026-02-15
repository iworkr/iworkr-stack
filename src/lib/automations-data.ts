/* ── Automations & Logic Engine Data ───────────────────── */

export type FlowStatus = "active" | "paused" | "draft" | "archived";
export type FlowCategory = "marketing" | "billing" | "operations";
export type BlockType = "trigger" | "delay" | "action" | "condition";
export type ActionChannel = "sms" | "email" | "webhook" | "internal";
export type ExecutionStatus = "success" | "failed" | "skipped";

export interface FlowBlock {
  id: string;
  type: BlockType;
  label: string;
  config: Record<string, string>;
  /* trigger: event, entity; delay: duration; action: channel, template; condition: field, operator, value */
}

export interface AutomationFlow {
  id: string;
  title: string;
  description: string;
  category: FlowCategory;
  status: FlowStatus;
  version: number;
  icon: string; // lucide icon name
  blocks: FlowBlock[];
  metrics: {
    runs24h: number;
    successRate: number;
    openRate?: number;
    replies?: number;
  };
  sparkline: number[]; // 24 data points for last 24h
  createdBy: string;
  lastEdited: string;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  flowId: string;
  flowTitle: string;
  timestamp: string;
  triggerSource: string;
  status: ExecutionStatus;
  errorMessage?: string;
  duration: string;
}

export interface FlowTemplate {
  id: string;
  title: string;
  description: string;
  category: FlowCategory;
  icon: string;
  blocks: FlowBlock[];
  popular: boolean;
}

/* ── Mock Automation Flows ─────────────────────────────── */

export const automationFlows: AutomationFlow[] = [
  {
    id: "flow-1",
    title: "Review Request Sequence",
    description: "Sends a review request SMS 2 hours after job completion.",
    category: "marketing",
    status: "active",
    version: 3,
    icon: "Star",
    blocks: [
      { id: "b1", type: "trigger", label: "Job Status → Completed", config: { event: "status_change", entity: "job", value: "completed" } },
      { id: "b2", type: "delay", label: "Wait 2 Hours", config: { duration: "2h" } },
      { id: "b3", type: "action", label: "Send SMS to Client", config: { channel: "sms", template: "Hi {Client.FirstName}, thanks for choosing {Company.Name}! We'd love your feedback: {Review.Link}" } },
    ],
    metrics: { runs24h: 8, successRate: 94, openRate: 45, replies: 12 },
    sparkline: [2, 1, 3, 0, 1, 2, 4, 3, 1, 0, 0, 1, 2, 3, 5, 4, 2, 1, 3, 2, 1, 0, 2, 1],
    createdBy: "Mike Thompson",
    lastEdited: "2h ago",
    createdAt: "Jan 2025",
  },
  {
    id: "flow-2",
    title: "Invoice Chaser",
    description: "Auto-follow up on unpaid invoices after 7 days.",
    category: "billing",
    status: "active",
    version: 2,
    icon: "Receipt",
    blocks: [
      { id: "b1", type: "trigger", label: "Invoice Status → Overdue", config: { event: "status_change", entity: "invoice", value: "overdue" } },
      { id: "b2", type: "delay", label: "Wait 7 Days", config: { duration: "7d" } },
      { id: "b3", type: "condition", label: "If Invoice Value > $500", config: { field: "invoice.total", operator: "gt", value: "500" } },
      { id: "b4", type: "action", label: "Send VIP Follow-up Email", config: { channel: "email", template: "Hi {Client.FirstName}, your invoice #{Invoice.Number} for {Invoice.Total} is now 7 days overdue..." } },
      { id: "b5", type: "action", label: "Send Standard Reminder", config: { channel: "email", template: "Hi {Client.FirstName}, a friendly reminder about invoice #{Invoice.Number}..." } },
    ],
    metrics: { runs24h: 3, successRate: 88, openRate: 62 },
    sparkline: [1, 0, 0, 1, 2, 0, 1, 0, 0, 0, 1, 1, 2, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0],
    createdBy: "Emma Walsh",
    lastEdited: "1d ago",
    createdAt: "Mar 2025",
  },
  {
    id: "flow-3",
    title: "Job Reminder — 24h",
    description: "SMS reminder to client 24 hours before scheduled job.",
    category: "operations",
    status: "active",
    version: 1,
    icon: "Clock",
    blocks: [
      { id: "b1", type: "trigger", label: "Schedule → 24h Before Job", config: { event: "schedule_before", entity: "job", value: "24h" } },
      { id: "b2", type: "action", label: "Send SMS to Client", config: { channel: "sms", template: "Hi {Client.FirstName}, just a reminder that {Tech.FirstName} will be arriving tomorrow at {Job.Time} for your {Job.Title}." } },
    ],
    metrics: { runs24h: 12, successRate: 100 },
    sparkline: [1, 0, 1, 2, 1, 0, 1, 1, 0, 0, 1, 2, 1, 0, 1, 1, 2, 0, 1, 0, 1, 1, 0, 1],
    createdBy: "Sarah Chen",
    lastEdited: "3d ago",
    createdAt: "Feb 2025",
  },
  {
    id: "flow-4",
    title: "Technician Assignment Alert",
    description: "Push notification to tech when assigned a new job.",
    category: "operations",
    status: "active",
    version: 1,
    icon: "UserCheck",
    blocks: [
      { id: "b1", type: "trigger", label: "Job → Assigned to Technician", config: { event: "assignment", entity: "job", value: "assigned" } },
      { id: "b2", type: "action", label: "Send Push to Technician", config: { channel: "internal", template: "New job assigned: {Job.Title} at {Job.Address}. Scheduled for {Job.Date}." } },
    ],
    metrics: { runs24h: 6, successRate: 100 },
    sparkline: [0, 1, 0, 1, 1, 0, 0, 1, 2, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    createdBy: "Mike Thompson",
    lastEdited: "1w ago",
    createdAt: "Dec 2024",
  },
  {
    id: "flow-5",
    title: "Quote Follow-Up",
    description: "Email follow-up 3 days after quote sent if not accepted.",
    category: "marketing",
    status: "active",
    version: 2,
    icon: "FileText",
    blocks: [
      { id: "b1", type: "trigger", label: "Quote Status → Sent", config: { event: "status_change", entity: "quote", value: "sent" } },
      { id: "b2", type: "delay", label: "Wait 3 Days", config: { duration: "3d" } },
      { id: "b3", type: "condition", label: "If Quote Status ≠ Accepted", config: { field: "quote.status", operator: "neq", value: "accepted" } },
      { id: "b4", type: "action", label: "Send Follow-up Email", config: { channel: "email", template: "Hi {Client.FirstName}, just checking in about the quote we sent for {Quote.Title}. Happy to answer any questions!" } },
    ],
    metrics: { runs24h: 2, successRate: 92, openRate: 38 },
    sparkline: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    createdBy: "Emma Walsh",
    lastEdited: "5d ago",
    createdAt: "Jan 2025",
  },
  {
    id: "flow-6",
    title: "Low Stock Alert",
    description: "Notify office when inventory drops below reorder point.",
    category: "operations",
    status: "active",
    version: 1,
    icon: "Package",
    blocks: [
      { id: "b1", type: "trigger", label: "Stock Level → Below Reorder Point", config: { event: "threshold", entity: "stock", value: "below_reorder" } },
      { id: "b2", type: "action", label: "Send Email to Office", config: { channel: "email", template: "{Stock.Name} (SKU: {Stock.SKU}) is running low — {Stock.CurrentQty} remaining. Reorder point: {Stock.ReorderPoint}." } },
    ],
    metrics: { runs24h: 4, successRate: 100 },
    sparkline: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
    createdBy: "Sarah Chen",
    lastEdited: "2w ago",
    createdAt: "Nov 2024",
  },
  {
    id: "flow-7",
    title: "Welcome Onboard Email",
    description: "Send welcome pack email when new client is created.",
    category: "marketing",
    status: "paused",
    version: 1,
    icon: "Mail",
    blocks: [
      { id: "b1", type: "trigger", label: "Client → Created", config: { event: "created", entity: "client", value: "new" } },
      { id: "b2", type: "action", label: "Send Welcome Email", config: { channel: "email", template: "Welcome to {Company.Name}, {Client.FirstName}! We're excited to work with you." } },
    ],
    metrics: { runs24h: 0, successRate: 0 },
    sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    createdBy: "Mike Thompson",
    lastEdited: "1mo ago",
    createdAt: "Oct 2024",
  },
  {
    id: "flow-8",
    title: "Job Completion Report",
    description: "Auto-generate PDF report and email to client when job is done.",
    category: "operations",
    status: "draft",
    version: 1,
    icon: "FileCheck",
    blocks: [
      { id: "b1", type: "trigger", label: "Job Status → Completed", config: { event: "status_change", entity: "job", value: "completed" } },
      { id: "b2", type: "delay", label: "Wait 30 Minutes", config: { duration: "30m" } },
      { id: "b3", type: "action", label: "Generate PDF Report", config: { channel: "internal", template: "Generate job completion report for {Job.Id}" } },
      { id: "b4", type: "action", label: "Email Report to Client", config: { channel: "email", template: "Hi {Client.FirstName}, please find attached the completion report for {Job.Title}." } },
    ],
    metrics: { runs24h: 0, successRate: 0 },
    sparkline: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    createdBy: "Mike Thompson",
    lastEdited: "Just now",
    createdAt: "Feb 2026",
  },
];

/* ── Mock Execution Logs ──────────────────────────────── */

export const executionLogs: ExecutionLog[] = [
  { id: "ex-1", flowId: "flow-1", flowTitle: "Review Request Sequence", timestamp: "Feb 15, 10:42 AM", triggerSource: "JOB-401", status: "success", duration: "2h 4m" },
  { id: "ex-2", flowId: "flow-3", flowTitle: "Job Reminder — 24h", timestamp: "Feb 15, 10:30 AM", triggerSource: "JOB-408", status: "success", duration: "< 1s" },
  { id: "ex-3", flowId: "flow-4", flowTitle: "Technician Assignment Alert", timestamp: "Feb 15, 10:15 AM", triggerSource: "JOB-410", status: "success", duration: "< 1s" },
  { id: "ex-4", flowId: "flow-2", flowTitle: "Invoice Chaser", timestamp: "Feb 15, 09:00 AM", triggerSource: "INV-1378", status: "success", duration: "7d 0h" },
  { id: "ex-5", flowId: "flow-6", flowTitle: "Low Stock Alert", timestamp: "Feb 15, 08:45 AM", triggerSource: "TANK-SEAL", status: "success", duration: "< 1s" },
  { id: "ex-6", flowId: "flow-1", flowTitle: "Review Request Sequence", timestamp: "Feb 14, 16:30 PM", triggerSource: "JOB-399", status: "success", duration: "2h 2m" },
  { id: "ex-7", flowId: "flow-5", flowTitle: "Quote Follow-Up", timestamp: "Feb 14, 14:00 PM", triggerSource: "QTE-088", status: "failed", errorMessage: "Client email bounced: invalid address", duration: "3d 0h" },
  { id: "ex-8", flowId: "flow-3", flowTitle: "Job Reminder — 24h", timestamp: "Feb 14, 10:00 AM", triggerSource: "JOB-405", status: "success", duration: "< 1s" },
  { id: "ex-9", flowId: "flow-4", flowTitle: "Technician Assignment Alert", timestamp: "Feb 14, 09:30 AM", triggerSource: "JOB-407", status: "success", duration: "< 1s" },
  { id: "ex-10", flowId: "flow-2", flowTitle: "Invoice Chaser", timestamp: "Feb 13, 09:00 AM", triggerSource: "INV-1365", status: "success", duration: "7d 0h" },
  { id: "ex-11", flowId: "flow-1", flowTitle: "Review Request Sequence", timestamp: "Feb 13, 15:20 PM", triggerSource: "JOB-397", status: "failed", errorMessage: "SMS delivery failed: phone number invalid", duration: "2h 1m" },
  { id: "ex-12", flowId: "flow-6", flowTitle: "Low Stock Alert", timestamp: "Feb 13, 08:00 AM", triggerSource: "BRS-BALL-22", status: "success", duration: "< 1s" },
];

/* ── Flow Templates ───────────────────────────────────── */

export const flowTemplates: FlowTemplate[] = [
  {
    id: "tpl-1",
    title: "The Chaser",
    description: "Auto-follow up on unpaid invoices after 7 days.",
    category: "billing",
    icon: "Receipt",
    popular: true,
    blocks: [
      { id: "b1", type: "trigger", label: "Invoice → Overdue", config: { event: "status_change", entity: "invoice", value: "overdue" } },
      { id: "b2", type: "delay", label: "Wait 7 Days", config: { duration: "7d" } },
      { id: "b3", type: "action", label: "Send Reminder Email", config: { channel: "email", template: "" } },
    ],
  },
  {
    id: "tpl-2",
    title: "The Hype Man",
    description: "SMS reminder 24h before job starts.",
    category: "operations",
    icon: "MessageSquare",
    popular: true,
    blocks: [
      { id: "b1", type: "trigger", label: "Schedule → 24h Before", config: { event: "schedule_before", entity: "job", value: "24h" } },
      { id: "b2", type: "action", label: "Send SMS Reminder", config: { channel: "sms", template: "" } },
    ],
  },
  {
    id: "tpl-3",
    title: "The Closer",
    description: "Review request 2h after job completion.",
    category: "marketing",
    icon: "Star",
    popular: true,
    blocks: [
      { id: "b1", type: "trigger", label: "Job → Completed", config: { event: "status_change", entity: "job", value: "completed" } },
      { id: "b2", type: "delay", label: "Wait 2 Hours", config: { duration: "2h" } },
      { id: "b3", type: "action", label: "Send Review SMS", config: { channel: "sms", template: "" } },
    ],
  },
  {
    id: "tpl-4",
    title: "Welcome Wagon",
    description: "Send welcome email when new client is added.",
    category: "marketing",
    icon: "Mail",
    popular: false,
    blocks: [
      { id: "b1", type: "trigger", label: "Client → Created", config: { event: "created", entity: "client", value: "new" } },
      { id: "b2", type: "action", label: "Send Welcome Email", config: { channel: "email", template: "" } },
    ],
  },
  {
    id: "tpl-5",
    title: "Stock Watcher",
    description: "Alert when inventory drops below reorder point.",
    category: "operations",
    icon: "Package",
    popular: false,
    blocks: [
      { id: "b1", type: "trigger", label: "Stock → Below Reorder", config: { event: "threshold", entity: "stock", value: "below_reorder" } },
      { id: "b2", type: "action", label: "Email Office Admin", config: { channel: "email", template: "" } },
    ],
  },
  {
    id: "tpl-6",
    title: "Payment Received",
    description: "Send thank-you when payment is recorded.",
    category: "billing",
    icon: "CreditCard",
    popular: false,
    blocks: [
      { id: "b1", type: "trigger", label: "Payment → Received", config: { event: "payment", entity: "invoice", value: "paid" } },
      { id: "b2", type: "action", label: "Send Thank-You SMS", config: { channel: "sms", template: "" } },
    ],
  },
];

/* ── Helpers ───────────────────────────────────────────── */

export function getActiveFlowCount(): number {
  return automationFlows.filter((f) => f.status === "active").length;
}

export function getTotalRuns24h(): number {
  return automationFlows.reduce((sum, f) => sum + f.metrics.runs24h, 0);
}

export function getCategoryLabel(cat: FlowCategory): string {
  return { marketing: "Marketing", billing: "Billing", operations: "Operations" }[cat];
}
