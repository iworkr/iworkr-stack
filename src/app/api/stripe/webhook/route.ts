/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getStripe, stripePriceToPlanKey } from "@/lib/stripe";
import {
  sendSubscriptionCreatedEmail,
  sendSubscriptionCanceledEmail,
  sendPaymentReceiptEmail,
  sendPaymentFailedEmail,
} from "@/lib/email";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getOrgOwnerEmail(
  supabase: any,
  orgId: string
): Promise<{ email: string; name: string; orgName: string } | null> {
  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", membership.user_id)
    .maybeSingle();

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .maybeSingle();

  if (!profile?.email) return null;

  return {
    email: profile.email,
    name: profile.full_name || profile.email.split("@")[0],
    orgName: org?.name || "your workspace",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabase();

  try {
    switch (event.type) {
      // ── Subscription Created ──
      case "customer.subscription.created": {
        const sub = event.data.object as any; // Stripe.Subscription — using any for SDK v20 compat
        const orgId = sub.metadata?.organization_id;
        if (!orgId) {
          console.warn("[Stripe] subscription.created: missing organization_id in metadata");
          break;
        }

        const priceId = sub.items?.data?.[0]?.price?.id || sub.plan?.id || "";
        const planKey = stripePriceToPlanKey(priceId);

        // Get period dates — SDK v20 moved these to items, fallback to root
        const item = sub.items?.data?.[0] || {};
        const periodStart = item.current_period_start || sub.current_period_start || sub.start_date;
        const periodEnd = item.current_period_end || sub.current_period_end;

        await supabase.from("subscriptions").upsert(
          {
            organization_id: orgId,
            polar_subscription_id: `stripe_${sub.id}`,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            plan_key: planKey,
            status: sub.status === "active" ? "active" : sub.status === "trialing" ? "trialing" : "incomplete",
            current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end || false,
            metadata: { stripe_subscription: sub.id, price_id: priceId },
          },
          { onConflict: "stripe_subscription_id" }
        );

        // Update org plan_tier and billing_provider
        await supabase
          .from("organizations")
          .update({
            plan_tier: planKey,
            billing_provider: "stripe",
            ...(periodEnd ? { subscription_active_until: new Date(periodEnd * 1000).toISOString() } : {}),
          })
          .eq("id", orgId);

        // Send email
        const owner = await getOrgOwnerEmail(supabase, orgId);
        if (owner) {
          const planNames: Record<string, string> = { starter: "Starter", pro: "Standard", business: "Enterprise" };
          const unitAmount = item.price?.unit_amount || sub.plan?.amount || 0;
          const interval = item.price?.recurring?.interval || sub.plan?.interval || "month";
          await sendSubscriptionCreatedEmail({
            to: owner.email,
            name: owner.name,
            companyName: owner.orgName,
            planName: planNames[planKey] || planKey,
            price: `$${(unitAmount / 100).toFixed(0)}`,
            billingCycle: interval === "year" ? "yearly" : "monthly",
            trialDays: sub.trial_end ? 14 : 0,
            nextBillingDate: periodEnd
              ? new Date(periodEnd * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
              : undefined,
          }).catch((err: any) => console.error("[Email] Subscription created email failed:", err));
        }

        console.log(`[Stripe] Subscription created: ${sub.id} → org ${orgId} (${planKey})`);
        break;
      }

      // ── Subscription Updated ──
      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.organization_id;
        const priceId = sub.items?.data?.[0]?.price?.id || sub.plan?.id || "";
        const planKey = stripePriceToPlanKey(priceId);

        const item = sub.items?.data?.[0] || {};
        const periodStart = item.current_period_start || sub.current_period_start || sub.start_date;
        const periodEnd = item.current_period_end || sub.current_period_end;

        const updateData: Record<string, any> = {
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end || false,
          stripe_price_id: priceId,
          plan_key: planKey,
          metadata: { stripe_subscription: sub.id, price_id: priceId },
        };
        if (periodStart) updateData.current_period_start = new Date(periodStart * 1000).toISOString();
        if (periodEnd) updateData.current_period_end = new Date(periodEnd * 1000).toISOString();
        if (sub.canceled_at) updateData.canceled_at = new Date(sub.canceled_at * 1000).toISOString();

        await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", sub.id);

        // Sync org plan_tier
        if (orgId) {
          await supabase
            .from("organizations")
            .update({
              plan_tier: sub.status === "canceled" ? "free" : planKey,
              ...(periodEnd ? { subscription_active_until: new Date(periodEnd * 1000).toISOString() } : {}),
            })
            .eq("id", orgId);

          // Send cancellation email if just set to cancel
          if (sub.cancel_at_period_end && periodEnd) {
            const owner = await getOrgOwnerEmail(supabase, orgId);
            if (owner) {
              const planNames: Record<string, string> = { starter: "Starter", pro: "Standard", business: "Enterprise" };
              await sendSubscriptionCanceledEmail({
                to: owner.email,
                name: owner.name,
                companyName: owner.orgName,
                planName: planNames[planKey] || planKey,
                endDate: new Date(periodEnd * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
                isImmediate: false,
              }).catch((err: any) => console.error("[Email] Cancellation email failed:", err));
            }
          }
        }

        console.log(`[Stripe] Subscription updated: ${sub.id} → ${sub.status} (${planKey})`);
        break;
      }

      // ── Subscription Deleted ──
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const orgId = sub.metadata?.organization_id;

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", sub.id);

        if (orgId) {
          await supabase
            .from("organizations")
            .update({
              plan_tier: "free",
              billing_provider: "free",
            })
            .eq("id", orgId);

          const owner = await getOrgOwnerEmail(supabase, orgId);
          if (owner) {
            await sendSubscriptionCanceledEmail({
              to: owner.email,
              name: owner.name,
              companyName: owner.orgName,
              planName: "your plan",
              endDate: new Date().toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
              isImmediate: true,
            }).catch((err) => console.error("[Email] Deletion email failed:", err));
          }
        }

        console.log(`[Stripe] Subscription deleted: ${sub.id}`);
        break;
      }

      // ── Invoice Payment Succeeded ──
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const orgId = invoice.subscription_details?.metadata?.organization_id || invoice.metadata?.organization_id;

        if (orgId && invoice.amount_paid > 0) {
          const owner = await getOrgOwnerEmail(supabase, orgId);
          if (owner) {
            const lineItem = invoice.lines?.data?.[0];
            const periodStr = lineItem?.period
              ? `${new Date(lineItem.period.start * 1000).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`
              : "Current period";
            await sendPaymentReceiptEmail({
              to: owner.email,
              name: owner.name,
              companyName: owner.orgName,
              invoiceNumber: invoice.number || `INV-${invoice.id.slice(-8)}`,
              amount: `$${(invoice.amount_paid / 100).toFixed(2)}`,
              planName: lineItem?.description || "Subscription",
              billingPeriod: periodStr,
              paymentDate: new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }),
              paymentMethod: "Card",
              invoiceUrl: invoice.hosted_invoice_url || undefined,
            }).catch((err: any) => console.error("[Email] Receipt email failed:", err));
          }
        }
        break;
      }

      // ── Invoice Payment Failed ──
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const orgId = invoice.subscription_details?.metadata?.organization_id || invoice.metadata?.organization_id;

        if (orgId) {
          // Mark subscription as past_due
          if (invoice.subscription) {
            await supabase
              .from("subscriptions")
              .update({ status: "past_due" })
              .eq("stripe_subscription_id", invoice.subscription);
          }

          const owner = await getOrgOwnerEmail(supabase, orgId);
          if (owner) {
            await sendPaymentFailedEmail({
              to: owner.email,
              name: owner.name,
              companyName: owner.orgName,
              planName: "Subscription",
              amount: `$${(invoice.amount_due / 100).toFixed(2)}`,
              retryDate: invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : undefined,
            }).catch((err: any) => console.error("[Email] Payment failed email failed:", err));
          }
        }
        break;
      }

      // ── Stripe Connect: Account Updated ──
      case "account.updated": {
        const account = event.data.object as any;
        const chargesEnabled = account.charges_enabled;
        const payoutsEnabled = account.payouts_enabled;

        if (account.metadata?.organization_id) {
          await supabase
            .from("organizations")
            .update({
              charges_enabled: chargesEnabled,
              payouts_enabled: payoutsEnabled,
              ...(chargesEnabled && payoutsEnabled
                ? { connect_onboarded_at: new Date().toISOString() }
                : {}),
            })
            .eq("stripe_account_id", account.id);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, err.message);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
