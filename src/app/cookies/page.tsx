/**
 * @page /cookies
 * @status COMPLETE
 * @description Cookie policy page with EU Cookie Law compliance details
 * @lastAudit 2026-03-22
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "iWorkr Cookie Policy — how we use cookies, what types we set, and how to manage your preferences. EU Cookie Law compliant.",
};

function LastUpdated({ date }: { date: string }) {
  return (
    <p className="mb-8 text-sm text-[var(--text-muted)]">
      Last updated: <span className="text-[var(--text-primary)]">{date}</span>
    </p>
  );
}

export default function CookiePolicyPage() {
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-body)]">
      {/* Noise texture overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/[0.03] blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 md:px-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--brand)]"
        >
          <ArrowLeft size={14} />
          Back to iWorkr
        </Link>

        <span className="mb-3 block font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Legal</span>
        <h1 className="mb-2 text-3xl font-medium tracking-tight text-[var(--text-heading)]">
          Cookie Policy
        </h1>
        <LastUpdated date="February 16, 2026" />

        <div className="space-y-10 text-[15px] leading-relaxed text-[var(--text-body)]">
          {/* Intro */}
          <section>
            <p>
              This Cookie Policy explains how iWorkr Pty Ltd (&quot;iWorkr&quot;, &quot;we&quot;,
              &quot;us&quot;) uses cookies and similar tracking technologies when you visit our
              website at{" "}
              <a href="https://iworkrapp.com" className="text-[var(--text-primary)] transition-colors hover:text-[var(--brand)]">
                iworkrapp.com
              </a>{" "}
              and use our platform.
            </p>
          </section>

          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[var(--text-heading)]">
              1. What Are Cookies?
            </h2>
            <p>
              Cookies are small text files stored on your device (computer, tablet, or mobile) when
              you visit a website. They are widely used to make websites work more efficiently, as
              well as to provide information to site owners.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[var(--text-heading)]">
              2. Types of Cookies We Use
            </h2>

            {/* Essential */}
            <div className="mt-4 rounded-lg border border-[var(--border-base)] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-[var(--brand)]" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Essential Cookies</h3>
                <span className="rounded-full bg-[rgba(16,185,129,0.1)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand)]">
                  Always Active
                </span>
              </div>
              <p className="mt-2 text-sm">
                These cookies are necessary for the platform to function. They enable core
                functionality such as authentication sessions, security tokens, and user
                preferences. Without these cookies, the Service cannot operate.
              </p>
              <div className="mt-3 overflow-hidden rounded-md border border-white/[0.04]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Cookie</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Purpose</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">sb-access-token</td>
                      <td className="px-3 py-1.5">Supabase authentication session</td>
                      <td className="px-3 py-1.5">1 hour</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">sb-refresh-token</td>
                      <td className="px-3 py-1.5">Session renewal</td>
                      <td className="px-3 py-1.5">7 days</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">__vercel_live_token</td>
                      <td className="px-3 py-1.5">Deployment preview access</td>
                      <td className="px-3 py-1.5">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Analytics */}
            <div className="mt-4 rounded-lg border border-[var(--border-base)] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Analytics Cookies</h3>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                  Optional
                </span>
              </div>
              <p className="mt-2 text-sm">
                These cookies help us understand how visitors interact with our website by
                collecting and reporting anonymous usage data. This information helps us improve
                the platform.
              </p>
              <div className="mt-3 overflow-hidden rounded-md border border-white/[0.04]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Cookie</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Provider</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">ph_*</td>
                      <td className="px-3 py-1.5">PostHog</td>
                      <td className="px-3 py-1.5">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">_ga / _gid</td>
                      <td className="px-3 py-1.5">Google Analytics</td>
                      <td className="px-3 py-1.5">2 years / 24 hours</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Functional */}
            <div className="mt-4 rounded-lg border border-[var(--border-base)] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-500" />
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Functional Cookies</h3>
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                  Optional
                </span>
              </div>
              <p className="mt-2 text-sm">
                These cookies enable enhanced functionality and personalization, such as remembering
                your preferred theme (dark/light), language, and region settings.
              </p>
              <div className="mt-3 overflow-hidden rounded-md border border-white/[0.04]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Cookie</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Purpose</th>
                      <th className="px-3 py-1.5 text-left font-medium text-[var(--text-muted)]">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">theme</td>
                      <td className="px-3 py-1.5">Dark/light mode preference</td>
                      <td className="px-3 py-1.5">1 year</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 font-mono text-[var(--text-primary)]">locale</td>
                      <td className="px-3 py-1.5">Language / region preference</td>
                      <td className="px-3 py-1.5">1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[var(--text-heading)]">
              3. How to Manage Your Preferences
            </h2>
            <p>
              You can control and manage cookies in several ways:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>
                <strong className="text-[var(--text-primary)]">Browser Settings:</strong> Most browsers allow you
                to refuse or delete cookies via their settings. Note that disabling essential cookies
                will prevent you from using the platform.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Opt-Out Links:</strong> For analytics cookies, you
                can opt out via{" "}
                <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--brand)]">
                  Google Analytics Opt-out
                </a>{" "}
                or through PostHog&apos;s built-in consent mechanisms.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Do Not Track:</strong> We honor Do Not Track (DNT)
                browser signals where technically feasible.
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[var(--text-heading)]">
              4. Third-Party Cookies
            </h2>
            <p>
              Some cookies are placed by third-party services that appear on our pages. We do not
              control these cookies. Please refer to the respective third-party privacy policies:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--brand)]">
                  Stripe Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--brand)]">
                  PostHog Privacy Policy
                </a>
              </li>
              <li>
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--brand)]">
                  Google Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[var(--text-heading)]">
              5. Changes to This Policy
            </h2>
            <p>
              We may update this Cookie Policy to reflect changes in our practices or for
              regulatory reasons. We will post any changes on this page and update the &quot;Last
              Updated&quot; date above.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-medium text-[var(--text-heading)]">
              6. Contact
            </h2>
            <p>
              If you have questions about our use of cookies, contact us at{" "}
              <a
                href="mailto:privacy@iworkr.com"
                className="text-[var(--text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--brand)]"
              >
                privacy@iworkr.com
              </a>
              .
            </p>
          </section>
        </div>

        {/* Bottom nav */}
        <div className="mt-16 flex items-center gap-4 border-t border-[var(--border-base)] pt-8 text-sm text-[var(--text-dim)]">
          <Link href="/terms" className="transition-colors hover:text-[var(--brand)]">Terms of Service</Link>
          <span className="text-[var(--border-base)]">|</span>
          <Link href="/privacy" className="transition-colors hover:text-[var(--brand)]">Privacy Policy</Link>
          <span className="text-[var(--border-base)]">|</span>
          <Link href="/contact" className="transition-colors hover:text-[var(--brand)]">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}
