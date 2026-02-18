"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Toggle, SettingRow, SettingSection, Select } from "@/components/settings/settings-toggle";
import { useSettingsStore } from "@/lib/stores/settings-store";

const themes = [
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
] as const;

export default function PreferencesPage() {
  const { preferences, updatePreference } = useSettingsStore();

  const activeTheme = preferences.theme || "dark";
  const homeView = preferences.home_view || "active_jobs";
  const displayNames = preferences.display_names || "full_name";
  const firstDay = preferences.first_day_of_week || "monday";
  const emoticons = preferences.emoticons !== false;
  const pointerCursors = preferences.pointer_cursors || false;
  const fontSize = preferences.font_size || "default";
  const notifBadge = preferences.notification_badge || "unread";
  const spellCheck = preferences.spell_check !== false;
  const autoAssign = preferences.auto_assign || false;
  const moveStarted = preferences.move_started || false;
  const assignStarted = preferences.assign_started || false;

  function handleThemeChange(theme: string) {
    updatePreference("theme", theme);
    // Also apply theme to the document
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else if (theme === "dark") {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
      document.documentElement.classList.toggle("light", !prefersDark);
    }
  }

  return (
    <>
      <h1 className="mb-8 text-2xl font-medium tracking-tight text-zinc-100">
        Preferences
      </h1>

      {/* General */}
      <SettingSection title="General">
        <SettingRow
          label="Default home view"
          description="Select which view to display when launching the app"
        >
          <Select
            value={homeView}
            options={[
              { value: "active_jobs", label: "Active jobs" },
              { value: "dashboard", label: "Dashboard" },
              { value: "inbox", label: "Inbox" },
            ]}
            onChange={(v) => updatePreference("home_view", v)}
          />
        </SettingRow>
        <SettingRow
          label="Display names"
          description="Select how names are displayed in the interface"
        >
          <Select
            value={displayNames}
            options={[
              { value: "full_name", label: "Full name" },
              { value: "first_name", label: "First name" },
              { value: "initials", label: "Initials" },
            ]}
            onChange={(v) => updatePreference("display_names", v)}
          />
        </SettingRow>
        <SettingRow
          label="First day of the week"
          description="Used for date pickers"
        >
          <Select
            value={firstDay}
            options={[
              { value: "monday", label: "Monday" },
              { value: "sunday", label: "Sunday" },
              { value: "saturday", label: "Saturday" },
            ]}
            onChange={(v) => updatePreference("first_day_of_week", v)}
          />
        </SettingRow>
        <SettingRow
          label="Convert text emoticons into emojis"
          description="Strings like :) will be converted to emoji"
        >
          <Toggle checked={emoticons} onChange={(v) => updatePreference("emoticons", v)} />
        </SettingRow>
      </SettingSection>

      {/* Interface and theme */}
      <SettingSection title="Interface and theme">
        <SettingRow
          label="Font size"
          description="Adjust the size of text across the app"
        >
          <Select
            value={fontSize}
            options={[
              { value: "small", label: "Small" },
              { value: "default", label: "Default" },
              { value: "large", label: "Large" },
            ]}
            onChange={(v) => updatePreference("font_size", v)}
          />
        </SettingRow>
        <SettingRow
          label="Use pointer cursors"
          description="Change the cursor to a pointer when hovering over interactive elements"
        >
          <Toggle checked={pointerCursors} onChange={(v) => updatePreference("pointer_cursors", v)} />
        </SettingRow>
        <SettingRow
          label="Interface theme"
          description="Select or customize your interface color scheme"
        >
          <div className="flex gap-2">
            {themes.map((theme) => {
              const Icon = theme.icon;
              const active = activeTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-all ${
                    active
                      ? "border-[#00E676]/40 bg-[rgba(0,230,118,0.06)] text-zinc-200"
                      : "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-400"
                  }`}
                >
                  <Icon size={12} />
                  {theme.label}
                </button>
              );
            })}
          </div>
        </SettingRow>
      </SettingSection>

      {/* Desktop application */}
      <SettingSection title="Desktop application">
        <SettingRow
          label="App notification badge"
          description="Show a badge on the app icon to indicate unread notifications"
        >
          <Select
            value={notifBadge}
            options={[
              { value: "unread", label: "Unread indicator" },
              { value: "count", label: "Count" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => updatePreference("notification_badge", v)}
          />
        </SettingRow>
        <SettingRow
          label="Check spelling"
          description="Check for spelling errors while typing"
        >
          <Toggle checked={spellCheck} onChange={(v) => updatePreference("spell_check", v)} />
        </SettingRow>
      </SettingSection>

      {/* Automations */}
      <SettingSection title="Automations and workflows">
        <SettingRow
          label="Auto-assign to self"
          description="When creating new jobs, always assign them to yourself by default"
        >
          <Toggle checked={autoAssign} onChange={(v) => updatePreference("auto_assign", v)} />
        </SettingRow>
        <SettingRow
          label="On status change, move to started"
          description="After changing job status, move the job to the team's first started workflow status"
        >
          <Toggle checked={moveStarted} onChange={(v) => updatePreference("move_started", v)} />
        </SettingRow>
        <SettingRow
          label="On move to started, assign to yourself"
          description="When you move an unassigned job to started, it will be automatically assigned to you"
        >
          <Toggle checked={assignStarted} onChange={(v) => updatePreference("assign_started", v)} />
        </SettingRow>
      </SettingSection>
    </>
  );
}
