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
      ? `Welcome to iWorkr — ${params.companyName} is ready`
      : "Welcome to iWorkr",
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
}) {
  return sendEmail({
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.companyName} on iWorkr`,
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
    subject: `${params.memberName} just joined ${params.companyName}`,
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
      ? `Your ${params.trialDays}-day free trial of ${params.planName} is live`
      : `You're now on the ${params.planName} plan`,
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
    subject: `Payment received — ${params.amount} (${params.invoiceNumber})`,
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
    subject: `⚠️ Action required: Payment failed for ${params.companyName}`,
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
    subject: "Your iWorkr sign-in link",
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
  return sendEmail({
    to: params.to,
    subject: `New job: ${params.jobTitle} — ${params.clientName} on ${params.scheduledDate}`,
    react: createElement(JobAssignedEmail, params),
    tags: [{ name: "event", value: "job_assigned" }],
  });
}
