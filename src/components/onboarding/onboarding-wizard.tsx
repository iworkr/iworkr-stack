"use client";

/* ═══════════════════════════════════════════════════════════════
   OnboardingWizard — Obsidian Multi-Step Onboarding
   Project Genesis §5

   Step 1: Identity Confirmation & Password Creation
   Step 2: Profile Hydration (Name, Phone, Avatar)
   Step 3: Execution Engine (complete_onboarding RPC)
   Step 4: Role-Based Handoff

   Security:
   - Email field locked to prevent forwarding abuse
   - Token verified SSR before this component renders
   - complete_onboarding RPC is transactional
   ═══════════════════════════════════════════════════════════════ */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Upload,
  Camera,
  QrCode,
  ArrowRight,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ── Types ────────────────────────────────────────────────── */

export interface InviteContext {
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLogo: string | null;
  brandColor: string;
  inviterName: string;
  expiresAt: string;
}

interface OnboardingWizardProps {
  token: string;
  inviteContext: InviteContext;
  existingUser: { id: string; email: string } | null;
}

type WizardStep = "identity" | "profile" | "executing" | "success" | "tech-handoff";

/* ── Password Strength ────────────────────────────────────── */

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-rose-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score, label: "Good", color: "bg-amber-400" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

/* ── Strength Meter ───────────────────────────────────────── */

function StrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const segments = 4;

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < strength.score ? strength.color : "bg-zinc-800"
            }`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
          />
        ))}
      </div>
      <p className={`text-[10px] font-medium ${
        strength.score <= 1 ? "text-rose-500" :
        strength.score <= 2 ? "text-amber-500" :
        strength.score <= 3 ? "text-amber-400" :
        "text-emerald-500"
      }`}>
        {strength.label}
      </p>
    </div>
  );
}

/* ── Luminance helper for dynamic text color ──────────────── */

function getContrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

/* ── Avatar Dropzone ──────────────────────────────────────── */

function AvatarDropzone({
  previewUrl,
  onFileSelect,
}: {
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${
          dragging
            ? "border-emerald-500 bg-emerald-500/5"
            : previewUrl
              ? "border-white/20"
              : "border-white/20 hover:border-emerald-500"
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Avatar preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Camera size={20} className="text-zinc-600" />
            <span className="text-[9px] text-zinc-600">Upload</span>
          </div>
        )}
        {/* Hover overlay */}
        {previewUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
            <Upload size={16} className="text-white" />
          </div>
        )}
      </motion.div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <p className="text-[10px] text-zinc-600">Click or drag to upload</p>
    </div>
  );
}

/* ── Step transition variants ─────────────────────────────── */

const stepVariants = {
  enter: { opacity: 0, x: 20 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

/* ═══════════════════════════════════════════════════════════════
   OnboardingWizard
   ═══════════════════════════════════════════════════════════════ */

export function OnboardingWizard({
  token,
  inviteContext,
  existingUser,
}: OnboardingWizardProps) {
  const router = useRouter();
  const supabase = createClient();

  // If the user is already authenticated, skip to profile/accept step
  const [step, setStep] = useState<WizardStep>(
    existingUser ? "profile" : "identity",
  );

  // Auth state
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(
    existingUser?.id || null,
  );

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // UI state
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joinResult, setJoinResult] = useState<{
    organizationName: string;
    role: string;
  } | null>(null);

  // Password validation
  const strength = getPasswordStrength(password);
  const passwordValid = strength.score >= 2 && password.length >= 8;

  const isTechRole = ["technician", "apprentice", "subcontractor"].includes(
    inviteContext.role,
  );

  /* ── Handle avatar file selection ──────────────────────── */
  const handleAvatarSelect = useCallback((file: File) => {
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  /* ── Step 1: Create Account ────────────────────────────── */
  const handleCreateAccount = useCallback(async () => {
    if (!passwordValid) return;
    setSubmitting(true);
    setError("");

    try {
      // Try signUp first
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: inviteContext.email,
          password,
          options: {
            data: { invited: true, invite_token: token },
          },
        });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          // Account exists — try sign in
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: inviteContext.email,
              password,
            });
          if (signInError) throw signInError;
          setAuthUserId(signInData.user?.id || null);
        } else {
          throw signUpError;
        }
      } else {
        setAuthUserId(signUpData.user?.id || null);
      }

      setStep("profile");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [password, passwordValid, inviteContext.email, token, supabase.auth]);

  /* ── Step 2: Complete Profile ──────────────────────────── */
  const handleCompleteProfile = useCallback(async () => {
    if (!fullName.trim()) return;
    setSubmitting(true);
    setError("");
    setStep("executing");

    try {
      // Get the current auth user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id || authUserId;
      if (!userId) throw new Error("Not authenticated");

      // Upload avatar if provided
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "png";
        const filePath = `${userId}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Call the transactional RPC
      const { data: result, error: rpcError } = await (supabase as any).rpc(
        "complete_onboarding",
        {
          p_auth_user_id: userId,
          p_token: token,
          p_full_name: fullName.trim(),
          p_phone: phone.trim() || null,
          p_avatar_url: avatarUrl,
        },
      );

      if (rpcError) throw rpcError;

      if (!result?.success) {
        throw new Error(result?.error || "Failed to complete onboarding");
      }

      setJoinResult({
        organizationName: result.organization_name,
        role: result.role,
      });

      // Route based on role
      if (isTechRole) {
        setStep("tech-handoff");
      } else {
        setStep("success");
        // Redirect to dashboard after animation
        setTimeout(() => router.push("/dashboard"), 2500);
      }
    } catch (err) {
      setError((err as Error).message);
      setStep("profile");
    } finally {
      setSubmitting(false);
    }
  }, [
    fullName,
    phone,
    avatarFile,
    authUserId,
    token,
    isTechRole,
    supabase,
    router,
  ]);

  /* ── Keyboard: Enter to advance ────────────────────────── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && !e.shiftKey) {
        if (step === "identity" && passwordValid && !submitting) {
          e.preventDefault();
          handleCreateAccount();
        }
        if (step === "profile" && fullName.trim() && !submitting) {
          e.preventDefault();
          handleCompleteProfile();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, passwordValid, fullName, submitting, handleCreateAccount, handleCompleteProfile]);

  /* ── Dynamic brand color for CTA ───────────────────────── */
  const brandColor = inviteContext.brandColor || "#00E676";
  const brandTextColor = getContrastTextColor(brandColor);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4">
      <div className="w-full max-w-md">
        {/* ── Workspace Logo ───────────────────────────────── */}
        {inviteContext.organizationLogo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 flex justify-center"
          >
            <img
              src={inviteContext.organizationLogo}
              alt={inviteContext.organizationName}
              className="h-10 max-w-[160px] object-contain"
            />
          </motion.div>
        )}

        {/* ── Glass Card ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-white/5 bg-zinc-950 p-8 shadow-2xl"
        >
          <AnimatePresence mode="wait">
            {/* ═══ STEP 1: Identity & Password ═══════════════ */}
            {step === "identity" && (
              <motion.div
                key="identity"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-semibold tracking-tight text-white">
                    Welcome to {inviteContext.organizationName}
                  </h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    {inviteContext.inviterName} invited you as{" "}
                    <span className="capitalize text-zinc-300">
                      {inviteContext.role.replace(/_/g, " ")}
                    </span>
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Locked email — anti-forwarding */}
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                      Email
                    </label>
                    <div className="w-full cursor-not-allowed rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
                      {inviteContext.email}
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                      Create Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                        }}
                        placeholder="Create a secure password"
                        autoFocus
                        className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-white placeholder-zinc-600 transition-colors focus:border-emerald-500/30 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <StrengthMeter password={password} />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                    <p className="text-xs text-rose-400">{error}</p>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={handleCreateAccount}
                  disabled={!passwordValid || submitting}
                  style={{
                    backgroundColor: passwordValid ? brandColor : undefined,
                    color: passwordValid ? brandTextColor : undefined,
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
                    passwordValid
                      ? "hover:opacity-90"
                      : "cursor-not-allowed bg-zinc-800 text-zinc-600"
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* ═══ STEP 2: Profile Hydration ═════════════════ */}
            {step === "profile" && (
              <motion.div
                key="profile"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-6"
              >
                <div className="text-center">
                  <h2 className="text-xl font-semibold tracking-tight text-white">
                    Complete your profile
                  </h2>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    Just a few details so your team can find you.
                  </p>
                </div>

                {/* Avatar dropzone */}
                <AvatarDropzone
                  previewUrl={avatarPreview}
                  onFileSelect={handleAvatarSelect}
                />

                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setError("");
                      }}
                      placeholder="e.g., Steve Jobs"
                      autoFocus
                      className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-white placeholder-zinc-600 transition-colors focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+61 400 000 000"
                      className="w-full rounded-lg border border-white/5 bg-zinc-900/50 px-4 py-3 text-sm text-white placeholder-zinc-600 transition-colors focus:border-emerald-500/30 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                    <p className="text-xs text-rose-400">{error}</p>
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={handleCompleteProfile}
                  disabled={!fullName.trim() || submitting}
                  style={{
                    backgroundColor: fullName.trim() ? brandColor : undefined,
                    color: fullName.trim() ? brandTextColor : undefined,
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
                    fullName.trim()
                      ? "hover:opacity-90"
                      : "cursor-not-allowed bg-zinc-800 text-zinc-600"
                  }`}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Complete Setup"
                  )}
                </button>
              </motion.div>
            )}

            {/* ═══ EXECUTING ═════════════════════════════════ */}
            {step === "executing" && (
              <motion.div
                key="executing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 py-8"
              >
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm text-zinc-500">
                  Setting up your account...
                </p>
              </motion.div>
            )}

            {/* ═══ SUCCESS: Admin/Dispatcher Handoff ═════════ */}
            {step === "success" && (
              <motion.div
                key="success"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-4 py-8"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10"
                >
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </motion.div>
                <h2 className="text-lg font-semibold text-white">
                  You&apos;re In
                </h2>
                <p className="text-sm text-zinc-500">
                  Welcome to{" "}
                  <span className="text-zinc-300">
                    {joinResult?.organizationName || inviteContext.organizationName}
                  </span>
                </p>
                <Loader2 className="mt-2 h-5 w-5 animate-spin text-zinc-600" />
                <p className="text-[11px] text-zinc-700">
                  Redirecting to your dashboard...
                </p>
              </motion.div>
            )}

            {/* ═══ TECH HANDOFF: Download App QR ════════════ */}
            {step === "tech-handoff" && (
              <motion.div
                key="tech-handoff"
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center gap-5 py-4"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10"
                >
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </motion.div>

                <div className="text-center">
                  <h2 className="text-lg font-semibold text-white">
                    You&apos;re all set, {fullName.split(" ")[0] || "there"}
                  </h2>
                  <p className="mt-1.5 max-w-[320px] text-sm leading-relaxed text-zinc-500">
                    iWorkr is designed for your mobile device. Download the app
                    to access your schedule, navigate to jobs, and complete
                    timesheets.
                  </p>
                </div>

                {/* QR Code placeholder — generated with QR library or img */}
                <div className="flex h-48 w-48 items-center justify-center rounded-2xl border border-white/10 bg-white p-4">
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg">
                    <QrCode className="h-24 w-24 text-zinc-900" />
                    <span className="text-[10px] font-medium text-zinc-500">
                      Scan to download
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <a
                    href="https://apps.apple.com/app/iworkr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/10 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.iworkr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/10 px-4 py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    Google Play
                  </a>
                </div>

                {/* Ghost link to web dashboard */}
                <button
                  onClick={() => router.push("/dashboard")}
                  className="mt-2 text-[11px] text-zinc-700 transition-colors hover:text-zinc-500"
                >
                  Continue to Web Dashboard →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Footer ────────────────────────────────────────── */}
        <p className="mt-6 text-center text-[10px] text-zinc-700">
          iWorkr — Field Service Operating System
        </p>
      </div>
    </div>
  );
}
