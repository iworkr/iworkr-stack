"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Lock, CheckCircle, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";

// ═══════════════════════════════════════════════════════════
// ── Accept Invite — Obsidian Onboarding Flow ─────────────
// ═══════════════════════════════════════════════════════════

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [step, setStep] = useState<"loading" | "auth" | "profile" | "success" | "error">("loading");
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: string;
    organization_name: string;
    inviter_name: string;
  } | null>(null);
  const [error, setError] = useState("");

  // Auth fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Password requirements
  const hasLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const passwordValid = hasLength && hasNumber && hasSymbol && passwordsMatch;

  useEffect(() => {
    if (!token) {
      setError("No invite token provided.");
      setStep("error");
      return;
    }
    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function validateToken() {
    try {
      const { data, error: rpcError } = await supabase.rpc("validate_invite_token", {
        p_token: token!,
      });

      if (rpcError) throw rpcError;

      const result = data as { valid: boolean; error?: string; email?: string; role?: string; organization_name?: string; inviter_name?: string };

      if (!result.valid) {
        setError(result.error || "This invitation is invalid.");
        setStep("error");
        return;
      }

      setInviteData({
        email: result.email!,
        role: result.role!,
        organization_name: result.organization_name!,
        inviter_name: result.inviter_name || "Your team",
      });

      // Check if user is already authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Already logged in — go straight to accepting
        await acceptInvite();
      } else {
        setStep("auth");
      }
    } catch {
      setError("Failed to validate invitation. Please try again.");
      setStep("error");
    }
  }

  async function handleCreateAccount() {
    if (!passwordValid || !inviteData) return;
    setSubmitting(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: inviteData.email,
        password,
        options: {
          data: { invited: true, invite_token: token },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          // User exists — sign in instead
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: inviteData.email,
            password,
          });
          if (signInError) throw signInError;
        } else {
          throw signUpError;
        }
      }

      setStep("profile");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfileComplete() {
    if (!fullName.trim()) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update profile
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });

      await acceptInvite();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  async function acceptInvite() {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("No active session");

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/accept-invite`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ token }),
        }
      );

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to accept invite");

      setStep("success");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      setError((err as Error).message);
      setStep("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ── Glass Modal ────────────────────────────── */}
        <div className="bg-zinc-950 border border-white/5 rounded-2xl p-8 shadow-2xl">

          {step === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-500">Verifying invitation...</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-rose-500" />
              </div>
              <h2 className="text-lg font-semibold text-white">Invitation Invalid</h2>
              <p className="text-sm text-zinc-500 text-center max-w-[320px]">
                {error || "This invitation has expired or has already been used. Please ask your administrator to send a new one."}
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 px-6 py-2.5 text-sm text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                Return to Home
              </button>
            </div>
          )}

          {step === "auth" && inviteData && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Welcome to {inviteData.organization_name}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {inviteData.inviter_name} invited you as{" "}
                  <span className="text-zinc-300 capitalize">{inviteData.role.replace("_", " ")}</span>
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Email</label>
                  <div className="w-full px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-zinc-400">
                    {inviteData.email}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      className="w-full px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                {/* Password requirements */}
                <div className="space-y-1 pt-1">
                  <Requirement met={hasLength}>8+ characters</Requirement>
                  <Requirement met={hasNumber}>Contains a number</Requirement>
                  <Requirement met={hasSymbol}>Contains a symbol</Requirement>
                  <Requirement met={passwordsMatch}>Passwords match</Requirement>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleCreateAccount}
                disabled={!passwordValid || submitting}
                className="w-full py-3 bg-white text-black font-semibold text-sm rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
              </button>
            </div>
          )}

          {step === "profile" && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-white">Complete Your Profile</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Just a few details so your team can find you.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 234 567 890 (optional)"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handleProfileComplete}
                disabled={!fullName.trim() || submitting}
                className="w-full py-3 bg-white text-black font-semibold text-sm rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
              </button>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-white">You&apos;re In</h2>
              <p className="text-sm text-zinc-500">
                Redirecting to your dashboard...
              </p>
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin mt-2" />
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <p className="text-center text-[10px] text-zinc-700 mt-6">
          iWorkr — Field Service Operating System
        </p>
      </div>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1 h-1 rounded-full ${met ? "bg-emerald-500" : "bg-zinc-700"}`} />
      <span className={`text-[11px] ${met ? "text-emerald-500" : "text-zinc-600"} transition-colors`}>
        {children}
      </span>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
