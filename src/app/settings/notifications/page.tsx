"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/app/actions/notifications";

/* ── Custom toggle (44×24, Obsidian spec) ──────────────── */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-emerald-500" : "bg-zinc-800"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[2px] h-5 w-5 rounded-full bg-white shadow-sm"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

/* ── Row layout ────────────────────────────────────────── */

function Row({
  label,
  description,
  children,
  indent = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-white/[0.04] py-4 last:border-0 ${
        indent ? "pl-5" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-200">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── Section card ──────────────────────────────────────── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
        {children}
      </div>
    </div>
  );
}

/* ── Time picker (HH:MM, Obsidian-styled) ──────────────── */

function TimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] text-zinc-300 outline-none transition-colors
        focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20
        disabled:cursor-not-allowed disabled:opacity-40
        [color-scheme:dark]`}
    />
  );
}

/* ── Skeleton loader ───────────────────────────────────── */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="mb-3 h-3 w-28 rounded bg-white/[0.06]" />
          <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-2">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="flex items-center justify-between border-b border-white/[0.03] py-4 last:border-0"
              >
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
                  <div className="h-2.5 w-56 rounded bg-white/[0.04]" />
                </div>
                <div className="h-[24px] w-[44px] rounded-full bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  /* Additional local state for fields not in the base schema */
  const [dndEnabled, setDndEnabled] = useState(false);
  const [autoDnd, setAutoDnd] = useState(false);
  const [muteChatMentions, setMuteChatMentions] = useState(false);
  const [muteShiftReminders, setMuteShiftReminders] = useState(false);
  const [muteAnnouncements, setMuteAnnouncements] = useState(false);

  /* ── Load preferences ────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data } = await getNotificationPreferences();
      if (data) {
        setPrefs(data);
        // Derive DND state from quiet hours being set
        setDndEnabled(!!(data.quiet_hours_start && data.quiet_hours_end));
        // Derive muted toggles from muted_types array
        const muted = data.muted_types ?? [];
        setMuteChatMentions(muted.includes("chat_mention"));
        setMuteShiftReminders(muted.includes("nudge_clock_in"));
        setMuteAnnouncements(muted.includes("announcement"));
        setAutoDnd(muted.includes("auto_dnd_off_duty"));
      }
      setLoading(false);
    })();
  }, []);

  /* ── Persist helper (fire-and-forget, optimistic) ───── */
  const persist = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      // Server call — fire and forget
      updateNotificationPreferences(patch);
    },
    [],
  );

  /* ── Muted-type helpers ──────────────────────────────── */
  const toggleMutedType = useCallback(
    (type: string, mute: boolean) => {
      if (!prefs) return;
      const current = new Set(prefs.muted_types ?? []);
      if (mute) current.add(type);
      else current.delete(type);
      const next = Array.from(current);
      setPrefs((p) => (p ? { ...p, muted_types: next } : p));
      persist({ muted_types: next });
    },
    [prefs, persist],
  );

  /* ── Render ──────────────────────────────────────────── */
  if (loading || !prefs) {
    return (
      <>
        <Header />
        <Skeleton />
      </>
    );
  }

  return (
    <>
      <Header />

      {/* ─── Push Notifications ────────────────────────── */}
      <Section title="Push Notifications">
        <Row
          label="Push Notifications"
          description="Receive real-time push alerts on your devices"
        >
          <Toggle
            checked={prefs.push_enabled}
            onChange={(v) => {
              setPrefs((p) => (p ? { ...p, push_enabled: v } : p));
              persist({ push_enabled: v });
            }}
          />
        </Row>

        <Row
          label="Chat Mentions"
          description="Get notified when someone @mentions you"
          indent
        >
          <Toggle
            checked={!muteChatMentions}
            disabled={!prefs.push_enabled}
            onChange={(v) => {
              setMuteChatMentions(!v);
              toggleMutedType("chat_mention", !v);
            }}
          />
        </Row>

        <Row
          label="Shift Reminders"
          description="Clock-in/out reminders and schedule updates"
          indent
        >
          <Toggle
            checked={!muteShiftReminders}
            disabled={!prefs.push_enabled}
            onChange={(v) => {
              setMuteShiftReminders(!v);
              toggleMutedType("nudge_clock_in", !v);
              toggleMutedType("nudge_clock_out", !v);
            }}
          />
        </Row>

        <Row
          label="Announcements"
          description="Organization-wide broadcasts"
          indent
        >
          <Toggle
            checked={!muteAnnouncements}
            disabled={!prefs.push_enabled}
            onChange={(v) => {
              setMuteAnnouncements(!v);
              toggleMutedType("announcement", !v);
            }}
          />
        </Row>
      </Section>

      {/* ─── Do Not Disturb ────────────────────────────── */}
      <Section title="Do Not Disturb">
        <Row
          label="Do Not Disturb"
          description="Pause all push notifications during quiet hours"
        >
          <Toggle
            checked={dndEnabled}
            onChange={(v) => {
              setDndEnabled(v);
              if (v) {
                const start = prefs.quiet_hours_start || "22:00";
                const end = prefs.quiet_hours_end || "07:00";
                setPrefs((p) =>
                  p
                    ? { ...p, quiet_hours_start: start, quiet_hours_end: end }
                    : p,
                );
                persist({ quiet_hours_start: start, quiet_hours_end: end });
              } else {
                setPrefs((p) =>
                  p
                    ? { ...p, quiet_hours_start: null, quiet_hours_end: null }
                    : p,
                );
                persist({ quiet_hours_start: null, quiet_hours_end: null });
              }
            }}
          />
        </Row>

        {dndEnabled && (
          <>
            <Row label="Quiet hours start" indent>
              <TimePicker
                value={prefs.quiet_hours_start || "22:00"}
                onChange={(v) => {
                  setPrefs((p) =>
                    p ? { ...p, quiet_hours_start: v } : p,
                  );
                  persist({ quiet_hours_start: v });
                }}
              />
            </Row>
            <Row label="Quiet hours end" indent>
              <TimePicker
                value={prefs.quiet_hours_end || "07:00"}
                onChange={(v) => {
                  setPrefs((p) =>
                    p ? { ...p, quiet_hours_end: v } : p,
                  );
                  persist({ quiet_hours_end: v });
                }}
              />
            </Row>
          </>
        )}

        <Row
          label="Auto-DND when off-duty"
          description="Automatically mute push notifications when you don't have an active shift"
          indent
        >
          <Toggle
            checked={autoDnd}
            onChange={(v) => {
              setAutoDnd(v);
              toggleMutedType("auto_dnd_off_duty", v);
            }}
          />
        </Row>
      </Section>

      {/* ─── Email Digest ──────────────────────────────── */}
      <Section title="Email Digest">
        <Row
          label="Daily email digest"
          description="Receive a summary of unread notifications by email"
        >
          <Toggle
            checked={prefs.email_enabled}
            onChange={(v) => {
              setPrefs((p) => (p ? { ...p, email_enabled: v } : p));
              persist({ email_enabled: v });
            }}
          />
        </Row>
      </Section>
    </>
  );
}

/* ── Header (extracted for skeleton reuse) ─────────────── */

function Header() {
  return (
    <div className="mb-10">
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Notifications
      </span>
      <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100">
        Notification Settings
      </h1>
      <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
        Control how and when you receive notifications.
      </p>
    </div>
  );
}
