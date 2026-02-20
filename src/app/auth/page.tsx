"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { emailSchema } from "@/lib/validation";
import { Spinner } from "@/components/onboarding/spinner";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "choice" | "email" | "password" | "magic_link_sent" | "authenticating";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black" />}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useOnboardingStore();
  const [mode, setMode] = useState<AuthMode>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordEmailRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (mode === "email") emailInputRef.current?.focus();
    if (mode === "password") passwordEmailRef.current?.focus();
  }, [mode]);

  // Show error from callback
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError("Authentication failed. Please try again.");
  }, [searchParams]);

  async function handleGoogleAuth() {
    setMode("authenticating");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      setError(error.message);
      setMode("choice");
    }
  }

  async function handleEmailSubmit() {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError(null);
    setMode("authenticating");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setMode("email");
      return;
    }

    // Also sync with the onboarding store for backwards compat during transition
    setAuth(email, email.split("@")[0]);
    setMode("magic_link_sent");
  }

  async function handlePasswordSubmit() {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    setError(null);
    setMode("authenticating");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setMode("password");
      return;
    }

    router.push("/dashboard");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "password") handlePasswordSubmit();
      else handleEmailSubmit();
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black">
      {/* Noise grain */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.018] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />

      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.025]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Back to home */}
      <div className="fixed top-6 left-6 z-10">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[12px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={13} />
          Back
        </Link>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-6">
        <AnimatePresence mode="wait">
          {mode === "choice" && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              {/* Logo */}
              <div className="flex flex-col items-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.1,
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  className="flex h-14 w-14 items-center justify-center rounded-xl"
                >
                  <img src="/logos/logo-dark-streamline.png" alt="Logo" className="h-12 w-12 object-contain" />
                </motion.div>
                <div className="text-center">
                  <h1 className="text-xl font-medium tracking-tight text-zinc-100">
                    Sign in to your workspace
                  </h1>
                  <p className="mt-1.5 text-[13px] text-zinc-600">
                    The operating system for service work.
                  </p>
                </div>
              </div>

              {/* Auth card */}
              <div className="space-y-3">
                {/* Google */}
                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogleAuth}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continue with Google
                </motion.button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                  <span className="text-xs text-zinc-600">or</span>
                  <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                </div>

                {/* Password */}
                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setMode("password")}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-3 text-sm text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-200"
                >
                  <KeyRound size={16} />
                  Sign in with Password
                </motion.button>

                {/* Email Magic Link */}
                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setMode("email")}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-[rgba(255,255,255,0.1)] bg-transparent px-4 py-3 text-sm text-zinc-400 transition-colors hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-200"
                >
                  <Mail size={16} />
                  Continue with Magic Link
                </motion.button>
              </div>

              {/* Terms */}
              <p className="text-center text-[11px] text-zinc-600">
                By continuing, you agree to our{" "}
                <a href="#" className="text-zinc-500 underline hover:text-zinc-400">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-zinc-500 underline hover:text-zinc-400">
                  Privacy Policy
                </a>
                .
              </p>
            </motion.div>
          )}

          {mode === "email" && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div>
                <button
                  onClick={() => setMode("choice")}
                  className="mb-4 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  &larr; Back
                </button>
                <h2 className="text-xl font-medium tracking-tight text-zinc-100">
                  Enter your email
                </h2>
                <p className="mt-1.5 text-sm text-zinc-500">
                  We&apos;ll send you a magic link to sign in instantly.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="you@company.com"
                    className="w-full border-b border-white/[0.08] bg-transparent py-3 text-base text-zinc-100 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500"
                    autoComplete="email"
                  />
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-xs text-rose-400/80"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleEmailSubmit}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-all hover:bg-zinc-200"
                >
                  Continue
                  <ArrowRight size={14} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {mode === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div>
                <button
                  onClick={() => { setMode("choice"); setError(null); }}
                  className="mb-4 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  &larr; Back
                </button>
                <h2 className="text-xl font-medium tracking-tight text-zinc-100">
                  Sign in with password
                </h2>
                <p className="mt-1.5 text-sm text-zinc-500">
                  Enter your email and password.
                </p>
              </div>

              <div className="space-y-4">
                <input
                  ref={passwordEmailRef}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="you@company.com"
                  className="w-full border-b border-white/[0.08] bg-transparent py-3 text-base text-zinc-100 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500"
                  autoComplete="email"
                />

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Password"
                    className="w-full border-b border-white/[0.08] bg-transparent py-3 pr-10 text-base text-zinc-100 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-zinc-600 hover:text-zinc-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

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
                  onClick={handlePasswordSubmit}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-all hover:bg-zinc-200"
                >
                  Sign In
                  <ArrowRight size={14} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {mode === "authenticating" && (
            <motion.div
              key="authenticating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center space-y-4 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <Spinner size={32} />
              </motion.div>
              <div>
                <p className="font-mono text-xs tracking-wider text-zinc-400">
                  Provisioning workspace...
                </p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-1 font-mono text-[10px] text-zinc-600"
                >
                  Authenticating secure session
                </motion.p>
              </div>
            </motion.div>
          )}

          {mode === "magic_link_sent" && (
            <motion.div
              key="magic_link_sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center space-y-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]"
              >
                <Mail size={24} className="text-zinc-400" />
              </motion.div>
              <div>
                <h2 className="text-xl font-medium tracking-tight text-zinc-100">
                  Check your email
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  We sent a magic link to{" "}
                  <span className="text-zinc-300">{email}</span>
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Click the link in the email to sign in.
                </p>
              </div>
              <button
                onClick={() => setMode("email")}
                className="text-xs text-zinc-600 transition-colors hover:text-zinc-300"
              >
                Use a different email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <span className="font-mono text-[10px] text-zinc-600">
          System Operational
        </span>
      </div>
    </div>
  );
}
