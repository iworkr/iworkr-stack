"use client";

import { Toggle, SettingRow, SettingSection } from "@/components/settings/settings-toggle";
import { useSettingsStore } from "@/lib/stores/settings-store";

export default function NotificationsPage() {
  const { notificationPrefs, updateNotificationPref } = useSettingsStore();

  const emailNotifs = notificationPrefs.email_digest !== false;
  const pushJobs = notificationPrefs.push_jobs !== false;
  const pushInbox = notificationPrefs.push_inbox !== false;
  const pushSchedule = notificationPrefs.push_schedule !== false;
  const emailJobAssigned = notificationPrefs.email_job_assigned !== false;
  const emailJobCompleted = notificationPrefs.email_job_completed || false;
  const emailMentions = notificationPrefs.email_mentions || false;
  const pushMentions = notificationPrefs.push_mentions || false;
  const slackNotifs = notificationPrefs.slack_enabled || false;
  const quoteApproved = notificationPrefs.quote_approved !== false;
  const scheduleConflict = notificationPrefs.schedule_conflict !== false;
  const weeklyDigest = notificationPrefs.email_digest !== false;

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Notifications
      </h1>

      <SettingSection title="Channels">
        <SettingRow label="Email notifications" description="Receive notifications via email">
          <Toggle
            checked={emailNotifs}
            onChange={(v) => updateNotificationPref("email_digest", v)}
          />
        </SettingRow>
        <SettingRow label="Push notifications (jobs)" description="Receive push notifications for job updates">
          <Toggle
            checked={pushJobs}
            onChange={(v) => updateNotificationPref("push_jobs", v)}
          />
        </SettingRow>
        <SettingRow label="Push notifications (inbox)" description="Receive push notifications for inbox messages">
          <Toggle
            checked={pushInbox}
            onChange={(v) => updateNotificationPref("push_inbox", v)}
          />
        </SettingRow>
        <SettingRow label="Push notifications (schedule)" description="Receive push notifications for schedule changes">
          <Toggle
            checked={pushSchedule}
            onChange={(v) => updateNotificationPref("push_schedule", v)}
          />
        </SettingRow>
        <SettingRow label="Slack notifications" description="Send notifications to your Slack workspace">
          <Toggle
            checked={slackNotifs}
            onChange={(v) => updateNotificationPref("slack_enabled", v)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Events">
        <SettingRow label="Job assigned (email)" description="Email when a job is assigned to you">
          <Toggle
            checked={emailJobAssigned}
            onChange={(v) => updateNotificationPref("email_job_assigned", v)}
          />
        </SettingRow>
        <SettingRow label="Job completed (email)" description="Email when a job you're involved in is completed">
          <Toggle
            checked={emailJobCompleted}
            onChange={(v) => updateNotificationPref("email_job_completed", v)}
          />
        </SettingRow>
        <SettingRow label="Mentions (email)" description="Email when someone mentions you in a comment">
          <Toggle
            checked={emailMentions}
            onChange={(v) => updateNotificationPref("email_mentions", v)}
          />
        </SettingRow>
        <SettingRow label="Mentions (push)" description="Push notification when someone mentions you">
          <Toggle
            checked={pushMentions}
            onChange={(v) => updateNotificationPref("push_mentions", v)}
          />
        </SettingRow>
        <SettingRow label="Quote approved" description="Notify when a client approves a quote">
          <Toggle
            checked={quoteApproved}
            onChange={(v) => updateNotificationPref("quote_approved", v)}
          />
        </SettingRow>
        <SettingRow label="Schedule conflicts" description="Notify when overlapping jobs are detected">
          <Toggle
            checked={scheduleConflict}
            onChange={(v) => updateNotificationPref("schedule_conflict", v)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Digest">
        <SettingRow label="Weekly digest" description="Receive a summary of your team's activity every Monday">
          <Toggle
            checked={weeklyDigest}
            onChange={(v) => updateNotificationPref("email_digest", v)}
          />
        </SettingRow>
      </SettingSection>
    </>
  );
}
