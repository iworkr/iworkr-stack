"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { CheckCircle, AlertTriangle, Loader2, Lock } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// ── Public Invoice Payment — Obsidian Checkout ───────────
// ═══════════════════════════════════════════════════════════

interface InvoiceData {
  id: string;
  invoice_number: string;
  organization_name: string;
  organization_logo: string | null;
  brand_color: string;
  client_name: string;
  client_email: string;
  line_items: { description: string; quantity: number; unit_price: number }[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: string;
  due_date: string;
  org_id: string;
}

export default function PayInvoicePage() {
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  async function fetchInvoice() {
    try {
      const res = await fetch(`/api/invoices/public/${invoiceId}`);
      if (!res.ok) throw new Error("Invoice not found");
      const data = await res.json();
      setInvoice(data);
    } catch {
      setError("This invoice could not be found or has already been paid.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-20">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-sm text-zinc-500">Loading invoice...</p>
        </div>
      </Shell>
    );
  }

  if (error || !invoice) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Lock className="w-6 h-6 text-rose-500" />
          </div>
          <h2 className="text-lg font-semibold text-white">Invoice Not Found</h2>
          <p className="text-sm text-zinc-500 text-center max-w-xs">
            {error || "This invoice may have expired or already been paid."}
          </p>
        </div>
      </Shell>
    );
  }

  if (invoice.status === "paid") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-white">Already Paid</h2>
          <p className="text-sm text-zinc-500">This invoice has been paid. Thank you!</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell brandColor={invoice.brand_color} logo={invoice.organization_logo} orgName={invoice.organization_name}>
      <div className="max-w-lg mx-auto w-full">
        {/* Invoice Header */}
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1">
            INVOICE {invoice.invoice_number}
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(invoice.total, invoice.currency)}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Due {new Date(invoice.due_date).toLocaleDateString()}</p>
        </div>

        {/* Line Items */}
        <div className="bg-zinc-950 border border-white/5 rounded-xl p-5 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-3">ITEMS</p>
          <div className="space-y-3">
            {invoice.line_items.map((item, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{item.description}</p>
                  <p className="text-xs text-zinc-600">{item.quantity} × {formatCurrency(item.unit_price, invoice.currency)}</p>
                </div>
                <p className="font-mono text-sm text-white ml-4">
                  {formatCurrency(item.quantity * item.unit_price, invoice.currency)}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 mt-4 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Subtotal</span>
              <span className="font-mono">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            {invoice.tax_amount > 0 && (
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Tax ({invoice.tax_rate}%)</span>
                <span className="font-mono">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-white pt-1">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment */}
        <PaymentSection invoice={invoice} />
      </div>
    </Shell>
  );
}

// ── Payment Section with Stripe Elements ─────────────────

function PaymentSection({ invoice }: { invoice: InvoiceData }) {
  const [clientSecret, setClientSecret] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createPaymentIntent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPaymentIntent() {
    try {
      const res = await fetch("/api/stripe/connect/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.id,
          orgId: invoice.org_id,
          amountCents: Math.round(invoice.total * 100),
          currency: invoice.currency,
        }),
      });
      const data = await res.json();
      setClientSecret(data.clientSecret);
      setStripeAccountId(data.stripeAccountId);
    } catch {
      // Silent fail — will show error state
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
      </div>
    );
  }

  if (!clientSecret || !stripeAccountId) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-rose-400">Unable to initialize payment. Please try again later.</p>
      </div>
    );
  }

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
    stripeAccount: stripeAccountId,
  });

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#10B981",
            colorBackground: "#09090B",
            colorText: "#EDEDED",
            colorDanger: "#F43F5E",
            borderRadius: "10px",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        },
      }}
    >
      <CheckoutForm total={invoice.total} currency={invoice.currency} />
    </Elements>
  );
}

// ── Checkout Form ────────────────────────────────────────

function CheckoutForm({ total, currency }: { total: number; currency: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError("");

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?success=true`,
      },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "Payment failed.");
      setProcessing(false);
    } else {
      setSucceeded(true);
      setProcessing(false);
    }
  }, [stripe, elements]);

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-semibold text-white">Payment Successful</h3>
        <p className="text-sm text-zinc-500">Thank you for your payment.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-zinc-950 border border-white/5 rounded-xl p-5 mb-4">
        <PaymentElement />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3.5 bg-white text-black font-semibold text-sm rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          `Pay ${formatCurrency(total, currency)}`
        )}
      </button>

      <p className="text-center text-[10px] text-zinc-700 mt-4">
        Secured by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
}

// ── Shell ────────────────────────────────────────────────

function Shell({
  children,
  brandColor,
  logo,
  orgName,
}: {
  children: React.ReactNode;
  brandColor?: string;
  logo?: string | null;
  orgName?: string;
}) {
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {logo && (
            <img src={logo} alt="" className="w-7 h-7 rounded object-contain" />
          )}
          <span className="text-sm font-medium text-zinc-400">{orgName || "iWorkr Pay"}</span>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-white/5 px-6 py-4">
        <p className="text-center text-[10px] text-zinc-700">
          Powered by iWorkr Pay
        </p>
      </footer>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}
