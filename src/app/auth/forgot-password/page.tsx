/**
 * @page ForgotPassword
 * @status COMPLETE
 * @auth PUBLIC — No auth required
 * @description Sends a password reset email via Supabase Auth
 */
"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-10 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-400">iW</span>
          </div>
          <span className="text-sm font-medium tracking-tight text-zinc-400">iWorkr</span>
        </div>

        <AnimatePresence mode="wait">
          {!sent ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-medium tracking-tight text-zinc-100">
                  Reset your password
                </h2>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="you@company.com"
                  className="w-full border-b border-[var(--border-base,#1a1a1a)] bg-transparent py-3 text-base text-zinc-100 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500"
                  autoComplete="email"
                  autoFocus
                />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-400/80"
                  >
                    {error}
                  </motion.p>
                )}

                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight size={14} />
                    </>
                  )}
                </motion.button>
              </div>

              <Link
                href="/auth"
                className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <ArrowLeft size={12} />
                Back to sign in
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-medium tracking-tight text-zinc-100">
                  Check your email
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  We&apos;ve sent a password reset link to{" "}
                  <span className="text-zinc-300">{email}</span>.
                  Check your inbox (and spam folder).
                </p>
              </div>

              <Link
                href="/auth"
                className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <ArrowLeft size={12} />
                Back to sign in
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
