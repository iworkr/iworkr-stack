/**
 * @page /portal/login
 * @status COMPLETE
 * @description Portal-specific login with OTP/Magic Link support.
 *   Progressive authentication — email OTP for persistent portal access.
 * @lastAudit 2026-03-24
 */
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PortalLoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = searchParams.get("slug") || "";
  const expired = searchParams.get("expired") === "true";

  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(expired ? "Your session expired due to inactivity. Please sign in again." : null);
  const [success, setSuccess] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: slug
            ? `${window.location.origin}/portal/c/${slug}`
            : `${window.location.origin}/portal`,
        },
      });

      if (authError) {
        setError(authError.message);
      } else {
        setOtpSent(true);
      }
    } catch {
      setError("Failed to send verification code. Please try again.");
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });

      if (verifyError) {
        setError(verifyError.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.replace(slug ? `/portal/c/${slug}` : "/portal");
        }, 1000);
      }
    } catch {
      setError("Failed to verify code. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
            <Shield size={24} className="text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-100">Client Portal</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Sign in with your email to access your portal
          </p>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-[12px] text-red-400"
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}

        {/* Success */}
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8"
          >
            <CheckCircle size={32} className="text-emerald-400" />
            <p className="text-[14px] font-medium text-emerald-300">Signed in successfully</p>
            <p className="text-[12px] text-zinc-500">Redirecting to your portal...</p>
          </motion.div>
        )}

        {!success && !otpSent && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Email address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="h-11 w-full rounded-lg border border-white/[0.08] bg-zinc-900/50 pl-9 pr-4 text-[14px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-500/30"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 text-[14px] font-medium text-black transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Send Verification Code <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        )}

        {!success && otpSent && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-4 text-center">
              <p className="text-[13px] text-zinc-300">
                We sent a 6-digit code to <span className="font-medium text-zinc-100">{email}</span>
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">Check your inbox and spam folder</p>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="h-11 w-full rounded-lg border border-white/[0.08] bg-zinc-900/50 px-4 text-center text-[20px] font-mono tracking-[0.3em] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 text-[14px] font-medium text-black transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Sign In"}
            </button>

            <button
              type="button"
              onClick={() => { setOtpSent(false); setOtp(""); }}
              className="w-full text-center text-[12px] text-zinc-600 hover:text-zinc-400"
            >
              Use a different email
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-[10px] text-zinc-700">
          Powered by iWorkr · Secure Portal Access
        </p>
      </motion.div>
    </div>
  );
}
