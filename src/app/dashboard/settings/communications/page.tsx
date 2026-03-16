"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Mail,
  Bell,
  Calendar,
  AlertTriangle,
  Megaphone,
  Receipt,
  Clock,
  Shield,
  Save,
  Loader2,
  Smartphone,
  Radio,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useToastStore } from "@/components/app/action-toast";
import {
  getWorkspaceCommunicationSettings,
  updateWorkspaceCommunicationSettings,
  type CommunicationSettings,
  DEFAULT_SETTINGS,
} from "@/app/actions/communications";

// ─── Types ─────────────────────────────────────────────────────────────
interface EventRow {
  key: keyof CommunicationSettings;
  smsKey: keyof CommunicationSettings;
  emailKey: keyof CommunicationSettings;
  label: string;
  description: string;
  icon: React.ElementType;
  smsLockOff?: boolean;
}

// ─── Event configuration ───────────────────────────────────────────────
const EVENT_ROWS: EventRow[] = [
  {
    key: "sms_roster_published",
    smsKey: "sms_roster_published",
    emailKey: "email_roster_published",
    label: "Roster Published",
    description: "Notify team members when a new roster is published for their schedule period.",
    icon: Calendar,
    smsLockOff: false,
  },
  {
    key: "sms_shift_modified_urgent",
    smsKey: "sms_shift_modified_urgent",
    emailKey: "email_shift_modified",
    label: "Shift Modified (Urgent)",
    description: "Immediate alert when a shift is changed within the next 24 hours.",
    icon: AlertTriangle,
    smsLockOff: false,
  },
  {
    key: "sms_shift_modified_standard",
    smsKey: "sms_shift_modified_standard",
    emailKey: "email_shift_modified",
    label: "Shift Modified (Standard)",
    description: "Non-urgent shift changes more than 24 hours away.",
    icon: Clock,
    smsLockOff: false,
  },
  {
    key: "sms_announcements",
    smsKey: "sms_announcements",
    emailKey: "email_announcements",
    label: "Announcements",
    description: "Workspace-wide announcements and important updates from management.",
    icon: Megaphone,
    smsLockOff: false,
  },
  {
    key: "sms_payslips",
    smsKey: "sms_payslips",
    emailKey: "email_payslips",
    label: "Payslips Ready",
    description: "Notification when a new payslip is available for download.",
    icon: Receipt,
    smsLockOff: true,
  },
];

// ─── Beacon Toggle ─────────────────────────────────────────────────────
function BeaconToggle({
  checked,
  onChange,
  disabled = false,
  size = "md",
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const w = size === "sm" ? 36 : 44;
  const h = size === "sm" ? 20 : 24;
  const dot = size === "sm" ? 14 : 18;
  const pad = size === "sm" ? 2 : 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
      style={{ width: w, height: h }}
    >
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          backgroundColor: checked ? "rgb(16 185 129)" : "rgb(39 39 42)",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
      <motion.div
        className="absolute rounded-full bg-white shadow-sm"
        style={{ width: dot, height: dot, top: pad }}
        animate={{
          x: checked ? w - dot - pad * 2 : pad,
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ─── Locked On Indicator ───────────────────────────────────────────────
function LockedOnIndicator() {
  return (
    <div className="flex items-center gap-2 text-emerald-400">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-xs font-medium tracking-wide uppercase">Always On</span>
    </div>
  );
}

// ─── Locked Off Indicator ──────────────────────────────────────────────
function LockedOffIndicator() {
  return (
    <div className="flex items-center gap-2 text-zinc-500">
      <Shield className="h-3.5 w-3.5" />
      <span className="text-xs font-medium tracking-wide uppercase">Secured</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────
export default function CommunicationsSettingsPage() {
  const { currentOrg } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const orgId = currentOrg?.id;

  const [settings, setSettings] = useState<CommunicationSettings>({ ...DEFAULT_SETTINGS });
  const [savedSettings, setSavedSettings] = useState<CommunicationSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Load settings ──────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const { data } = await getWorkspaceCommunicationSettings(orgId);
      if (data) {
        const merged = { ...DEFAULT_SETTINGS, ...data } as CommunicationSettings;
        setSettings(merged);
        setSavedSettings(merged);
      }
      setLoading(false);
    })();
  }, [orgId]);

  // ─── Dirty check ───────────────────────────────────────────────────
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(savedSettings);
  }, [settings, savedSettings]);

  // ─── Update helper ─────────────────────────────────────────────────
  const update = useCallback(
    (key: keyof CommunicationSettings, value: boolean | string) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        // If SMS master switch is turned off, disable all SMS sub-toggles
        if (key === "sms_enabled" && value === false) {
          next.sms_roster_published = false;
          next.sms_shift_modified_urgent = false;
          next.sms_shift_modified_standard = false;
          next.sms_announcements = false;
          next.sms_payslips = false;
        }
        // sms_payslips is always locked off
        next.sms_payslips = false;
        // push is always on
        next.push_always_on = true;
        return next;
      });
    },
    []
  );

  // ─── Save handler ─────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!orgId || saving) return;
    setSaving(true);
    const { error } = await updateWorkspaceCommunicationSettings(orgId, settings);
    if (error) {
      addToast(`Failed to save: ${error}`, undefined, "error");
    } else {
      setSavedSettings({ ...settings });
      addToast("Communication settings saved");
    }
    setSaving(false);
  }, [orgId, settings, saving, addToast]);

  // ─── Any SMS enabled ──────────────────────────────────────────────
  const anySmsOn = settings.sms_enabled && (
    settings.sms_roster_published ||
    settings.sms_shift_modified_urgent ||
    settings.sms_shift_modified_standard ||
    settings.sms_announcements
  );

  // ─── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-4xl space-y-8 pb-28">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
            <Radio className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            Communications
          </h1>
        </div>
        <p className="text-sm text-zinc-500 pl-12">
          Control how your workspace sends notifications to team members via SMS, email, and push.
        </p>
      </div>

      {/* ── SMS Master Switch ────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
              <Smartphone className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-zinc-100">SMS Notifications</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Enable SMS delivery via Twilio. Standard messaging rates apply.
              </p>
            </div>
          </div>
          <BeaconToggle
            checked={settings.sms_enabled}
            onChange={(v) => update("sms_enabled", v)}
          />
        </div>

        {/* Amber warning */}
        <AnimatePresence>
          {anySmsOn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-300/80">
                  <strong className="text-amber-300">SMS costs apply.</strong> Each message costs
                  ~$0.0079 USD. With {currentOrg?.name || "your workspace"}&apos;s team size, estimated
                  monthly cost will appear on your next invoice. Users can opt out at any time by
                  replying STOP.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Event Grid ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] items-center gap-4 border-b border-zinc-800/60 px-6 py-3">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Event</span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">
            <MessageSquare className="h-3.5 w-3.5 mx-auto" />
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">
            <Mail className="h-3.5 w-3.5 mx-auto" />
          </span>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-center">
            <Bell className="h-3.5 w-3.5 mx-auto" />
          </span>
        </div>

        {/* Event rows */}
        {EVENT_ROWS.map((row, idx) => {
          const Icon = row.icon;
          const smsDisabled = !settings.sms_enabled || row.smsLockOff;

          return (
            <div
              key={row.key}
              className={`grid grid-cols-[1fr_80px_80px_80px] items-center gap-4 px-6 py-4 ${
                idx < EVENT_ROWS.length - 1 ? "border-b border-zinc-800/30" : ""
              } hover:bg-zinc-800/10 transition-colors`}
            >
              {/* Event info */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800/60 mt-0.5">
                  <Icon className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{row.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 max-w-md">{row.description}</p>
                </div>
              </div>

              {/* SMS toggle */}
              <div className="flex justify-center">
                {row.smsLockOff ? (
                  <LockedOffIndicator />
                ) : (
                  <BeaconToggle
                    checked={settings[row.smsKey] as boolean}
                    onChange={(v) => update(row.smsKey, v)}
                    disabled={smsDisabled}
                    size="sm"
                  />
                )}
              </div>

              {/* Email toggle */}
              <div className="flex justify-center">
                <BeaconToggle
                  checked={settings[row.emailKey] as boolean}
                  onChange={(v) => update(row.emailKey, v)}
                  size="sm"
                />
              </div>

              {/* Push — always on */}
              <div className="flex justify-center">
                <LockedOnIndicator />
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Quiet Hours ──────────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
              <Clock className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-zinc-100">Quiet Hours</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Suppress non-urgent notifications during specified hours.
              </p>
            </div>
          </div>
          <BeaconToggle
            checked={settings.quiet_hours_enabled}
            onChange={(v) => update("quiet_hours_enabled", v)}
          />
        </div>

        <AnimatePresence>
          {settings.quiet_hours_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={settings.quiet_hours_start}
                      onChange={(e) => update("quiet_hours_start", e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      End time
                    </label>
                    <input
                      type="time"
                      value={settings.quiet_hours_end}
                      onChange={(e) => update("quiet_hours_end", e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={settings.quiet_hours_override_urgent}
                    onChange={(e) => update("quiet_hours_override_urgent", e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-700 bg-[#141414] text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
                  />
                  <div>
                    <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
                      Allow urgent notifications to bypass quiet hours
                    </p>
                    <p className="text-xs text-zinc-500">
                      Priority 1 messages (e.g. urgent shift changes) will still be delivered.
                    </p>
                  </div>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Twilio Sender ID ─────────────────────────────────────── */}
      <section className="rounded-xl border border-zinc-800/60 bg-[#0A0A0A] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800/80">
            <MessageSquare className="h-5 w-5 text-zinc-300" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-100">SMS Sender ID</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                The name displayed on outgoing SMS messages. Max 11 alphanumeric characters.
              </p>
            </div>
            <input
              type="text"
              value={settings.twilio_sender_id}
              onChange={(e) => {
                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11);
                update("twilio_sender_id", val);
              }}
              maxLength={11}
              placeholder="iWorkr"
              className="w-48 rounded-lg border border-zinc-800 bg-[#141414] px-3 py-2 text-sm text-zinc-200 font-mono tracking-wide focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>
      </section>

      {/* ── Sticky Save Bar ──────────────────────────────────────── */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-4 rounded-xl border border-zinc-700/60 bg-[#0A0A0A]/95 backdrop-blur-md px-5 py-3 shadow-2xl shadow-black/40">
              <span className="text-sm text-zinc-400">Unsaved changes</span>
              <button
                onClick={() => {
                  setSettings({ ...savedSettings });
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
