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
          Contact Us
        </h1>
        <p className="mb-10 text-[15px] leading-relaxed text-[#A1A1AA]">
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
              className="flex flex-col items-center rounded-2xl border border-[#00E676]/20 bg-[rgba(0,230,118,0.03)] px-8 py-16 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#00E676] shadow-[0_0_40px_-8px_rgba(0,230,118,0.5)]"
              >
                <CheckCircle size={24} className="text-black" />
              </motion.div>
              <h2 className="text-xl font-medium text-[#EDEDED]">Message Sent</h2>
              <p className="mt-2 max-w-sm text-sm text-zinc-500">
                Thanks, {name}! We&apos;ve sent you a confirmation email. Our team will get back to
                you within 24 hours.
              </p>
              <Link
                href="/"
                className="mt-6 text-sm text-zinc-500 transition-colors hover:text-[#00E676]"
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
                  <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Your Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[14px] text-zinc-200 placeholder-zinc-600 outline-none transition-all focus:border-[#00E676]/30 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.15)]"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[14px] text-zinc-200 placeholder-zinc-600 outline-none transition-all focus:border-[#00E676]/30 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.15)]"
                  />
                </div>
              </div>

              {/* Subject selector — card picker */}
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">
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
                        className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all ${
                          isSelected
                            ? "border-[#00E676]/30 bg-[rgba(0,230,118,0.05)] text-[#00E676]"
                            : "border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-white/[0.1] hover:text-zinc-300"
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
                <label htmlFor="message" className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[14px] leading-relaxed text-zinc-200 placeholder-zinc-600 outline-none transition-all focus:border-[#00E676]/30 focus:shadow-[0_0_12px_-4px_rgba(0,230,118,0.15)]"
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
                <p className="text-xs text-zinc-600">
                  Or email directly:{" "}
                  <a
                    href="mailto:support@iworkr.com"
                    className="text-zinc-400 underline underline-offset-2 transition-colors hover:text-[#00E676]"
                  >
                    support@iworkr.com
                  </a>
                </p>
                <button
                  type="submit"
                  disabled={sending}
                  className={`flex items-center gap-2 rounded-lg bg-[#00E676] px-5 py-2.5 text-[13px] font-medium text-black shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)] transition-all hover:bg-[#00C853] hover:shadow-[0_0_30px_-4px_rgba(0,230,118,0.5)] ${
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
        <div className="mt-16 flex items-center gap-4 border-t border-white/[0.06] pt-8 text-sm text-zinc-600">
          <Link href="/terms" className="transition-colors hover:text-[#00E676]">Terms of Service</Link>
          <span className="text-zinc-800">|</span>
          <Link href="/privacy" className="transition-colors hover:text-[#00E676]">Privacy Policy</Link>
          <span className="text-zinc-800">|</span>
          <Link href="/cookies" className="transition-colors hover:text-[#00E676]">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}
