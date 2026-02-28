"use client";

import { useState } from "react";
import { SettingRow, SettingSection } from "@/components/settings/settings-toggle";
import { useToastStore } from "@/components/app/action-toast";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const { addToast } = useToastStore();
  const [changingPassword, setChangingPassword] = useState(false);
  const [enrolling2FA, setEnrolling2FA] = useState(false);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaEnabled, setMfaEnabled] = useState(false);

  async function handleChangePassword() {
    const newPassword = prompt("Enter your new password:");
    if (!newPassword || newPassword.length < 6) {
      if (newPassword !== null) addToast("Password must be at least 6 characters");
      return;
    }
    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        addToast(`Error: ${error.message}`);
      } else {
        addToast("Password updated successfully");
      }
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleEnable2FA() {
    setEnrolling2FA(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (error) {
        addToast(`Error: ${error.message}`);
        setEnrolling2FA(false);
        return;
      }
      setFactorId(data.id);
      setTotpUri(data.totp.uri);
    } catch {
      addToast("Failed to start 2FA enrollment");
      setEnrolling2FA(false);
    }
  }

  async function handleVerify2FA() {
    if (!factorId || verifyCode.length !== 6) {
      addToast("Enter the 6-digit code from your authenticator app");
      return;
    }
    try {
      const supabase = createClient();
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) {
        addToast(`Error: ${challengeError.message}`);
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) {
        addToast(`Verification failed: ${verifyError.message}`);
        return;
      }
      setMfaEnabled(true);
      setEnrolling2FA(false);
      setTotpUri(null);
      setFactorId(null);
      setVerifyCode("");
      addToast("Two-factor authentication enabled");
    } catch {
      addToast("Verification failed");
    }
  }

  async function handleRevokeAll() {
    if (!confirm("This will sign you out of all devices, including this one. Continue?")) return;
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      addToast(`Error: ${error.message}`);
    } else {
      addToast("All sessions revoked. Redirecting...");
      window.location.href = "/auth";
    }
  }

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">Security & access</h1>
      <SettingSection title="Authentication">
        <SettingRow label="Password" description="Change your account password">
          <button
            onClick={handleChangePassword}
            disabled={changingPassword}
            className="rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]"
          >
            {changingPassword ? "Saving..." : "Change"}
          </button>
        </SettingRow>
        <SettingRow label="Two-factor authentication" description={mfaEnabled ? "Authenticator app is enabled" : "Add an extra layer of security to your account"}>
          {!enrolling2FA && !mfaEnabled && (
            <button
              onClick={handleEnable2FA}
              className="rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]"
            >
              Enable
            </button>
          )}
          {mfaEnabled && (
            <span className="text-[12px] text-emerald-500">Active</span>
          )}
        </SettingRow>
        {totpUri && (
          <div className="ml-4 mb-4 space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[12px] text-zinc-400">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
            </p>
            <div className="flex justify-center rounded-lg bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}`}
                alt="TOTP QR Code"
                width={200}
                height={200}
              />
            </div>
            <p className="text-[11px] text-zinc-600">
              Or enter this URI manually: <code className="break-all font-mono text-[10px] text-zinc-500">{totpUri}</code>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-28 rounded-md border border-white/[0.1] bg-transparent px-3 py-1.5 text-center font-mono text-[14px] text-zinc-200 outline-none focus:border-emerald-500/40"
              />
              <button
                onClick={handleVerify2FA}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-500"
              >
                Verify & Enable
              </button>
            </div>
          </div>
        )}
      </SettingSection>
      <SettingSection title="Sessions">
        <SettingRow label="Active sessions" description="You are currently signed in on 1 device">
          <button
            onClick={handleRevokeAll}
            className="rounded-md border border-red-500/20 px-3 py-1 text-[12px] text-red-400/70 hover:bg-red-500/10"
          >
            Revoke all
          </button>
        </SettingRow>
      </SettingSection>
    </>
  );
}
