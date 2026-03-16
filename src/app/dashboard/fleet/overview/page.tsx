"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, CarFront, Wrench, ShieldAlert, Play } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { getFleetOverviewAction, runConvoyDailyGroundingAction } from "@/app/actions/fleet-convoy";

export default function FleetOverviewPage() {
  const { orgId } = useOrg();
  const [data, setData] = useState<any>(null);
  const [pending, startTransition] = useTransition();

  const load = async () => {
    if (!orgId) return;
    const res = await getFleetOverviewAction(orgId);
    setData(res);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">PROJECT CONVOY</p>
          <h1 className="text-xl font-semibold text-zinc-100">Fleet Command Center</h1>
        </div>
        <button
          onClick={() => startTransition(async () => {
            await runConvoyDailyGroundingAction();
            await load();
          })}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.12] px-3 py-1.5 text-sm text-zinc-200"
          disabled={pending}
        >
          <Play size={14} />
          Run Daily Health Check
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Metric icon={CarFront} label="Active" value={data?.status_totals?.active ?? 0} />
        <Metric icon={CarFront} label="In Use" value={data?.status_totals?.in_use ?? 0} />
        <Metric icon={Wrench} label="Maintenance" value={data?.status_totals?.maintenance ?? 0} />
        <Metric icon={ShieldAlert} label="Defect OOS" value={data?.status_totals?.out_of_service_defect ?? 0} />
        <Metric icon={AlertTriangle} label="Compliance OOS" value={data?.status_totals?.out_of_service_compliance ?? 0} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-1 text-xs text-zinc-400">30-Day Utilization</p>
          <p className="text-2xl font-semibold text-zinc-100">{data?.utilization_percent_30d ?? 0}%</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="mb-2 text-xs text-zinc-400">Upcoming Expiries (14 days)</p>
          <div className="space-y-2 text-sm text-zinc-200">
            {(data?.upcoming_expiries || []).slice(0, 6).map((v: any) => (
              <div key={v.id} className="rounded border border-white/[0.06] px-2 py-1">
                {v.name} ({v.registration_number})
              </div>
            ))}
            {(!data?.upcoming_expiries || data.upcoming_expiries.length === 0) && (
              <p className="text-zinc-500">No upcoming expiries.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="mb-2 text-xs font-medium tracking-wider text-emerald-300 uppercase">Vacancy Alerts</p>
        {(data?.vacancy_signals || []).length === 0 ? (
          <p className="text-sm text-zinc-400">No current facility capacity opportunities detected.</p>
        ) : (
          <div className="space-y-2">
            {data.vacancy_signals.map((v: any) => (
              <div key={v.facility_id} className="text-sm text-zinc-200">
                Vacancy detected at {v.facility_name} ({v.active_count}/{v.capacity}) with {v.waitlist_count} waitlist lead(s).
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-2 text-zinc-400">
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
