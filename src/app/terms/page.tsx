"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300">
      <div className="mx-auto max-w-3xl px-6 py-24 md:px-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          Back to iWorkr
        </Link>

        <h1 className="mb-2 text-3xl font-medium tracking-tight text-zinc-100">
          Terms of Service
        </h1>
        <p className="mb-12 text-sm text-zinc-500">
          Last updated: February 16, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-zinc-400">
          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using iWorkr, you agree to be bound by these Terms
              of Service. If you do not agree with any part of these terms, you
              may not use our service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              2. Service Description
            </h2>
            <p>
              iWorkr provides a cloud-based platform for field service
              management, including job scheduling, invoicing, client management,
              and team coordination tools.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              3. Account Responsibilities
            </h2>
            <p>
              You are responsible for maintaining the security of your account
              credentials and for all activities that occur under your account.
              You must notify us immediately of any unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              4. Payment Terms
            </h2>
            <p>
              Subscription fees are billed in advance on a monthly or annual
              basis. All fees are non-refundable except as required by law or as
              explicitly stated in our refund policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              5. Contact
            </h2>
            <p>
              For questions about these terms, contact us at{" "}
              <a
                href="mailto:legal@iworkr.com"
                className="text-zinc-200 underline underline-offset-2 hover:text-white"
              >
                legal@iworkr.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
