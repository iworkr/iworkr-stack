import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "iWorkr Privacy Policy — how we collect, use, store, and protect your personal data. GDPR and CCPA compliant.",
};

function LastUpdated({ date }: { date: string }) {
  return (
    <p className="mb-8 text-sm text-zinc-500">
      Last updated: <span className="text-zinc-300">{date}</span>
    </p>
  );
}

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <LastUpdated date="February 16, 2026" />

        <div className="space-y-10 text-[15px] leading-relaxed text-[#A1A1AA]">
          {/* Intro */}
          <section>
            <p>
              iWorkr Pty Ltd (&quot;iWorkr&quot;, &quot;we&quot;, &quot;us&quot;) is committed to
              protecting your privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our platform at{" "}
              <a href="https://iworkrapp.com" className="text-white transition-colors hover:text-[#00E676]">
                iworkrapp.com
              </a>{" "}
              and associated mobile applications.
            </p>
          </section>

          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              1. Data We Collect
            </h2>

            <h3 className="mb-2 mt-4 text-sm font-medium text-zinc-200">Account Data</h3>
            <p>
              Name, email address, phone number, password hash, company name, and billing address.
              This data is provided by you during registration and account setup.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-medium text-zinc-200">Operational Data</h3>
            <p>
              Job details, client lists, invoices, asset inventories, schedules, form responses,
              and any other content you input into the platform. This data is owned by you and
              processed solely to deliver the Service.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-medium text-zinc-200">Location Data</h3>
            <p>
              Real-time GPS coordinates of technicians who have enabled location sharing. Location
              data is collected <strong className="text-zinc-200">only during active working hours</strong> as
              configured by the organization administrator, and is used for dispatch optimization
              and job tracking.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-medium text-zinc-200">Usage &amp; Device Data</h3>
            <p>
              Browser type, operating system, IP address, pages visited, feature usage patterns,
              and device identifiers. This data is collected automatically through cookies and
              analytics tools to improve the Service.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-medium text-zinc-200">Payment Data</h3>
            <p>
              Payment card details are processed and stored exclusively by our payment processor,{" "}
              <strong className="text-zinc-200">Stripe</strong>. iWorkr does not store full card numbers,
              CVVs, or bank account details on our servers.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              2. How We Use Your Data
            </h2>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>To operate, maintain, and improve the iWorkr platform.</li>
              <li>To process transactions and send invoices, receipts, and payment confirmations.</li>
              <li>To communicate about your account, including security alerts and service updates.</li>
              <li>To provide customer support and respond to your requests.</li>
              <li>To enforce our Terms of Service and protect against abuse.</li>
              <li>To generate aggregated, anonymized analytics to improve the product.</li>
            </ul>
            <p className="mt-3 rounded-lg border border-[#00E676]/15 bg-[rgba(0,230,118,0.03)] px-4 py-3 text-sm text-zinc-300">
              <strong className="text-[#00E676]">We do not sell your personal data to third parties.</strong>{" "}
              Your data is used exclusively for delivering and improving the Service.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              3. Third-Party Processors
            </h2>
            <p>
              We share data with the following trusted third-party processors, each operating under
              strict data processing agreements:
            </p>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-300">Provider</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-300">Purpose</th>
                    <th className="px-4 py-2.5 text-left font-medium text-zinc-300">Data Shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-200">Supabase</td>
                    <td className="px-4 py-2.5">Database &amp; Authentication</td>
                    <td className="px-4 py-2.5">All operational data, auth credentials</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-200">Stripe</td>
                    <td className="px-4 py-2.5">Payment Processing</td>
                    <td className="px-4 py-2.5">Billing info, transaction amounts</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-200">Resend</td>
                    <td className="px-4 py-2.5">Transactional Emails</td>
                    <td className="px-4 py-2.5">Email addresses, message content</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-200">Vercel</td>
                    <td className="px-4 py-2.5">Hosting &amp; CDN</td>
                    <td className="px-4 py-2.5">Request logs, IP addresses</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-200">PostHog</td>
                    <td className="px-4 py-2.5">Product Analytics</td>
                    <td className="px-4 py-2.5">Anonymized usage events</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              4. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li><strong className="text-zinc-200">Encryption in transit:</strong> All data is transmitted over TLS 1.3.</li>
              <li><strong className="text-zinc-200">Encryption at rest:</strong> Database storage uses AES-256 encryption.</li>
              <li><strong className="text-zinc-200">Access control:</strong> Row-Level Security (RLS) enforces data isolation between organizations.</li>
              <li><strong className="text-zinc-200">Authentication:</strong> Passwords are hashed using bcrypt. MFA is available.</li>
              <li><strong className="text-zinc-200">Monitoring:</strong> Automated alerting for suspicious access patterns.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              5. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide
              the Service. Upon account deletion:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Personal data is deleted within 30 days.</li>
              <li>Operational data (jobs, invoices) is anonymized or deleted per your request.</li>
              <li>Backup copies are purged within 90 days.</li>
              <li>We may retain aggregated, anonymized data indefinitely for analytics purposes.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              6. Your Rights
            </h2>
            <p>
              Depending on your jurisdiction (GDPR, CCPA, Australian Privacy Act), you may have the
              following rights:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li><strong className="text-zinc-200">Access:</strong> Request a copy of all personal data we hold about you.</li>
              <li><strong className="text-zinc-200">Rectification:</strong> Correct inaccurate or incomplete data.</li>
              <li><strong className="text-zinc-200">Erasure:</strong> Request deletion of your personal data (&quot;Right to be Forgotten&quot;).</li>
              <li><strong className="text-zinc-200">Portability:</strong> Export your data in a machine-readable format (JSON/CSV).</li>
              <li><strong className="text-zinc-200">Restriction:</strong> Limit how we process your data in certain circumstances.</li>
              <li><strong className="text-zinc-200">Objection:</strong> Object to processing based on legitimate interests.</li>
              <li><strong className="text-zinc-200">Withdraw Consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@iworkr.com" className="text-white underline underline-offset-2 transition-colors hover:text-[#00E676]">
                privacy@iworkr.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              7. Cookies &amp; Tracking
            </h2>
            <p>
              We use cookies and similar technologies to maintain sessions, remember preferences,
              and analyze usage. For full details, see our{" "}
              <Link href="/cookies" className="text-white underline underline-offset-2 transition-colors hover:text-[#00E676]">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              8. Children&apos;s Privacy
            </h2>
            <p>
              iWorkr is not directed at individuals under the age of 16. We do not knowingly
              collect personal data from children. If you believe we have inadvertently collected
              such data, please contact us immediately.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              9. International Transfers
            </h2>
            <p>
              Your data may be transferred to and processed in countries outside your jurisdiction
              (including Australia and the United States). We ensure adequate safeguards are in
              place, including Standard Contractual Clauses for EU transfers.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via email or in-app notification. Continued use of the Service after
              changes take effect constitutes acceptance of the revised policy.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[#EDEDED]">
              11. Contact Our Data Protection Officer
            </h2>
            <p>
              For any questions or concerns about this policy or our data practices, contact
              our Data Protection Officer at{" "}
              <a
                href="mailto:privacy@iworkr.com"
                className="text-white underline underline-offset-2 transition-colors hover:text-[#00E676]"
              >
                privacy@iworkr.com
              </a>
              .
            </p>
          </section>
        </div>

        {/* Bottom nav */}
        <div className="mt-16 flex items-center gap-4 border-t border-white/[0.06] pt-8 text-sm text-zinc-600">
          <Link href="/terms" className="transition-colors hover:text-[#00E676]">Terms of Service</Link>
          <span className="text-zinc-800">|</span>
          <Link href="/cookies" className="transition-colors hover:text-[#00E676]">Cookie Policy</Link>
          <span className="text-zinc-800">|</span>
          <Link href="/contact" className="transition-colors hover:text-[#00E676]">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
