"use client";

import { useState } from "react";
import { Toggle, SettingRow, SettingSection } from "@/components/settings/settings-toggle";
import { SaveToast, useSaveToast } from "@/components/settings/save-toast";

export default function NotificationsPage() {
  const { visible, showSaved } = useSaveToast();
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [slackNotifs, setSlackNotifs] = useState(false);
  const [jobAssigned, setJobAssigned] = useState(true);
  const [jobCompleted, setJobCompleted] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [quoteApproved, setQuoteApproved] = useState(true);
  const [scheduleConflict, setScheduleConflict] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  function toggle(setter: (v: boolean) => void, current: boolean) {
    setter(!current);
    showSaved();
  }

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Notifications
      </h1>

      <SettingSection title="Channels">
        <SettingRow label="Email notifications" description="Receive notifications via email">
          <Toggle checked={emailNotifs} onChange={() => toggle(setEmailNotifs, emailNotifs)} />
        </SettingRow>
        <SettingRow label="Push notifications" description="Receive push notifications on mobile and desktop">
          <Toggle checked={pushNotifs} onChange={() => toggle(setPushNotifs, pushNotifs)} />
        </SettingRow>
        <SettingRow label="Slack notifications" description="Send notifications to your Slack workspace">
          <Toggle checked={slackNotifs} onChange={() => toggle(setSlackNotifs, slackNotifs)} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Events">
        <SettingRow label="Job assigned" description="Notify when a job is assigned to you">
          <Toggle checked={jobAssigned} onChange={() => toggle(setJobAssigned, jobAssigned)} />
        </SettingRow>
        <SettingRow label="Job completed" description="Notify when a job you're involved in is completed">
          <Toggle checked={jobCompleted} onChange={() => toggle(setJobCompleted, jobCompleted)} />
        </SettingRow>
        <SettingRow label="Mentions" description="Notify when someone mentions you in a comment">
          <Toggle checked={mentions} onChange={() => toggle(setMentions, mentions)} />
        </SettingRow>
        <SettingRow label="Quote approved" description="Notify when a client approves a quote">
          <Toggle checked={quoteApproved} onChange={() => toggle(setQuoteApproved, quoteApproved)} />
        </SettingRow>
        <SettingRow label="Schedule conflicts" description="Notify when overlapping jobs are detected">
          <Toggle checked={scheduleConflict} onChange={() => toggle(setScheduleConflict, scheduleConflict)} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Digest">
        <SettingRow label="Weekly digest" description="Receive a summary of your team's activity every Monday">
          <Toggle checked={weeklyDigest} onChange={() => toggle(setWeeklyDigest, weeklyDigest)} />
        </SettingRow>
      </SettingSection>

      <SaveToast visible={visible} />
    </>
  );
}
