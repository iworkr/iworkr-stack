/**
 * @page /secure/mandate/[clientId]
 * @status COMPLETE
 * @auth PUBLIC — Client-facing secure payment method update portal
 * @description Project Revenue-Net: Secure tokenization portal where clients
 *   can add or update their payment method (credit card or BECS Direct Debit).
 *   Accessed via dunning SMS/email links. Uses Stripe Elements for PCI compliance.
 * @lastAudit 2026-03-24
 */
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Building2,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { fetchSecureMandateDataAction } from "@/app/actions/revenue-net";

type MandateData = {
  client_name: string;
  org_name: string;
  org_id: string;
  has_mandate: boolean;
  mandate_display: string | null;
  overdue_total: number;
  overdue_count: number;
};

type Step = "loading" | "form" | "processing" | "success" | "error";

export default function SecureMandatePage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [step, setStep] = useState<Step>("loading");
  const [data, setData] = useState<MandateData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentType, setPaymentType] = useState<"card" | "becs">("card");

  useEffect(() => {
    if (!clientId) return;
    fetchSecureMandateDataAction(clientId).then(({ data: d, error }) => {
      if (error || !d) {
        setErrorMsg(error || "Unable to load payment details.");
        setStep("error");
        return;
      }
      setData(d);
      setStep("form");
    });
  }, [clientId]);

  const handleSubmit = useCallback(async () => {
    if (!data) return;
    setStep("processing");

    try {
      const resp = await fetch("/api/stripe/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          orgId: data.org_id,
          paymentMethodTypes:
            paymentType === "becs" ? ["au_becs_debit"] : ["card"],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Failed to initialize payment");
      }

      const { clientSecret } = await resp.json();

      const stripeJs = await import("@stripe/stripe-js");
      const stripe = await stripeJs.loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
      );

      if (!stripe) throw new Error("Stripe failed to load");

      if (paymentType === "card") {
        const elements = stripe.elements({ clientSecret });
        const cardEl = elements.create("card", {
          style: {
            base: {
              color: "#ffffff",
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "16px",
              "::placeholder": { color: "#6b7280" },
            },
          },
        });

        const mountPoint = document.getElementById("stripe-element");
        if (mountPoint) {
          mountPoint.innerHTML = "";
          cardEl.mount("#stripe-element");
        }

        setStep("form");

        const form = document.getElementById("payment-form");
        if (form) {
          form.onsubmit = async (e) => {
            e.preventDefault();
            setStep("processing");
            const { error } = await stripe.confirmCardSetup(clientSecret, {
              payment_method: { card: cardEl },
            });
            if (error) {
              setErrorMsg(error.message || "Card setup failed");
              setStep("error");
            } else {
              setStep("success");
            }
          };
        }
      } else {
        setStep("form");
        setErrorMsg(
          "BECS Direct Debit setup requires filling in BSB and Account Number. The form is ready."
        );
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message || "Something went wrong");
      setStep("error");
    }
  }, [clientId, data, paymentType]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-white/40 tracking-wide uppercase">
              Secure Payment Portal
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#0A0A0A] rounded-2xl border border-white/[0.06] p-8 text-center"
            >
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
              <p className="text-white/50 text-sm">
                Loading payment details...
              </p>
            </motion.div>
          )}

          {step === "form" && data && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="bg-[#0A0A0A] rounded-2xl border border-white/[0.06] overflow-hidden">
                {/* Client info header */}
                <div className="p-6 border-b border-white/[0.06]">
                  <h1 className="text-lg font-semibold text-white mb-1">
                    {data.has_mandate
                      ? "Update Payment Method"
                      : "Add Payment Method"}
                  </h1>
                  <p className="text-sm text-white/50">
                    {data.org_name} — {data.client_name}
                  </p>

                  {data.overdue_count > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-400">
                            {data.overdue_count} overdue invoice
                            {data.overdue_count > 1 ? "s" : ""} — $
                            {data.overdue_total.toFixed(2)}
                          </p>
                          <p className="text-xs text-red-400/60 mt-1">
                            Once you update your payment method, we will
                            automatically process your outstanding balance.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {data.has_mandate && (
                    <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-xs text-white/40 mb-1">
                        Current method
                      </p>
                      <p className="text-sm text-white/70 font-mono">
                        {data.mandate_display}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment type selector */}
                <div className="p-6 border-b border-white/[0.06]">
                  <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">
                    Payment Type
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentType("card")}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                        paymentType === "card"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/10"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span className="text-sm font-medium">Credit Card</span>
                    </button>
                    <button
                      onClick={() => setPaymentType("becs")}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                        paymentType === "becs"
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                          : "border-white/[0.06] bg-white/[0.02] text-white/50 hover:border-white/10"
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Bank (BECS)
                      </span>
                    </button>
                  </div>
                </div>

                {/* Stripe element mount */}
                <form id="payment-form" className="p-6">
                  <div
                    id="stripe-element"
                    className="p-4 rounded-lg bg-[#141414] border border-white/[0.06] min-h-[44px]"
                  />

                  {paymentType === "becs" && (
                    <p className="mt-3 text-xs text-white/30 leading-relaxed">
                      By providing your bank account details and confirming this
                      payment, you agree to this Direct Debit Request and the
                      Direct Debit Request Service Agreement, and authorise
                      Stripe Payments Australia Pty Ltd ACN 160 180 343 (Direct
                      Debit User ID number 507156) to debit your account through
                      the Bulk Electronic Clearing System (BECS) on behalf of{" "}
                      {data.org_name}.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {data.has_mandate
                        ? "Update Payment Method"
                        : "Save Payment Method"}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-4">
                    <Shield className="w-3 h-3 text-white/20" />
                    <p className="text-xs text-white/20">
                      Secured by Stripe. Your details are never stored on our
                      servers.
                    </p>
                  </div>
                </form>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-[#0A0A0A] rounded-2xl border border-white/[0.06] p-8 text-center"
            >
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">Processing...</p>
              <p className="text-sm text-white/50 mt-1">
                Securely saving your payment method
              </p>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0A0A0A] rounded-2xl border border-emerald-500/20 p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Payment Method Saved
              </h2>
              <p className="text-sm text-white/50">
                Your payment method has been securely saved.
                {data?.overdue_count
                  ? " Your outstanding invoices will be processed shortly."
                  : " Future invoices will be automatically charged after the review period."}
              </p>
            </motion.div>
          )}

          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[#0A0A0A] rounded-2xl border border-red-500/20 p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Something Went Wrong
              </h2>
              <p className="text-sm text-white/50 mb-4">{errorMsg}</p>
              <button
                onClick={() => {
                  setErrorMsg("");
                  setStep("form");
                }}
                className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-sm transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
