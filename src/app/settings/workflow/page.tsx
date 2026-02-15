"use client";

import { Toggle, SettingRow, SettingSection, Select } from "@/components/settings/settings-toggle";
import { SaveToast, useSaveToast } from "@/components/settings/save-toast";
import { useState } from "react";

export default function WorkflowPage() {
  const { visible, showSaved } = useSaveToast();
  const [autoRoute, setAutoRoute] = useState(true);
  const [travelTime, setTravelTime] = useState(true);
  const [defaultPriority, setDefaultPriority] = useState("medium");

  function toggle(setter: (v: boolean) => void, current: boolean) { setter(!current); showSaved(); }

  return (
    <>
      <h1 className="mb-2 text-2xl font-medium tracking-tight text-zinc-100">Workflow</h1>
      <p className="mb-6 text-[13px] text-zinc-600">Configure how jobs flow through your workspace.</p>

      <SettingSection title="Scheduling">
        <SettingRow label="Auto-route optimization" description="Automatically optimize job routes when dispatching">
          <Toggle checked={autoRoute} onChange={() => toggle(setAutoRoute, autoRoute)} />
        </SettingRow>
        <SettingRow label="Show travel time" description="Display estimated travel time between jobs on the schedule">
          <Toggle checked={travelTime} onChange={() => toggle(setTravelTime, travelTime)} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Defaults">
        <SettingRow label="Default priority" description="Priority assigned to new jobs by default">
          <Select value={defaultPriority} onChange={(v) => { setDefaultPriority(v); showSaved(); }} options={[
            { value: "urgent", label: "Urgent" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
            { value: "none", label: "None" },
          ]} />
        </SettingRow>
      </SettingSection>

      <SaveToast visible={visible} />
    </>
  );
}
