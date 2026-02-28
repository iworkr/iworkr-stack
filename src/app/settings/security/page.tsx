"use client";

import { useState } from "react";
import { SettingRow, SettingSection } from "@/components/settings/settings-toggle";
import { useToastStore } from "@/components/app/action-toast";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const { addToast } = useToastStore();
  const [changingPassword, setChangingPassword] = useState(false);

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

  function handleEnable2FA() {
    // INCOMPLETE:TODO — 2FA not implemented; should integrate with Supabase Auth MFA (TOTP) to enable authenticator app enrollment and verification. Done when users can enroll a TOTP device and are prompted on login.
    addToast("Two-factor authentication coming soon");
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
        <SettingRow label="Two-factor authentication" description="Add an extra layer of security to your account">
          <button
            onClick={handleEnable2FA}
            className="rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]"
          >
            Enable
          </button>
        </SettingRow>
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
