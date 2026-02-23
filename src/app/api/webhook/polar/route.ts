/* eslint-disable @typescript-eslint/no-explicit-any */
import { Webhooks } from "@polar-sh/nextjs";
import { createClient } from "@supabase/supabase-js";
import {
  sendSubscriptionCreatedEmail,
  sendSubscriptionCanceledEmail,
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

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    console.log(
      `[Polar Webhook] ${payload.type}`,
      JSON.stringify(payload.data?.id)
    );
  },
  onSubscriptionCreated: async (payload) => {
    const sub = payload.data;
    const orgId = (sub.metadata as Record<string, string>)?.organization_id;
    if (!orgId) {
      console.warn(
        "subscription.created: missing organization_id in metadata"
      );
      return;
    }

    const supabase = getSupabase();

    const planKey =
      (sub.metadata as Record<string, string>)?.plan_key ||
      sub.product?.name?.toLowerCase().replace(/\s+/g, "_") ||
      "unknown";

    await supabase.from("subscriptions").upsert(
      {
        organization_id: orgId,
        polar_subscription_id: sub.id,
        polar_product_id: sub.productId,
        plan_key: planKey,
        status: sub.status === "active" ? "active" : "incomplete",
        current_period_start: sub.currentPeriodStart,
        current_period_end: sub.currentPeriodEnd,
        cancel_at_period_end: sub.cancelAtPeriodEnd || false,
        metadata: sub as unknown as Record<string, unknown>,
      },
      { onConflict: "polar_subscription_id" }
    );

    await supabase.from("audit_log").insert({
      organization_id: orgId,
      action: "subscription.created",
      entity_type: "subscription",
      entity_id: sub.id,
      new_data: { plan_key: planKey, status: sub.status },
    });

    // Send subscription created email
    const owner = await getOrgOwnerEmail(supabase, orgId);
    if (owner) {
      const planName =
        sub.product?.name ||
        planKey.charAt(0).toUpperCase() + planKey.slice(1);
      const price = sub.amount ? `$${(sub.amount / 100).toFixed(0)}` : "$0";

      await sendSubscriptionCreatedEmail({
        to: owner.email,
        name: owner.name,
        companyName: owner.orgName,
        planName,
        price,
        billingCycle: sub.recurringInterval === "year" ? "yearly" : "monthly",
        trialDays: sub.currentPeriodStart !== sub.startedAt ? 14 : 0,
        nextBillingDate: sub.currentPeriodEnd
          ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-AU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : undefined,
      }).catch((err) =>
        console.error("[Email] Subscription email failed:", err)
      );
    }

    console.log(
      `[Polar] Subscription created: ${sub.id} → org ${orgId} (${planKey})`
    );
  },
  onSubscriptionUpdated: async (payload) => {
    const sub = payload.data;
    const orgId = (sub.metadata as Record<string, string>)?.organization_id;

    const supabase = getSupabase();

    const planKey =
      (sub.metadata as Record<string, string>)?.plan_key ||
      sub.product?.name?.toLowerCase().replace(/\s+/g, "_");

    const updateData: Record<string, unknown> = {
      status: sub.status,
      current_period_start: sub.currentPeriodStart,
      current_period_end: sub.currentPeriodEnd,
      cancel_at_period_end: sub.cancelAtPeriodEnd || false,
      metadata: sub as unknown as Record<string, unknown>,
    };
    if (planKey) updateData.plan_key = planKey;

    await supabase
      .from("subscriptions")
      .update(updateData)
      .eq("polar_subscription_id", sub.id);

    if (orgId) {
      await supabase.from("audit_log").insert({
        organization_id: orgId,
        action: "subscription.updated",
        entity_type: "subscription",
        entity_id: sub.id,
        new_data: { status: sub.status },
      });

      // If cancel_at_period_end was just set, send cancellation email
      if (sub.cancelAtPeriodEnd) {
        const owner = await getOrgOwnerEmail(supabase, orgId);
        if (owner) {
          const planName =
            sub.product?.name ||
            (planKey || "").charAt(0).toUpperCase() +
              (planKey || "").slice(1);
          const endDate = sub.currentPeriodEnd
            ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "soon";

          await sendSubscriptionCanceledEmail({
            to: owner.email,
            name: owner.name,
            companyName: owner.orgName,
            planName,
            endDate,
            isImmediate: false,
          }).catch((err) =>
            console.error("[Email] Cancellation email failed:", err)
          );
        }
      }
    }
  },
  onSubscriptionRevoked: async (payload) => {
    const sub = payload.data;
    const orgId = (sub.metadata as Record<string, string>)?.organization_id;
    const supabase = getSupabase();

    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("polar_subscription_id", sub.id);

    // Send immediate cancellation email
    if (orgId) {
      const owner = await getOrgOwnerEmail(supabase, orgId);
      if (owner) {
        const planName =
          sub.product?.name || "your plan";

        await sendSubscriptionCanceledEmail({
          to: owner.email,
          name: owner.name,
          companyName: owner.orgName,
          planName,
          endDate: new Date().toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          isImmediate: true,
        }).catch((err) =>
          console.error("[Email] Revocation email failed:", err)
        );
      }
    }
  },
});
