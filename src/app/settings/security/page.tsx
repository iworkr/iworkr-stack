"use client";

import { SettingRow, SettingSection } from "@/components/settings/settings-toggle";

export default function SecurityPage() {
  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">Security & access</h1>
      <SettingSection title="Authentication">
        <SettingRow label="Password" description="Change your account password">
          <button className="rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]">Change</button>
        </SettingRow>
        <SettingRow label="Two-factor authentication" description="Add an extra layer of security to your account">
          <button className="rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1 text-[12px] text-zinc-400 hover:bg-[rgba(255,255,255,0.04)]">Enable</button>
        </SettingRow>
      </SettingSection>
      <SettingSection title="Sessions">
        <SettingRow label="Active sessions" description="You are currently signed in on 1 device">
          <button className="rounded-md border border-red-500/20 px-3 py-1 text-[12px] text-red-400/70 hover:bg-red-500/10">Revoke all</button>
        </SettingRow>
      </SettingSection>
    </>
  );
}
