/**
 * @module lib/email/index.ts
 * @status STABLE
 * @description Transactional email helpers — index
 * @lastReview 2026-03-28
 */
export { sendEmail, type SendEmailOptions } from "./send";
export {
  sendWelcomeEmail,
  sendInviteEmail,
  sendInviteAcceptedEmail,
  sendSubscriptionCreatedEmail,
  sendSubscriptionCanceledEmail,
  sendPaymentReceiptEmail,
  sendPaymentFailedEmail,
  sendMagicLinkEmail,
  sendJobAssignedEmail,
  sendInvoiceSentEmail,
  sendWeeklyDigestEmail,
  queueEmail,
  queueJobAssignedEmail,
  queueJobCancelledEmail,
  queueComplianceWarningEmail,
} from "./events";
