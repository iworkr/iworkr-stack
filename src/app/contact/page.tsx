/**
 * @page /contact
 * @status COMPLETE
 * @description Public contact form with support, feedback, and bug report categories
 * @lastAudit 2026-03-22
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, CheckCircle, Mail, MessageSquare, Bug, HelpCircle } from "lucide-react";
import { submitContactForm } from "@/app/actions/contact";

const subjectOptions = [
  { value: "support", label: "Support", icon: HelpCircle, description: "I need help with the platform" },
  { value: "sales", label: "Sales", icon: MessageSquare, description: "Pricing and enterprise plans" },
  { value: "bug", label: "Bug Report", icon: Bug, description: "Something isn't working right" },
  { value: "other", label: "Other", icon: Mail, description: "General questions or feedback" },
] as const;

type SubjectType = (typeof subjectOptions)[number]["value"];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<SubjectType>("support");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || sent) return;

    setError(null);
    setSending(true);

    const result = await submitContactForm({ name, email, subject, message });

    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "Something went wrong.");
    }
    setSending(false);
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-body)]">
      {/* Noise texture overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/[0.03] blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 md:px-12">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--brand)]"
        >
          <ArrowLeft size={14} />
          Back to iWorkr
        </Link>

        <span className="mb-3 block font-mono text-[9px] font-bold tracking-widest text-[var(--brand)] uppercase">Get in touch</span>
        <h1 className="mb-2 text-3xl font-medium tracking-tight text-[var(--text-heading)]">
          Contact Us
        </h1>
        <p className="mb-10 text-[15px] leading-relaxed text-[var(--text-body)]">
          Have a question, need support, or want to chat about enterprise plans? We&apos;d love to
          hear from you. Our team typically responds within 24 hours.
        </p>

        <AnimatePresence mode="wait">
          {sent ? (
            /* ── Success State ──────────────────────────── */
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center rounded-2xl border border-[var(--brand)]/20 bg-[rgba(16,185,129,0.03)] px-8 py-16 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] shadow-[0_0_40px_-8px_rgba(16,185,129,0.5)]"
              >
                <CheckCircle size={24} className="text-black" />
              </motion.div>
              <h2 className="text-xl font-medium text-[var(--text-heading)]">Message Sent</h2>
              <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
                Thanks, {name}! We&apos;ve sent you a confirmation email. Our team will get back to
                you within 24 hours.
              </p>
              <Link
                href="/"
                className="mt-6 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--brand)]"
              >
                Return to Home
              </Link>
            </motion.div>
          ) : (
            /* ── Contact Form ──────────────────────────── */
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Name & Email row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                    Your Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--border-base)] bg-[var(--card-bg)] px-3 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--brand)]/30 focus:shadow-[var(--brand-glow-subtle)]"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="h-10 w-full rounded-[var(--radius-input)] border border-[var(--border-base)] bg-[var(--card-bg)] px-3 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--brand)]/30 focus:shadow-[var(--brand-glow-subtle)]"
                  />
                </div>
              </div>

              {/* Subject selector — card picker */}
              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--text-muted)]">
                  What can we help with?
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {subjectOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = subject === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSubject(opt.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-[var(--radius-input)] border p-3 text-center transition-all ${
                          isSelected
                            ? "border-[var(--brand)]/30 bg-[rgba(16,185,129,0.05)] text-[var(--brand)]"
                            : "border-[var(--border-base)] bg-[var(--card-bg)] text-[var(--text-muted)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <Icon size={16} />
                        <span className="text-[11px] font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="w-full rounded-[var(--radius-input)] border border-[var(--border-base)] bg-[var(--card-bg)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--brand)]/30 focus:shadow-[var(--brand-glow-subtle)]"
                />
              </div>

              {/* Error */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-500/15 bg-red-500/5 px-4 py-2.5 text-sm text-red-400"
                >
                  {error}
                </motion.p>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--text-dim)]">
                  Or email directly:{" "}
                  <a
                    href="mailto:support@iworkr.com"
                    className="text-[var(--text-muted)] underline underline-offset-2 transition-colors hover:text-[var(--brand)]"
                  >
                    support@iworkr.com
                  </a>
                </p>
                <button
                  type="submit"
                  disabled={sending}
                  className={`flex items-center gap-2 rounded-[var(--radius-button)] bg-[var(--brand)] px-5 py-2.5 text-[13px] font-medium text-black shadow-[var(--brand-glow)] transition-all hover:bg-[var(--brand-hover)] hover:shadow-[0_0_30px_-4px_rgba(16,185,129,0.5)] ${
                    sending ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  <Send size={14} />
                  {sending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Bottom nav */}
        <div className="mt-16 flex items-center gap-4 border-t border-[var(--border-base)] pt-8 text-sm text-[var(--text-dim)]">
          <Link href="/terms" className="transition-colors hover:text-[var(--brand)]">Terms of Service</Link>
          <span className="text-[var(--border-base)]">|</span>
          <Link href="/privacy" className="transition-colors hover:text-[var(--brand)]">Privacy Policy</Link>
          <span className="text-[var(--border-base)]">|</span>
          <Link href="/cookies" className="transition-colors hover:text-[var(--brand)]">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}
