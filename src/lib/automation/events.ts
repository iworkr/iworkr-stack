/**
 * iWorkr Automation Event System
 *
 * Defines all domain events that can trigger automation flows.
 * Events are emitted from server actions and processed by the automation engine.
 */

/* ── Event Types ─────────────────────────────────────── */

export type EventCategory = "job" | "client" | "invoice" | "schedule" | "inventory" | "form" | "team" | "system";

export type EventType =
  // Job events
  | "job.created"
  | "job.status_change"
  | "job.assigned"
  | "job.completed"
  | "job.cancelled"
  | "job.overdue"
  // Client events
  | "client.created"
  | "client.updated"
  | "client.status_change"
  // Invoice events
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.overdue"
  | "invoice.voided"
  // Schedule events
  | "schedule.block_created"
  | "schedule.block_updated"
  | "schedule.conflict_detected"
  | "schedule.reminder"
  // Inventory events
  | "inventory.low_stock"
  | "inventory.critical_stock"
  | "inventory.restocked"
  // Form events
  | "form.submitted"
  | "form.signed"
  | "form.expired"
  // Team events
  | "team.member_joined"
  | "team.member_removed"
  | "team.invite_sent"
  // System events
  | "system.cron.daily"
  | "system.cron.hourly"
  | "system.webhook_received";

/* ── Event Payload ────────────────────────────────────── */

export interface AutomationEvent {
  id: string;
  type: EventType;
  category: EventCategory;
  organization_id: string;
  user_id?: string;
  entity_type?: string;
  entity_id?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/* ── Event Factories ──────────────────────────────────── */

function createEvent(
  type: EventType,
  category: EventCategory,
  orgId: string,
  payload: Record<string, unknown>,
  opts?: { userId?: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }
): AutomationEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    category,
    organization_id: orgId,
    user_id: opts?.userId,
    entity_type: opts?.entityType,
    entity_id: opts?.entityId,
    payload,
    metadata: opts?.metadata,
    timestamp: new Date().toISOString(),
  };
}

export const Events = {
  // Job events
  jobCreated: (orgId: string, jobId: string, payload: Record<string, unknown>) =>
    createEvent("job.created", "job", orgId, payload, { entityType: "job", entityId: jobId }),

  jobStatusChange: (orgId: string, jobId: string, oldStatus: string, newStatus: string, userId?: string) =>
    createEvent("job.status_change", "job", orgId, { old_status: oldStatus, new_status: newStatus }, { entityType: "job", entityId: jobId, userId }),

  jobAssigned: (orgId: string, jobId: string, assigneeId: string, assigneeName: string) =>
    createEvent("job.assigned", "job", orgId, { assignee_id: assigneeId, assignee_name: assigneeName }, { entityType: "job", entityId: jobId }),

  jobCompleted: (orgId: string, jobId: string, payload: Record<string, unknown>) =>
    createEvent("job.completed", "job", orgId, payload, { entityType: "job", entityId: jobId }),

  // Client events
  clientCreated: (orgId: string, clientId: string, payload: Record<string, unknown>) =>
    createEvent("client.created", "client", orgId, payload, { entityType: "client", entityId: clientId }),

  clientStatusChange: (orgId: string, clientId: string, oldStatus: string, newStatus: string) =>
    createEvent("client.status_change", "client", orgId, { old_status: oldStatus, new_status: newStatus }, { entityType: "client", entityId: clientId }),

  // Invoice events
  invoiceCreated: (orgId: string, invoiceId: string, payload: Record<string, unknown>) =>
    createEvent("invoice.created", "invoice", orgId, payload, { entityType: "invoice", entityId: invoiceId }),

  invoiceSent: (orgId: string, invoiceId: string, payload: Record<string, unknown>) =>
    createEvent("invoice.sent", "invoice", orgId, payload, { entityType: "invoice", entityId: invoiceId }),

  invoicePaid: (orgId: string, invoiceId: string, payload: Record<string, unknown>) =>
    createEvent("invoice.paid", "invoice", orgId, payload, { entityType: "invoice", entityId: invoiceId }),

  invoiceOverdue: (orgId: string, invoiceId: string, payload: Record<string, unknown>) =>
    createEvent("invoice.overdue", "invoice", orgId, payload, { entityType: "invoice", entityId: invoiceId }),

  // Schedule events
  scheduleConflict: (orgId: string, blockId: string, payload: Record<string, unknown>) =>
    createEvent("schedule.conflict_detected", "schedule", orgId, payload, { entityType: "schedule_block", entityId: blockId }),

  // Inventory events
  inventoryLowStock: (orgId: string, itemId: string, payload: Record<string, unknown>) =>
    createEvent("inventory.low_stock", "inventory", orgId, payload, { entityType: "inventory_item", entityId: itemId }),

  inventoryCriticalStock: (orgId: string, itemId: string, payload: Record<string, unknown>) =>
    createEvent("inventory.critical_stock", "inventory", orgId, payload, { entityType: "inventory_item", entityId: itemId }),

  // Form events
  formSubmitted: (orgId: string, submissionId: string, payload: Record<string, unknown>) =>
    createEvent("form.submitted", "form", orgId, payload, { entityType: "form_submission", entityId: submissionId }),

  // Team events
  teamMemberJoined: (orgId: string, memberId: string, payload: Record<string, unknown>) =>
    createEvent("team.member_joined", "team", orgId, payload, { entityType: "member", entityId: memberId }),
};
