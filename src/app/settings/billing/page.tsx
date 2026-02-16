"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Check,
  Crown,
  ExternalLink,
  Loader2,
  Sparkles,
  Users,
  Zap,
  ArrowRight,
  CreditCard,
  AlertTriangle,
  Calendar,
  Shield,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useBillingStore } from "@/lib/billing-store";
import {
  PLANS,
  getPlanDisplayName,
  getBillingCycle,
  type PlanDefinition,
} from "@/lib/plans";

function PlanBadge({ planKey }: { planKey: string }) {
  const name = getPlanDisplayName(planKey);
  const colors: Record<string, string> = {
    Free: "border-zinc-700 text-zinc-500",
    Starter: "border-blue-500/30 text-blue-400 bg-blue-500/5",
    Standard: "border-violet-500/30 text-violet-400 bg-violet-500/5",
    Enterprise: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        colors[name] || colors.Free
      }`}
    >
      {name === "Free" ? null : <Crown size={10} />}
      {name}
    </span>
  );
}

function UsageMeter({
  label,
  current,
  max,
  icon: Icon,
}: {
  label: string;
  current: number;
  max: number;
  icon: React.ElementType;
}) {
  const pct = max === Infinity ? 0 : Math.min((current / max) * 100, 100);
  const isNearLimit = pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-zinc-400">
          <Icon size={13} strokeWidth={1.5} />
          {label}
        </div>
        <span className="text-[12px] tabular-nums text-zinc-500">
          {current} / {max === Infinity ? "∞" : max}
        </span>
      </div>
      {max !== Infinity && (
        <div className="h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`h-full rounded-full ${
              isNearLimit ? "bg-amber-500" : "bg-white/20"
            }`}
          />
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  isCurrentPlan,
  isYearly,
  onUpgrade,
  loading,
}: {
  plan: PlanDefinition;
  isCurrentPlan: boolean;
  isYearly: boolean;
  onUpgrade: (productId: string) => void;
  loading: boolean;
}) {
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

  return (
    <motion.div
      whileHover={isCurrentPlan ? undefined : { y: -2 }}
      transition={{ duration: 0.2 }}
      className={`relative flex flex-col rounded-xl border p-5 transition-colors ${
        isCurrentPlan
          ? "border-white/20 bg-white/[0.03]"
          : plan.highlighted
          ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.2)]"
          : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)] hover:border-[rgba(255,255,255,0.15)]"
      }`}
    >
      {plan.highlighted && !isCurrentPlan && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
      )}
      {isCurrentPlan && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-medium text-zinc-100">{plan.name}</h3>
            {plan.badge && !isCurrentPlan && (
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-medium text-violet-400">
                {plan.badge}
              </span>
            )}
            {isCurrentPlan && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-medium text-zinc-300">
                Current
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-zinc-600">{plan.description}</p>
        </div>
        <div className="text-right">
          {price === 0 ? (
            <span className="text-2xl font-medium text-zinc-400">Free</span>
          ) : (
            <div className="flex items-baseline gap-0.5">
              <span className="text-[13px] text-zinc-500">$</span>
              <span className="text-2xl font-medium tabular-nums text-zinc-100">{price}</span>
              <span className="text-[12px] text-zinc-600">/mo</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {plan.features.slice(0, 6).map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <Check size={11} className="shrink-0 text-zinc-600" />
            <span className="text-[11px] text-zinc-500">{f}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex-1" />

      {isCurrentPlan ? (
        <div className="mt-3 flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] py-2 text-[12px] text-zinc-600">
          <Check size={13} className="mr-1.5" />
          Your current plan
        </div>
      ) : plan.ctaLabel === "Contact sales" ? (
        <a
          href="mailto:sales@iworkr.com"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] py-2 text-[12px] text-zinc-400 transition-all hover:border-[rgba(255,255,255,0.2)] hover:text-zinc-200"
        >
          Contact Sales
          <ExternalLink size={11} />
        </a>
      ) : (
        <button
          onClick={() => onUpgrade(plan.polarProductId)}
          disabled={loading || !plan.polarProductId}
          className={`mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-all ${
            plan.highlighted
              ? "bg-white text-black hover:bg-zinc-200"
              : "border border-[rgba(255,255,255,0.15)] text-zinc-200 hover:bg-[rgba(255,255,255,0.05)]"
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <>
              Upgrade
              <ArrowRight size={12} />
            </>
          )}
        </button>
      )}
    </motion.div>
  );
}

export default function BillingPage() {
  const { currentOrg, currentMembership } = useAuthStore();
  const { subscription, plan, memberCount, loading, loadBilling } =
    useBillingStore();
  const [isYearly, setIsYearly] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const orgId = currentOrg?.id;
  const isAdmin =
    currentMembership?.role === "owner" || currentMembership?.role === "admin";

  useEffect(() => {
    if (orgId) loadBilling(orgId);
  }, [orgId, loadBilling]);

  function handleUpgrade(productId: string) {
    if (!productId) return;
    window.location.href = `/api/checkout?products=${productId}`;
  }

  function handleManageBilling() {
    // For now, open Polar portal. In future, integrate customerId from subscription.
    window.open("https://polar.sh/iworkr/portal", "_blank");
  }

  const currentPlanKey = subscription?.plan_key || "free";
  const billingCycle = getBillingCycle(currentPlanKey);
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;

  return (
    <>
      <h1 className="mb-2 text-2xl font-medium tracking-tight text-zinc-100">
        Billing
      </h1>
      <p className="mb-6 text-[13px] text-zinc-600">
        Manage your subscription plan and payment method.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Current Plan Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                  Current plan
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-medium text-zinc-100">
                    {plan.name}
                  </span>
                  <PlanBadge planKey={currentPlanKey} />
                </div>
                {billingCycle !== "free" && (
                  <p className="mt-1.5 text-[12px] text-zinc-600">
                    ${plan.monthlyPrice}/mo ·{" "}
                    {billingCycle === "yearly" ? "Billed annually" : "Billed monthly"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {subscription && isAdmin && (
                  <button
                    onClick={handleManageBilling}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[12px] text-zinc-400 transition-all hover:border-[rgba(255,255,255,0.2)] hover:text-zinc-200"
                  >
                    <CreditCard size={12} />
                    Manage billing
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setShowPlans(!showPlans)}
                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-zinc-200"
                  >
                    <Sparkles size={12} />
                    {showPlans ? "Hide plans" : "Change plan"}
                  </button>
                )}
              </div>
            </div>

            {/* Past due warning */}
            {subscription?.status === "past_due" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-400"
              >
                <AlertTriangle size={13} />
                Payment failed. Please update your payment method to avoid service interruption.
              </motion.div>
            )}

            {/* Cancel at period end warning */}
            {subscription?.cancel_at_period_end && periodEnd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-400"
              >
                <AlertTriangle size={13} />
                Your subscription will be canceled on{" "}
                {periodEnd.toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                .
              </motion.div>
            )}

            {/* Usage */}
            <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[rgba(255,255,255,0.06)] pt-5 sm:grid-cols-2">
              <UsageMeter
                label="Team members"
                current={memberCount}
                max={plan.limits.maxUsers}
                icon={Users}
              />
              <UsageMeter
                label="Automations"
                current={0}
                max={plan.limits.maxAutomations}
                icon={Zap}
              />
            </div>

            {/* Subscription details */}
            {subscription && periodEnd && (
              <div className="mt-4 flex flex-wrap gap-4 border-t border-[rgba(255,255,255,0.06)] pt-4">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                  <Calendar size={11} />
                  Next billing:{" "}
                  {periodEnd.toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
                  <Shield size={11} />
                  Status: {subscription.status}
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Plan Selection Grid ── */}
          <AnimatePresence>
            {showPlans && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Billing cycle toggle */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[14px] font-medium text-zinc-200">
                    Available plans
                  </h2>
                  <div className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-0.5">
                    <button
                      onClick={() => setIsYearly(false)}
                      className={`rounded-full px-3 py-1 text-[11px] transition-all ${
                        !isYearly
                          ? "bg-white text-black"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setIsYearly(true)}
                      className={`rounded-full px-3 py-1 text-[11px] transition-all ${
                        isYearly
                          ? "bg-white text-black"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      Yearly{" "}
                      <span className="text-[9px] text-emerald-500">-20%</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {PLANS.filter((p) => p.key !== "free" || currentPlanKey === "free").map(
                    (p) => (
                      <PlanCard
                        key={p.key}
                        plan={p}
                        isCurrentPlan={
                          p.key ===
                          currentPlanKey
                            .replace(/_monthly$/, "")
                            .replace(/_annual$/, "")
                            .replace(/_yearly$/, "")
                        }
                        isYearly={isYearly}
                        onUpgrade={handleUpgrade}
                        loading={false}
                      />
                    )
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Invoices Section ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-[rgba(255,255,255,0.08)]"
          >
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
              <span className="text-[11px] font-medium tracking-wider text-zinc-600 uppercase">
                Invoices
              </span>
              {subscription && (
                <button
                  onClick={handleManageBilling}
                  className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
                >
                  View all in portal →
                </button>
              )}
            </div>
            <div className="px-5 py-10 text-center">
              <CreditCard size={20} className="mx-auto mb-2 text-zinc-700" />
              <p className="text-[13px] text-zinc-600">
                {subscription
                  ? "View and manage invoices in your billing portal."
                  : "No invoices yet. Subscribe to a plan to get started."}
              </p>
            </div>
          </motion.div>

          {/* ── Not admin notice ── */}
          {!isAdmin && (
            <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.01)] px-4 py-3 text-[12px] text-zinc-600">
              Only workspace owners and admins can manage billing. Contact your
              admin to make changes.
            </div>
          )}
        </div>
      )}
    </>
  );
}
