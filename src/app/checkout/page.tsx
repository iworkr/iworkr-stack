"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  loadStripe,
  type StripeElementsOptions,
} from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  ArrowLeft,
  Check,
  Shield,
  Zap,
  Loader2,
  Lock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { getPlanByKey, type PlanDefinition } from "@/lib/plans";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// ── Checkout Form (inside Elements provider) ──
function CheckoutForm({
  plan,
  type,
  onSuccess,
}: {
  plan: PlanDefinition;
  type: "setup" | "payment";
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const returnUrl = `${window.location.origin}/checkout?success=true&plan=${plan.key}`;

    let result;

    if (type === "setup") {
      result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
    } else {
      result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
    }

    if (result.error) {
      setError(result.error.message || "Something went wrong.");
      setProcessing(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <PaymentElement
          options={{
            layout: "tabs",
            defaultValues: {
              billingDetails: {
                name: "",
                email: "",
              },
            },
          }}
        />
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-[13px] text-rose-400"
        >
          {error}
        </motion.div>
      )}

      <motion.button
        type="submit"
        disabled={!stripe || processing}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white py-3.5 text-[14px] font-medium text-black transition-all hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={14} />
            {plan.hasFreeTrial
              ? `Start ${plan.trialDays}-day free trial`
              : `Subscribe — $${plan.monthlyPrice}/mo`}
          </>
        )}
      </motion.button>

      <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-600">
        <div className="flex items-center gap-1">
          <Shield size={10} />
          <span>256-bit SSL</span>
        </div>
        <div className="flex items-center gap-1">
          <Lock size={10} />
          <span>PCI compliant</span>
        </div>
        <div className="flex items-center gap-1">
          <Check size={10} />
          <span>Cancel anytime</span>
        </div>
      </div>
    </form>
  );
}

// ── Success State ──
function CheckoutSuccess({ planName }: { planName: string }) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/dashboard"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10"
      >
        <CheckCircle2 size={32} className="text-emerald-400" />
      </motion.div>
      <h2 className="text-xl font-medium text-zinc-100">Welcome to {planName}</h2>
      <p className="mt-2 text-[13px] text-zinc-500">
        Your workspace is being upgraded. Redirecting to dashboard...
      </p>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 4, ease: "linear" }}
        className="mt-8 h-0.5 w-full max-w-xs rounded-full bg-emerald-500/30"
      />
    </motion.div>
  );
}

// ── Main Checkout Page ──
function CheckoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, currentOrg } = useAuthStore();

  const planKey = searchParams.get("plan") || "pro";
  const interval = searchParams.get("interval") || "monthly";
  const isSuccess = searchParams.get("success") === "true";

  const plan = getPlanByKey(planKey);
  const isYearly = interval === "yearly";
  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const priceId = isYearly ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"setup" | "payment">("setup");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(isSuccess);
  const initRef = useRef(false);

  async function createSubscription() {
    if (!currentOrg?.id || !priceId) return;

    try {
      const res = await fetch("/api/stripe/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, orgId: currentOrg.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoadError(data.error || "Failed to initialize checkout");
        return;
      }

      setClientSecret(data.clientSecret);
      setIntentType(data.type);
    } catch {
      setLoadError("Network error. Please try again.");
    }
  }

  useEffect(() => {
    if (!user) {
      router.push(`/auth?next=/checkout?plan=${planKey}&interval=${interval}`);
      return;
    }
    if (!isSuccess && currentOrg?.id && priceId && !initRef.current) {
      initRef.current = true;
      createSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentOrg?.id, priceId, isSuccess]);

  if (success) {
    return <CheckoutSuccess planName={plan.name} />;
  }

  const elementsOptions: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#10B981",
        colorBackground: "#0A0A0A",
        colorText: "#ededed",
        colorTextSecondary: "#71717a",
        colorDanger: "#f43f5e",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSizeBase: "14px",
        borderRadius: "10px",
        spacingUnit: "4px",
      },
      rules: {
        ".Input": {
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "none",
          padding: "12px 14px",
        },
        ".Input:focus": {
          border: "1px solid rgba(16,185,129,0.4)",
          boxShadow: "0 0 0 1px rgba(16,185,129,0.15)",
        },
        ".Label": {
          fontWeight: "500",
          fontSize: "12px",
          marginBottom: "6px",
          color: "#a1a1aa",
        },
        ".Tab": {
          border: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "#0A0A0A",
        },
        ".Tab--selected": {
          border: "1px solid rgba(16,185,129,0.3)",
          backgroundColor: "#141414",
        },
      },
    },
  };

  return (
    <div className="relative flex min-h-screen bg-[#050505]">
      {/* Noise */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.015] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Left: Order Summary */}
      <div className="hidden w-[440px] flex-col border-r border-white/[0.06] bg-[#0A0A0A] p-10 lg:flex">
        <Link
          href="/#pricing"
          className="mb-10 flex items-center gap-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={13} />
          Back to pricing
        </Link>

        <div className="flex-1">
          {/* Plan card */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <Sparkles size={16} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-medium text-zinc-100">
                  iWorkr {plan.name}
                </h3>
                <p className="text-[11px] text-zinc-600">{plan.description}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-white/[0.06] pt-4">
              {plan.features.slice(0, 6).map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Check size={12} className="shrink-0 text-emerald-500/60" />
                  <span className="text-[12px] text-zinc-400">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price breakdown */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-zinc-500">{plan.name} plan</span>
              <span className="text-zinc-300">
                ${price}/mo
              </span>
            </div>
            {isYearly && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-zinc-600">Billed annually</span>
                <span className="text-zinc-500">
                  ${price * 12}/yr
                </span>
              </div>
            )}
            {plan.hasFreeTrial && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-emerald-500/80">
                  {plan.trialDays}-day free trial
                </span>
                <span className="text-emerald-500/80">−${price}</span>
              </div>
            )}
            <div className="border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium text-zinc-200">
                  Due today
                </span>
                <span className="text-[18px] font-medium tabular-nums text-zinc-100">
                  {plan.hasFreeTrial ? "$0.00" : `$${price}.00`}
                </span>
              </div>
              {plan.hasFreeTrial && (
                <p className="mt-1 text-[11px] text-zinc-600">
                  Then ${price}/mo after {plan.trialDays}-day trial
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-auto space-y-3 border-t border-white/[0.06] pt-6">
          <div className="flex items-center gap-2.5 text-[11px] text-zinc-600">
            <Shield size={13} className="shrink-0 text-zinc-600" />
            Secured by Stripe. Your card details never touch our servers.
          </div>
          <div className="flex items-center gap-2.5 text-[11px] text-zinc-600">
            <Zap size={13} className="shrink-0 text-zinc-600" />
            Cancel or change plans anytime from your dashboard.
          </div>
        </div>
      </div>

      {/* Right: Payment Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 lg:px-16">
        {/* Mobile back link */}
        <div className="mb-8 w-full max-w-md lg:hidden">
          <Link
            href="/#pricing"
            className="flex items-center gap-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft size={13} />
            Back to pricing
          </Link>
        </div>

        <div className="w-full max-w-md">
          {/* Mobile plan summary */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-zinc-100">
                  iWorkr {plan.name}
                </h2>
                <p className="text-[12px] text-zinc-600">{plan.description}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-medium tabular-nums text-zinc-100">
                  ${price}
                </span>
                <span className="text-[12px] text-zinc-600">/mo</span>
              </div>
            </div>
            {plan.hasFreeTrial && (
              <div className="mt-2 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-400">
                {plan.trialDays}-day free trial · No charge today
              </div>
            )}
          </div>

          <h1 className="mb-1 text-[18px] font-medium text-zinc-100">
            Payment details
          </h1>
          <p className="mb-8 text-[13px] text-zinc-600">
            {plan.hasFreeTrial
              ? "Add your card to start your free trial. You won't be charged today."
              : "Enter your payment details to subscribe."}
          </p>

          {loadError ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center"
            >
              <p className="text-[13px] text-rose-400">{loadError}</p>
              <button
                onClick={() => {
                  setLoadError(null);
                  createSubscription();
                }}
                className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-[12px] text-zinc-300 transition-colors hover:bg-white/5"
              >
                Try again
              </button>
            </motion.div>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <CheckoutForm
                plan={plan}
                type={intentType}
                onSuccess={() => setSuccess(true)}
              />
            </Elements>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-zinc-600" />
              <p className="mt-3 text-[12px] text-zinc-600">
                Preparing checkout...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050505]">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
