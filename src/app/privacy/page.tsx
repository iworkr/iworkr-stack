"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="mb-12 text-sm text-zinc-500">
          Last updated: February 16, 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-zinc-400">
          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              1. Information We Collect
            </h2>
            <p>
              iWorkr collects information you provide directly — such as your
              name, email, company details, and payment information — as well as
              usage data automatically gathered through cookies and analytics
              tools.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              2. How We Use Your Information
            </h2>
            <p>
              We use collected information to operate and improve the iWorkr
              platform, process transactions, communicate with you about your
              account, and provide customer support.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              3. Data Security
            </h2>
            <p>
              We implement industry-standard security measures including
              encryption in transit (TLS 1.3), encryption at rest (AES-256), and
              regular security audits to protect your data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              4. Your Rights
            </h2>
            <p>
              You have the right to access, correct, or delete your personal
              data at any time. Contact us at{" "}
              <a
                href="mailto:privacy@iworkr.com"
                className="text-zinc-200 underline underline-offset-2 hover:text-white"
              >
                privacy@iworkr.com
              </a>{" "}
              to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-200">
              5. Contact
            </h2>
            <p>
              For questions about this policy, contact our Data Protection
              Officer at{" "}
              <a
                href="mailto:privacy@iworkr.com"
                className="text-zinc-200 underline underline-offset-2 hover:text-white"
              >
                privacy@iworkr.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
