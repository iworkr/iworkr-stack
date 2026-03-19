import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calendar, Shield, Trash2, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Google Calendar Integration | iWorkr",
  description:
    "Learn how iWorkr uses Google Calendar to synchronize your field service schedule. Full transparency on data access and security.",
};

export default function GoogleIntegrationPage() {
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-body)]">
      <div className="stealth-noise" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/[0.03] blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 md:px-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--brand)]"
        >
          <ArrowLeft size={14} />
          Back to iWorkr
        </Link>

        <span className="mb-3 block font-mono text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
          Integration
        </span>
        <h1 className="mb-2 text-3xl font-medium tracking-tight text-[var(--text-heading)]">
          Google Calendar Integration
        </h1>
        <p className="mb-10 text-[var(--text-muted)]">
          How iWorkr uses Google Calendar to keep your field service schedule in sync.
        </p>

        <div className="space-y-10 text-sm leading-relaxed">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Calendar size={18} className="text-[var(--brand)]" />
              <h2 className="text-lg font-medium text-[var(--text-heading)]">
                What We Access
              </h2>
            </div>
            <p>
              When you connect Google Calendar, iWorkr requests the following permissions:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>
                <strong className="text-[var(--text-primary)]">View and edit events on all your calendars</strong>{" "}
                — so we can display your Google Calendar events on the iWorkr Master Roster and create schedule blocks from iWorkr jobs.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">See your primary Google Account email address</strong>{" "}
                — to identify which Google account is connected.
              </li>
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Shield size={18} className="text-[var(--brand)]" />
              <h2 className="text-lg font-medium text-[var(--text-heading)]">
                How We Use Your Data
              </h2>
            </div>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>Calendar events are synchronized to the iWorkr Master Roster so dispatchers can see technician availability alongside Google Calendar commitments.</li>
              <li>When a job is scheduled in iWorkr, it can optionally be pushed to your Google Calendar so you see it in your phone&apos;s native calendar app.</li>
              <li>We use Google Cloud Pub/Sub push notifications to receive instant updates when your calendar changes — we do <strong className="text-[var(--text-primary)]">not</strong> poll your calendar.</li>
              <li>We do <strong className="text-[var(--text-primary)]">not</strong> read, access, or store email content, contacts, or any data beyond calendar events and your email address.</li>
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Lock size={18} className="text-[var(--brand)]" />
              <h2 className="text-lg font-medium text-[var(--text-heading)]">
                Security & Compliance
              </h2>
            </div>
            <ul className="list-disc space-y-1.5 pl-6">
              <li>OAuth tokens are encrypted at rest using AES-256-GCM before being stored in our database.</li>
              <li>All communication with Google APIs happens over TLS 1.3.</li>
              <li>iWorkr complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline">Google API Services User Data Policy</a>, including Limited Use requirements.</li>
              <li>We do <strong className="text-[var(--text-primary)]">not</strong> sell, share, or transfer your Google user data to third-party data brokers or advertising networks.</li>
              <li>Your data is isolated per organization using PostgreSQL Row-Level Security (RLS).</li>
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Trash2 size={18} className="text-[var(--brand)]" />
              <h2 className="text-lg font-medium text-[var(--text-heading)]">
                Disconnecting
              </h2>
            </div>
            <p>
              You can disconnect Google Calendar at any time from your{" "}
              <strong className="text-[var(--text-primary)]">Dashboard → Integrations</strong> page.
              When you disconnect:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Your OAuth tokens are immediately revoked at Google and deleted from our database.</li>
              <li>The Google Calendar push notification channel is stopped.</li>
              <li>Previously synced schedule blocks remain in iWorkr but are no longer updated from Google.</li>
            </ul>
          </section>

          <section className="rounded-lg border border-[var(--border-base)] bg-white/[0.02] p-5">
            <p className="text-[var(--text-muted)]">
              Questions about our Google Calendar integration?{" "}
              <a href="mailto:privacy@iworkrapp.com" className="text-[var(--brand)] hover:underline">
                Contact our privacy team
              </a>.
            </p>
            <div className="mt-3 flex gap-4 text-xs text-[var(--text-dim)]">
              <Link href="/privacy" className="hover:text-[var(--brand)]">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-[var(--brand)]">Terms of Service</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
