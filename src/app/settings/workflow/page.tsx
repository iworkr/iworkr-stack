"use client";

import { Toggle, SettingRow, SettingSection, Select } from "@/components/settings/settings-toggle";
import { useSettingsStore } from "@/lib/stores/settings-store";

export default function WorkflowPage() {
  const { orgSettings, updateOrgSettingsField } = useSettingsStore();

  const defaultJobDuration = orgSettings?.default_job_duration_mins ?? 60;
  const travelBuffer = orgSettings?.travel_buffer_mins ?? 15;
  const defaultPriority = orgSettings?.default_priority || "medium";
  const autoRoute = orgSettings?.auto_route !== false;
  const showTravelTime = orgSettings?.show_travel_time !== false;

  return (
    <>
      <h1 className="mb-2 text-2xl font-medium tracking-tight text-zinc-100">Workflow</h1>
      <p className="mb-6 text-[13px] text-zinc-600">Configure how jobs flow through your workspace.</p>

      <SettingSection title="Scheduling">
        <SettingRow label="Default job duration (minutes)" description="How long a standard job takes by default">
          <input
            type="number"
            min={15}
            max={480}
            step={15}
            value={defaultJobDuration}
            onChange={(e) => updateOrgSettingsField("default_job_duration_mins", parseInt(e.target.value) || 60)}
            className="w-[100px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
          />
        </SettingRow>
        <SettingRow label="Travel time buffer (minutes)" description="Buffer between consecutive jobs for travel">
          <input
            type="number"
            min={0}
            max={120}
            step={5}
            value={travelBuffer}
            onChange={(e) => updateOrgSettingsField("travel_buffer_mins", parseInt(e.target.value) || 15)}
            className="w-[100px] rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 text-[13px] text-zinc-200 outline-none transition-colors focus:border-[#00E676]/40"
          />
        </SettingRow>
        <SettingRow label="Auto-route optimization" description="Automatically optimize job routes when dispatching">
          <Toggle checked={autoRoute} onChange={(v) => updateOrgSettingsField("auto_route", v)} />
        </SettingRow>
        <SettingRow label="Show travel time" description="Display estimated travel time between jobs on the schedule">
          <Toggle checked={showTravelTime} onChange={(v) => updateOrgSettingsField("show_travel_time", v)} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Defaults">
        <SettingRow label="Default priority" description="Priority assigned to new jobs by default">
          <Select
            value={defaultPriority}
            onChange={(v) => updateOrgSettingsField("default_priority", v)}
            options={[
              { value: "urgent", label: "Urgent" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
              { value: "none", label: "None" },
            ]}
          />
        </SettingRow>
      </SettingSection>
    </>
  );
}
