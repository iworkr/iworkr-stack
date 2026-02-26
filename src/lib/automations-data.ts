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
  isPublished: boolean;
  icon: string; // lucide icon name
  blocks: FlowBlock[];
  /** JSON Logic AST for global condition evaluation */
  conditions: JsonLogicRule | null;
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

/** JSON Logic AST node — recursive tree structure */
export type JsonLogicRule = Record<string, unknown>;

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

/** Dry-run / execution trace step */
export interface TraceStep {
  step: string;
  status: "passed" | "failed" | "simulated" | "skipped" | "error";
  description?: string;
  evaluation?: string;
  data?: unknown;
  duration_ms?: number;
}

/** Execution run from the idempotency ledger */
export interface ExecutionRun {
  id: string;
  automationId: string;
  flowTitle: string;
  triggerEventId: string;
  status: "success" | "failed" | "skipped";
  executionTimeMs: number;
  errorDetails?: string;
  trace: TraceStep[];
  timestamp: string;
}

/** Condition rule for the UI builder */
export interface ConditionRule {
  id: string;
  field: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "exists" | "not_exists";
  value: string;
}

/** Condition group (AND/OR collection of rules) */
export interface ConditionGroup {
  id: string;
  logic: "and" | "or";
  rules: ConditionRule[];
}

/** Available trigger events for the builder */
export const triggerEvents = [
  { value: "job.created", label: "Job Created", entity: "job" },
  { value: "job.status_change", label: "Job Status Changed", entity: "job" },
  { value: "job.completed", label: "Job Completed", entity: "job" },
  { value: "job.assigned", label: "Job Assigned", entity: "job" },
  { value: "job.cancelled", label: "Job Cancelled", entity: "job" },
  { value: "job.overdue", label: "Job Overdue", entity: "job" },
  { value: "invoice.created", label: "Invoice Created", entity: "invoice" },
  { value: "invoice.sent", label: "Invoice Sent", entity: "invoice" },
  { value: "invoice.paid", label: "Invoice Paid", entity: "invoice" },
  { value: "invoice.overdue", label: "Invoice Overdue", entity: "invoice" },
  { value: "client.created", label: "New Client Created", entity: "client" },
  { value: "client.status_change", label: "Client Status Changed", entity: "client" },
  { value: "schedule.reminder", label: "Schedule Reminder", entity: "schedule" },
  { value: "inventory.low_stock", label: "Low Stock Alert", entity: "inventory" },
  { value: "form.submitted", label: "Form Submitted", entity: "form" },
  { value: "team.member_joined", label: "Team Member Joined", entity: "team" },
] as const;

/** Available condition operators */
export const conditionOperators = [
  { value: "==", label: "equals" },
  { value: "!=", label: "does not equal" },
  { value: ">", label: "greater than" },
  { value: ">=", label: "greater or equal" },
  { value: "<", label: "less than" },
  { value: "<=", label: "less or equal" },
  { value: "in", label: "contains" },
  { value: "exists", label: "is not empty" },
  { value: "not_exists", label: "is empty" },
] as const;

/** Available context variables per entity type */
export const contextVariables: Record<string, { value: string; label: string }[]> = {
  job: [
    { value: "trigger.new_record.status", label: "Job → Status" },
    { value: "trigger.new_record.title", label: "Job → Title" },
    { value: "trigger.new_record.priority", label: "Job → Priority" },
    { value: "trigger.client_name", label: "Job → Client Name" },
    { value: "trigger.client_email", label: "Job → Client Email" },
    { value: "trigger.client_phone", label: "Job → Client Phone" },
    { value: "trigger.new_record.grand_total_cents", label: "Job → Total (cents)" },
  ],
  invoice: [
    { value: "trigger.new_record.status", label: "Invoice → Status" },
    { value: "trigger.new_record.total", label: "Invoice → Total" },
    { value: "trigger.invoice_number", label: "Invoice → Number" },
    { value: "trigger.client_name", label: "Invoice → Client Name" },
    { value: "trigger.client_email", label: "Invoice → Client Email" },
  ],
  client: [
    { value: "trigger.new_record.status", label: "Client → Status" },
    { value: "trigger.new_record.name", label: "Client → Name" },
    { value: "trigger.new_record.email", label: "Client → Email" },
    { value: "trigger.new_record.type", label: "Client → Type" },
  ],
  schedule: [
    { value: "trigger.new_record.status", label: "Schedule → Status" },
    { value: "trigger.new_record.start_time", label: "Schedule → Start Time" },
  ],
  inventory: [
    { value: "trigger.new_record.current_qty", label: "Stock → Current Qty" },
    { value: "trigger.new_record.reorder_point", label: "Stock → Reorder Point" },
    { value: "trigger.new_record.name", label: "Stock → Name" },
  ],
  form: [
    { value: "trigger.new_record.status", label: "Form → Status" },
    { value: "trigger.new_record.title", label: "Form → Title" },
  ],
  team: [
    { value: "trigger.new_record.role", label: "Member → Role" },
    { value: "trigger.new_record.email", label: "Member → Email" },
  ],
};

/** Convert UI ConditionGroups to JSON Logic AST */
export function conditionGroupsToJsonLogic(groups: ConditionGroup[]): JsonLogicRule | null {
  if (groups.length === 0) return null;

  const groupRules = groups.map((group) => {
    const rules = group.rules.map((rule) => {
      if (rule.operator === "exists") {
        return { "!=": [{ var: rule.field }, null] };
      }
      if (rule.operator === "not_exists") {
        return { "==": [{ var: rule.field }, null] };
      }
      // Numeric operators
      if ([">", ">=", "<", "<="].includes(rule.operator)) {
        return { [rule.operator]: [{ var: rule.field }, Number(rule.value)] };
      }
      return { [rule.operator]: [{ var: rule.field }, rule.value] };
    });

    if (rules.length === 1) return rules[0];
    return { [group.logic]: rules };
  });

  if (groupRules.length === 1) return groupRules[0] as JsonLogicRule;
  return { and: groupRules };
}

/** Convert JSON Logic AST back to UI ConditionGroups */
export function jsonLogicToConditionGroups(logic: JsonLogicRule | null): ConditionGroup[] {
  if (!logic) return [];

  function parseRule(rule: Record<string, unknown>): ConditionRule | null {
    const op = Object.keys(rule)[0];
    const args = rule[op] as unknown[];
    if (!args || !Array.isArray(args) || args.length < 2) return null;

    const first = args[0] as Record<string, unknown>;
    const field = first?.var as string;
    if (!field) return null;

    return {
      id: `rule-${Math.random().toString(36).slice(2, 6)}`,
      field,
      operator: op as ConditionRule["operator"],
      value: String(args[1] ?? ""),
    };
  }

  function parseGroup(node: Record<string, unknown>): ConditionGroup | null {
    const op = Object.keys(node)[0];
    if (op === "and" || op === "or") {
      const children = node[op] as Record<string, unknown>[];
      const rules = children.map(parseRule).filter(Boolean) as ConditionRule[];
      if (rules.length === 0) return null;
      return { id: `group-${Math.random().toString(36).slice(2, 6)}`, logic: op, rules };
    }
    // Single rule at top level
    const rule = parseRule(node);
    if (!rule) return null;
    return { id: `group-${Math.random().toString(36).slice(2, 6)}`, logic: "and", rules: [rule] };
  }

  const group = parseGroup(logic);
  return group ? [group] : [];
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
    isPublished: true,
    icon: "Star",
    blocks: [
      { id: "b1", type: "trigger", label: "Job Status → Completed", config: { event: "status_change", entity: "job", value: "completed" } },
      { id: "b2", type: "delay", label: "Wait 2 Hours", config: { duration: "2h" } },
      { id: "b3", type: "action", label: "Send SMS to Client", config: { channel: "sms", template: "Hi {Client.FirstName}, thanks for choosing {Company.Name}! We'd love your feedback: {Review.Link}" } },
    ],
    conditions: null,
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
    isPublished: true,
    icon: "Receipt",
    blocks: [
      { id: "b1", type: "trigger", label: "Invoice Status → Overdue", config: { event: "status_change", entity: "invoice", value: "overdue" } },
      { id: "b2", type: "delay", label: "Wait 7 Days", config: { duration: "7d" } },
      { id: "b3", type: "condition", label: "If Invoice Value > $500", config: { field: "invoice.total", operator: "gt", value: "500" } },
      { id: "b4", type: "action", label: "Send VIP Follow-up Email", config: { channel: "email", template: "Hi {Client.FirstName}, your invoice #{Invoice.Number} for {Invoice.Total} is now 7 days overdue..." } },
      { id: "b5", type: "action", label: "Send Standard Reminder", config: { channel: "email", template: "Hi {Client.FirstName}, a friendly reminder about invoice #{Invoice.Number}..." } },
    ],
    conditions: null,
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
    isPublished: true,
    icon: "Clock",
    blocks: [
      { id: "b1", type: "trigger", label: "Schedule → 24h Before Job", config: { event: "schedule_before", entity: "job", value: "24h" } },
      { id: "b2", type: "action", label: "Send SMS to Client", config: { channel: "sms", template: "Hi {Client.FirstName}, just a reminder that {Tech.FirstName} will be arriving tomorrow at {Job.Time} for your {Job.Title}." } },
    ],
    conditions: null,
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
    isPublished: true,
    icon: "UserCheck",
    blocks: [
      { id: "b1", type: "trigger", label: "Job → Assigned to Technician", config: { event: "assignment", entity: "job", value: "assigned" } },
      { id: "b2", type: "action", label: "Send Push to Technician", config: { channel: "internal", template: "New job assigned: {Job.Title} at {Job.Address}. Scheduled for {Job.Date}." } },
    ],
    conditions: null,
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
    isPublished: true,
    icon: "FileText",
    blocks: [
      { id: "b1", type: "trigger", label: "Quote Status → Sent", config: { event: "status_change", entity: "quote", value: "sent" } },
      { id: "b2", type: "delay", label: "Wait 3 Days", config: { duration: "3d" } },
      { id: "b3", type: "condition", label: "If Quote Status ≠ Accepted", config: { field: "quote.status", operator: "neq", value: "accepted" } },
      { id: "b4", type: "action", label: "Send Follow-up Email", config: { channel: "email", template: "Hi {Client.FirstName}, just checking in about the quote we sent for {Quote.Title}. Happy to answer any questions!" } },
    ],
    conditions: null,
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
    isPublished: true,
    icon: "Package",
    blocks: [
      { id: "b1", type: "trigger", label: "Stock Level → Below Reorder Point", config: { event: "threshold", entity: "stock", value: "below_reorder" } },
      { id: "b2", type: "action", label: "Send Email to Office", config: { channel: "email", template: "{Stock.Name} (SKU: {Stock.SKU}) is running low — {Stock.CurrentQty} remaining. Reorder point: {Stock.ReorderPoint}." } },
    ],
    conditions: null,
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
    isPublished: false,
    icon: "Mail",
    blocks: [
      { id: "b1", type: "trigger", label: "Client → Created", config: { event: "created", entity: "client", value: "new" } },
      { id: "b2", type: "action", label: "Send Welcome Email", config: { channel: "email", template: "Welcome to {Company.Name}, {Client.FirstName}! We're excited to work with you." } },
    ],
    conditions: null,
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
    isPublished: false,
    icon: "FileCheck",
    blocks: [
      { id: "b1", type: "trigger", label: "Job Status → Completed", config: { event: "status_change", entity: "job", value: "completed" } },
      { id: "b2", type: "delay", label: "Wait 30 Minutes", config: { duration: "30m" } },
      { id: "b3", type: "action", label: "Generate PDF Report", config: { channel: "internal", template: "Generate job completion report for {Job.Id}" } },
      { id: "b4", type: "action", label: "Email Report to Client", config: { channel: "email", template: "Hi {Client.FirstName}, please find attached the completion report for {Job.Title}." } },
    ],
    conditions: null,
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
