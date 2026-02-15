"use client";

export default function BillingPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-medium tracking-tight text-zinc-100">Billing</h1>
      <p className="mb-6 text-[13px] text-zinc-600">Manage your subscription plan and payment method.</p>

      <div className="mb-6 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-5">
        <div className="mb-1 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Current plan</div>
        <div className="text-xl font-medium text-zinc-100">Free</div>
        <p className="mt-1 text-[12px] text-zinc-600">4 of 5 members used · Unlimited jobs</p>
        <button className="mt-4 rounded-md bg-white px-4 py-2 text-[13px] font-medium text-black hover:bg-zinc-200">Upgrade to Standard</button>
      </div>

      <div className="rounded-lg border border-[rgba(255,255,255,0.08)]">
        <div className="border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5 text-[11px] font-medium tracking-wider text-zinc-600 uppercase">Invoices</div>
        <div className="px-4 py-8 text-center text-[13px] text-zinc-600">No invoices yet</div>
      </div>
    </>
  );
}
