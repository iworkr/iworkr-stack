/**
 * @page UpdatePassword
 * @status COMPLETE
 * @auth SESSION — Requires valid password reset token (from email link)
 * @description Intercepts the password reset token from Supabase and allows setting a new password
 */
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Supabase automatically picks up the hash fragment from the reset email
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
  }, [supabase]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError("Password must contain both letters and digits.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
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

        {success ? (
          <motion.div
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
                Password updated
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Redirecting to your dashboard...
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div>
              <div className="mb-2 flex items-center gap-2 text-emerald-400">
                <ShieldCheck size={18} />
                <span className="text-xs font-medium uppercase tracking-wider">Secure Reset</span>
              </div>
              <h2 className="text-xl font-medium tracking-tight text-zinc-100">
                Set a new password
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                Must be at least 8 characters with letters and digits.
              </p>
            </div>

            {!sessionReady && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-amber-400/80"
              >
                Verifying reset link...
              </motion.p>
            )}

            <div className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                  placeholder="New password"
                  className="w-full border-b border-[var(--border-base,#1a1a1a)] bg-transparent py-3 pr-10 text-base text-zinc-100 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500"
                  autoComplete="new-password"
                  autoFocus
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

              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Confirm new password"
                className="w-full border-b border-[var(--border-base,#1a1a1a)] bg-transparent py-3 text-base text-zinc-100 outline-none transition-all placeholder:text-zinc-700 focus:border-emerald-500"
                autoComplete="new-password"
              />

              {/* Strength indicators */}
              <div className="flex gap-2 text-xs">
                <span className={password.length >= 8 ? "text-emerald-400" : "text-zinc-600"}>
                  8+ chars
                </span>
                <span className="text-zinc-800">•</span>
                <span className={/[a-zA-Z]/.test(password) ? "text-emerald-400" : "text-zinc-600"}>
                  Letters
                </span>
                <span className="text-zinc-800">•</span>
                <span className={/\d/.test(password) ? "text-emerald-400" : "text-zinc-600"}>
                  Digits
                </span>
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
                onClick={handleSubmit}
                disabled={loading || !sessionReady}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                ) : (
                  <>
                    Update Password
                    <ArrowRight size={14} />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
