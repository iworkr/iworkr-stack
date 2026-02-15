"use client";

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Toggle, SettingRow, SettingSection, Select } from "@/components/settings/settings-toggle";
import { SaveToast, useSaveToast } from "@/components/settings/save-toast";

const themes = [
  { id: "system", label: "System", icon: Monitor },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
];

export default function PreferencesPage() {
  const { visible, showSaved } = useSaveToast();

  const [activeTheme, setActiveTheme] = useState("dark");
  const [homeView, setHomeView] = useState("active_jobs");
  const [displayNames, setDisplayNames] = useState("full_name");
  const [firstDay, setFirstDay] = useState("monday");
  const [emoticons, setEmoticons] = useState(true);
  const [pointerCursors, setPointerCursors] = useState(false);
  const [fontSize, setFontSize] = useState("default");
  const [openDesktop, setOpenDesktop] = useState(false);
  const [notifBadge, setNotifBadge] = useState("unread");
  const [spellCheck, setSpellCheck] = useState(true);
  const [autoAssign, setAutoAssign] = useState(false);
  const [moveStarted, setMoveStarted] = useState(false);
  const [assignStarted, setAssignStarted] = useState(false);

  function toggle(setter: (v: boolean) => void, current: boolean) {
    setter(!current);
    showSaved();
  }

  function change<T>(setter: (v: T) => void, value: T) {
    setter(value);
    showSaved();
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
          description="Select which view to display when launching iWorkr"
        >
          <Select
            value={homeView}
            options={[
              { value: "active_jobs", label: "Active jobs" },
              { value: "dashboard", label: "Dashboard" },
              { value: "inbox", label: "Inbox" },
            ]}
            onChange={(v) => change(setHomeView, v)}
          />
        </SettingRow>
        <SettingRow
          label="Display names"
          description="Select how names are displayed in the iWorkr interface"
        >
          <Select
            value={displayNames}
            options={[
              { value: "full_name", label: "Full name" },
              { value: "first_name", label: "First name" },
              { value: "initials", label: "Initials" },
            ]}
            onChange={(v) => change(setDisplayNames, v)}
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
            onChange={(v) => change(setFirstDay, v)}
          />
        </SettingRow>
        <SettingRow
          label="Convert text emoticons into emojis"
          description="Strings like :) will be converted to emoji"
        >
          <Toggle checked={emoticons} onChange={() => toggle(setEmoticons, emoticons)} />
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
            onChange={(v) => change(setFontSize, v)}
          />
        </SettingRow>
        <SettingRow
          label="Use pointer cursors"
          description="Change the cursor to a pointer when hovering over interactive elements"
        >
          <Toggle checked={pointerCursors} onChange={() => toggle(setPointerCursors, pointerCursors)} />
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
                  onClick={() => change(setActiveTheme, theme.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] transition-all ${
                    active
                      ? "border-white/30 bg-[rgba(255,255,255,0.06)] text-zinc-200"
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
          label="Open in desktop app"
          description="Automatically open links in desktop app when possible"
        >
          <Toggle checked={openDesktop} onChange={() => toggle(setOpenDesktop, openDesktop)} />
        </SettingRow>
        <SettingRow
          label="App notification badge"
          description="Show a badge on iWorkr's icon to indicate unread notifications"
        >
          <Select
            value={notifBadge}
            options={[
              { value: "unread", label: "Unread indicator" },
              { value: "count", label: "Count" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => change(setNotifBadge, v)}
          />
        </SettingRow>
        <SettingRow
          label="Check spelling"
          description="Check for spelling errors while typing"
        >
          <Toggle checked={spellCheck} onChange={() => toggle(setSpellCheck, spellCheck)} />
        </SettingRow>
      </SettingSection>

      {/* Automations */}
      <SettingSection title="Automations and workflows">
        <SettingRow
          label="Auto-assign to self"
          description="When creating new jobs, always assign them to yourself by default"
        >
          <Toggle checked={autoAssign} onChange={() => toggle(setAutoAssign, autoAssign)} />
        </SettingRow>
        <SettingRow
          label="On status change, move to started"
          description="After changing job status, move the job to the team's first started workflow status"
        >
          <Toggle checked={moveStarted} onChange={() => toggle(setMoveStarted, moveStarted)} />
        </SettingRow>
        <SettingRow
          label="On move to started, assign to yourself"
          description="When you move an unassigned job to started, it will be automatically assigned to you"
        >
          <Toggle checked={assignStarted} onChange={() => toggle(setAssignStarted, assignStarted)} />
        </SettingRow>
      </SettingSection>

      <SaveToast visible={visible} />
    </>
  );
}
