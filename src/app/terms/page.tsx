import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "iWorkr Terms of Service — rules of engagement, subscription terms, liability, and account responsibilities for our field service management platform.",
};

function LastUpdated({ date }: { date: string }) {
  return (
    <p className="mb-8 text-sm text-zinc-500">
      Last updated: <span className="text-zinc-300">{date}</span>
    </p>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300">
      <div className="mx-auto max-w-3xl px-6 py-24 md:px-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-[#00E676]"
        >
          <ArrowLeft size={14} />
          Back to iWorkr
        </Link>

        <h1 className="mb-2 text-3xl font-medium tracking-tight text-[#EDEDED]">
          Terms of Service
        </h1>
        <LastUpdated date="February 16, 2026" />

        <div className="space-y-10 text-[15px] leading-relaxed text-[#A1A1AA]">
          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              1. Acceptance of Terms
            </h2>
            <p>
              Welcome to iWorkr. By accessing our website at{" "}
              <a href="https://iworkrapp.com" className="text-white transition-colors hover:text-[#00E676]">
                iworkrapp.com
              </a>{" "}
              and using our services, you agree to be bound by the following terms and conditions
              (&quot;Terms&quot;). If you do not agree with any part of these Terms, you must not
              use the Service.
            </p>
            <p className="mt-3">
              These Terms constitute a legally binding agreement between you (&quot;User&quot;,
              &quot;you&quot;) and iWorkr Pty Ltd (&quot;iWorkr&quot;, &quot;we&quot;,
              &quot;us&quot;) governing your access to and use of the iWorkr platform, including
              all associated mobile applications, APIs, and documentation.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              2. Service Description
            </h2>
            <p>
              iWorkr provides a cloud-based platform for field service management, including but
              not limited to: job scheduling and dispatch, invoicing and payment processing, client
              relationship management, team coordination and RBAC (Role-Based Access Control),
              asset and inventory tracking, real-time location services, and automated workflows.
            </p>
            <p className="mt-3">
              We strive for 99.9% uptime but do not guarantee uninterrupted access. We reserve
              the right to modify, suspend, or discontinue features at any time with reasonable
              notice. Scheduled maintenance windows will be communicated in advance.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              3. Account Responsibilities
            </h2>
            <p>
              You are responsible for maintaining the confidentiality and security of your account
              credentials, including passwords and API keys. You must notify us immediately of any
              unauthorized access or suspected breach.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>
                <strong className="text-zinc-200">Organization Owners</strong> are responsible for
                managing team access via the RBAC permissions matrix.
              </li>
              <li>
                <strong className="text-zinc-200">Administrators</strong> must ensure all team
                members comply with these Terms.
              </li>
              <li>
                You may not share login credentials or allow unauthorized third parties to access
                your account.
              </li>
              <li>
                All activities that occur under your account are your responsibility.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              4. Subscription &amp; Billing
            </h2>
            <p>
              Subscription fees are billed in advance on a monthly or annual basis through our
              payment processor, Stripe. All fees are quoted in your local currency and are
              exclusive of applicable taxes unless otherwise stated.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Subscriptions auto-renew unless cancelled before the end of the current billing period.</li>
              <li>Fees are non-refundable except as required by applicable law or explicitly stated in our refund policy.</li>
              <li>We reserve the right to modify pricing with 30 days&apos; notice to active subscribers.</li>
              <li>Failed payment attempts may result in service suspension after a 7-day grace period.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              5. Acceptable Use
            </h2>
            <p>You agree not to use the Service to:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Violate any applicable local, state, national, or international law.</li>
              <li>Transmit malicious code, spam, or any content that could harm the platform or other users.</li>
              <li>Attempt to gain unauthorized access to any part of the Service, other accounts, or systems.</li>
              <li>Reverse-engineer, decompile, or disassemble any portion of the software.</li>
              <li>Use automated tools (scrapers, bots) to extract data without explicit written permission.</li>
              <li>Impersonate another person or entity.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              6. Intellectual Property
            </h2>
            <p>
              The iWorkr platform, including its design, code, logos, trademarks, and
              documentation, is the exclusive property of iWorkr Pty Ltd. You retain ownership of
              all data you input into the platform (jobs, clients, invoices, etc.).
            </p>
            <p className="mt-3">
              By using the Service, you grant iWorkr a limited, non-exclusive license to process
              your data solely for the purpose of providing and improving the Service.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              7. Termination
            </h2>
            <p>
              Either party may terminate this agreement at any time. You may cancel your
              subscription through the Settings page or by contacting support.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>
                We reserve the right to suspend or terminate accounts that violate these Terms,
                engage in fraudulent activity, or abuse the platform.
              </li>
              <li>
                Upon termination, your data will be retained for 30 days to allow export, after
                which it will be permanently deleted.
              </li>
              <li>
                Suspension for non-payment does not release you from outstanding payment
                obligations.
              </li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, iWorkr shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including but not limited to
              loss of profits, data, business, or goodwill, arising out of or in connection with
              your use of the Service.
            </p>
            <p className="mt-3">
              Our total liability shall not exceed the amount you have paid for the Service in the
              twelve (12) months preceding the claim. This limitation applies regardless of the
              theory of liability (contract, tort, strict liability, or otherwise).
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              9. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold harmless iWorkr, its officers, directors, employees,
              and affiliates from any claims, damages, losses, or expenses arising from your use
              of the Service, your violation of these Terms, or your violation of any third-party
              rights.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              10. Modifications to Terms
            </h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated
              via email or in-app notification at least 14 days before they take effect. Continued
              use of the Service after changes become effective constitutes acceptance of the
              revised Terms.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              11. Governing Law
            </h2>
            <p>
              These Terms are governed by the laws of Australia. Any disputes arising from these
              Terms shall be resolved in the courts of New South Wales, Australia.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              12. Contact
            </h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a
                href="mailto:legal@iworkr.com"
                className="text-white underline underline-offset-2 transition-colors hover:text-[#00E676]"
              >
                legal@iworkr.com
              </a>{" "}
              or visit our{" "}
              <Link href="/contact" className="text-white underline underline-offset-2 transition-colors hover:text-[#00E676]">
                Contact page
              </Link>
              .
            </p>
          </section>
        </div>

        {/* Bottom nav */}
        <div className="mt-16 flex items-center gap-4 border-t border-white/[0.06] pt-8 text-sm text-zinc-600">
          <Link href="/privacy" className="transition-colors hover:text-[#00E676]">Privacy Policy</Link>
          <span className="text-zinc-800">|</span>
          <Link href="/cookies" className="transition-colors hover:text-[#00E676]">Cookie Policy</Link>
          <span className="text-zinc-800">|</span>
          <Link href="/contact" className="transition-colors hover:text-[#00E676]">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
