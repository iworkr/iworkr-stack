"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import { Lock, CheckCircle, AlertTriangle, Loader2, Eye, EyeOff, UserPlus } from "lucide-react";
import { getDashboardPath } from "@/lib/hooks/use-dashboard-path";

// ═══════════════════════════════════════════════════════════
// ── Accept Invite — Obsidian Onboarding Flow ─────────────
// ═══════════════════════════════════════════════════════════

interface InviteData {
  email: string;
  role: string;
  organization_name: string;
  organization_id: string;
  inviter_name: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [step, setStep] = useState<"loading" | "auth" | "profile" | "accepting" | "success" | "error">("loading");
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState("");

  // Auth fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const hasAutoAccepted = useRef(false);

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

  // ── Step 1: Validate the invite token ──────────────────
  async function validateToken() {
    try {
      const res = await fetch("/api/team/validate-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await res.json();

      if (!result.valid) {
        setError(result.error || "This invitation is invalid.");
        setStep("error");
        return;
      }

      const invite: InviteData = {
        email: result.email,
        role: result.role,
        organization_name: result.organization_name,
        organization_id: result.organization_id,
        inviter_name: result.inviter_name || "Your team",
      };
      setInviteData(invite);

      // Check if the INVITED user is already authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email?.toLowerCase() === invite.email.toLowerCase()) {
        // Already logged in as the invited user — skip to profile/accept
        if (!hasAutoAccepted.current) {
          hasAutoAccepted.current = true;
          setStep("accepting");
          await acceptInviteForUser(invite);
        }
      } else if (user && user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        // Logged in as DIFFERENT user (e.g. admin viewing the link)
        // Show auth step — they need to sign in as the invited email
        setStep("auth");
      } else {
        // Not logged in — show create account / sign in
        setStep("auth");
      }
    } catch {
      setError("Failed to validate invitation. Please try again.");
      setStep("error");
    }
  }

  // ── Step 2: Create account or sign in ──────────────────
  async function handleCreateAccount() {
    if (!passwordValid || !inviteData) return;
    setSubmitting(true);
    setError("");

    try {
      // Step A: Create the user via server API (auto-confirms email)
      const signupRes = await fetch("/api/team/signup-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: inviteData.email,
          password,
        }),
      });
      const signupData = await signupRes.json();

      if (signupData.error === "account_exists") {
        // Account already exists — just sign in
      } else if (!signupRes.ok) {
        throw new Error(signupData.error || "Failed to create account");
      }

      // Step B: Sign in client-side to establish session cookies
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      // Verify we're actually signed in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Sign-in succeeded but session not established. Please try again.");
      }

      // Go to profile step
      setStep("profile");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 3: Complete profile + accept ──────────────────
  async function handleProfileComplete() {
    if (!fullName.trim() || !inviteData) return;
    setSubmitting(true);
    setError("");

    try {
      // Use the API route to update profile + accept invite in one go
      // This uses service role so RLS doesn't block it
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to join team");
      }

      setStep("success");
      setTimeout(() => router.push(getDashboardPath()), 2500);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setSubmitting(false);
    }
  }

  // ── Auto-accept for already-authenticated invited user ─
  async function acceptInviteForUser(invite: InviteData) {
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to accept invite");

      setStep("success");
      setTimeout(() => router.push(getDashboardPath()), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
      setStep("error");
    }
  }

  return (
    <div className="relative min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="stealth-noise fixed" />

      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-[var(--brand)] opacity-[0.025] blur-[180px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-[var(--surface-1)] border border-[var(--border-base)] rounded-2xl p-8 shadow-2xl">

          {/* ── Loading ───────────────────────────────── */}
          {step === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-500">Verifying invitation...</p>
            </div>
          )}

          {/* ── Error ─────────────────────────────────── */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-rose-500" />
              </div>
              <h2 className="text-lg font-semibold text-white">Invitation Issue</h2>
              <p className="text-sm text-zinc-500 text-center max-w-[320px]">
                {error || "This invitation has expired or has already been used."}
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 px-6 py-2.5 text-sm text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                Return to Home
              </button>
            </div>
          )}

          {/* ── Auth: Create Account / Sign In ────────── */}
          {step === "auth" && inviteData && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <UserPlus className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Join {inviteData.organization_name}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  {inviteData.inviter_name} invited you as{" "}
                  <span className="text-zinc-300 capitalize">{inviteData.role.replace(/_/g, " ")}</span>
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Email</label>
                  <div className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border-base)] rounded-lg text-sm text-zinc-400">
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
                      className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border-base)] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
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
                    className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border-base)] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

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
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account & Continue"}
              </button>
            </div>
          )}

          {/* ── Profile: Name + Phone ─────────────────── */}
          {step === "profile" && (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <h2 className="text-lg font-semibold text-white">Complete Your Profile</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Just a few details so your team can find you.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    autoFocus
                    className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border-base)] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-1.5 block">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+61 400 000 000 (optional)"
                    className="w-full px-4 py-3 bg-white/[0.03] border border-[var(--border-base)] rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleProfileComplete}
                disabled={!fullName.trim() || submitting}
                className="w-full py-3 bg-white text-black font-semibold text-sm rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join Team"}
              </button>
            </div>
          )}

          {/* ── Accepting (auto) ──────────────────────── */}
          {step === "accepting" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              <p className="text-sm text-zinc-500">Joining your team...</p>
            </div>
          )}

          {/* ── Success ───────────────────────────────── */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-lg font-semibold text-white">You&apos;re In!</h2>
              <p className="text-sm text-zinc-500">
                {inviteData ? `Welcome to ${inviteData.organization_name}` : "Welcome to the team"}
              </p>
              <p className="text-xs text-zinc-600">Redirecting to your dashboard...</p>
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin mt-2" />
            </div>
          )}
        </div>

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
        <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
