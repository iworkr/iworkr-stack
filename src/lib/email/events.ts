import { sendEmail } from "./send";
import WelcomeEmail from "@/emails/welcome";
import InviteEmail from "@/emails/invite";
import InviteAcceptedEmail from "@/emails/invite-accepted";
import SubscriptionCreatedEmail from "@/emails/subscription-created";
import SubscriptionCanceledEmail from "@/emails/subscription-canceled";
import PaymentReceiptEmail from "@/emails/payment-receipt";
import PaymentFailedEmail from "@/emails/payment-failed";
import MagicLinkEmail from "@/emails/magic-link";
import JobAssignedEmail from "@/emails/job-assigned";
import InvoiceSentEmail from "@/emails/invoice-sent";
import WeeklyDigestEmail from "@/emails/weekly-digest";
import { createElement } from "react";

/* ── Welcome ── */
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  companyName?: string;
}) {
  return sendEmail({
    to: params.to,
    subject: params.companyName
      ? `You're in — ${params.companyName} is live on iWorkr`
      : "You're in — welcome to iWorkr",
    react: createElement(WelcomeEmail, {
      name: params.name,
      companyName: params.companyName,
    }),
    tags: [{ name: "event", value: "welcome" }],
  });
}

/* ── Organization Invite ── */
export async function sendInviteEmail(params: {
  to: string;
  inviteeName?: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteUrl: string;
  /** Project Genesis — dynamic workspace branding */
  brandColorHex?: string;
  logoUrl?: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `${params.inviterName} wants you on the roster at ${params.companyName}`,
    react: createElement(InviteEmail, params),
    tags: [{ name: "event", value: "invite" }],
  });
}

/* ── Invite Accepted (notify owner) ── */
export async function sendInviteAcceptedEmail(params: {
  to: string;
  ownerName: string;
  memberName: string;
  memberEmail: string;
  companyName: string;
  role: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `🎯 ${params.memberName} is on the roster`,
    react: createElement(InviteAcceptedEmail, params),
    tags: [{ name: "event", value: "invite_accepted" }],
  });
}

/* ── Subscription Created ── */
export async function sendSubscriptionCreatedEmail(params: {
  to: string;
  name: string;
  companyName: string;
  planName: string;
  price: string;
  billingCycle: string;
  trialDays?: number;
  nextBillingDate?: string;
}) {
  const isTrial = (params.trialDays || 0) > 0;
  return sendEmail({
    to: params.to,
    subject: isTrial
      ? `🚀 Your ${params.trialDays}-day free trial of ${params.planName} is live`
      : `⚡ ${params.companyName} just leveled up to ${params.planName}`,
    react: createElement(SubscriptionCreatedEmail, params),
    tags: [{ name: "event", value: "subscription_created" }],
  });
}

/* ── Subscription Canceled ── */
export async function sendSubscriptionCanceledEmail(params: {
  to: string;
  name: string;
  companyName: string;
  planName: string;
  endDate: string;
  isImmediate?: boolean;
}) {
  return sendEmail({
    to: params.to,
    subject: params.isImmediate
      ? `Your ${params.planName} subscription has been canceled`
      : `Your ${params.planName} plan will end on ${params.endDate}`,
    react: createElement(SubscriptionCanceledEmail, params),
    tags: [{ name: "event", value: "subscription_canceled" }],
  });
}

/* ── Payment Receipt ── */
export async function sendPaymentReceiptEmail(params: {
  to: string;
  name: string;
  companyName: string;
  invoiceNumber: string;
  amount: string;
  planName: string;
  billingPeriod: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceUrl?: string;
}) {
  return sendEmail({
    to: params.to,
    subject: `Cha-ching! ${params.amount} received 💸 (${params.invoiceNumber})`,
    react: createElement(PaymentReceiptEmail, params),
    tags: [{ name: "event", value: "payment_receipt" }],
  });
}

/* ── Payment Failed ── */
export async function sendPaymentFailedEmail(params: {
  to: string;
  name: string;
  companyName: string;
  planName: string;
  amount: string;
  retryDate?: string;
  attemptsLeft?: number;
}) {
  return sendEmail({
    to: params.to,
    subject: `Heads up: ${params.amount} payment failed for ${params.companyName}`,
    react: createElement(PaymentFailedEmail, params),
    tags: [{ name: "event", value: "payment_failed" }],
  });
}

/* ── Magic Link ── */
export async function sendMagicLinkEmail(params: {
  to: string;
  magicLink: string;
}) {
  return sendEmail({
    to: params.to,
    subject: "Your iWorkr sign-in link — tap to enter",
    react: createElement(MagicLinkEmail, {
      magicLink: params.magicLink,
      email: params.to,
    }),
    tags: [{ name: "event", value: "magic_link" }],
  });
}

/* ── Job Assigned ── */
export async function sendJobAssignedEmail(params: {
  to: string;
  technicianName: string;
  jobTitle: string;
  clientName: string;
  clientAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
  assignedBy: string;
  jobId: string;
}) {
  const shortAddress = params.clientAddress.split(",")[0];
  return sendEmail({
    to: params.to,
    subject: `📍 New job: ${shortAddress} at ${params.scheduledTime}`,
    react: createElement(JobAssignedEmail, params),
    tags: [{ name: "event", value: "job_assigned" }],
  });
}

/* ── Invoice Sent (to end customer) ── */
export async function sendInvoiceSentEmail(params: {
  to: string;
  recipientName: string;
  companyName: string;
  companyLogo?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  projectName: string;
  lineItems: { description: string; quantity: number; rate: number; total: number }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentUrl: string;
  currency?: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: params.currency || "USD",
    minimumFractionDigits: 2,
  }).format(params.total);

  return sendEmail({
    to: params.to,
    subject: `Invoice ${params.invoiceNumber} from ${params.companyName} — ${formatted}`,
    react: createElement(InvoiceSentEmail, params),
    tags: [{ name: "event", value: "invoice_sent" }],
  });
}

/* ── Weekly Digest (Admin) ── */
export async function sendWeeklyDigestEmail(params: {
  to: string;
  name: string;
  companyName: string;
  weekLabel: string;
  revenue: number;
  revenueChange: number;
  jobsCompleted: number;
  jobsCompletedChange: number;
  avgRating: number;
  openJobs: number;
  topTechnician?: string;
  topTechnicianJobs?: number;
  overdueInvoices?: number;
  overdueAmount?: number;
  currency?: string;
}) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: params.currency || "USD",
    minimumFractionDigits: 0,
  }).format(params.revenue);

  return sendEmail({
    to: params.to,
    subject: `📈 ${params.companyName} weekly: ${formatted} revenue, ${params.jobsCompleted} jobs closed`,
    react: createElement(WeeklyDigestEmail, params),
    tags: [{ name: "event", value: "weekly_digest" }],
  });
}

/* ── Queue-based sending (for server-side/backend use) ── */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function queueEmail(params: {
  organizationId: string;
  eventType: string;
  recipientEmail: string;
  payload: Record<string, unknown>;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await (supabase as any).from("mail_queue").insert({
      organization_id: params.organizationId,
      event_type: params.eventType,
      recipient_email: params.recipientEmail,
      payload: params.payload,
    });

    if (error) {
      console.error("[Email Queue] Failed to enqueue:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email Queue] Enqueued "${params.eventType}" for ${params.recipientEmail}`);
    return { success: true };
  } catch (err) {
    console.error("[Email Queue] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function queueJobAssignedEmail(params: {
  organizationId: string;
  jobId: string;
  jobTitle: string;
  jobDate: string;
  jobLocation: string;
  technicianEmail: string;
  technicianName: string;
  clientName: string;
  clientAddress: string;
  workspaceName: string;
}) {
  return queueEmail({
    organizationId: params.organizationId,
    eventType: "job_assigned",
    recipientEmail: params.technicianEmail,
    payload: {
      job_id: params.jobId,
      job: { title: params.jobTitle, date: params.jobDate, location: params.jobLocation },
      tech: { name: params.technicianName },
      client: { name: params.clientName, address: params.clientAddress },
      workspace: { name: params.workspaceName },
    },
  });
}

export async function queueJobCancelledEmail(params: {
  organizationId: string;
  jobId: string;
  jobTitle: string;
  technicianEmail: string;
  technicianName: string;
  workspaceName: string;
  reason?: string;
}) {
  return queueEmail({
    organizationId: params.organizationId,
    eventType: "job_cancelled",
    recipientEmail: params.technicianEmail,
    payload: {
      job_id: params.jobId,
      job: { title: params.jobTitle },
      tech: { name: params.technicianName },
      workspace: { name: params.workspaceName },
      reason: params.reason,
    },
  });
}

export async function queueComplianceWarningEmail(params: {
  organizationId: string;
  jobId: string;
  jobDisplayId: string;
  jobTitle: string;
  technicianName: string;
  recipientEmail: string;
  workspaceName: string;
}) {
  return queueEmail({
    organizationId: params.organizationId,
    eventType: "compliance_warning_swms",
    recipientEmail: params.recipientEmail,
    payload: {
      job_id: params.jobId,
      job: { id: params.jobDisplayId, title: params.jobTitle },
      tech: { name: params.technicianName },
      workspace: { name: params.workspaceName },
    },
  });
}
