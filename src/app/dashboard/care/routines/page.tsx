"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarCheck2, PlusCircle, RefreshCw } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  createRoutineTemplateAction,
  listCareFacilitiesAction,
  listRoutineTemplatesAction,
  triggerDailyTaskGenerationAction,
} from "@/app/actions/care-routines";

type Facility = { id: string; name: string };

type TemplateRow = {
  id: string;
  title: string;
  target_type: "participant" | "facility" | "global";
  task_type: "checkbox" | "number_input" | "photo_required" | "form_trigger";
  is_mandatory: boolean;
  is_critical: boolean;
  schedule_cron: string;
  trigger_mode: "calendar" | "per_shift";
  care_facilities?: { name?: string | null };
  participant_profiles?: { preferred_name?: string | null };
};

export default function CareRoutinesPage() {
  const { orgId } = useOrg();
  const [busy, startBusy] = useTransition();
  const [msg, setMsg] = useState("");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  const [title, setTitle] = useState("");
  const [targetType, setTargetType] = useState<"participant" | "facility" | "global">("facility");
  const [taskType, setTaskType] = useState<"checkbox" | "number_input" | "photo_required" | "form_trigger">(
    "checkbox",
  );
  const [facilityId, setFacilityId] = useState("");
  const [scheduleCron, setScheduleCron] = useState("0 8 * * *");
  const [triggerMode, setTriggerMode] = useState<"calendar" | "per_shift">("calendar");
  const [mandatory, setMandatory] = useState(true);
  const [critical, setCritical] = useState(false);

  async function refresh() {
    if (!orgId) return;
    const [t, f] = await Promise.all([listRoutineTemplatesAction(orgId), listCareFacilitiesAction(orgId)]);
    setTemplates((t || []) as TemplateRow[]);
    setFacilities((f || []).map((x: any) => ({ id: x.id as string, name: x.name as string })));
  }

  useEffect(() => {
    refresh();
  }, [orgId]);

  const byType = useMemo(() => {
    const facility = templates.filter((x) => x.target_type === "facility").length;
    const participant = templates.filter((x) => x.target_type === "participant").length;
    const global = templates.filter((x) => x.target_type === "global").length;
    return { facility, participant, global };
  }, [templates]);

  function onCreateTemplate() {
    if (!orgId || !title.trim()) return;
    startBusy(async () => {
      try {
        await createRoutineTemplateAction({
          organization_id: orgId,
          target_type: targetType,
          facility_id: targetType === "facility" ? facilityId || undefined : undefined,
          title: title.trim(),
          task_type: taskType,
          is_mandatory: mandatory,
          is_critical: critical,
          visible_to_family: false,
          schedule_cron: scheduleCron.trim(),
          trigger_mode: triggerMode,
        });
        setTitle("");
        setMsg("Routine template created.");
        await refresh();
      } catch (error: any) {
        setMsg(error?.message || "Failed to create template.");
      }
    });
  }

  function onGenerateNow() {
    startBusy(async () => {
      try {
        const inserted = await triggerDailyTaskGenerationAction({});
        setMsg(`Daily generation complete (${inserted} new task instances).`);
      } catch (error: any) {
        setMsg(error?.message || "Failed to generate tasks.");
      }
    });
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Project Choreography</p>
          <h1 className="text-lg font-semibold text-zinc-200">Task Definition Builder</h1>
        </div>
        <button className="stealth-btn-secondary" onClick={onGenerateNow} disabled={busy}>
          <RefreshCw size={14} />
          Generate Today Now
        </button>
      </div>

      {msg && (
        <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </div>
      )}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Metric label="Facility Templates" value={String(byType.facility)} />
        <Metric label="Participant Templates" value={String(byType.participant)} />
        <Metric label="Global Templates" value={String(byType.global)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="stealth-panel lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <PlusCircle size={16} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">New Routine Template</h2>
          </div>
          <label className="stealth-label mb-1 block">Title</label>
          <input className="stealth-input mb-3" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="stealth-label mb-1 block">Target Type</label>
          <select
            className="stealth-input mb-3"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "participant" | "facility" | "global")}
          >
            <option value="facility">Facility / House</option>
            <option value="participant">Participant</option>
            <option value="global">Global</option>
          </select>

          {targetType === "facility" && (
            <>
              <label className="stealth-label mb-1 block">Facility</label>
              <select className="stealth-input mb-3" value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                <option value="">Select facility</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="stealth-label mb-1 block">Task Type</label>
          <select
            className="stealth-input mb-3"
            value={taskType}
            onChange={(e) =>
              setTaskType(e.target.value as "checkbox" | "number_input" | "photo_required" | "form_trigger")
            }
          >
            <option value="checkbox">Simple Checkbox</option>
            <option value="number_input">Data Entry (Number)</option>
            <option value="photo_required">Photo Evidence</option>
            <option value="form_trigger">Form Trigger</option>
          </select>

          <label className="stealth-label mb-1 block">Recurrence (CRON)</label>
          <input
            className="stealth-input mb-3 font-mono"
            value={scheduleCron}
            onChange={(e) => setScheduleCron(e.target.value)}
            placeholder="0 8 * * *"
          />

          <label className="stealth-label mb-1 block">Generation Mode</label>
          <select
            className="stealth-input mb-3"
            value={triggerMode}
            onChange={(e) => setTriggerMode(e.target.value as "calendar" | "per_shift")}
          >
            <option value="calendar">Calendar schedule</option>
            <option value="per_shift">Once per matching shift</option>
          </select>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              className={`stealth-btn-secondary justify-center ${mandatory ? "border-emerald-500/35 text-emerald-300" : ""}`}
              onClick={() => setMandatory((x) => !x)}
              type="button"
            >
              Mandatory
            </button>
            <button
              className={`stealth-btn-secondary justify-center ${critical ? "border-rose-500/35 text-rose-300" : ""}`}
              onClick={() => setCritical((x) => !x)}
              type="button"
            >
              Critical
            </button>
          </div>

          <button
            className="stealth-btn-primary w-full justify-center"
            disabled={busy || !orgId || !title.trim() || (targetType === "facility" && !facilityId)}
            onClick={onCreateTemplate}
          >
            Create Template
          </button>
        </section>

        <section className="stealth-panel lg:col-span-8">
          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck2 size={16} className="text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Active Routine Library</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="w-full">
              <thead className="bg-white/[0.02]">
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">CRON</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                      No routine templates yet.
                    </td>
                  </tr>
                ) : (
                  templates.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 text-sm text-zinc-300">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span>{row.title}</span>
                          {row.is_mandatory && (
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              Mandatory
                            </span>
                          )}
                          {row.is_critical && (
                            <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                              Critical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">
                        {row.target_type === "facility"
                          ? row.care_facilities?.name || "Facility"
                          : row.target_type === "participant"
                            ? row.participant_profiles?.preferred_name || "Participant"
                            : "Global"}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{row.task_type}</td>
                      <td className="px-3 py-2 text-zinc-400">{row.trigger_mode}</td>
                      <td className="px-3 py-2 font-mono text-zinc-500">{row.schedule_cron}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className="text-lg font-semibold text-zinc-200">{value}</p>
    </div>
  );
}
